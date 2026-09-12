import { DriveFileItem, DuplicateMatch, CleanupMetrics } from '../types';

/**
 * Formats a byte number into human-readable text (B, KB, MB, GB).
 */
export function formatBytes(bytes?: number | string): string {
  if (bytes === undefined || bytes === null) return '0 B';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  const formatted = (num / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i]}`;
}

/**
 * Estimates file size in bytes.
 * For native Docs/Sheets without `size`, uses content string length.
 */
export function getEstimatedFileSize(file: DriveFileItem): number {
  if (file.size !== undefined && file.size !== null) {
    const parsed = typeof file.size === 'string' ? parseInt(file.size, 10) : file.size;
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (file.content) {
    return new TextEncoder().encode(file.content).length;
  }
  return 0;
}

/**
 * Computes scan summary metrics given the scanned files and matches.
 */
export function computeScanMetrics(
  totalScanned: number,
  actionableMatches: DuplicateMatch[],
  uncertainMatches: DuplicateMatch[],
  uniqueFilesCount: number,
  scanDurationMs: number
): CleanupMetrics {
  let exactCount = 0;
  let draftCount = 0;
  let totalReclaimedBytes = 0;
  let similaritySum = 0;

  for (const m of actionableMatches) {
    if (m.type === 'exact') {
      exactCount++;
    } else {
      draftCount++;
    }
    totalReclaimedBytes += getEstimatedFileSize(m.targetFile);
    similaritySum += m.similarityScore;
  }

  const avgSimilarity = actionableMatches.length > 0
    ? Math.round((similaritySum / actionableMatches.length) * 100)
    : 0;

  const duplicationRate = totalScanned > 0
    ? Math.round((actionableMatches.length / totalScanned) * 100)
    : 0;

  const durationSec = Math.max(0.1, scanDurationMs / 1000);
  const scanSpeedFilesPerSec = Math.round((totalScanned / durationSec) * 10) / 10;

  return {
    totalScanned,
    exactDuplicatesCount: exactCount,
    versionDraftsCount: draftCount,
    uncertainCount: uncertainMatches.length,
    uniqueKeptCount: uniqueFilesCount,
    totalBytesReclaimed: totalReclaimedBytes,
    duplicationRate,
    avgSimilarity,
    scanDurationMs,
    scanSpeedFilesPerSec,
  };
}
