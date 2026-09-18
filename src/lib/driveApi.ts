import { DriveFileItem, DriveFolderItem, ContentStatus } from '../types';
import { extractTextFromPdf } from './pdfTextExtractor';

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const EMPTY_MD5 = 'd41d8cd98f00b204e9800998ecf8427e';

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
 * Lists all folders in user's Google Drive.
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
 * Never hashes empty data to prevent false duplicate collisions.
 */
export async function computeHash(data: string | ArrayBuffer): Promise<string> {
  if (typeof data === 'string' && data.length === 0) return '';
  if (data instanceof ArrayBuffer && data.byteLength === 0) return '';
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (buffer.byteLength === 0) return '';
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === EMPTY_SHA256 ? '' : hex;
}

/**
 * Searches for a folder by name in user's Google Drive.
 * Strictly skips any folder named "Craft".
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
    (f: { id: string; name: string }) => f.name && f.name.toLowerCase() !== 'craft'
  );

  return folders.length > 0 ? folders[0] : null;
}

/**
 * Lists all files inside a folder (and its subfolders).
 * Recursively traverses every level of subfolders (whether scanning Entire Drive from root or a specific folder).
 *
 * CRITICAL SAFETY REQUIREMENT:
 * The folder named "Craft" must be skipped entirely at EVERY level of the recursive traversal —
 * if "Craft" appears anywhere in the folder tree, including nested inside another folder,
 * it and everything inside it must never be read, listed, or referenced.
 */
export async function listAllFilesInFolder(
  folderId: string,
  accessToken: string,
  onProgress?: (count: number, currentFolder: string) => void,
  initialFolderName?: string
): Promise<DriveFileItem[]> {
  const collectedFiles: DriveFileItem[] = [];
  const foldersToProcess: { id: string; name: string }[] = [
    { id: folderId, name: initialFolderName || (folderId === 'root' ? 'Entire Drive' : 'root') },
  ];
  const visitedFolderIds = new Set<string>();

  while (foldersToProcess.length > 0) {
    const current = foldersToProcess.shift()!;

    // Prevent cycle loops
    if (visitedFolderIds.has(current.id)) {
      continue;
    }
    visitedFolderIds.add(current.id);

    // CRITICAL SAFETY REQUIREMENT: Skip "Craft" folder at every level of recursive crawl
    if (current.name && current.name.toLowerCase() === 'craft') {
      console.log('Skipping "Craft" folder during recursive traversal:', current.id);
      continue;
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
        console.warn(`Failed to list files in folder ${current.name} (${current.id}): ${res.status}`);
        break;
      }

      const data = await res.json();
      const files: any[] = data.files || [];

      for (const file of files) {
        // CRITICAL SAFETY REQUIREMENT: If "Craft" appears anywhere in folder tree, skip completely
        if (file.name && file.name.toLowerCase() === 'craft') {
          console.log('Skipping "Craft" item in listing:', file.id);
          continue;
        }

        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Subfolder to explore recursively - ensure not visited
          if (!visitedFolderIds.has(file.id)) {
            foldersToProcess.push({ id: file.id, name: file.name });
          }
        } else {
          // CRITICAL EXCLUSION: 00_README.txt is fully excluded from scan and reports
          if (/^(?:00_)?readme\.txt$/i.test(file.name?.trim() || '')) {
            console.log('Skipping protected key file from scan listing:', file.name);
            continue;
          }

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
 * Reads file content and honestly tracks whether substantive text was extracted.
 * Handles Google Docs (export to text/plain), Sheets (export to text/csv),
 * Slides (export to text/plain), standard plain-text / markdown, PDFs, or binary files.
 *
 * For PDFs: attempts real text extraction via extractTextFromPdf; if the PDF has no
 * extractable text (e.g. scanned image) or extraction fails, marks contentStatus as 'unavailable'.
 * For images, archives, and unextractable binaries: marks contentStatus as 'unavailable'
 * and never sets placeholder text or fabricated similarity.
 */
export async function readFileContent(
  file: DriveFileItem,
  accessToken: string
): Promise<{
  text?: string;
  hash: string;
  contentStatus: ContentStatus;
  extractedWordCount: number;
  sizeBytes?: number;
}> {
  let textContent: string | undefined = undefined;
  let hash = '';
  let contentStatus: ContentStatus = 'unavailable';
  let extractedWordCount = 0;
  let sizeBytes: number | undefined = undefined;

  try {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/plain`;
      const res = await driveFetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const raw = await res.text();
        const trimmed = raw.trim();
        if (trimmed.length >= 15) {
          const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
          textContent = trimmed;
          hash = await computeHash(trimmed);
          contentStatus = words.length >= 3 ? 'extracted' : 'unavailable';
          extractedWordCount = words.length;
        } else if (trimmed.length === 0) {
          contentStatus = 'empty';
        } else {
          textContent = trimmed;
          hash = await computeHash(trimmed);
          contentStatus = 'extracted';
          extractedWordCount = trimmed.split(/\s+/).length;
        }
      }
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/csv`;
      const res = await driveFetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const raw = await res.text();
        const trimmed = raw.trim();
        if (trimmed.length >= 10) {
          const words = trimmed.split(/[\s,;]+/).filter((w) => w.length >= 2);
          textContent = trimmed;
          hash = await computeHash(trimmed);
          contentStatus = 'extracted';
          extractedWordCount = words.length;
        } else if (trimmed.length === 0) {
          contentStatus = 'empty';
        }
      }
    } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
      const exportUrl = `${DRIVE_API_BASE}/files/${file.id}/export?mimeType=text/plain`;
      const res = await driveFetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const raw = await res.text();
        const trimmed = raw.trim();
        if (trimmed.length >= 15) {
          const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
          textContent = trimmed;
          hash = await computeHash(trimmed);
          contentStatus = 'extracted';
          extractedWordCount = words.length;
        } else if (trimmed.length === 0) {
          contentStatus = 'empty';
        }
      }
    } else {
      // Regular files: text, markdown, PDF, image, archive, etc.
      const isPdf =
        file.mimeType === 'application/pdf' ||
        /\.pdf$/i.test(file.name);

      const isText =
        file.mimeType.startsWith('text/') ||
        file.name.match(/\.(txt|md|markdown|csv|tsv|json|js|ts|tsx|jsx|py|html|xml|log|css|yaml|yml|sh|env|sql)$/i);

      const url = `${DRIVE_API_BASE}/files/${file.id}?alt=media`;
      const res = await driveFetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        if (isPdf) {
          // Attempt real text extraction from PDF
          const buffer = await res.arrayBuffer();
          sizeBytes = buffer.byteLength;
          if (buffer.byteLength > 0) {
            hash = await computeHash(buffer);
            const { text: pdfText, success } = await extractTextFromPdf(buffer);
            if (success && pdfText.trim().length >= 20) {
              textContent = pdfText;
              contentStatus = 'extracted';
              extractedWordCount = pdfText.split(/\s+/).length;
            } else {
              // Scanned image or unextractable text in PDF
              contentStatus = 'unavailable';
              textContent = undefined;
            }
          } else {
            contentStatus = 'empty';
          }
        } else if (isText) {
          const raw = await res.text();
          const trimmed = raw.trim();
          if (trimmed.length >= 15) {
            const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
            textContent = trimmed;
            hash = await computeHash(trimmed);
            contentStatus = words.length >= 2 ? 'extracted' : 'unavailable';
            extractedWordCount = words.length;
          } else if (trimmed.length === 0) {
            contentStatus = 'empty';
          } else {
            textContent = trimmed;
            hash = await computeHash(trimmed);
            contentStatus = 'extracted';
            extractedWordCount = trimmed.split(/\s+/).length;
          }
        } else {
          // Images (PNG/JPG), archives (ZIP), binary media
          const buffer = await res.arrayBuffer();
          sizeBytes = buffer.byteLength;
          if (buffer.byteLength > 0) {
            hash = await computeHash(buffer);
          }
          contentStatus = buffer.byteLength === 0 ? 'empty' : 'unavailable';
          textContent = undefined; // Never fabricate placeholder strings
        }
      } else {
        // Direct media download failed
        contentStatus = 'unavailable';
        textContent = undefined;
        hash = file.md5Checksum && file.md5Checksum !== EMPTY_MD5 ? file.md5Checksum : '';
      }
    }
  } catch (err) {
    console.warn(`Error reading content of "${file.name}":`, err);
    contentStatus = 'unavailable';
    textContent = undefined;
    hash = file.md5Checksum && file.md5Checksum !== EMPTY_MD5 ? file.md5Checksum : '';
  }

  // Filter out empty hashes to prevent false collisions
  if (hash === EMPTY_SHA256 || hash === EMPTY_MD5) {
    hash = '';
  }

  return {
    text: textContent,
    hash,
    contentStatus,
    extractedWordCount,
    sizeBytes,
  };
}

/**
 * Parses Google Drive API error responses into specific, diagnosable error descriptions.
 */
export function parseDriveError(status: number, rawText: string, fileId?: string): string {
  let parsedMessage = '';
  let reason = '';
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.error) {
      parsedMessage = parsed.error.message || '';
      if (Array.isArray(parsed.error.errors) && parsed.error.errors.length > 0) {
        reason = parsed.error.errors[0].reason || '';
        if (!parsedMessage && parsed.error.errors[0].message) {
          parsedMessage = parsed.error.errors[0].message;
        }
      }
    }
  } catch {
    parsedMessage = rawText.slice(0, 150);
  }

  if (status === 403) {
    if (reason === 'insufficientFilePermissions' || /permission/i.test(parsedMessage)) {
      return `Permission Denied (403): You do not have write/trash permission for this file (it may be read-only or owned by another user)`;
    }
    if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return `Rate Limit Exceeded (403): Google Drive API rate limit reached, please try again shortly`;
    }
    return `Access Denied (403): ${parsedMessage || 'Permission denied by Google Drive'}`;
  }

  if (status === 404) {
    return `File Not Found (404): File no longer exists in Google Drive or was already deleted`;
  }

  if (status === 401) {
    return `Authentication Expired (401): Google Drive session expired. Please refresh your Google login`;
  }

  if (status === 400) {
    return `Invalid Request (400): ${parsedMessage || 'Google Drive rejected request parameters'}`;
  }

  if (status >= 500) {
    return `Drive Service Unavailable (${status}): Temporary Google Drive server error`;
  }

  return parsedMessage ? `HTTP Error ${status}: ${parsedMessage}` : `HTTP Error ${status}`;
}

/**
 * Moves a file to Google Drive Trash (safe operation, not permanent deletion).
 */
export async function moveFileToTrash(
  fileId: string,
  accessToken: string
): Promise<boolean> {
  const url = `${DRIVE_API_BASE}/files/${fileId}`;
  try {
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
      const specificError = parseDriveError(res.status, errText, fileId);
      throw new Error(specificError);
    }

    return true;
  } catch (err: any) {
    if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
      throw new Error('Network Error: Unable to reach Google Drive API. Please check your internet connection.');
    }
    throw err;
  }
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
