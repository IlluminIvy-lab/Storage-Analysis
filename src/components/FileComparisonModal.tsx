import React, { useState, useMemo } from 'react';
import {
  X,
  ExternalLink,
  FileText,
  Calendar,
  HardDrive,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Split,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DuplicateMatch } from '../types';
import { detectContentDivergence } from '../lib/smartFileIntelligence';

interface FileComparisonModalProps {
  match: DuplicateMatch | null;
  onClose: () => void;
}

export const FileComparisonModal: React.FC<FileComparisonModalProps> = ({
  match,
  onClose,
}) => {
  const [showDivergenceInspector, setShowDivergenceInspector] = useState<boolean>(true);
  const [activeDiffTab, setActiveDiffTab] = useState<'both' | 'target_unique' | 'original_unique'>('both');

  const divergence = useMemo(() => {
    if (!match) return null;
    if (match.divergenceInfo) return match.divergenceInfo;
    return detectContentDivergence(match.targetFile, match.originalFile, match.similarityScore);
  }, [match]);

  if (!match || !divergence) return null;

  const { originalFile, targetFile, type, similarityScore, reason, isUncertain, uncertaintyReason } = match;
  const hasSignificantDivergence = divergence.hasSignificantDivergence;

  const openInDrive = (fileId: string) => {
    window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
  };

  const openBothInDrive = () => {
    openInDrive(targetFile.id);
    setTimeout(() => openInDrive(originalFile.id), 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-[#333333] rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              hasSignificantDivergence
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#C75B12]/20 text-[#C75B12]'
            }`}>
              {hasSignificantDivergence ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#F5E9DC]">
                  Document Comparison & Diff
                </h2>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    type === 'exact'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : isUncertain
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {type === 'exact'
                    ? 'Exact Duplicate'
                    : isUncertain
                    ? 'Uncertain Match'
                    : 'Draft Version Pair'}
                </span>

                {hasSignificantDivergence && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Significant Content Divergence</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A0988E]">
                Similarity Score: <strong className="text-[#C9A86A]">{Math.round(similarityScore * 100)}%</strong>
                {hasSignificantDivergence && (
                  <span className="ml-2 text-amber-400">
                    &bull; ~{divergence.divergencePercentage}% non-overlapping changes
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#252525] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close Comparison Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PROMINENT VISUAL WARNING: Triggered when both versions have significant, different content changes */}
        {hasSignificantDivergence && (
          <div className="px-4 sm:px-5 pt-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#22170d] to-amber-900/30 border-2 border-amber-500/60 shadow-lg shadow-amber-950/30 text-xs text-[#F5E9DC] space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-black">
                      MANUAL VERIFICATION REQUIRED
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Conflicting Edits Detected
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-amber-200">
                    Both versions contain significant, different content changes
                  </h3>
                  <p className="text-xs text-[#E5DCD0] leading-relaxed">
                    The older file targeted for trashing (&ldquo;{targetFile.name}&rdquo;) contains{' '}
                    <strong className="text-amber-300 font-bold">{divergence.uniqueToTargetCount} unique line(s) / sections</strong>{' '}
                    that do not appear in the kept version (&ldquo;{originalFile.name}&rdquo;).
                  </p>
                  <p className="text-[11px] text-amber-300/90 font-medium">
                    ⚠️ <strong>Safety Warning:</strong> Trashing this version before manual verification may permanently discard valuable thoughts, meeting points, or edits that were not merged. Please review the unique lines below or open both files in Drive.
                  </p>
                </div>
              </div>

              {/* Quick toggle to inspect specific unique lines */}
              <div className="pt-2 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-200">
                  <span className="font-semibold">Target file:</span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/40 text-rose-200 font-mono">
                    {divergence.uniqueToTargetCount} unique line(s)
                  </span>
                  <span className="mx-1 text-[#888888]">&bull;</span>
                  <span className="font-semibold">Kept file:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-mono">
                    {divergence.uniqueToOriginalCount} unique line(s)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDivergenceInspector(!showDivergenceInspector)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>{showDivergenceInspector ? 'Hide Unique Diff' : 'Inspect Unique Diff'}</span>
                    {showDivergenceInspector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={openBothInDrive}
                    className="px-2.5 py-1 rounded-lg bg-[#252525] hover:bg-[#333333] border border-[#444444] text-[#F5E9DC] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Open both documents in Google Drive to cross-check"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C9A86A]" />
                    <span>Open Both in Drive</span>
                  </button>
                </div>
              </div>

              {/* Unique Lines Diff Box */}
              {showDivergenceInspector && (
                <div className="mt-2 bg-[#12100e] border border-amber-500/30 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#2a221b]">
                    <span className="font-semibold text-amber-300">
                      Unmerged Sections in Target File (Would be lost if trashed):
                    </span>
                    <span className="text-[10px] text-[#A0988E]">Showing preview of unique lines</span>
                  </div>

                  {divergence.uniqueToTargetLines && divergence.uniqueToTargetLines.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {divergence.uniqueToTargetLines.map((line, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200 text-[11px] font-mono leading-relaxed"
                        >
                          <span className="text-rose-400 font-bold mr-1.5">-</span>
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#888888] italic">No line-level text parsed (binary or non-text file).</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reason card */}
        <div className="px-4 sm:px-5 pt-3">
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              isUncertain
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-[#202020] border-[#2c2c2c] text-[#D8D0C5]'
            }`}
          >
            <span className="font-semibold text-[#F5E9DC]">Agent Analysis: </span>
            {reason}
            {isUncertain && uncertaintyReason && (
              <p className="mt-1 text-amber-400 font-medium">Notice: {uncertaintyReason}</p>
            )}
          </div>
        </div>

        {/* Side-by-side files */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kept (Newer) File */}
          <div className="bg-[#141414] border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>KEPT (Newer Version)</span>
              </div>
              <button
                onClick={() => openInDrive(originalFile.id)}
                className="text-[11px] text-[#A0988E] hover:text-[#F5E9DC] flex items-center gap-1 p-1 hover:underline cursor-pointer"
              >
                <span>View Drive</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="font-bold text-[#F5E9DC] break-all">{originalFile.name}</p>
              <div className="text-[#A0988E] space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#C9A86A]" />
                  <span>Modified: {new Date(originalFile.modifiedTime).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-[#C9A86A]" />
                  <span>Size: {originalFile.size ? `${originalFile.size} bytes` : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Content snippet */}
            <div className="mt-2 flex-1 flex flex-col">
              <span className="text-[11px] font-semibold text-[#888888] mb-1">Content Preview:</span>
              <div className="bg-[#0c0c0c] border border-[#222222] rounded-lg p-3 text-[11px] font-mono text-[#D8D0C5] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {originalFile.content || '[No text content available or binary file]'}
              </div>
            </div>
          </div>

          {/* Trashed (Older) File */}
          <div
            className={`rounded-xl p-4 flex flex-col gap-3 border ${
              hasSignificantDivergence
                ? 'bg-[#181310] border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-[#141414] border-rose-500/30'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#252525]">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span className={hasSignificantDivergence ? 'text-amber-300' : 'text-rose-400'}>
                  {isUncertain ? 'RETAINED (Uncertain)' : 'PROPOSED FOR TRASH (Older Copy)'}
                </span>
              </div>
              <button
                onClick={() => openInDrive(targetFile.id)}
                className="text-[11px] text-[#A0988E] hover:text-[#F5E9DC] flex items-center gap-1 p-1 hover:underline cursor-pointer"
              >
                <span>View Drive</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-[#F5E9DC] break-all">{targetFile.name}</p>
                {hasSignificantDivergence && (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    ⚠️ Has Unique Edits
                  </span>
                )}
              </div>
              <div className="text-[#A0988E] space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#C9A86A]" />
                  <span>Modified: {new Date(targetFile.modifiedTime).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-[#C9A86A]" />
                  <span>Size: {targetFile.size ? `${targetFile.size} bytes` : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Content snippet */}
            <div className="mt-2 flex-1 flex flex-col">
              <span className="text-[11px] font-semibold text-[#888888] mb-1">Content Preview:</span>
              <div className="bg-[#0c0c0c] border border-[#222222] rounded-lg p-3 text-[11px] font-mono text-[#D8D0C5] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {targetFile.content || '[No text content available or binary file]'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#282828] bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#A0988E]">
            <span>
              {type === 'exact'
                ? 'Identical hash / text match'
                : `Overlap ratio: ${Math.round(similarityScore * 100)}%`}
            </span>
            {hasSignificantDivergence && (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                &bull; <AlertTriangle className="w-3.5 h-3.5" /> Verify manually before trashing
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasSignificantDivergence && (
              <button
                onClick={openBothInDrive}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                <span>Open Both in Drive</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-[#F5E9DC] text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
