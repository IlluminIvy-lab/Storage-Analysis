import { AutoSelectPreferences, DEFAULT_AUTO_SELECT_PREFERENCES, DuplicateMatch, DriveFileItem, KeeperPreference } from '../types';
const STORAGE_KEY = 'notes_by_ivy_auto_select_prefs';

export function getSavedAutoSelectPreferences(): AutoSelectPreferences {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? { ...DEFAULT_AUTO_SELECT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_AUTO_SELECT_PREFERENCES }; }
  catch { return { ...DEFAULT_AUTO_SELECT_PREFERENCES }; }
}
export function saveAutoSelectPreferences(prefs: AutoSelectPreferences): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* optional convenience preference */ } }
export function hasCopySuffix(name: string): boolean { return /[\s_-]*(copy|\(\d+\)|\bcopy\b)/i.test(name); }
export function getKeeperPreferenceLabel(pref: KeeperPreference): string { return ({ newer: 'Always prefer newer files (Latest modified)', largest: 'Always prefer largest files (Highest file size)', older: 'Always prefer older files (Earliest original)', smallest: 'Always prefer smallest files (Leanest file size)', cleanest_name: 'Always prefer cleanest filename (No copy suffixes)' } as Record<KeeperPreference, string>)[pref]; }
export function getKeeperPreferenceSummary(prefs?: Partial<AutoSelectPreferences> | null): string { const p = { ...DEFAULT_AUTO_SELECT_PREFERENCES, ...(prefs || {}) }; if (!p.enabled) return 'Assisted cleanup: review plan before applying'; const types = [p.autoSelectExact && 'Exact', p.autoSelectDrafts && `Drafts ≥${Math.round(p.minSimilarityThreshold * 100)}%`, p.autoSelectDivergent && 'Divergent'].filter(Boolean); return `Prefer: ${p.keeperPreference} • ${types.join(', ') || 'Manual'}`; }
export function compareFilesForKeeper(a: DriveFileItem, b: DriveFileItem, pref: KeeperPreference, secondaryPref: KeeperPreference = 'newer'): boolean { const value = (criterion: KeeperPreference): boolean | null => { if (criterion === 'newer' || criterion === 'older') { const x = new Date(a.modifiedTime).getTime(), y = new Date(b.modifiedTime).getTime(); return x === y ? null : criterion === 'newer' ? x > y : x < y; } if (criterion === 'largest' || criterion === 'smallest') { const x = Number(a.size) || 0, y = Number(b.size) || 0; return x === y ? null : criterion === 'largest' ? x > y : x < y; } const ac = hasCopySuffix(a.name), bc = hasCopySuffix(b.name); return ac === bc ? (a.name.length === b.name.length ? null : a.name.length < b.name.length) : !ac; }; return value(pref) ?? value(secondaryPref) ?? (new Date(a.modifiedTime).getTime() >= new Date(b.modifiedTime).getTime()); }
export function realignMatchWithPreferences(match: DuplicateMatch, prefs?: Partial<AutoSelectPreferences> | null): DuplicateMatch { const p = { ...DEFAULT_AUTO_SELECT_PREFERENCES, ...(prefs || {}) }; if (p.respectContentSignals && match.signalUsed === 'content_statement') return match; if (compareFilesForKeeper(match.originalFile, match.targetFile, p.keeperPreference, p.secondaryPreference)) return match; return { ...match, originalFile: match.targetFile, targetFile: match.originalFile, reason: `${match.reason} [Preference applied: ${p.keeperPreference}.]` }; }
export function realignMatchesWithPreferences(matches: DuplicateMatch[], prefs?: Partial<AutoSelectPreferences> | null): DuplicateMatch[] { return matches.map((m) => realignMatchWithPreferences(m, prefs)); }

/** Explicit action policy: this function never selects uncertain/manual-review candidates. */
export function evaluateAutoSelectMatchIds(matches: DuplicateMatch[], prefs?: Partial<AutoSelectPreferences> | null, forceRun = false): string[] {
  const p = { ...DEFAULT_AUTO_SELECT_PREFERENCES, ...(prefs || {}) };
  if (!p.enabled && !forceRun) return [];
  return matches.filter((m) => {
    if (m.requiresManualReview || m.deletionEligible === false || m.isUncertain || m.hasSignificantDivergence) return false;
    if (m.type === 'probable-candidate') return false;
    if (m.type === 'exact' || m.type === 'byte-exact') return p.autoSelectExact;
    if (m.type === 'near-duplicate' || m.type === 'content-exact') return p.autoSelectDrafts && m.similarityScore >= p.minSimilarityThreshold;
    return false;
  }).map((m) => m.id);
}
