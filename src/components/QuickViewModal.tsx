import React, { useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  Eye,
  FileCode,
  Clock,
  Sparkles,
  GitCompare,
} from 'lucide-react';
import { DriveFileItem, DuplicateMatch } from '../types';
import { getEstimatedFileSize, formatBytes } from '../lib/formatters';
import { generateQuickSummary } from '../lib/smartFileIntelligence';

interface QuickViewModalProps {
  isOpen: boolean;
  file: DriveFileItem | null;
  match?: DuplicateMatch | null;
  onClose: () => void;
  onOpenFullComparison?: (match: DuplicateMatch) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  isOpen,
  file,
  match,
  onClose,
  onOpenFullComparison,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'snippet' | 'meta'>('snippet');

  if (!isOpen || !file) return null;

  // Format date and time
  const modifiedDate = new Date(file.modifiedTime);
  const formattedDate = !isNaN(modifiedDate.getTime())
    ? modifiedDate.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date';
  const formattedTime = !isNaN(modifiedDate.getTime())
    ? modifiedDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  // Get content snippet
  const rawContent = file.content?.trim() || '';
  const snippet = rawContent
    ? rawContent.slice(0, 750) + (rawContent.length > 750 ? '\n\n... [remaining content truncated for quick view]' : '')
    : 'No text content available or file format is binary/spreadsheet.';

  const executiveSummary = generateQuickSummary(file);
  const fileSize = getEstimatedFileSize(file);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(rawContent || snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      id="quick-view-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="quick-view-modal-content"
        className="bg-[#181818] border border-[#2f2f2f] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-[#F5E9DC]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#282828] flex items-start justify-between gap-3 bg-[#151515]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shrink-0 mt-0.5">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A]">
                  Quick Document Snippet
                </span>
                {match && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded bg-[#222222] text-[#A0988E] border border-[#333333]">
                    {Math.round(match.similarityScore * 100)}% match
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#F5E9DC] truncate max-w-sm" title={file.name}>
                {file.name}
              </h3>
            </div>
          </div>

          <button
            id="quick-view-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#252525] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Close Quick View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Banner: Last Modified & Size */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-[#121212] border-b border-[#252525] text-xs">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#1a1a1a] border border-[#282828]">
            <Calendar className="w-4 h-4 text-[#C75B12] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#888888] block uppercase">Last Modified</span>
              <span className="font-semibold text-[#F5E9DC] text-[11px] truncate block" title={`${formattedDate} ${formattedTime}`}>
                {formattedDate}
              </span>
              <span className="text-[10px] text-[#A0988E] block">{formattedTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#1a1a1a] border border-[#282828]">
            <HardDrive className="w-4 h-4 text-[#C9A86A] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#888888] block uppercase">File Size & Type</span>
              <span className="font-semibold text-[#F5E9DC] text-[11px] block">
                {fileSize > 0 ? formatBytes(fileSize) : 'Text Document'}
              </span>
              <span className="text-[10px] text-[#A0988E] truncate block">
                {file.mimeType.split('.').pop() || file.mimeType}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs: Snippet vs Quick Overview */}
        <div className="flex items-center px-4 pt-2.5 border-b border-[#262626] gap-2 bg-[#161616]">
          <button
            id="tab-quick-snippet"
            onClick={() => setActiveTab('snippet')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer min-h-[36px] ${
              activeTab === 'snippet'
                ? 'border-[#C75B12] text-[#F5E9DC] bg-[#1e1e1e]'
                : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Document Snippet</span>
          </button>
          <button
            id="tab-quick-meta"
            onClick={() => setActiveTab('meta')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer min-h-[36px] ${
              activeTab === 'meta'
                ? 'border-[#C75B12] text-[#F5E9DC] bg-[#1e1e1e]'
                : 'border-transparent text-[#888888] hover:text-[#D8D0C5]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C9A86A]" />
            <span>AI Overview & Pair</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs max-h-[50vh]">
          {activeTab === 'snippet' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#A0988E] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#C75B12]" />
                  Content Preview ({rawContent ? `${rawContent.length} chars` : '0 chars'})
                </span>
                {rawContent && (
                  <button
                    id="copy-snippet-btn"
                    onClick={handleCopySnippet}
                    className="text-[11px] text-[#C9A86A] hover:text-[#F5E9DC] flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="bg-[#111111] border border-[#282828] rounded-xl p-3.5 font-mono text-[11px] text-[#D8D0C5] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60 select-text">
                {snippet}
              </div>

              <p className="text-[10px] text-[#777777] italic">
                Snippet extracted from document text for quick inspection without launching full comparison view.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Executive Summary */}
              <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] space-y-1">
                <span className="text-[10px] font-bold text-[#C9A86A] uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Executive 1-2 Sentence Overview
                </span>
                <p className="text-[#D8D0C5] text-xs italic leading-relaxed">
                  &ldquo;{executiveSummary}&rdquo;
                </p>
              </div>

              {/* Duplicate Pair Context if available */}
              {match && (
                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">
                      Paired Document to Keep
                    </span>
                    <span className="text-[10px] font-mono text-[#C9A86A]">
                      {match.type === 'exact' ? 'Exact Duplicate' : 'Draft / Version Pair'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#F5E9DC]">
                    {match.originalFile.name}
                  </div>
                  <p className="text-[11px] text-[#888888] leading-normal">
                    {match.reason}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-[#282828] bg-[#141414] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <a
            href={`https://drive.google.com/file/d/${file.id}/view`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-xs text-[#A0988E] hover:text-[#F5E9DC] flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
          >
            <span>Open in Drive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2">
            {match && onOpenFullComparison && (
              <button
                id="quick-view-full-diff-btn"
                onClick={() => {
                  onClose();
                  onOpenFullComparison(match);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#3a3a3a] text-xs font-semibold text-[#C9A86A] hover:text-[#F5E9DC] flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px] flex-1 sm:flex-initial"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Full Comparison Diff</span>
              </button>
            )}

            <button
              id="quick-view-done-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold transition-colors cursor-pointer min-h-[40px] flex-1 sm:flex-initial"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
