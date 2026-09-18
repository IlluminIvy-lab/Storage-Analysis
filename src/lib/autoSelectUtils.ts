import {
  AutoSelectPreferences,
  DEFAULT_AUTO_SELECT_PREFERENCES,
  DuplicateMatch,
  DriveFileItem,
  KeeperPreference,
} from '../types';
import { isCleanupEligible } from './cleanupActionGate';

const STORAGE_KEY = 'notes_by_ivy_auto_select_prefs';

/**
 * Loads persistent Auto-Select preferences from localStorage with fallback to defaults.
 */
export function getSavedAutoSelectPreferences(): AutoSelectPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUTO_SELECT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AUTO_SELECT_PREFERENCES,
      ...parsed,
    };
  } catch (e) {
    console.warn('Failed to load auto-select preferences from localStorage:', e);
    return DEFAULT_AUTO_SELECT_PREFERENCES;
  }
}

/**
 * Persists Auto-Select preferences to localStorage.
 */
export function saveAutoSelectPreferences(prefs: AutoSelectPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save auto-select preferences to localStorage:', e);
  }
}

/**
 * Checks if a filename has copy suffixes like " (1)", " - Copy", "_copy".
 */
export function hasCopySuffix(name: string): boolean {
  return /[\s_-]*(copy|\(\d+\)|\bcopy\b)/i.test(name);
}

/**
 * Returns a human-friendly label for a Keeper Preference.
 */
export function getKeeperPreferenceLabel(pref: KeeperPreference): string {
  switch (pref) {
    case 'newer':
      return 'Always prefer newer files (Latest modified)';
    case 'largest':
      return 'Always prefer largest files (Highest file size)';
    case 'older':
      return 'Always prefer older files (Earliest original)';
    case 'smallest':
      return 'Always prefer smallest files (Leanest file size)';
    case 'cleanest_name':
      return 'Always prefer cleanest filename (No copy suffixes)';
    default:
      return 'Always prefer newer files';
  }
}

/**
 * Returns a short badge text summarizing the active preferences.
 */
export function getKeeperPreferenceSummary(prefs?: Partial<AutoSelectPreferences> | null): string {
  const p: AutoSelectPreferences = {
    ...DEFAULT_AUTO_SELECT_PREFERENCES,
    ...(prefs || {}),
  };
  if (!p.enabled) {
    return 'Auto-Select: OFF (Manual selection only)';
  }
  let primary = 'Newer';
  if (p.keeperPreference === 'largest') primary = 'Largest Size';
  else if (p.keeperPreference === 'older') primary = 'Earliest Date';
  else if (p.keeperPreference === 'smallest') primary = 'Smallest Size';
  else if (p.keeperPreference === 'cleanest_name') primary = 'Clean Name';

  const types = [];
  if (p.autoSelectExact) types.push('Exact');
  if (p.autoSelectDrafts) types.push(`Drafts ≥${Math.round(p.minSimilarityThreshold * 100)}%`);
  if (p.autoSelectDivergent) types.push('Divergent');

  return `Prefer: ${primary} • ${types.join(', ') || 'Manual'}`;
}

/**
 * Evaluates whether fileA should be KEPT over fileB according to the specified keeper preference.
 * Returns true if fileA is the keeper, false if fileB is the keeper.
 */
export function compareFilesForKeeper(
  fileA: DriveFileItem,
  fileB: DriveFileItem,
  pref: KeeperPreference,
  secondaryPref: KeeperPreference = 'newer'
): boolean {
  // Helper to evaluate a single criterion
  const evaluateCriterion = (criterion: KeeperPreference): boolean | null => {
    switch (criterion) {
      case 'newer': {
        const timeA = new Date(fileA.modifiedTime).getTime();
        const timeB = new Date(fileB.modifiedTime).getTime();
        if (timeA !== timeB) return timeA > timeB;
        return null;
      }
      case 'older': {
        const timeA = new Date(fileA.modifiedTime).getTime();
        const timeB = new Date(fileB.modifiedTime).getTime();
        if (timeA !== timeB) return timeA < timeB;
        return null;
      }
      case 'largest': {
        const sizeA = Number(fileA.size) || 0;
        const sizeB = Number(fileB.size) || 0;
        if (sizeA !== sizeB) return sizeA > sizeB;
        return null;
      }
      case 'smallest': {
        const sizeA = Number(fileA.size) || 0;
        const sizeB = Number(fileB.size) || 0;
        if (sizeA !== sizeB) return sizeA < sizeB;
        return null;
      }
      case 'cleanest_name': {
        const copyA = hasCopySuffix(fileA.name);
        const copyB = hasCopySuffix(fileB.name);
        if (copyA !== copyB) return !copyA; // file without copy suffix is preferred
        if (fileA.name.length !== fileB.name.length) return fileA.name.length < fileB.name.length;
        return null;
      }
      default:
        return null;
    }
  };

  const primaryResult = evaluateCriterion(pref);
  if (primaryResult !== null) return primaryResult;

  // Primary rule is tied, evaluate secondary tie-breaker
  if (secondaryPref !== pref) {
    const secondaryResult = evaluateCriterion(secondaryPref);
    if (secondaryResult !== null) return secondaryResult;
  }

  // Final fallback: shorter filename or newer timestamp
  return new Date(fileA.modifiedTime).getTime() >= new Date(fileB.modifiedTime).getTime();
}

/**
 * Re-aligns a DuplicateMatch so that originalFile is the designated KEEPER
 * and targetFile is the designated file to TRASH according to user preferences.
 */
export function realignMatchWithPreferences(
  match: DuplicateMatch,
  prefs?: Partial<AutoSelectPreferences> | null
): DuplicateMatch {
  const p: AutoSelectPreferences = {
    ...DEFAULT_AUTO_SELECT_PREFERENCES,
    ...(prefs || {}),
  };

  // If the match was strictly determined by a validated explicit content statement (e.g. "v2" supersedes "v1")
  // and user enabled respectContentSignals, keep the author's explicit version declaration.
  if (p.respectContentSignals && match.signalUsed === 'content_statement') {
    return match;
  }

  const currentKeeper = match.originalFile;
  const currentTarget = match.targetFile;

  const shouldCurrentKeeperStay = compareFilesForKeeper(
    currentKeeper,
    currentTarget,
    p.keeperPreference,
    p.secondaryPreference
  );

  if (shouldCurrentKeeperStay) {
    return match;
  }

  // Flip roles: currentTarget becomes originalFile (keeper), currentKeeper becomes targetFile (to trash)
  const newKeeper = currentTarget;
  const newTarget = currentKeeper;

  let reasonNote = '';
  switch (p.keeperPreference) {
    case 'largest':
      reasonNote = `Preference applied: Always prefer largest file size. "${newKeeper.name}" is retained as the larger copy; "${newTarget.name}" is flagged for cleanup.`;
      break;
    case 'older':
      reasonNote = `Preference applied: Always prefer older original. "${newKeeper.name}" is retained as the earlier created copy; "${newTarget.name}" is flagged for cleanup.`;
      break;
    case 'smallest':
      reasonNote = `Preference applied: Always prefer smallest file size. "${newKeeper.name}" is retained as the leanest copy; "${newTarget.name}" is flagged for cleanup.`;
      break;
    case 'cleanest_name':
      reasonNote = `Preference applied: Always prefer cleanest filename. "${newKeeper.name}" is retained without copy suffixes; "${newTarget.name}" is flagged for cleanup.`;
      break;
    default:
      reasonNote = `Preference applied: Always prefer newer files. "${newKeeper.name}" was modified more recently than "${newTarget.name}".`;
      break;
  }

  return {
    ...match,
    originalFile: newKeeper,
    targetFile: newTarget,
    reason: `${match.reason} [${reasonNote}]`,
  };
}

/**
 * Re-aligns an array of matches according to the active keeper preference.
 */
export function realignMatchesWithPreferences(
  matches: DuplicateMatch[],
  prefs?: Partial<AutoSelectPreferences> | null
): DuplicateMatch[] {
  return matches.map((m) => realignMatchWithPreferences(m, prefs));
}

/**
 * Computes which match IDs should be auto-selected based on the user's persistent criteria.
 */
export function evaluateAutoSelectMatchIds(
  matches: DuplicateMatch[],
  prefs?: Partial<AutoSelectPreferences> | null,
  forceRun: boolean = false
): string[] {
  const p: AutoSelectPreferences = {
    ...DEFAULT_AUTO_SELECT_PREFERENCES,
    ...(prefs || {}),
  };

  // If auto-select is toggled OFF and not explicitly overridden:
  if (!p.enabled && !forceRun) {
    return [];
  }

  const selectedIds: string[] = [];

  for (const match of matches) {
    // Strict Safety Gate: Do not auto-select matches that fail the cleanup eligibility gate
    if (!isCleanupEligible(match)) {
      continue;
    }

    // Safety check for uncertain matches
    if (match.isUncertain) {
      if (p.autoSelectUncertain) {
        selectedIds.push(match.id);
      }
      continue;
    }

    // Exact duplicate matches
    if (match.type === 'exact') {
      if (p.autoSelectExact) {
        selectedIds.push(match.id);
      }
      continue;
    }

    // Near-duplicate / draft versions
    if (match.type === 'near-duplicate') {
      // If divergent, check divergent preference
      if (match.hasSignificantDivergence && !p.autoSelectDivergent) {
        continue;
      }

      // Check similarity gate
      if (match.similarityScore < p.minSimilarityThreshold) {
        continue;
      }

      if (p.autoSelectDrafts) {
        selectedIds.push(match.id);
      }
    }
  }

  return selectedIds;
}
