import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Clock,
  HardDrive,
  FileText,
  Calendar,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import {
  AutoSelectPreferences,
  DEFAULT_AUTO_SELECT_PREFERENCES,
  DuplicateMatch,
  KeeperPreference,
} from '../types';
import {
  evaluateAutoSelectMatchIds,
  saveAutoSelectPreferences,
} from '../lib/autoSelectUtils';

interface AdvancedAutoSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences?: AutoSelectPreferences;
  initialPreferences?: AutoSelectPreferences;
  onSavePreferences: (newPrefs: AutoSelectPreferences) => void;
  currentMatches?: DuplicateMatch[];
  candidateMatches?: DuplicateMatch[];
  onApplyToCurrent?: (newPrefs: AutoSelectPreferences) => void;
}

const resolveEffectivePrefs = (
  prefs?: Partial<AutoSelectPreferences> | null
): AutoSelectPreferences => ({
  ...DEFAULT_AUTO_SELECT_PREFERENCES,
  ...(prefs || {}),
});

export const AdvancedAutoSelectModal: React.FC<AdvancedAutoSelectModalProps> = ({
  isOpen,
  onClose,
  preferences,
  initialPreferences,
  onSavePreferences,
  currentMatches,
  candidateMatches,
  onApplyToCurrent,
}) => {
  const matchesList = candidateMatches || currentMatches || [];
  const incomingPrefs = preferences || initialPreferences;

  const [draftPrefs, setDraftPrefs] = useState<AutoSelectPreferences>(() =>
    resolveEffectivePrefs(incomingPrefs)
  );
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  // Sync draft preferences whenever modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      setDraftPrefs(resolveEffectivePrefs(preferences || initialPreferences));
      setShowSavedToast(false);
      setAppliedCount(null);
    }
  }, [isOpen, preferences, initialPreferences]);

  // Live calculation of matches that would be selected with current draft preferences
  const simulatedSelectedIds = useMemo(() => {
    if (!matchesList || matchesList.length === 0) return [];
    return evaluateAutoSelectMatchIds(matchesList, draftPrefs);
  }, [matchesList, draftPrefs]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveAutoSelectPreferences(draftPrefs);
    onSavePreferences(draftPrefs);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 900);
  };

  const handleApplyNow = () => {
    saveAutoSelectPreferences(draftPrefs);
    onSavePreferences(draftPrefs);
    if (onApplyToCurrent) {
      onApplyToCurrent(draftPrefs);
      setAppliedCount(simulatedSelectedIds.length);
    }
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
    }, 1500);
  };

  const handleResetDefaults = () => {
    setDraftPrefs(DEFAULT_AUTO_SELECT_PREFERENCES);
  };

  const keeperOptions: Array<{
    id: KeeperPreference;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'newer',
      title: 'Always prefer newer files',
      description: 'Keep the most recently modified note as the original; select older drafts for cleanup.',
      icon: <Clock className="w-5 h-5 text-[#C75B12]" />,
    },
    {
      id: 'largest',
      title: 'Always prefer files with largest file size',
      description: 'Keep the largest file (preserving rich edits, attachments & content); select truncated copies.',
      icon: <HardDrive className="w-5 h-5 text-[#C9A86A]" />,
    },
    {
      id: 'older',
      title: 'Always prefer older original files',
      description: 'Keep the earliest created root document; select subsequently created duplicates for cleanup.',
      icon: <Calendar className="w-5 h-5 text-[#F5E9DC]/70]" />,
    },
    {
      id: 'cleanest_name',
      title: 'Always prefer cleanest file names',
      description: 'Keep names without copy tags like "(1)", " - Copy", or "_draft"; select tagged copies.',
      icon: <FileText className="w-5 h-5 text-[#C75B12]" />,
    },
    {
      id: 'smallest',
      title: 'Always prefer smallest file size',
      description: 'Keep the leanest version of a note; select larger or bloated variations for cleanup.',
      icon: <HardDrive className="w-5 h-5 text-[#F5E9DC]/50" />,
    },
  ];

  return (
    <div
      id="advanced-auto-select-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="advanced-auto-select-modal-container"
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-[#161616] border border-[#2a2a2a] rounded-t-3xl sm:rounded-3xl text-[#F5E9DC] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626] bg-[#111111]/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#C75B12]/15 border border-[#C75B12]/30 text-[#C75B12]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-['Montserrat'] tracking-tight text-[#F5E9DC]">
                Advanced Auto-Select
              </h2>
              <p className="text-xs text-[#F5E9DC]/60">
                Define rules for automated duplicate resolution
              </p>
            </div>
          </div>
          <button
            id="btn-close-auto-select-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#F5E9DC]/60 hover:text-[#F5E9DC] hover:bg-[#222222] min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {/* Toast Banner */}
          {showSavedToast && (
            <div className="p-3 bg-[#1d3320] border border-[#2d5f35] rounded-xl flex items-center space-x-2 text-[#7dd88f] animate-in fade-in">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-xs">
                Preferences saved! Future scans will automatically apply these rules.
              </span>
            </div>
          )}

          {/* MASTER AUTO-SELECT ON/OFF TOGGLE */}
          <div
            id="auto-select-master-toggle-card"
            className={`p-4 rounded-2xl border transition-all ${
              draftPrefs.enabled
                ? 'bg-[#C75B12]/10 border-[#C75B12]/40 shadow-sm shadow-[#C75B12]/10'
                : 'bg-[#181818] border-[#2f2f2f]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                    draftPrefs.enabled
                      ? 'bg-[#C75B12] text-white shadow-md shadow-[#C75B12]/30'
                      : 'bg-[#262626] text-[#777777]'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#F5E9DC]">
                      Auto-Select Duplicate Candidates
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        draftPrefs.enabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {draftPrefs.enabled ? 'Enabled' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs text-[#F5E9DC]/70 mt-1 leading-relaxed">
                    {draftPrefs.enabled
                      ? 'Automatically pre-select duplicates for cleanup based on rules below.'
                      : 'Auto-select is toggled OFF. All candidates remain unselected until you pick them manually.'}
                  </p>
                </div>
              </div>

              {/* Accessible thumb-friendly Switch */}
              <button
                id="toggle-auto-select-master-btn"
                type="button"
                role="switch"
                aria-checked={draftPrefs.enabled}
                onClick={() => setDraftPrefs({ ...draftPrefs, enabled: !draftPrefs.enabled })}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] items-center px-0.5 ${
                  draftPrefs.enabled ? 'bg-[#C75B12]' : 'bg-[#333333]'
                }`}
                title={draftPrefs.enabled ? 'Click to toggle Auto-Select OFF' : 'Click to toggle Auto-Select ON'}
              >
                <span className="sr-only">Toggle Auto-Select</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-[#F5E9DC] shadow-lg ring-0 transition duration-200 ease-in-out ${
                    draftPrefs.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {!draftPrefs.enabled && (
              <div className="mt-3 pt-3 border-t border-[#2a2a2a] text-xs text-[#C9A86A] flex items-center justify-between gap-2">
                <span>Auto-select is currently disabled. Manual review active.</span>
                <button
                  type="button"
                  onClick={() => setDraftPrefs({ ...draftPrefs, enabled: true })}
                  className="font-bold underline hover:text-[#F5E9DC] transition-colors shrink-0"
                >
                  Turn ON
                </button>
              </div>
            )}
          </div>

          {/* Section 1: Primary Keeper Preference */}
          <div className={`space-y-3 transition-opacity ${!draftPrefs.enabled ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
                1. Keeper Preference (Which File to Keep)
              </label>
              <span className="text-[11px] text-[#F5E9DC]/50">Primary Rule</span>
            </div>
            <p className="text-xs text-[#F5E9DC]/70">
              When duplicate files are compared, which one should Ivy designate as the permanent original to KEEP?
            </p>

            <div className="space-y-2">
              {keeperOptions.map((opt) => {
                const isSelected = draftPrefs.keeperPreference === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`btn-keeper-pref-${opt.id}`}
                    type="button"
                    onClick={() => setDraftPrefs({ ...draftPrefs, keeperPreference: opt.id })}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start space-x-3 min-h-[52px] ${
                      isSelected
                        ? 'bg-[#C75B12]/15 border-[#C75B12] text-[#F5E9DC]'
                        : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#383838] text-[#F5E9DC]/80'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-[#F5E9DC]">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-bold text-[#C75B12] flex items-center">
                            <Check className="w-3.5 h-3.5 mr-1 inline" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#F5E9DC]/60 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Secondary Tie-Breaker */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
              2. Tie-Breaker Resolution
            </label>
            <p className="text-xs text-[#F5E9DC]/70">
              If the primary rule is equal (e.g. identical file sizes or identical timestamps):
            </p>
            <select
              id="select-secondary-preference"
              value={draftPrefs.secondaryPreference}
              onChange={(e) =>
                setDraftPrefs({
                  ...draftPrefs,
                  secondaryPreference: e.target.value as KeeperPreference,
                })
              }
              className="w-full bg-[#111111] border border-[#333333] rounded-xl px-3.5 py-2.5 text-sm text-[#F5E9DC] focus:outline-none focus:border-[#C75B12] min-h-[44px]"
            >
              <option value="newer">Tie-breaker: Newer modified date</option>
              <option value="largest">Tie-breaker: Largest file size</option>
              <option value="cleanest_name">Tie-breaker: Cleanest file name (no copy tags)</option>
              <option value="older">Tie-breaker: Earliest modified date</option>
              <option value="smallest">Tie-breaker: Smallest file size</option>
            </select>
          </div>

          {/* Section 3: Content Signal Priority */}
          <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] space-y-2">
            <div className="flex items-start justify-between space-x-3">
              <div className="flex-1">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#C9A86A]" />
                  <span className="font-semibold text-sm text-[#F5E9DC]">
                    Honor explicit version statements in text
                  </span>
                </div>
                <p className="text-xs text-[#F5E9DC]/60 mt-1 leading-relaxed">
                  If notes explicitly state &ldquo;v2 supersedes v1&rdquo; or &ldquo;final approved draft&rdquo;, honor this editorial intent over raw timestamps and file sizes.
                </p>
              </div>
              <input
                id="checkbox-respect-content-signals"
                type="checkbox"
                checked={draftPrefs.respectContentSignals}
                onChange={(e) =>
                  setDraftPrefs({ ...draftPrefs, respectContentSignals: e.target.checked })
                }
                className="w-5 h-5 accent-[#C75B12] rounded cursor-pointer mt-1 flex-shrink-0"
              />
            </div>
          </div>

          {/* Section 4: What Gets Auto-Selected for Cleanup */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
              3. Automated Selection Scope
            </label>
            <p className="text-xs text-[#F5E9DC]/70">
              Select which categories of duplicates should be automatically checked for cleanup:
            </p>

            <div className="space-y-2">
              {/* Exact Duplicates */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer hover:border-[#383838] transition-colors">
                <input
                  id="checkbox-auto-select-exact"
                  type="checkbox"
                  checked={draftPrefs.autoSelectExact}
                  onChange={(e) =>
                    setDraftPrefs({ ...draftPrefs, autoSelectExact: e.target.checked })
                  }
                  className="w-5 h-5 accent-[#C75B12] rounded cursor-pointer mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#F5E9DC]">
                      Exact byte/hash duplicates
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#1b3820] text-[#7dd88f]">
                      100% Safe
                    </span>
                  </div>
                  <p className="text-xs text-[#F5E9DC]/60 mt-0.5">
                    100% byte-identical duplicates with zero divergence.
                  </p>
                </div>
              </label>

              {/* Draft Versions */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer hover:border-[#383838] transition-colors">
                <input
                  id="checkbox-auto-select-drafts"
                  type="checkbox"
                  checked={draftPrefs.autoSelectDrafts}
                  onChange={(e) =>
                    setDraftPrefs({ ...draftPrefs, autoSelectDrafts: e.target.checked })
                  }
                  className="w-5 h-5 accent-[#C75B12] rounded cursor-pointer mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#F5E9DC]">
                      Linear draft revisions
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#352514] text-[#C9A86A]">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-[#F5E9DC]/60 mt-0.5">
                    Sequential note drafts where edits progressed linearly into the keeper file.
                  </p>
                </div>
              </label>

              {/* Divergent Notes Warning */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer hover:border-[#383838] transition-colors">
                <input
                  id="checkbox-auto-select-divergent"
                  type="checkbox"
                  checked={draftPrefs.autoSelectDivergent}
                  onChange={(e) =>
                    setDraftPrefs({ ...draftPrefs, autoSelectDivergent: e.target.checked })
                  }
                  className="w-5 h-5 accent-[#C75B12] rounded cursor-pointer mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#F5E9DC] flex items-center">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#C75B12] mr-1 inline" />
                      Divergent draft files
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#3b1919] text-[#f87171]">
                      Caution
                    </span>
                  </div>
                  <p className="text-xs text-[#F5E9DC]/60 mt-0.5">
                    Drafts containing unique paragraphs not found in the keeper note. Keep unchecked to review manually.
                  </p>
                </div>
              </label>

              {/* Minimum Similarity Threshold */}
              <div className="p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#F5E9DC]">
                    Minimum Content Similarity Gate
                  </span>
                  <span className="text-xs font-mono font-bold text-[#C75B12] bg-[#C75B12]/15 px-2 py-0.5 rounded-md">
                    {Math.round(draftPrefs.minSimilarityThreshold * 100)}%
                  </span>
                </div>
                <p className="text-xs text-[#F5E9DC]/60">
                  Only auto-select near-duplicate drafts that share at least this much verified text content:
                </p>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[0.7, 0.75, 0.8, 0.9].map((val) => (
                    <button
                      key={val}
                      id={`btn-similarity-preset-${Math.round(val * 100)}`}
                      type="button"
                      onClick={() => setDraftPrefs({ ...draftPrefs, minSimilarityThreshold: val })}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] flex items-center justify-center ${
                        Math.abs(draftPrefs.minSimilarityThreshold - val) < 0.02
                          ? 'bg-[#C75B12] border-[#C75B12] text-white shadow'
                          : 'bg-[#111111] border-[#333333] text-[#F5E9DC]/80 hover:border-[#444444]'
                      }`}
                    >
                      {Math.round(val * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Scan Automation */}
          <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] space-y-2">
            <div className="flex items-start justify-between space-x-3">
              <div className="flex-1">
                <div className="flex items-center space-x-1.5">
                  <FileCheck className="w-4 h-4 text-[#7dd88f]" />
                  <span className="font-semibold text-sm text-[#F5E9DC]">
                    Auto-apply rules upon scan completion
                  </span>
                </div>
                <p className="text-xs text-[#F5E9DC]/60 mt-1 leading-relaxed">
                  When a folder scan finishes, automatically pre-select matching duplicate candidates according to these rules.
                </p>
              </div>
              <input
                id="checkbox-auto-apply-on-scan"
                type="checkbox"
                checked={draftPrefs.autoApplyOnScan}
                onChange={(e) =>
                  setDraftPrefs({ ...draftPrefs, autoApplyOnScan: e.target.checked })
                }
                className="w-5 h-5 accent-[#C75B12] rounded cursor-pointer mt-1 flex-shrink-0"
              />
            </div>
          </div>

          {/* Section 6: Live Scan Impact Preview */}
          {matchesList.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#111111] border border-[#333333] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
                  Impact on Current Results
                </span>
                <span className="text-xs font-bold text-[#F5E9DC]">
                  {draftPrefs.enabled
                    ? `${simulatedSelectedIds.length} of ${matchesList.length} items`
                    : `0 of ${matchesList.length} items (Auto-Select OFF)`}
                </span>
              </div>
              <p className="text-xs text-[#F5E9DC]/70 leading-relaxed">
                {draftPrefs.enabled
                  ? `Applying these preferences will select ${simulatedSelectedIds.length} duplicate file(s) for cleanup and designate the corresponding original(s) to keep.`
                  : 'Auto-select is toggled OFF. Applying will clear automatic selections so you can manually review and choose any items to trash.'}
              </p>
              {onApplyToCurrent && (
                <button
                  id="btn-apply-to-current-matches"
                  type="button"
                  onClick={handleApplyNow}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#444444] text-[#F5E9DC] font-medium text-xs flex items-center justify-center space-x-2 min-h-[44px] transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[#C75B12]" />
                  <span>
                    {draftPrefs.enabled
                      ? 'Apply Rules to Current Scan Results'
                      : 'Apply (Deselect All & Switch to Manual)'}
                  </span>
                </button>
              )}
              {appliedCount !== null && (
                <p className="text-[11px] text-[#7dd88f] text-center font-medium">
                  {draftPrefs.enabled
                    ? `✓ Successfully applied rules to ${appliedCount} items in current scan`
                    : '✓ Auto-select disabled. All candidates deselected for manual review.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#262626] bg-[#111111] space-y-2 sticky bottom-0">
          <div className="flex items-center space-x-3">
            <button
              id="btn-reset-auto-select-defaults"
              type="button"
              onClick={handleResetDefaults}
              className="py-3 px-3.5 rounded-xl border border-[#333333] text-[#F5E9DC]/70 hover:text-[#F5E9DC] hover:bg-[#222222] text-xs font-semibold flex items-center justify-center space-x-1.5 min-h-[48px] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            <button
              id="btn-save-auto-select-preferences"
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 px-4 rounded-xl bg-[#C75B12] hover:bg-[#b5500e] active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-lg flex items-center justify-center space-x-2 min-h-[48px] transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
