import React, { useState } from 'react';
import {
  Trash2,
  AlertCircle,
  FileCheck2,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  GitCompare,
  PauseCircle,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  Sparkles,
  RefreshCw,
  BrainCircuit,
  FolderDown,
} from 'lucide-react';
import { CleanupReport, DuplicateMatch } from '../types';
import {
  exportReportToCsv,
  exportReportToMarkdown,
  exportReportToText,
  exportReport,
  generateMarkdownReport,
  generatePlainTextReport,
  ReportExportFormat,
} from '../lib/exportReport';
import { DownloadReportModal } from './DownloadReportModal';
import { ScanMetricsCard } from './ScanMetricsCard';
import { computeScanMetrics } from '../lib/formatters';

interface ReportViewProps {
  report: CleanupReport;
  onRestoreFile?: (fileId: string) => Promise<void>;
  onOpenComparison: (match: DuplicateMatch) => void;
  onRestartScan: () => void;
  onRefreshInsight?: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  report,
  onRestoreFile,
  onOpenComparison,
  onRestartScan,
  onRefreshInsight,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'trashed' | 'uncertain' | 'kept' | 'raw'>('trashed');
  const [copied, setCopied] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [rawViewFormat, setRawViewFormat] = useState<'markdown' | 'text'>('markdown');

  const isProtectedKeyFile = (fileName?: string) =>
    /^(?:00_)?readme\.txt$/i.test(fileName?.trim() || '');

  // Guaranteed single status per file and exclusion of 00_README.txt
  const attemptedIds = new Set(report.trashedFiles.map((t) => t.trashedFile?.id).filter(Boolean));
  const displayedUncertain = report.uncertainFiles.filter(
    (u) => !attemptedIds.has(u.fileB?.id) && !isProtectedKeyFile(u.fileB?.name)
  );
  const displayedKept = report.keptFiles.filter(
    (f) => !attemptedIds.has(f.id) && !isProtectedKeyFile(f.name)
  );

  // Derive metrics if not explicitly passed
  const displayMetrics = report.metrics || computeScanMetrics(
    report.totalFilesReviewed,
    report.trashedFiles.map((t, idx) => ({
      id: `m-${idx}`,
      type: t.type,
      confidence: 1,
      reason: t.reason,
      originalFile: t.keptOriginalFile,
      targetFile: t.trashedFile,
      similarityScore: t.similarity,
      isUncertain: false,
    })),
    displayedUncertain.map((u, idx) => ({
      id: `u-${idx}`,
      type: 'near-duplicate',
      confidence: 0.5,
      reason: u.reason,
      originalFile: u.fileA,
      targetFile: u.fileB,
      similarityScore: u.similarity,
      isUncertain: true,
    })),
    displayedKept.length,
    report.scanDurationMs || 3000
  );

  const handleCopy = async () => {
    const text = rawViewFormat === 'markdown' ? generateMarkdownReport(report) : generatePlainTextReport(report);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = async (fileId: string) => {
    if (!onRestoreFile) return;
    setRestoringId(fileId);
    try {
      await onRestoreFile(fileId);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Cleanup Completed Banner */}
      <div className="bg-[#C75B12]/15 border border-[#C75B12]/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shrink-0 mt-0.5">
            <PauseCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#F5E9DC]">
                Scan Finished &bull; Folder &ldquo;{report.folderName}&rdquo;
              </h3>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Cleanup Executed
              </span>
            </div>
            <p className="text-xs text-[#D8D0C5] mt-1 leading-relaxed">
              Finished processing folder &ldquo;{report.folderName}&rdquo;. Approved duplicates were safely moved to Drive Trash with 30-day recovery window and session undo available.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          {/* Primary Download Report Modal Trigger */}
          <button
            id="download-report-modal-trigger-btn"
            onClick={() => setIsDownloadModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[44px]"
            title="Download cleanup report as Markdown, Plain Text, or CSV"
          >
            <FolderDown className="w-4 h-4" />
            <span>Download Report</span>
          </button>

          {/* Quick Direct Format Buttons */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-xl border border-[#2e2e2e]">
            <button
              id="export-md-btn"
              onClick={() => exportReportToMarkdown(report)}
              className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] text-[#F5E9DC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
              title="Download Markdown Document (.md)"
            >
              <FileCode className="w-3.5 h-3.5 text-[#C75B12]" />
              <span>.MD</span>
            </button>
            <button
              id="export-txt-btn"
              onClick={() => exportReportToText(report)}
              className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] text-[#F5E9DC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
              title="Download Plain Text Document (.txt)"
            >
              <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
              <span>.TXT</span>
            </button>
            <button
              id="export-csv-btn"
              onClick={() => exportReportToCsv(report)}
              className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] text-[#F5E9DC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
              title="Download CSV Spreadsheet (.csv)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>.CSV</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#383838] text-[#F5E9DC] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            title="Copy formatted summary to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#C9A86A]" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Gemini AI Cleanup Insight Card */}
      <div
        id="cleanup-insight-card"
        className="w-full bg-[#181818] border border-[#2e2b24] hover:border-[#C9A86A]/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2.5 transition-colors relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C9A86A]/15 border border-[#C9A86A]/30 flex items-center justify-center text-[#C9A86A] shrink-0">
              <Sparkles className="w-4 h-4 text-[#C9A86A]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C9A86A] flex items-center gap-1.5">
                Cleanup Insight
                <span className="text-[10px] font-medium bg-[#C9A86A]/15 text-[#F5E9DC] px-2 py-0.2 rounded-full border border-[#C9A86A]/30 lowercase">
                  gemini 3.8
                </span>
              </span>
            </div>
          </div>

          {onRefreshInsight && (
            <button
              id="refresh-insight-btn"
              type="button"
              onClick={onRefreshInsight}
              disabled={report.isLoadingInsight}
              className="p-2 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Re-generate Gemini cleanup insight"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${report.isLoadingInsight ? 'animate-spin text-[#C9A86A]' : ''}`} />
            </button>
          )}
        </div>

        {report.isLoadingInsight ? (
          <div className="flex items-center gap-2.5 py-1 text-xs text-[#A0988E] animate-pulse">
            <div className="w-2 h-2 rounded-full bg-[#C9A86A] animate-ping" />
            <span>Analyzing duplicate types and patterns with Gemini...</span>
          </div>
        ) : (
          <p className="text-sm sm:text-base font-medium text-[#F5E9DC] leading-relaxed pl-0.5">
            &ldquo;{report.cleanupInsight || 'Most duplicates identified are older revision drafts and redundant versions of your documents.'}&rdquo;
          </p>
        )}
      </div>

      {/* Comprehensive Scan Summary Metrics Card */}
      <ScanMetricsCard
        metrics={displayMetrics}
        folderName={report.folderName}
        isPreTrash={false}
      />

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2a] gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('trashed')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'trashed'
              ? 'border-[#C75B12] text-[#F5E9DC] bg-[#222222]'
              : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Trashed Files ({report.trashedFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('uncertain')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'uncertain'
              ? 'border-[#C75B12] text-[#F5E9DC] bg-[#222222]'
              : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Flagged Uncertain ({displayedUncertain.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('kept')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'kept'
              ? 'border-[#C75B12] text-[#F5E9DC] bg-[#222222]'
              : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Kept / Unique ({displayedKept.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'raw'
              ? 'border-[#C75B12] text-[#F5E9DC] bg-[#222222]'
              : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
          }`}
        >
          <Copy className="w-3.5 h-3.5 text-[#C9A86A]" />
          <span>Formatted Report Text</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {/* Trashed Files Tab */}
        {activeTab === 'trashed' && (
          <div className="space-y-3">
            {report.trashedFiles.length === 0 ? (
              <div className="bg-[#181818] border border-[#282828] rounded-2xl p-8 text-center text-[#A0988E] text-xs">
                No files were moved to trash.
              </div>
            ) : (
              report.trashedFiles.map((item, idx) => (
                <div
                  key={idx}
                  className={`bg-[#181818] border rounded-2xl p-4 transition-colors space-y-3 ${
                    item.trashedSuccess ? 'border-[#292929] hover:border-[#383838]' : 'border-rose-800/40 bg-rose-950/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                        item.trashedSuccess ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-[#F5E9DC] break-all">
                        {item.trashedFile.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          (item.signalUsed === 'content_statement' || item.reason.includes('Signal used: Content'))
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {(item.signalUsed === 'content_statement' || item.reason.includes('Signal used: Content'))
                          ? 'Signal: Content Statement'
                          : 'Signal: Modified Timestamp'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          !item.trashedSuccess
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : item.type === 'exact'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {!item.trashedSuccess
                          ? 'Trash Attempt Failed'
                          : item.type === 'exact'
                          ? 'Exact Duplicate'
                          : 'Older Draft Version'}
                      </span>
                      <span className="text-[10px] font-mono text-[#C9A86A] bg-[#222222] px-2 py-0.5 rounded-full border border-[#333333]">
                        {item.comparisonMethod === 'size_and_name_match'
                          ? 'Size & Name Match'
                          : item.comparisonMethod === 'binary_checksum_match'
                          ? 'Byte Checksum Match'
                          : item.comparisonMethod === 'none'
                          ? 'Unreadable Content'
                          : `${Math.round(item.similarity * 100)}% match`}
                      </span>
                    </div>
                  </div>

                  {/* Relationship mapping */}
                  <div className="p-3 bg-[#131313] border border-[#222222] rounded-xl flex flex-col gap-2 text-xs">
                    <div className="flex items-start gap-2">
                      {item.trashedSuccess ? (
                        <Trash2 className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className={item.trashedSuccess ? 'text-[#888888]' : 'text-amber-400 font-semibold'}>
                          {item.trashedSuccess ? 'Moved to Trash: ' : 'Trash Attempt Failed: '}
                        </span>
                        <strong className={item.trashedSuccess ? 'text-rose-300' : 'text-amber-200'}>
                          {item.trashedFile.name}
                        </strong>
                        <span className="text-[#666666] ml-2">
                          (Modified: {new Date(item.trashedFile.modifiedTime).toLocaleString()})
                        </span>
                      </div>
                    </div>

                    {!item.trashedSuccess && item.error && (
                      <div className="text-[11px] text-rose-300/90 bg-rose-950/30 p-2 rounded-lg border border-rose-800/30 font-mono">
                        Failure Diagnostic: {item.error}
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[#888888]">Duplicate / Older Version OF: </span>
                        <strong className="text-emerald-300">{item.keptOriginalFile.name}</strong>
                        <span className="text-[#666666] ml-2">
                          (Modified: {new Date(item.keptOriginalFile.modifiedTime).toLocaleString()})
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#A0988E] border-t border-[#222222] pt-2 mt-1">
                      <strong>Reason: </strong> {item.reason}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      onClick={() =>
                        onOpenComparison({
                          id: `comp-${item.trashedFile.id}`,
                          type: item.type,
                          confidence: 1.0,
                          reason: item.reason,
                          originalFile: item.keptOriginalFile,
                          targetFile: item.trashedFile,
                          similarityScore: item.similarity,
                          isUncertain: false,
                        })
                      }
                      className="text-[#C9A86A] hover:text-[#F5E9DC] flex items-center gap-1.5 p-1 font-medium cursor-pointer"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      <span>Compare Content Diff</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {onRestoreFile && item.trashedSuccess && (
                        <button
                          onClick={() => handleRestore(item.trashedFile.id)}
                          disabled={restoringId === item.trashedFile.id}
                          className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#D8D0C5] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-[#A0988E]" />
                          <span>{restoringId === item.trashedFile.id ? 'Restoring...' : 'Restore File'}</span>
                        </button>
                      )}
                      <a
                        href={`https://drive.google.com/file/d/${item.trashedFile.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <span>Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Flagged Uncertain Tab */}
        {activeTab === 'uncertain' && (
          <div className="space-y-3">
            {displayedUncertain.length === 0 ? (
              <div className="bg-[#181818] border border-[#282828] rounded-2xl p-8 text-center text-[#A0988E] text-xs">
                No uncertain files. All files were categorized with high confidence.
              </div>
            ) : (
              displayedUncertain.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#181818] border border-amber-500/30 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#F5E9DC]">
                      Comparison: &ldquo;{item.fileA.name}&rdquo; vs &ldquo;{item.fileB.name}&rdquo;
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Kept Safely In Place
                    </span>
                  </div>

                  <div className="p-3 bg-amber-950/20 border border-amber-500/25 rounded-xl text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300">Why flagged: </strong>
                    {item.reason}
                    <div className="mt-1 text-[11px] text-[#A0988E]">
                      {item.comparisonMethod === 'none' || item.reason.includes('Content could not be extracted') ? (
                        'Content unavailable for text comparison — manual review required. Left safely untouched.'
                      ) : (
                        <>Similarity: <strong>{Math.round(item.similarity * 100)}%</strong>. Left untouched per the strict rule: &ldquo;Do NOT trash anything you are less than highly confident about.&rdquo;</>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      onOpenComparison({
                        id: `uncert-${item.fileA.id}-${item.fileB.id}`,
                        type: 'near-duplicate',
                        confidence: 0.5,
                        reason: item.reason,
                        originalFile: item.fileA,
                        targetFile: item.fileB,
                        similarityScore: item.similarity,
                        isUncertain: true,
                        uncertaintyReason: item.reason,
                      })
                    }
                    className="text-[#C9A86A] hover:text-[#F5E9DC] flex items-center gap-1.5 p-1 text-xs font-medium cursor-pointer"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Inspect Differences Side-by-Side</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Kept Files Tab */}
        {activeTab === 'kept' && (
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-[#A0988E] uppercase tracking-wider pb-2 border-b border-[#262626]">
              Retained Files ({displayedKept.length})
            </h4>
            <div className="space-y-2">
              {displayedKept.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-xl bg-[#1d1d1d] border border-[#282828] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-medium text-[#F5E9DC] truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#A0988E] hidden sm:inline">
                      {new Date(file.modifiedTime).toLocaleDateString()}
                    </span>
                    <a
                      href={`https://drive.google.com/file/d/${file.id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-[#252525] hover:bg-[#303030] text-[#A0988E] hover:text-[#F5E9DC] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Formatted Text Tab */}
        {activeTab === 'raw' && (
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
              {/* Format Preview Toggle */}
              <div className="flex items-center gap-1.5 bg-[#141414] p-1 rounded-xl border border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setRawViewFormat('markdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    rawViewFormat === 'markdown'
                      ? 'bg-[#242424] text-[#F5E9DC] shadow-sm'
                      : 'text-[#888888] hover:text-[#D8D0C5]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C75B12]" />
                  <span>Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRawViewFormat('text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    rawViewFormat === 'text'
                      ? 'bg-[#242424] text-[#F5E9DC] shadow-sm'
                      : 'text-[#888888] hover:text-[#D8D0C5]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
                  <span>Plain Text (.txt)</span>
                </button>
              </div>

              {/* Action Downloads & Copy */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => exportReportToMarkdown(report)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[11px] font-medium text-[#F5E9DC] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Download as Markdown Document (.md)"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C75B12]" />
                  <span>Download .md</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportReportToText(report)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[11px] font-medium text-[#F5E9DC] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Download as Plain Text Document (.txt)"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
                  <span>Download .txt</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <pre className="bg-[#111111] border border-[#262626] rounded-xl p-4 text-xs font-mono text-[#D8D0C5] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
              {rawViewFormat === 'markdown' ? generateMarkdownReport(report) : generatePlainTextReport(report)}
            </pre>
          </div>
        )}
      </div>

      {/* Rescan and Export buttons in footer */}
      <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#262626]">
        <span className="text-xs text-[#888888] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#C9A86A]" />
          Processed on {new Date(report.timestamp).toLocaleTimeString()}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="footer-download-report-btn"
            onClick={() => setIsDownloadModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
            title="Download report in Markdown, Plain Text, or CSV"
          >
            <FolderDown className="w-4 h-4 text-[#C75B12]" />
            <span>Download Report (.md / .txt / .csv)</span>
          </button>
          <button
            onClick={onRestartScan}
            className="px-4 py-2.5 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Scan / Configure</span>
          </button>
        </div>
      </div>

      {/* Download Report Modal */}
      <DownloadReportModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        report={report}
      />
    </div>
  );
};
