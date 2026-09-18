import React, { useState } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  Check,
  ShieldCheck,
  FolderDown,
} from 'lucide-react';
import { CleanupReport } from '../types';
import {
  ReportExportFormat,
  exportReport,
  getReportFilename,
} from '../lib/exportReport';

interface DownloadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: CleanupReport;
}

export const DownloadReportModal: React.FC<DownloadReportModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [downloadedFormat, setDownloadedFormat] = useState<ReportExportFormat | null>(null);

  if (!isOpen) return null;

  const handleDownload = (format: ReportExportFormat) => {
    exportReport(report, format);
    setDownloadedFormat(format);
    setTimeout(() => {
      setDownloadedFormat(null);
    }, 2000);
  };

  const isProposed = Boolean(report.isProposedReport);

  const formatOptions: Array<{
    id: ReportExportFormat;
    name: string;
    extension: string;
    icon: React.ReactNode;
    badge: string;
    description: string;
    bestFor: string;
    accentColor: string;
  }> = [
    {
      id: 'markdown',
      name: 'Markdown Document',
      extension: '.md',
      icon: <FileCode className="w-5 h-5 text-[#C75B12]" />,
      badge: 'Recommended',
      description: 'Structured document with executive tables, itemized candidate details, and AI insights.',
      bestFor: 'Notion, Obsidian, GitHub, and markdown notes',
      accentColor: '#C75B12',
    },
    {
      id: 'text',
      name: 'Plain Text Document',
      extension: '.txt',
      icon: <FileText className="w-5 h-5 text-[#C9A86A]" />,
      badge: 'Universal',
      description: 'Clean ASCII-formatted summary with organized sections readable in any text editor.',
      bestFor: 'Notepad, TextEdit, terminal review, or print archiving',
      accentColor: '#C9A86A',
    },
    {
      id: 'csv',
      name: 'CSV Spreadsheet',
      extension: '.csv',
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-400" />,
      badge: 'Tabular',
      description: 'Raw tabular file entries with byte sizes, Drive IDs, timestamps, and reason columns.',
      bestFor: 'Google Sheets, Excel, database imports, and audits',
      accentColor: '#34d399',
    },
  ];

  return (
    <div
      id="download-report-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="download-report-modal"
        className="w-full max-w-lg bg-[#181818] border border-[#2e2b24] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#262626]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shrink-0">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#F5E9DC]">
                Download Cleanup Report
              </h3>
              <p className="text-xs text-[#A0988E]">
                {isProposed ? 'Proposed Plan Audit' : 'Cleanup Execution Summary'} &bull; Folder &ldquo;{report.folderName}&rdquo;
              </p>
            </div>
          </div>
          <button
            id="close-download-report-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988E] block">
            Select Output Format
          </span>

          <div className="space-y-2.5">
            {formatOptions.map((opt) => {
              const filename = getReportFilename(report, opt.id);
              const isDownloaded = downloadedFormat === opt.id;

              return (
                <div
                  key={opt.id}
                  className="p-3.5 rounded-2xl bg-[#1f1f1f] border border-[#2d2d2d] hover:border-[#3d3d3d] transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#282828] border border-[#383838] flex items-center justify-center shrink-0 mt-0.5">
                        {opt.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#F5E9DC]">
                            {opt.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#282828] text-[#C9A86A] border border-[#383838]">
                            {opt.extension}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-[#242424] text-[#A0988E] border border-[#333333]">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#A0988E] mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                        <div className="text-[11px] text-[#6d6d6d] mt-1">
                          Best for: <span className="text-[#888888]">{opt.bestFor}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a] gap-2">
                    <span className="text-[10px] font-mono text-[#666666] truncate max-w-[200px] sm:max-w-[280px]">
                      {filename}
                    </span>
                    <button
                      id={`download-report-btn-${opt.id}`}
                      type="button"
                      onClick={() => handleDownload(opt.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px] shrink-0 ${
                        isDownloaded
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] shadow-md shadow-[#C75B12]/15'
                      }`}
                    >
                      {isDownloaded ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Downloaded!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download {opt.extension}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Safety Note */}
        <div className="p-3 bg-[#141414] border border-[#262626] rounded-xl flex items-center gap-2.5 text-xs text-[#888888]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Downloads are generated directly in your browser with complete confidentiality and zero external transmissions.
          </span>
        </div>
      </div>
    </div>
  );
};
