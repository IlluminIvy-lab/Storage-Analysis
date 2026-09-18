import { DuplicateMatch, DriveFileItem } from '../types';

/**
 * Checks if a filename is a protected documentation or answer key file.
 * e.g., "00_README.txt", "README.txt", "readme.md".
 */
export function isProtectedFile(fileName?: string): boolean {
  if (!fileName) return false;
  const clean = fileName.trim().toLowerCase();
  return (
    clean === '00_readme.txt' ||
    clean === 'readme.txt' ||
    clean === '00_readme.md' ||
    clean === 'readme.md' ||
    /^00_readme\./i.test(clean) ||
    /^readme\./i.test(clean)
  );
}

/**
 * Checks if a folder name is protected from mutation or crawling.
 * Strictly protects "Craft" at any hierarchy level.
 */
export function isProtectedFolder(folderName?: string): boolean {
  if (!folderName) return false;
  const clean = folderName.trim().toLowerCase();
  return clean === 'craft' || clean.includes('/craft') || clean.includes('craft/');
}

export interface CleanupEligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Evaluates whether a duplicate/draft match is strictly eligible for automated or approved cleanup.
 * Reject or exclude any match that:
 * - requiresManualReview is true
 * - deletionEligible is false
 * - isUncertain is true
 * - hasSignificantDivergence is true
 * - classification is 'probable-candidate' or 'unreadable'
 * - contentStatus is unavailable for content comparisons
 * - references a protected file (e.g. 00_README.txt)
 * - references a protected folder (e.g. Craft)
 * - has an invalid or missing target ID
 */
export function isCleanupEligible(match: DuplicateMatch): CleanupEligibilityResult {
  if (!match) {
    return { eligible: false, reason: 'Match is undefined or null' };
  }

  // 1. Validate target file existence and ID
  if (!match.targetFile || !match.targetFile.id || typeof match.targetFile.id !== 'string') {
    return { eligible: false, reason: 'Missing or invalid target file ID' };
  }

  if (!match.originalFile || !match.originalFile.id || typeof match.originalFile.id !== 'string') {
    return { eligible: false, reason: 'Missing or invalid original file ID' };
  }

  if (match.targetFile.id === match.originalFile.id) {
    return { eligible: false, reason: 'Target file and original keeper file have identical ID' };
  }

  // 2. Protected files check (Target and Original)
  if (isProtectedFile(match.targetFile.name)) {
    return {
      eligible: false,
      reason: `Target file "${match.targetFile.name}" is a protected key file and cannot be trashed.`,
    };
  }

  if (isProtectedFile(match.originalFile.name)) {
    // If the original keeper is a protected readme, we must never perform automated actions on its pair
    return {
      eligible: false,
      reason: `Keeper file "${match.originalFile.name}" is a protected key file.`,
    };
  }

  // 3. Explicit safety flags
  if (match.requiresManualReview === true) {
    return {
      eligible: false,
      reason: match.uncertaintyReason || 'Item requires manual review before any action.',
    };
  }

  if (match.deletionEligible === false) {
    return {
      eligible: false,
      reason: match.uncertaintyReason || 'Item is marked as not eligible for cleanup.',
    };
  }

  if (match.isUncertain === true) {
    return {
      eligible: false,
      reason: match.uncertaintyReason || 'Uncertain match — left untouched for safety.',
    };
  }

  // 4. Classification check
  const classification = match.classification || match.type;
  if (classification === 'probable-candidate') {
    return {
      eligible: false,
      reason: 'Probable candidate matched on metadata only; content verification required.',
    };
  }

  if (classification === 'unreadable') {
    return {
      eligible: false,
      reason: 'File content could not be verified; unreadable candidates are not cleanup eligible.',
    };
  }

  if (classification === 'not-duplicate') {
    return { eligible: false, reason: 'Item is not a duplicate.' };
  }

  // 5. Significant content divergence check
  if (match.hasSignificantDivergence === true) {
    return {
      eligible: false,
      reason:
        match.divergenceInfo?.summaryMessage ||
        'Significant content divergence detected between draft versions. Human review required.',
    };
  }

  // 6. Content verification for draft comparisons
  if (
    match.comparisonMethod === 'text_similarity' &&
    match.targetFile.contentStatus === 'unavailable'
  ) {
    return {
      eligible: false,
      reason: 'Draft comparison cannot proceed because target file content is unavailable.',
    };
  }

  // 7. Check if matched purely by name and size without binary or content hash verification
  if (match.comparisonMethod === 'size_and_name_match' && match.contentVerified !== true) {
    return {
      eligible: false,
      reason:
        'Matched purely by size and filename without verified content; unverified matches cannot be trashed.',
    };
  }

  return { eligible: true };
}

/**
 * Validates an entire proposed cleanup batch against the centralized safety gate.
 * Partitions candidates into validMatches and rejectedMatches with explicit rejection reasons.
 */
export function validateCleanupPlan(matches: DuplicateMatch[]): {
  validMatches: DuplicateMatch[];
  rejectedMatches: Array<{ match: DuplicateMatch; reason: string }>;
} {
  const validMatches: DuplicateMatch[] = [];
  const rejectedMatches: Array<{ match: DuplicateMatch; reason: string }> = [];

  for (const match of matches) {
    const check = isCleanupEligible(match);
    if (check.eligible) {
      validMatches.push(match);
    } else {
      rejectedMatches.push({ match, reason: check.reason || 'Failed safety gate' });
    }
  }

  return { validMatches, rejectedMatches };
}

/**
 * Convenience filter returning only strictly eligible cleanup matches.
 */
export function getCleanupEligibleMatches(matches: DuplicateMatch[]): DuplicateMatch[] {
  return matches.filter((m) => isCleanupEligible(m).eligible);
}

export interface FinalValidationContext {
  currentScannedFiles?: DriveFileItem[];
  alreadyTrashedIds?: Set<string>;
  approvedPlanTargetIds?: Set<string>;
  isPlanApproved?: boolean;
}

/**
 * Final validation performed immediately before issuing a Drive Trash API call for a specific file.
 * Ensures the candidate still exists, is not protected, was in the approved plan,
 * and has not already been trashed in the current session.
 */
export function validateFinalTrashCandidate(
  fileId: string,
  targetFile: DriveFileItem,
  context: FinalValidationContext
): { valid: boolean; reason?: string } {
  if (!fileId || typeof fileId !== 'string') {
    return { valid: false, reason: 'Invalid or missing file ID.' };
  }

  if (isProtectedFile(targetFile.name)) {
    return { valid: false, reason: `File "${targetFile.name}" is protected from deletion.` };
  }

  if (context.isPlanApproved === false) {
    return { valid: false, reason: 'Plan has not been approved by user.' };
  }

  if (context.approvedPlanTargetIds && !context.approvedPlanTargetIds.has(fileId)) {
    return { valid: false, reason: `File "${targetFile.name}" was not included in the approved plan.` };
  }

  if (context.alreadyTrashedIds && context.alreadyTrashedIds.has(fileId)) {
    return { valid: false, reason: `File "${targetFile.name}" was already trashed in this session.` };
  }

  if (context.currentScannedFiles) {
    const existsInScan = context.currentScannedFiles.some((f) => f.id === fileId);
    if (!existsInScan) {
      return {
        valid: false,
        reason: `File "${targetFile.name}" is no longer present in current scan state.`,
      };
    }
  }

  return { valid: true };
}
