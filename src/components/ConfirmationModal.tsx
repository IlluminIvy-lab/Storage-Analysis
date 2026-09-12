import React from 'react';
import { AlertTriangle, Trash2, X, FileText, Check } from 'lucide-react';
import { DuplicateMatch } from '../types';

interface ConfirmationModalProps {
  isOpen: boolean;
  matchesToTrash: DuplicateMatch[];
  onConfirm: () => void;
  onCancel: () => void;
  isTrashing: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  matchesToTrash,
  onConfirm,
  onCancel,
  isTrashing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-[#333333] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#F5E9DC]">
                Confirm Trash Cleanup
              </h2>
              <p className="text-xs text-[#A0988E]">
                Move {matchesToTrash.length} older/duplicate file{matchesToTrash.length === 1 ? '' : 's'} to Google Drive Trash
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isTrashing}
            className="p-2 rounded-lg text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#252525] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/25 text-amber-200/90 text-xs leading-relaxed space-y-1">
            <p className="font-semibold text-amber-300">Safe Trash Protection:</p>
            <p>
              These files will be moved to your <strong>Google Drive Trash</strong> (not permanently deleted). You can recover them anytime from the Drive Trash bin or via the agent report.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A0988E]">
              Files to be moved to Trash ({matchesToTrash.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {matchesToTrash.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-[#202020] border border-[#2d2d2d] flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#F5E9DC] truncate flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#C75B12]" />
                      {m.targetFile.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          m.signalUsed === 'content_statement' || m.reason.includes('Signal used: Content')
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {m.signalUsed === 'content_statement' || m.reason.includes('Signal used: Content')
                          ? 'Signal: Content'
                          : 'Signal: Timestamp'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          m.type === 'exact'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {m.type === 'exact' ? 'Exact Duplicate' : 'Older Draft'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#A0988E] flex flex-col gap-0.5">
                    <span className="flex items-center gap-1">
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      Trash older: {new Date(m.targetFile.modifiedTime).toLocaleDateString()} ({m.targetFile.size || 'unknown'} bytes)
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400/90">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Keeping newer: {m.originalFile.name} ({new Date(m.originalFile.modifiedTime).toLocaleDateString()})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 sm:p-5 border-t border-[#282828] bg-[#141414] flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isTrashing}
            className="px-4 py-2.5 rounded-xl border border-[#333333] text-[#F5E9DC] text-xs font-medium hover:bg-[#222222] transition-colors min-h-[44px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isTrashing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C75B12] to-[#b04f0f] hover:from-[#d66518] hover:to-[#be5612] text-[#F5E9DC] text-xs font-semibold shadow-md flex items-center gap-2 transition-all min-h-[44px] cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isTrashing ? 'Moving to Trash...' : `Confirm & Move ${matchesToTrash.length} to Trash`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
