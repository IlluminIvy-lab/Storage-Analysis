import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowRight,
  GitCompare,
  Filter,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Info,
} from 'lucide-react';
import { DuplicateMatch, DriveFileItem, CleanupMetrics } from '../types';

interface SmartScanReviewViewProps {
  folderName: string;
  actionableMatches: DuplicateMatch[];
  uncertainMatches: DuplicateMatch[];
  uniqueFiles: DriveFileItem[];
  metrics: CleanupMetrics | null;
  selectedMatchIds: string[];
  keptMatchIds?: string[];
  onToggleSelectMatch: (id: string) => void;
  onSelectSafeOnly: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onKeepAll: () => void;
  onResetKept?: () => void;
  onToggleKeepMatch?: (id: string) => void;
  onFinalizeKeepAll?: () => void;
  onOpenComparison: (match: DuplicateMatch) => void;
  onProceedToDetailedResults: () => void;
  onConfirmTrashApproved: () => void;
  onCancelWorkflow?: () => void;
}

export const SmartScanReviewView: React.FC<SmartScanReviewViewProps> = ({
  folderName,
  actionableMatches,
  uncertainMatches,
  uniqueFiles,
  metrics,
  selectedMatchIds,
  keptMatchIds = [],
  onToggleSelectMatch,
  onSelectSafeOnly,
  onSelectAll,
  onDeselectAll,
  onKeepAll,
  onResetKept,
  onToggleKeepMatch,
  onFinalizeKeepAll,
  onOpenComparison,
  onProceedToDetailedResults,
  onConfirmTrashApproved,
  onCancelWorkflow,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Group matches by safety tier
  const exactMatches = actionableMatches.filter((m) => m.type === 'exact');
  const divergentMatches = actionableMatches.filter((m) => m.hasSignificantDivergence);
  const linearDraftMatches = actionableMatches.filter(
    (m) => m.type === 'near-duplicate' && !m.hasSignificantDivergence
  );

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedCount = selectedMatchIds.length;
  const keptCount = keptMatchIds.length;
  const allKept = actionableMatches.length > 0 && keptCount >= actionableMatches.length;
  const selectedDivergentCount = divergentMatches.filter((m) => selectedMatchIds.includes(m.id)).length;

  return (
    <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 animate-in fade-in duration-200">
      {/* Smart Review Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#282828]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12]">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#C9A86A]">
              Smart Scan Complete &bull; Interactive Review Stage
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5E9DC]">
            Smart Cleanup Review for &ldquo;{folderName}&rdquo;
          </h2>
          <p className="text-xs text-[#A0988E] max-w-2xl leading-relaxed">
            AI content and hash analysis has classified detected files into safety tiers. Review recommendations below, cross-check divergent versions, or click <strong className="text-emerald-300">Keep All</strong> to ignore all duplicates for fast bulk handling.
          </p>
        </div>

        {/* Quick approval action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onCancelWorkflow && (
            <button
              id="cancel-review-btn"
              onClick={onCancelWorkflow}
              className="px-3.5 py-2.5 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#383838] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              title="Stop and return to scan configuration"
            >
              <span>Cancel Review</span>
            </button>
          )}

          <button
            id="keep-all-header-btn"
            onClick={onKeepAll}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
              allKept
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                : 'bg-[#222222] hover:bg-[#2c2c2c] border-[#383838] text-emerald-400 hover:text-emerald-300'
            }`}
            title="Mark all identified duplicates as kept / ignored and exclude them from trashing"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{allKept ? 'All Kept (Ignored)' : 'Keep All'}</span>
          </button>

          <button
            onClick={onSelectSafeOnly}
            className="px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#303030] border border-[#383838] text-[#F5E9DC] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
            title="Select all exact duplicates and linear drafts, leaving divergent drafts unselected"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Select Safe Only</span>
          </button>

          <button
            onClick={onConfirmTrashApproved}
            disabled={selectedCount === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] cursor-pointer ${
              selectedCount > 0
                ? 'bg-gradient-to-r from-[#C75B12] to-[#b3510e] hover:from-[#d66518] hover:to-[#c25810] text-[#F5E9DC] shadow-[#C75B12]/20'
                : 'bg-[#222222] text-[#666666] cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash {selectedCount} Approved File{selectedCount === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>

      {/* Keep All Active Banner */}
      {allKept && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-200 text-sm">
                All {actionableMatches.length} duplicates marked as Kept / Ignored
              </h4>
              <p className="text-emerald-300/80 text-[11px]">
                No files will be moved to Google Drive Trash. All drafts and versions are preserved safely.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {onResetKept && (
              <button
                onClick={onResetKept}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset / Re-evaluate
              </button>
            )}
            {onFinalizeKeepAll && (
              <button
                onClick={onFinalizeKeepAll}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#111111] text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Finalize Clean Report (0 Trashed)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Partial Kept Indicator (when some files are kept but not all) */}
      {!allKept && keptCount > 0 && (
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>{keptCount}</strong> file{keptCount === 1 ? '' : 's'} marked as kept / ignored and excluded from trash.
            </span>
          </div>
          {onResetKept && (
            <button
              onClick={onResetKept}
              className="text-[11px] text-emerald-400 underline hover:text-emerald-300 cursor-pointer"
            >
              Reset Kept
            </button>
          )}
        </div>
      )}

      {/* Safety Alert if any divergent files are currently selected */}
      {selectedDivergentCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border-2 border-amber-500/50 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-300">
              Notice: {selectedDivergentCount} Divergent File{selectedDivergentCount === 1 ? '' : 's'} Currently Selected
            </h4>
            <p className="text-[#D8D0C5] leading-relaxed">
              You have selected draft files where both versions contain significant, different content changes. We recommend verifying their unique diffs in the comparison viewer or unselecting them before trashing.
            </p>
            <button
              onClick={onSelectSafeOnly}
              className="mt-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Exclude Divergent Files (Keep Safe Only)</span>
            </button>
          </div>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <span className="text-[11px] text-[#A0988E] font-medium">Exact Duplicates</span>
          <div className="text-xl font-black text-rose-400 flex items-center gap-2">
            <span>{exactMatches.length}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              100% Safe
            </span>
          </div>
          <p className="text-[10px] text-[#888888]">Byte or text identical copies</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <span className="text-[11px] text-[#A0988E] font-medium">Linear Drafts</span>
          <div className="text-xl font-black text-amber-400 flex items-center gap-2">
            <span>{linearDraftMatches.length}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Low Risk
            </span>
          </div>
          <p className="text-[10px] text-[#888888]">Newer copy supersedes older</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <span className="text-[11px] text-[#A0988E] font-medium">Divergent Versions</span>
          <div className="text-xl font-black text-amber-300 flex items-center gap-2">
            <span>{divergentMatches.length}</span>
            {divergentMatches.length > 0 ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/50">
                Review Needed
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                None
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#888888]">Independent edits detected</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <span className="text-[11px] text-[#A0988E] font-medium">Unique Kept Files</span>
          <div className="text-xl font-black text-emerald-400">
            {uniqueFiles.length}
          </div>
          <p className="text-[10px] text-[#888888]">Retained in folder untouched</p>
        </div>
      </div>

      {/* Tier 1: Exact Duplicates */}
      {exactMatches.length > 0 && (
        <div className="border border-[#262626] bg-[#141414] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('exact')}
            className="w-full p-4 bg-[#1a1a1a] flex items-center justify-between text-left hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <h3 className="text-sm font-bold text-[#F5E9DC]">
                Tier 1: Exact Duplicates ({exactMatches.length})
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Safe to Clean
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#A0988E]">
              <span>
                {exactMatches.filter((m) => selectedMatchIds.includes(m.id)).length} selected
              </span>
              {collapsedSections['exact'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </button>

          {!collapsedSections['exact'] && (
            <div className="p-3 divide-y divide-[#222222] space-y-2">
              {exactMatches.map((match) => {
                const isSelected = selectedMatchIds.includes(match.id);
                const isKept = keptMatchIds.includes(match.id);
                return (
                  <div
                    key={match.id}
                    className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleSelectMatch(match.id)}
                        className="mt-0.5 text-[#C75B12] hover:text-[#e06718] cursor-pointer"
                        title={isSelected ? 'Unselect from trash' : 'Select for trash'}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[#666666]" />}
                      </button>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${isKept ? 'text-[#F5E9DC]' : 'text-rose-300 line-through'}`}>
                            {match.targetFile.name}
                          </span>
                          <span className="text-[#666666]">&rarr;</span>
                          <span className="text-emerald-400 font-medium">
                            Keeps: {match.originalFile.name}
                          </span>
                          {isKept && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Kept &bull; Safe</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#888888]">{match.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {onToggleKeepMatch && (
                        <button
                          onClick={() => onToggleKeepMatch(match.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            isKept
                              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                              : 'bg-[#222222] hover:bg-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC]'
                          }`}
                          title={isKept ? 'Unmark kept' : 'Mark this duplicate as kept / ignored'}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{isKept ? 'Kept' : 'Keep'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onOpenComparison(match)}
                        className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-[#F5E9DC] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <GitCompare className="w-3 h-3 text-[#C9A86A]" />
                        <span>Compare</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tier 2: Linear Draft Progression */}
      {linearDraftMatches.length > 0 && (
        <div className="border border-[#262626] bg-[#141414] rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('linear')}
            className="w-full p-4 bg-[#1a1a1a] flex items-center justify-between text-left hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h3 className="text-sm font-bold text-[#F5E9DC]">
                Tier 2: Linear Draft Progression ({linearDraftMatches.length})
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Low Risk &bull; Chronological
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#A0988E]">
              <span>
                {linearDraftMatches.filter((m) => selectedMatchIds.includes(m.id)).length} selected
              </span>
              {collapsedSections['linear'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </button>

          {!collapsedSections['linear'] && (
            <div className="p-3 divide-y divide-[#222222] space-y-2">
              {linearDraftMatches.map((match) => {
                const isSelected = selectedMatchIds.includes(match.id);
                const isKept = keptMatchIds.includes(match.id);
                return (
                  <div
                    key={match.id}
                    className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleSelectMatch(match.id)}
                        className="mt-0.5 text-[#C75B12] hover:text-[#e06718] cursor-pointer"
                        title={isSelected ? 'Unselect from trash' : 'Select for trash'}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[#666666]" />}
                      </button>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${isKept ? 'text-[#F5E9DC]' : 'text-amber-200 line-through'}`}>
                            {match.targetFile.name}
                          </span>
                          <span className="text-[#666666]">&rarr;</span>
                          <span className="text-emerald-400 font-medium">
                            Keeps: {match.originalFile.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#222222] text-[#A0988E]">
                            {Math.round(match.similarityScore * 100)}% match
                          </span>
                          {isKept && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Kept &bull; Safe</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#888888]">{match.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {onToggleKeepMatch && (
                        <button
                          onClick={() => onToggleKeepMatch(match.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            isKept
                              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                              : 'bg-[#222222] hover:bg-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC]'
                          }`}
                          title={isKept ? 'Unmark kept' : 'Mark this draft as kept / ignored'}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{isKept ? 'Kept' : 'Keep'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onOpenComparison(match)}
                        className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-[#F5E9DC] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <GitCompare className="w-3 h-3 text-[#C9A86A]" />
                        <span>Compare</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tier 3: Divergent Edits (Manual Verification Alert) */}
      {divergentMatches.length > 0 && (
        <div className="border-2 border-amber-500/50 bg-[#16120e] rounded-2xl overflow-hidden shadow-lg shadow-amber-950/20">
          <button
            onClick={() => toggleSection('divergent')}
            className="w-full p-4 bg-gradient-to-r from-amber-950/40 to-[#1f1710] flex items-center justify-between text-left hover:bg-amber-950/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold text-amber-200">
                Tier 3: Divergent Versions &bull; Manual Verification Flagged ({divergentMatches.length})
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black">
                Review Required
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <span>
                {divergentMatches.filter((m) => selectedMatchIds.includes(m.id)).length} selected
              </span>
              {collapsedSections['divergent'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </button>

          {!collapsedSections['divergent'] && (
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                <p>
                  <strong>Why flagged:</strong> Both versions have independent edits or unique lines. Trashing these older copies before manual cross-checking might permanently delete unmerged thoughts or notes.
                </p>
              </div>

              <div className="divide-y divide-amber-900/30 space-y-2">
                {divergentMatches.map((match) => {
                  const isSelected = selectedMatchIds.includes(match.id);
                  const isKept = keptMatchIds.includes(match.id);
                  return (
                    <div
                      key={match.id}
                      className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => onToggleSelectMatch(match.id)}
                          className="mt-0.5 text-amber-400 hover:text-amber-300 cursor-pointer"
                          title={isSelected ? 'Unselect from trash' : 'Select for trash'}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[#888888]" />}
                        </button>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-bold ${isKept ? 'text-[#F5E9DC]' : 'text-amber-300'}`}>
                              {match.targetFile.name}
                            </span>
                            <span className="text-[#888888]">&harr;</span>
                            <span className="text-[#F5E9DC]">
                              {match.originalFile.name}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300">
                              ⚠️ {match.divergenceInfo?.uniqueToTargetCount || 2}+ Unique Lines
                            </span>
                            {isKept && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Kept &bull; Preserved</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#C8BFB5] leading-relaxed">
                            {match.divergenceInfo?.summaryMessage || match.reason}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {onToggleKeepMatch && (
                          <button
                            onClick={() => onToggleKeepMatch(match.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isKept
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                : 'bg-[#222222] hover:bg-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC]'
                            }`}
                            title={isKept ? 'Unmark kept' : 'Keep both divergent versions safely'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isKept ? 'Kept' : 'Keep'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => onOpenComparison(match)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Inspect Divergence</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="pt-4 border-t border-[#282828] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A0988E]">
          <span>Selection: <strong className="text-[#F5E9DC]">{selectedCount}</strong> of {actionableMatches.length} files approved</span>
          <button
            onClick={onSelectAll}
            className="text-[11px] text-[#C9A86A] hover:underline cursor-pointer ml-1"
          >
            Select All
          </button>
          <span className="text-[#666666]">&bull;</span>
          <button
            onClick={onDeselectAll}
            className="text-[11px] text-[#A0988E] hover:underline cursor-pointer"
          >
            Clear
          </button>
          <span className="text-[#666666]">&bull;</span>
          <button
            id="keep-all-footer-link"
            onClick={onKeepAll}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer flex items-center gap-1"
            title="Mark all duplicates as kept or ignored"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Keep All</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            id="keep-all-footer-btn"
            onClick={onKeepAll}
            className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] ${
              allKept
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#222222] hover:bg-[#2c2c2c] border-[#383838] text-emerald-400 hover:text-emerald-300'
            }`}
            title="Mark all identified duplicates as kept / ignored"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{allKept ? 'All Kept' : 'Keep All'}</span>
          </button>

          <button
            onClick={onProceedToDetailedResults}
            className="px-4 py-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-[#F5E9DC] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <Filter className="w-3.5 h-3.5 text-[#C9A86A]" />
            <span>Granular Results & Filters</span>
          </button>

          <button
            onClick={onConfirmTrashApproved}
            disabled={selectedCount === 0}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all min-h-[44px] cursor-pointer ${
              selectedCount > 0
                ? 'bg-gradient-to-r from-[#C75B12] to-[#b3510e] hover:from-[#d66518] hover:to-[#c25810] text-[#F5E9DC] shadow-[#C75B12]/20'
                : 'bg-[#222222] text-[#666666] cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Execute Approved Cleanup</span>
          </button>
        </div>
      </div>
    </div>
  );
};
