import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Download,
  Eye,
  BookmarkCheck,
  X,
  HardDrive,
  ArrowRight,
  Shield,
  Layers,
  FileCode,
  FileText,
  FileSpreadsheet,
  FolderDown,
} from 'lucide-react';
import { DriveFileItem, DuplicateMatch } from '../types';
import { formatBytes, getEstimatedFileSize } from '../lib/formatters';
import { ReportExportFormat } from '../lib/exportReport';

interface ScanSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  scannedFiles: DriveFileItem[];
  actionableMatches: DuplicateMatch[];
  uncertainMatches: DuplicateMatch[];
  uniqueFiles: DriveFileItem[];
  onReviewAllDetails: () => void;
  onSelectExactOnlyAndReview: () => void;
  onKeepEverythingForNow: () => void;
  onExportReport: (format?: ReportExportFormat) => void;
}

export const ScanSummaryModal: React.FC<ScanSummaryModalProps> = ({
  isOpen,
  onClose,
  folderName,
  scannedFiles,
  actionableMatches,
  uncertainMatches,
  uniqueFiles,
  onReviewAllDetails,
  onSelectExactOnlyAndReview,
  onKeepEverythingForNow,
  onExportReport,
}) => {
  if (!isOpen) return null;

  const exactMatches = actionableMatches.filter((m) => m.type === 'exact');
  const draftMatches = actionableMatches.filter((m) => m.type !== 'exact');

  const exactCount = exactMatches.length;
  const draftCount = draftMatches.length;
  const uncertainCount = uncertainMatches.length;
  const uniqueCount = uniqueFiles.length;
  const totalScanned = scannedFiles.length;

  // Calculate potential space savings
  const potentialReclaimBytes = actionableMatches.reduce(
    (acc, m) => acc + getEstimatedFileSize(m.targetFile),
    0
  );
  const exactReclaimBytes = exactMatches.reduce(
    (acc, m) => acc + getEstimatedFileSize(m.targetFile),
    0
  );

  return (
    <div
      id="scan-summary-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="scan-summary-modal-card"
        className="bg-[#141414] border border-[#2e2e2e] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#242424] flex items-center justify-between bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#F5E9DC] font-['Montserrat']">
                  Scan Findings Summary
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <p className="text-xs text-[#A0988E] flex items-center gap-1.5 mt-0.5">
                <HardDrive className="w-3.5 h-3.5 text-[#C9A86A]" />
                <span className="truncate max-w-[240px]">{folderName}</span>
              </p>
            </div>
          </div>

          <button
            id="scan-summary-close-btn"
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC] flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            title="Dismiss summary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Main concise narrative paragraph */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
            <p className="text-sm text-[#F5E9DC] leading-relaxed font-medium">
              Found{' '}
              <strong className="text-[#C9A86A] font-bold">
                {exactCount} exact duplicate pair{exactCount === 1 ? '' : 's'}
              </strong>{' '}
              and{' '}
              <strong className="text-[#C75B12] font-bold">
                {draftCount} draft/version pair{draftCount === 1 ? '' : 's'}
              </strong>
              .{' '}
              <strong className="text-emerald-400 font-bold">
                {uniqueCount} file{uniqueCount === 1 ? '' : 's'}
              </strong>{' '}
              {uniqueCount === 1 ? 'is' : 'are'} unique and unaffected.
            </p>
            {potentialReclaimBytes > 0 && (
              <p className="text-xs text-[#A0988E] mt-2 flex items-center gap-1.5">
                <span>Total potential space to recover:</span>
                <span className="font-semibold text-[#F5E9DC]">
                  {formatBytes(potentialReclaimBytes)}
                </span>
                {exactCount > 0 && (
                  <span className="text-[#888888]">
                    ({formatBytes(exactReclaimBytes)} in exact duplicates)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Scannable Breakdown Cards */}
          <div className="space-y-2 text-xs">
            {/* Exact Duplicates Card */}
            <div className="p-3 rounded-xl bg-[#181818] border border-[#272727] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#F5E9DC] font-semibold flex items-center gap-2">
                    <span>Exact Duplicate Pairs</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      Safest
                    </span>
                  </div>
                  <p className="text-[#888888] text-[11px] mt-0.5 leading-normal">
                    {exactCount > 0
                      ? `${exactCount} file pairs with identical contents or hash. Older duplicate copies can be cleanly trashed.`
                      : 'No exact byte-identical duplicates found.'}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-[#F5E9DC] shrink-0">
                {exactCount}
              </span>
            </div>

            {/* Version & Drafts Card */}
            <div className="p-3 rounded-xl bg-[#181818] border border-[#272727] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-[#C75B12] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#F5E9DC] font-semibold flex items-center gap-2">
                    <span>Draft &amp; Version Pairs</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#C75B12]/20 text-[#C75B12] font-bold">
                      Reviewed
                    </span>
                  </div>
                  <p className="text-[#888888] text-[11px] mt-0.5 leading-normal">
                    {draftCount > 0
                      ? `${draftCount} pairs where a newer or final version supersedes older working drafts.`
                      : 'No version/draft conflicts detected.'}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-[#F5E9DC] shrink-0">
                {draftCount}
              </span>
            </div>

            {/* Unique / Untouched Files */}
            <div className="p-3 rounded-xl bg-[#181818] border border-[#272727] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#F5E9DC] font-semibold flex items-center gap-2">
                    <span>Unique &amp; Latest Copies</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#C9A86A]/20 text-[#C9A86A] font-bold">
                      Preserved
                    </span>
                  </div>
                  <p className="text-[#888888] text-[11px] mt-0.5 leading-normal">
                    {uniqueCount} files are completely unique or confirmed primary versions and remain untouched.
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-[#F5E9DC] shrink-0">
                {uniqueCount}
              </span>
            </div>

            {/* Uncertain / Flagged if any */}
            {uncertainCount > 0 && (
              <div className="p-3 rounded-xl bg-[#1e1610] border border-[#C75B12]/30 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#C75B12] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[#F5E9DC] font-semibold flex items-center gap-2">
                      <span>Flagged for Human Review</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                        Uncertain
                      </span>
                    </div>
                    <p className="text-[#A0988E] text-[11px] mt-0.5 leading-normal">
                      {uncertainCount} candidate pairs modified within 5 minutes without clear version words; skipped from auto-selection.
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#C75B12] shrink-0">
                  {uncertainCount}
                </span>
              </div>
            )}
          </div>

          {/* Reassurance Notice */}
          <div className="bg-[#121212] border border-[#222222] rounded-xl p-3 flex items-center gap-2.5 text-[11px] text-[#888888]">
            <Shield className="w-4 h-4 text-[#C9A86A] shrink-0" />
            <p>
              Tapping a choice below takes you to the corresponding filtered review. No files are trashed until you review and explicitly tap Execute Confirmation.
            </p>
          </div>

          {/* Quick-Tap Actions */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A0988E]">
              Choose Next Action
            </h3>

            {/* Action 1: Review All Details */}
            <button
              id="summary-action-review-all-btn"
              type="button"
              onClick={onReviewAllDetails}
              className="w-full p-3.5 rounded-2xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold flex items-center justify-between shadow-lg shadow-[#C75B12]/20 transition-all cursor-pointer min-h-[48px]"
            >
              <div className="flex items-center gap-2.5 text-left">
                <Eye className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-sm font-bold leading-tight">Review All Details</div>
                  <div className="text-[11px] text-[#F5E9DC]/80 font-normal">
                    Inspect all proposed tiers and verify candidates item by item
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 ml-2" />
            </button>

            {/* Action 2: Trash Only Exact Duplicates (safest) */}
            <button
              id="summary-action-exact-only-btn"
              type="button"
              disabled={exactCount === 0}
              onClick={onSelectExactOnlyAndReview}
              className={`w-full p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all min-h-[48px] ${
                exactCount === 0
                  ? 'bg-[#181818] border-[#262626] text-[#666666] cursor-not-allowed opacity-50'
                  : 'bg-[#192219] hover:bg-[#1f2b1f] border-emerald-500/40 text-emerald-300 cursor-pointer shadow-md'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold leading-tight flex items-center gap-1.5">
                    <span>Trash Only Exact Duplicates</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Safest ({exactCount})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A0988E] font-normal">
                    Filter review to only the {exactCount} 100% identical duplicates
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 ml-2 text-emerald-400" />
            </button>

            {/* Action 3: Keep Everything for Now */}
            <button
              id="summary-action-keep-everything-btn"
              type="button"
              onClick={onKeepEverythingForNow}
              className="w-full p-3 rounded-2xl bg-[#1e1e1e] hover:bg-[#262626] border border-[#333333] text-[#F5E9DC] text-xs font-semibold flex items-center justify-between transition-all cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-2.5 text-left">
                <BookmarkCheck className="w-4 h-4 text-[#C9A86A] shrink-0" />
                <div>
                  <div className="text-xs font-bold">Keep Everything for Now</div>
                  <div className="text-[11px] text-[#888888]">
                    Deselect all files and mark everything as kept safe
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-[#A0988E] font-medium">Safe Exit</span>
            </button>

            {/* Action 4: Export Report First in multiple formats */}
            <div
              id="summary-action-export-panel"
              className="w-full p-3 rounded-2xl bg-[#181818] border border-[#2e2e2e] text-[#F5E9DC] text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-left">
                  <FolderDown className="w-4 h-4 text-[#C75B12] shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#F5E9DC]">Export Scan Plan First</div>
                    <div className="text-[11px] text-[#888888]">
                      Download full proposed audit trail before making any changes
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#262626]">
                <button
                  id="summary-export-md-btn"
                  type="button"
                  onClick={() => onExportReport('markdown')}
                  className="p-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                  title="Download Markdown Document (.md)"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C75B12]" />
                  <span className="text-[11px] font-bold">Markdown</span>
                  <span className="text-[9px] text-[#A0988E]">.md</span>
                </button>

                <button
                  id="summary-export-txt-btn"
                  type="button"
                  onClick={() => onExportReport('text')}
                  className="p-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                  title="Download Plain Text Document (.txt)"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
                  <span className="text-[11px] font-bold">Plain Text</span>
                  <span className="text-[9px] text-[#A0988E]">.txt</span>
                </button>

                <button
                  id="summary-export-csv-btn"
                  type="button"
                  onClick={() => onExportReport('csv')}
                  className="p-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer min-h-[44px]"
                  title="Download CSV Spreadsheet (.csv)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold">Spreadsheet</span>
                  <span className="text-[9px] text-[#A0988E]">.csv</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
