import { DriveFileItem, FileTypeFilter } from '../types';

/**
 * Evaluates whether a Google Drive file matches the chosen file type filter.
 */
export function isFileMatchingFilter(
  file: DriveFileItem,
  filter: FileTypeFilter,
  customExtensions: string[]
): boolean {
  if (filter === 'all') return true;

  const name = (file.name || '').toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();

  if (filter === 'documents') {
    return (
      mime.includes('document') ||
      mime.includes('text') ||
      /\.(docx?|odt|rtf|txt|md|pages|gdoc)$/i.test(name)
    );
  }

  if (filter === 'markdown_text') {
    return (
      mime.includes('text/plain') ||
      mime.includes('text/markdown') ||
      /\.(md|markdown|txt|text|mdown|mkdn)$/i.test(name)
    );
  }

  if (filter === 'office') {
    return (
      mime.includes('document') ||
      mime.includes('spreadsheet') ||
      mime.includes('presentation') ||
      /\.(docx?|xlsx?|pptx?|csv|gdoc|gsheet|gslides)$/i.test(name)
    );
  }

  if (filter === 'custom') {
    if (!customExtensions || customExtensions.length === 0) return true;
    return customExtensions.some((ext) => {
      const clean = ext.trim().toLowerCase();
      if (!clean) return false;
      const normalizedExt = clean.startsWith('.') ? clean : `.${clean}`;
      return name.endsWith(normalizedExt);
    });
  }

  return true;
}

export const COMMON_EXTENSIONS = [
  '.docx',
  '.md',
  '.txt',
  '.pdf',
  '.xlsx',
  '.pptx',
  '.csv',
  '.json',
];
