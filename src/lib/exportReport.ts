import { CleanupReport } from '../types';
import { formatBytes, getEstimatedFileSize } from './formatters';

export type ReportExportFormat = 'csv' | 'markdown' | 'text';

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
 * Checks if a filename corresponds to protected key documentation.
 */
export const isProtectedKeyFile = (fileName?: string): boolean =>
  /^(?:00_)?readme\.txt$/i.test(fileName?.trim() || '');

/**
 * Helper to trigger a browser file download.
 */
export function downloadReportFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an appropriate filename based on folder name, report type, and chosen format.
 */
export function getReportFilename(report: CleanupReport, format: ReportExportFormat): string {
  const dateStr = new Date(report.timestamp).toISOString().split('T')[0];
  const safeFolder = (report.folderName || 'drive')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const reportType = report.isProposedReport ? 'proposed_plan' : 'summary';

  switch (format) {
    case 'markdown':
      return `drive_cleanup_${reportType}_${safeFolder}_${dateStr}.md`;
    case 'text':
      return `drive_cleanup_${reportType}_${safeFolder}_${dateStr}.txt`;
    case 'csv':
    default:
      return `drive_cleanup_${reportType}_${safeFolder}_${dateStr}.csv`;
  }
}

/**
 * Generates and downloads a clean CSV file from a CleanupReport.
 */
export function exportReportToCsv(report: CleanupReport): void {
  const lines: string[] = [];
  const seenFileIds = new Set<string>();

  // Calculate actual counts excluding protected key files and deduplicated
  const validTrashed = report.trashedFiles.filter(
    (item) => !isProtectedKeyFile(item.trashedFile?.name)
  );
  const successfulTrashed = validTrashed.filter((item) => item.trashedSuccess);
  const failedTrashed = validTrashed.filter(
    (item) => !item.trashedSuccess && !item.isProposed && !report.isProposedReport
  );

  // Metadata & Summary Block
  lines.push(`${escapeCsv(report.isProposedReport ? 'DRIVE CLEANUP AGENT - PROPOSED PLAN REPORT' : 'DRIVE CLEANUP AGENT - SUMMARY REPORT')}`);
  lines.push(`${escapeCsv('Folder Name')},${escapeCsv(report.folderName)}`);
  lines.push(`${escapeCsv('Report Timestamp')},${escapeCsv(report.timestamp)}`);
  lines.push(`${escapeCsv('Total Files Reviewed')},${escapeCsv(report.totalFilesReviewed)}`);

  if (report.isProposedReport) {
    lines.push(`${escapeCsv('Total Proposed for Trash')},${escapeCsv(validTrashed.length)}`);
    lines.push(`${escapeCsv('Exact Duplicates Proposed')},${escapeCsv(validTrashed.filter((m) => m.type === 'exact').length)}`);
    lines.push(`${escapeCsv('Older Drafts Proposed')},${escapeCsv(validTrashed.filter((m) => m.type !== 'exact').length)}`);
  } else {
    lines.push(`${escapeCsv('Total Trashed Files (Success)')},${escapeCsv(successfulTrashed.length)}`);
    if (failedTrashed.length > 0) {
      lines.push(`${escapeCsv('Trash Attempts Failed')},${escapeCsv(failedTrashed.length)}`);
    }
    lines.push(`${escapeCsv('Exact Duplicates Trashed')},${escapeCsv(report.totalExactDuplicates)}`);
    lines.push(`${escapeCsv('Older Draft Versions Trashed')},${escapeCsv(report.totalVersionDrafts)}`);
  }

  lines.push(`${escapeCsv('Flagged Uncertain (Kept)')},${escapeCsv(report.uncertainFiles.filter((u) => !isProtectedKeyFile(u.fileB?.name)).length)}`);
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

  // 1. Files with Trash Actions (Executed, Failed Attempts, or Proposed)
  validTrashed.forEach((item) => {
    const file = item.trashedFile;
    if (!file || !file.id || seenFileIds.has(file.id)) {
      return;
    }
    seenFileIds.add(file.id);

    const sizeBytes = getEstimatedFileSize(file);
    const isExact = item.type === 'exact';
    const typeSuffix = isExact ? 'Exact Duplicate' : 'Older Draft Version';

    let category: string;
    let statusText: string;

    if (report.isProposedReport || item.isProposed) {
      category = `Proposed for Trash - ${typeSuffix}`;
      statusText = 'Pending Confirmation (Not Yet Trashed)';
    } else if (item.trashedSuccess) {
      category = `Trashed - ${typeSuffix}`;
      statusText = 'Moved to Drive Trash';
    } else {
      category = `Trash Attempt Failed - ${typeSuffix}`;
      statusText = `Failed to Trash: ${item.error || 'Permission denied or file unavailable in Drive'}`;
    }

    const signalLabel = item.signalUsed === 'content_statement'
      ? 'Content Statement'
      : item.signalUsed === 'size_and_name'
      ? 'File Size & Name Match'
      : item.signalUsed === 'modified_timestamp'
      ? 'Modified Timestamp'
      : item.reason.includes('Signal used: Content') ? 'Content Statement' : 'Modified Timestamp';

    const similarityCell =
      item.comparisonMethod === 'size_and_name_match'
        ? 'N/A (Size & Name Match)'
        : item.comparisonMethod === 'binary_checksum_match'
        ? 'N/A (Byte Checksum Match)'
        : item.comparisonMethod === 'none'
        ? 'N/A (Unreadable Content)'
        : item.comparisonMethod === 'text_similarity' && item.similarity !== undefined
        ? `${Math.round(item.similarity * 100)}%`
        : item.similarity !== undefined && item.similarity > 0 && !item.reason.includes('could not be read')
        ? `${Math.round(item.similarity * 100)}%`
        : 'N/A (Not Compared As Text)';

    lines.push([
      escapeCsv(category),
      escapeCsv(file.name),
      escapeCsv(file.id),
      escapeCsv(sizeBytes),
      escapeCsv(formatBytes(sizeBytes)),
      escapeCsv(file.mimeType),
      escapeCsv(new Date(file.modifiedTime).toISOString()),
      escapeCsv(item.keptOriginalFile?.name || 'N/A'),
      escapeCsv(item.keptOriginalFile?.id || 'N/A'),
      escapeCsv(item.keptOriginalFile ? new Date(item.keptOriginalFile.modifiedTime).toISOString() : 'N/A'),
      escapeCsv(signalLabel),
      escapeCsv(similarityCell),
      escapeCsv(item.reason),
      escapeCsv(statusText),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  // 2. Uncertain Files
  report.uncertainFiles.forEach((item) => {
    const targetFile = item.fileB;
    if (!targetFile || !targetFile.id || seenFileIds.has(targetFile.id) || isProtectedKeyFile(targetFile.name)) {
      return;
    }
    seenFileIds.add(targetFile.id);

    const sizeBytes = getEstimatedFileSize(targetFile);
    const uncertainSimCell =
      item.comparisonMethod === 'text_similarity' && item.similarity > 0
        ? `${Math.round(item.similarity * 100)}%`
        : 'N/A (Unreadable / Not Compared)';

    lines.push([
      escapeCsv('Flagged Uncertain - Safely Kept'),
      escapeCsv(targetFile.name),
      escapeCsv(targetFile.id),
      escapeCsv(sizeBytes),
      escapeCsv(formatBytes(sizeBytes)),
      escapeCsv(targetFile.mimeType),
      escapeCsv(new Date(targetFile.modifiedTime).toISOString()),
      escapeCsv(item.fileA?.name || 'N/A'),
      escapeCsv(item.fileA?.id || 'N/A'),
      escapeCsv(item.fileA ? new Date(item.fileA.modifiedTime).toISOString() : 'N/A'),
      escapeCsv('None (Uncertain / Conflicting)'),
      escapeCsv(uncertainSimCell),
      escapeCsv(`Flagged: ${item.reason} - Kept in place without action per strict safety threshold`),
      escapeCsv('Active in Drive (Untouched)'),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  // 3. Kept / Unique Files
  report.keptFiles.forEach((file) => {
    if (!file || !file.id || seenFileIds.has(file.id) || isProtectedKeyFile(file.name)) {
      return;
    }
    seenFileIds.add(file.id);

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
      escapeCsv('N/A (Unique File)'),
      escapeCsv('Kept as active unique document or newest primary version'),
      escapeCsv('Active in Drive'),
      escapeCsv(report.folderName),
      escapeCsv(report.timestamp),
    ].join(','));
  });

  const csvContent = lines.join('\r\n');
  const filename = getReportFilename(report, 'csv');
  downloadReportFile(csvContent, filename, 'text/csv');
}

/**
 * Generates a clean Markdown document from a CleanupReport.
 */
export function generateMarkdownReport(report: CleanupReport): string {
  const isProposed = Boolean(report.isProposedReport);
  const title = isProposed
    ? 'Drive Cleanup Agent — Proposed Plan Report'
    : 'Drive Cleanup Agent — Cleanup Summary Report';

  const validTrashed = report.trashedFiles.filter(
    (item) => !isProtectedKeyFile(item.trashedFile?.name)
  );
  const successfulTrashed = validTrashed.filter((item) => item.trashedSuccess);
  const failedTrashed = validTrashed.filter(
    (item) => !item.trashedSuccess && !item.isProposed && !isProposed
  );
  const displayedUncertain = report.uncertainFiles.filter(
    (u) => !isProtectedKeyFile(u.fileB?.name)
  );
  const displayedKept = report.keptFiles.filter((f) => !isProtectedKeyFile(f?.name));

  let md = `# ${title}\n\n`;
  md += `> **Folder Scanned:** \`${report.folderName}\`  \n`;
  md += `> **Generated At:** ${new Date(report.timestamp).toLocaleString()}  \n`;
  md += `> **Execution Mode:** ${isProposed ? 'Proposed Plan (Pre-Execution Audit)' : 'Executed (Moved to Drive Trash)'}  \n`;
  md += `> **Policy:** Non-destructive Google Drive Trash with 30-day recovery window.\n\n`;

  // 1. Executive Summary Table
  md += `## 1. Executive Summary\n\n`;
  md += `| Metric | Count / Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Total Files Reviewed** | ${report.totalFilesReviewed} |\n`;

  if (isProposed) {
    md += `| **Total Proposed for Trash** | ${validTrashed.length} |\n`;
    md += `| **Exact Duplicates** | ${validTrashed.filter((m) => m.type === 'exact').length} |\n`;
    md += `| **Older Draft Versions** | ${validTrashed.filter((m) => m.type !== 'exact').length} |\n`;
  } else {
    md += `| **Total Trashed Files (Success)** | ${successfulTrashed.length} |\n`;
    if (failedTrashed.length > 0) {
      md += `| **Trash Attempts Failed** | ${failedTrashed.length} |\n`;
    }
    md += `| **Exact Duplicates Trashed** | ${report.totalExactDuplicates} |\n`;
    md += `| **Older Draft Versions Trashed** | ${report.totalVersionDrafts} |\n`;
  }

  md += `| **Flagged as Uncertain (Kept Safely)** | ${displayedUncertain.length} |\n`;
  md += `| **Unique & Latest Files Kept** | ${displayedKept.length} |\n`;

  if (report.metrics) {
    md += `| **Estimated Space Reclaimed** | ${formatBytes(report.metrics.totalBytesReclaimed)} |\n`;
    md += `| **Duplication Rate** | ${report.metrics.duplicationRate}% |\n`;
    md += `| **Average Similarity** | ${report.metrics.avgSimilarity}% |\n`;
    md += `| **Scan Duration** | ${report.metrics.scanDurationMs} ms |\n`;
    md += `| **Processing Speed** | ${report.metrics.scanSpeedFilesPerSec} files/sec |\n`;
  }
  md += `\n`;

  // 2. Gemini AI Cleanup Insight
  if (report.cleanupInsight) {
    md += `## 2. AI Cleanup Insight (Gemini)\n\n`;
    md += `> ${report.cleanupInsight.replace(/\n/g, '\n> ')}\n\n`;
  }

  // 3. Processed Candidate Files Breakdown
  md += `## ${report.cleanupInsight ? '3' : '2'}. ${isProposed ? 'Proposed Candidate Files' : 'Processed Files & Outcomes'}\n\n`;
  if (validTrashed.length === 0) {
    md += `_No duplicate or older draft files were found._\n\n`;
  } else {
    validTrashed.forEach((item, index) => {
      const file = item.trashedFile;
      const isExact = item.type === 'exact';
      const typeLabel = isExact ? 'Exact Duplicate' : 'Older Draft Version';

      let statusBadge = isProposed || item.isProposed
        ? 'PROPOSED FOR TRASH'
        : item.trashedSuccess
        ? 'TRASHED'
        : `FAILED: ${item.error || 'Permission Denied'}`;

      const signalLabel = item.signalUsed === 'content_statement'
        ? 'Explicit Content Statement'
        : item.signalUsed === 'size_and_name'
        ? 'File Size & Name Match'
        : item.signalUsed === 'modified_timestamp'
        ? 'Modified Timestamp'
        : item.reason.includes('Signal used: Content') ? 'Explicit Content Statement' : 'Modified Timestamp';

      const simLabel =
        item.comparisonMethod === 'size_and_name_match'
          ? 'Size and Name Match'
          : item.comparisonMethod === 'binary_checksum_match'
          ? 'Byte Checksum Match (Binary)'
          : item.comparisonMethod === 'none'
          ? 'Unreadable Content'
          : item.similarity !== undefined
          ? `${Math.round(item.similarity * 100)}% Similarity`
          : 'N/A';

      md += `### ${index + 1}. \`[${statusBadge}]\` ${file.name}\n\n`;
      md += `- **File ID:** \`${file.id}\`\n`;
      md += `- **Size:** ${formatBytes(getEstimatedFileSize(file))} (${getEstimatedFileSize(file)} bytes)\n`;
      md += `- **MIME Type:** \`${file.mimeType}\`\n`;
      md += `- **Modified Date:** ${new Date(file.modifiedTime).toLocaleString()}\n`;
      if (item.keptOriginalFile) {
        md += `- **Superseded By (Kept Copy):** "${item.keptOriginalFile.name}" (ID: \`${item.keptOriginalFile.id}\`, Modified: ${new Date(item.keptOriginalFile.modifiedTime).toLocaleString()})\n`;
      }
      md += `- **Classification:** ${typeLabel} (${simLabel})\n`;
      md += `- **Decision Signal:** ${signalLabel}\n`;
      md += `- **Reasoning:** ${item.reason}\n\n`;
    });
  }

  // 4. Uncertain Files
  md += `## ${report.cleanupInsight ? '4' : '3'}. Files Flagged as Uncertain (Retained Without Action)\n\n`;
  if (displayedUncertain.length === 0) {
    md += `_None. All reviewed files were categorized with high confidence._\n\n`;
  } else {
    displayedUncertain.forEach((item, index) => {
      const uncertSim = item.comparisonMethod === 'text_similarity' && item.similarity > 0
        ? `${Math.round(item.similarity * 100)}%`
        : 'N/A (Content unreadable / not compared as text)';

      md += `### ${index + 1}. \`[KEPT SAFE]\` ${item.fileB.name}\n\n`;
      md += `- **File ID:** \`${item.fileB.id}\`\n`;
      md += `- **Compared Against:** "${item.fileA.name}" (ID: \`${item.fileA.id}\`)\n`;
      md += `- **Similarity:** ${uncertSim}\n`;
      md += `- **Why Flagged:** ${item.reason}\n`;
      md += `- **Safety Rule:** Retained in place per the safety constraint: *"Do not trash anything without high confidence."*\n\n`;
    });
  }

  // 5. Retained Unique Files
  md += `## ${report.cleanupInsight ? '5' : '4'}. Retained Unique & Primary Files\n\n`;
  if (displayedKept.length === 0) {
    md += `_No unique files to display._\n\n`;
  } else {
    md += `| File Name | Modified Date | Size | File ID |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    displayedKept.forEach((f) => {
      md += `| ${f.name} | ${new Date(f.modifiedTime).toLocaleDateString()} | ${formatBytes(getEstimatedFileSize(f))} | \`${f.id}\` |\n`;
    });
    md += `\n`;
  }

  // 6. Safety & Scope Policies
  md += `## ${report.cleanupInsight ? '6' : '5'}. Safety & Compliance Policies\n\n`;
  md += `- **Safe Non-Destructive Trash:** All deletions move files to Google Drive Trash rather than permanent deletion, preserving a 30-day recovery window.\n`;
  md += `- **Session Undo Available:** Actions performed within the active session can be undone with one tap.\n`;
  md += `- **Content-First Precedence:** Explicit version statements and superseding text markers take priority over file modification dates.\n`;
  md += `- **Zero Unconfirmed Actions:** Every file moved to trash requires interactive user confirmation.\n`;

  return md;
}

/**
 * Generates a clean, plain text document from a CleanupReport.
 */
export function generatePlainTextReport(report: CleanupReport): string {
  const isProposed = Boolean(report.isProposedReport);
  const sep = '='.repeat(80);
  const subSep = '-'.repeat(80);

  const validTrashed = report.trashedFiles.filter(
    (item) => !isProtectedKeyFile(item.trashedFile?.name)
  );
  const successfulTrashed = validTrashed.filter((item) => item.trashedSuccess);
  const failedTrashed = validTrashed.filter(
    (item) => !item.trashedSuccess && !item.isProposed && !isProposed
  );
  const displayedUncertain = report.uncertainFiles.filter(
    (u) => !isProtectedKeyFile(u.fileB?.name)
  );
  const displayedKept = report.keptFiles.filter((f) => !isProtectedKeyFile(f?.name));

  let txt = `${sep}\n`;
  txt += `GOOGLE DRIVE CLEANUP AGENT - ${isProposed ? 'PROPOSED PLAN REPORT' : 'SUMMARY REPORT'}\n`;
  txt += `${sep}\n`;
  txt += `Target Folder:       "${report.folderName}"\n`;
  txt += `Report Timestamp:    ${new Date(report.timestamp).toLocaleString()}\n`;
  txt += `Status:              ${isProposed ? 'PROPOSED AUDIT PLAN (Pending Confirmation)' : 'CLEANUP EXECUTED (Moved to Drive Trash)'}\n`;
  txt += `Policy Enforcement:  Non-destructive Drive Trash (30-day recovery), user-approved\n`;
  txt += `${sep}\n\n`;

  // 1. Executive Summary
  txt += `${subSep}\n`;
  txt += `1. EXECUTIVE SUMMARY & STATISTICS\n`;
  txt += `${subSep}\n`;
  txt += `Total Files Reviewed:          ${report.totalFilesReviewed}\n`;

  if (isProposed) {
    txt += `Total Proposed for Trash:      ${validTrashed.length}\n`;
    txt += `  - Exact Duplicates:          ${validTrashed.filter((m) => m.type === 'exact').length}\n`;
    txt += `  - Older Draft Versions:      ${validTrashed.filter((m) => m.type !== 'exact').length}\n`;
  } else {
    txt += `Total Trashed Files (Success): ${successfulTrashed.length}\n`;
    if (failedTrashed.length > 0) {
      txt += `Trash Attempts Failed:         ${failedTrashed.length}\n`;
    }
    txt += `  - Exact Duplicates Trashed:  ${report.totalExactDuplicates}\n`;
    txt += `  - Older Drafts Trashed:      ${report.totalVersionDrafts}\n`;
  }

  txt += `Flagged Uncertain (Kept Safe): ${displayedUncertain.length}\n`;
  txt += `Unique & Latest Files Kept:    ${displayedKept.length}\n`;

  if (report.metrics) {
    txt += `Estimated Space Reclaimed:     ${formatBytes(report.metrics.totalBytesReclaimed)}\n`;
    txt += `Duplication Rate:              ${report.metrics.duplicationRate}%\n`;
    txt += `Average Similarity:            ${report.metrics.avgSimilarity}%\n`;
    txt += `Scan Duration:                 ${report.metrics.scanDurationMs} ms\n`;
    txt += `Processing Speed:              ${report.metrics.scanSpeedFilesPerSec} files/sec\n`;
  }
  txt += `\n`;

  // 2. AI Insight
  if (report.cleanupInsight) {
    txt += `${subSep}\n`;
    txt += `2. AI CLEANUP INSIGHT (GEMINI)\n`;
    txt += `${subSep}\n`;
    txt += `${report.cleanupInsight}\n\n`;
  }

  // 3. Candidates
  txt += `${subSep}\n`;
  txt += `3. ${isProposed ? 'PROPOSED CANDIDATE FILES' : 'PROCESSED FILES & ACTION AUDIT TRAIL'}\n`;
  txt += `${subSep}\n`;

  if (validTrashed.length === 0) {
    txt += `(None. No duplicate files or older draft versions were found.)\n\n`;
  } else {
    validTrashed.forEach((item, index) => {
      const file = item.trashedFile;
      const isExact = item.type === 'exact';
      const typeLabel = isExact ? 'Exact Duplicate' : 'Older Draft Version';

      const statusBadge = isProposed || item.isProposed
        ? 'PROPOSED FOR TRASH'
        : item.trashedSuccess
        ? 'TRASHED'
        : `FAILED: ${item.error || 'Permission Denied'}`;

      const signalLabel = item.signalUsed === 'content_statement'
        ? 'Explicit Content Statement'
        : item.signalUsed === 'size_and_name'
        ? 'File Size & Name Match'
        : item.signalUsed === 'modified_timestamp'
        ? 'Modified Timestamp'
        : item.reason.includes('Signal used: Content') ? 'Explicit Content Statement' : 'Modified Timestamp';

      const simLabel =
        item.comparisonMethod === 'size_and_name_match'
          ? 'Size and Name Match'
          : item.comparisonMethod === 'binary_checksum_match'
          ? 'Byte Checksum Match'
          : item.comparisonMethod === 'none'
          ? 'Unreadable Content'
          : item.similarity !== undefined
          ? `${Math.round(item.similarity * 100)}% Similarity`
          : 'N/A';

      txt += `[${index + 1}] [${statusBadge}] ${file.name}\n`;
      txt += `    - File ID:         ${file.id}\n`;
      txt += `    - Size:            ${formatBytes(getEstimatedFileSize(file))} (${getEstimatedFileSize(file)} bytes)\n`;
      txt += `    - MIME Type:       ${file.mimeType}\n`;
      txt += `    - Modified Date:   ${new Date(file.modifiedTime).toLocaleString()}\n`;
      if (item.keptOriginalFile) {
        txt += `    - Superseded By:   "${item.keptOriginalFile.name}" (ID: ${item.keptOriginalFile.id}, Modified: ${new Date(item.keptOriginalFile.modifiedTime).toLocaleString()})\n`;
      }
      txt += `    - Classification:  ${typeLabel} (${simLabel})\n`;
      txt += `    - Decision Signal: ${signalLabel}\n`;
      txt += `    - Reason / Detail: ${item.reason}\n\n`;
    });
  }

  // 4. Uncertain Files
  txt += `${subSep}\n`;
  txt += `4. FILES FLAGGED AS UNCERTAIN (RETAINED WITHOUT ACTION)\n`;
  txt += `${subSep}\n`;

  if (displayedUncertain.length === 0) {
    txt += `(None. All files were categorized with high confidence.)\n\n`;
  } else {
    displayedUncertain.forEach((item, index) => {
      const uncertSim = item.comparisonMethod === 'text_similarity' && item.similarity > 0
        ? `${Math.round(item.similarity * 100)}%`
        : 'N/A (Content unreadable / not compared as text)';

      txt += `[${index + 1}] [KEPT SAFE] ${item.fileB.name}\n`;
      txt += `    - File ID:         ${item.fileB.id}\n`;
      txt += `    - Compared With:   "${item.fileA.name}" (ID: ${item.fileA.id})\n`;
      txt += `    - Similarity:      ${uncertSim}\n`;
      txt += `    - Why Flagged:     ${item.reason}\n`;
      txt += `    - Action Taken:    Untouched in Drive per safety policy.\n\n`;
    });
  }

  // 5. Retained Unique Files
  txt += `${subSep}\n`;
  txt += `5. RETAINED UNIQUE & PRIMARY FILES (${displayedKept.length} files)\n`;
  txt += `${subSep}\n`;
  if (displayedKept.length === 0) {
    txt += `(No unique files)\n\n`;
  } else {
    displayedKept.forEach((f, idx) => {
      txt += `${idx + 1}. "${f.name}" (${formatBytes(getEstimatedFileSize(f))}, Modified: ${new Date(f.modifiedTime).toLocaleDateString()}, ID: ${f.id})\n`;
    });
    txt += `\n`;
  }

  // 6. Policies
  txt += `${subSep}\n`;
  txt += `6. SAFETY PROTOCOLS & RECOVERY GUARANTEES\n`;
  txt += `${subSep}\n`;
  txt += `- All trashed files are placed in Google Drive Trash with a 30-day recovery window.\n`;
  txt += `- In-session undo allows immediate restoration within active time window.\n`;
  txt += `- Content statements indicating "final draft" or "supersedes" take precedence over modification timestamps.\n`;
  txt += `${sep}\n`;

  return txt;
}

/**
 * Generates and downloads a Markdown document (.md) from a CleanupReport.
 */
export function exportReportToMarkdown(report: CleanupReport): void {
  const content = generateMarkdownReport(report);
  const filename = getReportFilename(report, 'markdown');
  downloadReportFile(content, filename, 'text/markdown');
}

/**
 * Generates and downloads a plain text document (.txt) from a CleanupReport.
 */
export function exportReportToText(report: CleanupReport): void {
  const content = generatePlainTextReport(report);
  const filename = getReportFilename(report, 'text');
  downloadReportFile(content, filename, 'text/plain');
}

/**
 * General unified dispatcher for exporting in any format.
 */
export function exportReport(report: CleanupReport, format: ReportExportFormat): void {
  switch (format) {
    case 'markdown':
      exportReportToMarkdown(report);
      break;
    case 'text':
      exportReportToText(report);
      break;
    case 'csv':
    default:
      exportReportToCsv(report);
      break;
  }
}
