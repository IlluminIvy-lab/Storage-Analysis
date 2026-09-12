import { DriveFileItem, DriveFolderItem } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Custom fetch wrapper for Drive API calls that detects 401 Unauthorized
 * and dispatches a 'drive_auth_expired' event so the app can gracefully prompt
 * for a token refresh without losing user session or state.
 */
async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drive_auth_expired', { detail: { status: 401 } }));
    }
  }
  return res;
}

/**
 * Lists all folders in user's Google Drive, strictly skipping "Craft" folder.
 */
export async function listDriveFolders(accessToken: string): Promise<DriveFolderItem[]> {
  const folders: DriveFolderItem[] = [];
  let pageToken: string | null = null;

  try {
    do {
      const q = encodeURIComponent(
        "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
      );
      let url = `${DRIVE_API_BASE}/files?q=${q}&fields=nextPageToken,files(id,name,parents,modifiedTime)&pageSize=100&orderBy=name asc`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await driveFetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Failed to list folders from Drive: ${res.status} - ${err}`);
        break;
      }

      const data = await res.json();
      for (const f of data.files || []) {
        // Strict safety rule: ALWAYS skip "Craft" folder entirely, no exceptions
        if (f.name && f.name.toLowerCase() === 'craft') {
          continue;
        }
        folders.push({
          id: f.id,
          name: f.name,
          parentId: f.parents && f.parents.length > 0 ? f.parents[0] : undefined,
          modifiedTime: f.modifiedTime,
        });
      }
      pageToken = data.nextPageToken || null;
    } while (pageToken);
  } catch (err) {
    console.error('Error fetching drive folders:', err);
  }

  return folders;
}

/**
 * Computes a SHA-256 hex string for a given text or ArrayBuffer in the browser.
 */
export async function computeHash(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Searches for a folder by name, strictly skipping any folder named "Craft".
 */
export async function findFolderByName(
  folderName: string,
  accessToken: string
): Promise<{ id: string; name: string } | null> {
  if (folderName.toLowerCase() === 'craft') {
    throw new Error('Access to the "Craft" folder is strictly restricted per policy.');
  }

  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`
  );
  const url = `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)&pageSize=10`;

  const response = await driveFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to find folder "${folderName}": ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const folders = (data.files || []).filter(
    (f: { id: string; name: string }) => f.name.toLowerCase() !== 'craft'
  );

  return folders.length > 0 ? folders[0] : null;
}

/**
 * Lists all files inside a folder (and its subfolders), strictly skipping:
 * 1. Any folder named "Craft"
 * 2. Any file named "00_README.txt"
 */
export async function listAllFilesInFolder(
  folderId: string,
  accessToken: string,
  onProgress?: (count: number, currentFolder: string) => void
): Promise<DriveFileItem[]> {
  const collectedFiles: DriveFileItem[] = [];
  const foldersToProcess: { id: string; name: string }[] = [{ id: folderId, name: 'root' }];

  while (foldersToProcess.length > 0) {
    const current = foldersToProcess.shift()!;
    if (current.name.toLowerCase() === 'craft') {
      continue; // Skip Craft folder completely
    }

    let pageToken: string | null = null;
    do {
      const q = encodeURIComponent(`'${current.id}' in parents and trashed = false`);
      let url = `${DRIVE_API_BASE}/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum,parents)&pageSize=100`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await driveFetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to list files in folder ${current.name}: ${res.status}`);
      }

      const data = await res.json();
      const files: any[] = data.files || [];

      for (const file of files) {
        // Strict exemption 1: "Craft" folder
        if (file.name.toLowerCase() === 'craft') {
          continue;
        }

        // Strict exemption 2: "00_README.txt" answer key
        if (file.name.toLowerCase() === '00_readme.txt') {
          console.log('Skipping 00_README.txt per instructions (answer key).');
          continue;
        }

        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Subfolder to explore
          foldersToProcess.push({ id: file.id, name: file.name });
        } else {
          collectedFiles.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
            size: file.size,
            md5Checksum: file.md5Checksum,
            parents: file.parents,
          });
        }
      }

      pageToken = data.nextPageToken || null;
      if (onProgress) {
        onProgress(collectedFiles.length, current.name);
      }
    } while (pageToken);
  }

  return collectedFiles;
}

/**
 * Reads file content.
 * Handles Google Docs (export to text/plain), Sheets (export to text/csv),
 * Slides (export to text/plain), or standard binary/text files.
 */
export async function readFileContent(
  file: DriveFileItem,
  accessToken: string
): Promise<{ text: string; hash: string }> {
  // Safety check
  if (file.name.toLowerCase() === '00_readme.txt') {
    throw new Error('Access to 00_README.txt is strictly forbidden.');
  }

  let textContent = '';
  let hash = '';

  if (file.mimeType === 'application/vnd.google-apps.document') {
    const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/plain`;
    const res = await driveFetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      textContent = await res.text();
      hash = await computeHash(textContent);
    }
  } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/csv`;
    const res = await driveFetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      textContent = await res.text();
      hash = await computeHash(textContent);
    }
  } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
    const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/plain`;
    const res = await driveFetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      textContent = await res.text();
      hash = await computeHash(textContent);
    }
  } else {
    // Regular text or binary media
    const url = `${DRIVE_API_BASE}/files/${file.id}?alt=media`;
    const res = await driveFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const isText =
        contentType.includes('text') ||
        contentType.includes('json') ||
        contentType.includes('xml') ||
        contentType.includes('javascript') ||
        file.name.match(/\.(txt|md|csv|json|js|ts|py|html|xml|log|css|yaml|yml)$/i);

      if (isText) {
        textContent = await res.text();
        hash = await computeHash(textContent);
      } else {
        // Binary file: compute hash from ArrayBuffer
        const buffer = await res.arrayBuffer();
        hash = await computeHash(buffer);
        textContent = `[Binary content, ${buffer.byteLength} bytes]`;
      }
    } else {
      // If direct download failed, fallback to md5Checksum or empty
      hash = file.md5Checksum || (await computeHash(`${file.name}-${file.size}`));
      textContent = `[Unable to read content: ${res.status}]`;
    }
  }

  return { text: textContent, hash };
}

/**
 * Moves a file to Google Drive Trash (safe operation, not permanent deletion).
 */
export async function moveFileToTrash(
  fileId: string,
  accessToken: string
): Promise<boolean> {
  const url = `${DRIVE_API_BASE}/files/${fileId}`;
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to move file ${fileId} to trash: ${res.status} - ${errText}`);
  }

  return true;
}

/**
 * Restores a file from Google Drive Trash.
 */
export async function restoreFileFromTrash(
  fileId: string,
  accessToken: string
): Promise<boolean> {
  const url = `${DRIVE_API_BASE}/files/${fileId}`;
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: false }),
  });

  if (!res.ok) {
    throw new Error(`Failed to restore file ${fileId}: ${res.status}`);
  }

  return true;
}

/**
 * Lists files currently in Google Drive Trash.
 */
export async function listFilesInTrash(
  accessToken: string,
  maxResults = 100
): Promise<DriveFileItem[]> {
  const q = encodeURIComponent('trashed = true');
  const url = `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,size,md5Checksum,trashed,parents)&pageSize=${maxResults}&orderBy=modifiedTime desc`;

  const res = await driveFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list files in trash: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  return (data.files || []).map((file: any) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime || new Date().toISOString(),
    size: file.size,
    md5Checksum: file.md5Checksum,
    parents: file.parents,
    trashed: true,
  }));
}

/**
 * Renames a Google Drive file.
 */
export async function renameFile(
  fileId: string,
  newName: string,
  accessToken: string
): Promise<boolean> {
  const url = `${DRIVE_API_BASE}/files/${fileId}`;
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to rename file: ${res.status} - ${errText}`);
  }

  return true;
}

/**
 * Moves a file to another folder in Google Drive.
 */
export async function moveFileToFolder(
  fileId: string,
  targetFolderId: string,
  currentParentId: string | undefined,
  accessToken: string
): Promise<boolean> {
  let url = `${DRIVE_API_BASE}/files/${fileId}?addParents=${targetFolderId}`;
  if (currentParentId) {
    url += `&removeParents=${currentParentId}`;
  }

  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to move file to folder: ${res.status} - ${errText}`);
  }

  return true;
}
