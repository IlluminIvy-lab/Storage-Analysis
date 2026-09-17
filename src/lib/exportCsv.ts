import { CleanupReport } from '../types';
import { formatBytes, getEstimatedFileSize } from './formatters';

/**
 * Escapes a field for RFC 4180 CSV compliance.
 */
function escapeCsv(val: any): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates and downloads a clean CSV file from a CleanupReport.
 */
export function exportReportToCsv(report: CleanupReport): void {
  const lines: string[] = [];

  // Metadata & Summary Block
  lines.push(`${escapeCsv('DRIVE CLEANUP AGENT - SUMMARY REPORT')}`);
  lines.push(`${escapeCsv('Folder Name')},${escapeCsv(report.folderName)}`);
  lines.push(`${escapeCsv('Report Timestamp')},${escapeCsv(report.timestamp)}`);
  lines.push(`${escapeCsv('Total Files Reviewed')},${escapeCsv(report.totalFilesReviewed)}`);
  lines.push(`${escapeCsv('Total Trashed Files')},${escapeCsv(report.totalTrashed)}`);
  lines.push(`${escapeCsv('Exact Duplicates Trashed')},${escapeCsv(report.totalExactDuplicates)}`);
  lines.push(`${escapeCsv('Older Draft Versions Trashed')},${escapeCsv(report.totalVersionDrafts)}`);
  lines.push(`${escapeCsv('Flagged Uncertain (Kept)')},${escapeCsv(report.uncertainFiles.length)}`);
  lines.push(`${escapeCsv('Unique / Latest Kept')},${escapeCsv(report.totalUniqueKept)}`);

  if (report.metrics) {
    lines.push(`${escapeCsv('Estimated Space Reclaimed')},${escapeCsv(formatBytes(report.metrics.totalBytesReclaimed))}`);
    lines.push(`${escapeCsv('Duplication Rate (%)')},${escapeCsv(report.metrics.duplicationRate + '%')}`);
    lines.push(`${escapeCsv('Average Similarity (%)')},${escapeCsv(report.metrics.avgSimilarity + '%')}`);
    lines.push(`${escapeCsv('Scan Duration (ms)')},${escapeCsv(report.metrics.scanDurationMs)}`);
    lines.push(`${escapeCsv('Processing Speed')},${escapeCsv(report.metrics.scanSpeedFilesPerSec + ' files/sec')}`);
  }
  lines.push(`${escapeCsv('Policy Enforcement')},${escapeCsv('Non-destructive Drive Trash; 30-day recovery; User-approved actions only; Session undo active')}`);
  lines.push(''); // Blank separator line

  // Detailed File Table Header
  const headers = [
    'Category',
    'File Name',
    'File ID',
    'Size (Bytes)',
    'Size (Formatted)',
    'MIME Type',
    'Modified Date',
    'Duplicate / Draft OF (Name)',
    'Duplicate / Draft OF (ID)',
    'Duplicate / Draft OF (Modified)',
    'Signal Used (Content vs Timestamp)',
    'Content Similarity (%)',
    'Reason / Action Details',
    'Drive Trash Status',
    'Folder',
    'Scan Timestamp',
  ];
  lines.push(headers.map(escapeCsv).join(','));

  // 1. Trashed Files
  report.trashedFiles.forEach((item) => {
    const sizeBytes = getEstimatedFileSize(item.trashedFile);
    const category = item.type === 'exact' ? 'Trashed - Exact Duplicate' : 'Trashed - Older Draft Version';
    const statusText = item.trashedSuccess ? 'Moved to Drive Trash' : `Failed to Trash: ${item.error || 'Unknown error'}`;
    const signalLabel = item.signalUsed === 'content_statement'
      ? 'Content Statement'
      : item.signalUsed === 'modified_timestamp'
      ? 'Modified Timestamp'
      : item.reason.includes('Signal used: Content') ? 'Content Statement' : 'Modified Timestamp';

    lines.push([
      escapeCsv(category),
      escapeCsv(item.trashedFile.name),
      escapeCsv(item.trashedFile.id),
      escapeCsv(sizeBytes),
      escapeCsv(formatBytes(sizeBytes)),
      escapeCsv(item.trashedFile.mimeType),
      escapeCsv(new Date(item.trashedFile.modifiedTime).toISOString()),
      escapeCsv(item.keptOriginalFile.name),
      escapeCsv(item.keptOriginalFile.id),
      escapeCsv(new Date(item.keptOriginalFile.modifiedTime).toISOString()),
      escapeCsv(signalLabel),
      escapeCsv(Math.round(item.similarity * 100)),
      escapeCsv(item.reason),
      escapeCsv(statusText),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  // 2. Uncertain Files
  report.uncertainFiles.forEach((item) => {
    const sizeBytes = getEstimatedFileSize(item.fileB);
    lines.push([
      escapeCsv('Flagged Uncertain - Safely Kept'),
      escapeCsv(item.fileB.name),
      escapeCsv(item.fileB.id),
      escapeCsv(sizeBytes),
      escapeCsv(formatBytes(sizeBytes)),
      escapeCsv(item.fileB.mimeType),
      escapeCsv(new Date(item.fileB.modifiedTime).toISOString()),
      escapeCsv(item.fileA.name),
      escapeCsv(item.fileA.id),
      escapeCsv(new Date(item.fileA.modifiedTime).toISOString()),
      escapeCsv('None (Uncertain / Conflicting)'),
      escapeCsv(Math.round(item.similarity * 100)),
      escapeCsv(`Flagged: ${item.reason} - Kept in place without action per strict safety threshold`),
      escapeCsv('Active in Drive (Untouched)'),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  // 3. Kept / Unique Files
  report.keptFiles.forEach((file) => {
    const sizeBytes = getEstimatedFileSize(file);
    lines.push([
      escapeCsv('Kept - Unique / Latest Version'),
      escapeCsv(file.name),
      escapeCsv(file.id),
      escapeCsv(sizeBytes),
      escapeCsv(formatBytes(sizeBytes)),
      escapeCsv(file.mimeType),
      escapeCsv(new Date(file.modifiedTime).toISOString()),
      escapeCsv('N/A (Unique or Latest Copy)'),
      escapeCsv('N/A'),
      escapeCsv('N/A'),
      escapeCsv('N/A'),
      escapeCsv('100'),
      escapeCsv('Kept as active unique document or newest primary version'),
      escapeCsv('Active in Drive'),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  // Create Blob & Trigger Download
  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date(report.timestamp).toISOString().split('T')[0];
  const filename = `drive_cleanup_summary_${report.folderName}_${dateStr}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
