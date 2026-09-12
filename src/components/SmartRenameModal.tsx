import React, { useState, useEffect } from 'react';
import { Edit3, Sparkles, X, Check, ArrowRight, FileText } from 'lucide-react';
import { DriveFileItem } from '../types';
import { suggestSmartRename } from '../lib/smartFileIntelligence';

interface SmartRenameModalProps {
  isOpen: boolean;
  file: DriveFileItem | null;
  onClose: () => void;
  onApplyRename: (fileId: string, newName: string, oldName: string) => Promise<void>;
}

export const SmartRenameModal: React.FC<SmartRenameModalProps> = ({
  isOpen,
  file,
  onClose,
  onApplyRename,
}) => {
  const [customName, setCustomName] = useState<string>('');
  const [smartSuggestion, setSmartSuggestion] = useState<{ suggestedName: string; reason: string }>({
    suggestedName: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const suggestion = suggestSmartRename(file);
      setSmartSuggestion(suggestion);
      setCustomName(suggestion.suggestedName || file.name);
      setError(null);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setError('File name cannot be empty.');
      return;
    }

    if (customName.trim() === file.name) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onApplyRename(file.id, customName.trim(), file.name);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to rename file.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#181818] border border-[#2c2c2c] rounded-3xl shadow-2xl p-5 sm:p-6 text-[#F5E9DC] space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Smart File Rename"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#222222] text-[#C75B12]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5E9DC]">
                Smart File Rename
              </h3>
              <p className="text-xs text-[#A0988E]">
                Cleans duplicate clutter, fixes version numbers, or extracts real title
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-[#888888] hover:text-[#F5E9DC] hover:bg-[#222222] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Name Card */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#A0988E] uppercase tracking-wider">
            Current Filename
          </label>
          <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-2 text-xs font-mono text-[#F5E9DC]/80 break-all">
            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{file.name}</span>
          </div>
        </div>

        {/* Smart Suggestion Pill */}
        {smartSuggestion.suggestedName !== file.name && (
          <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Smart Suggestion
              </span>
              <button
                type="button"
                onClick={() => setCustomName(smartSuggestion.suggestedName)}
                className="text-[11px] font-semibold text-[#C9A86A] hover:text-[#F5E9DC] cursor-pointer"
              >
                Use this suggestion
              </button>
            </div>
            <p className="font-mono text-xs text-[#F5E9DC] bg-black/30 p-2 rounded-lg break-all">
              {smartSuggestion.suggestedName}
            </p>
            <p className="text-[11px] text-[#A0988E]">
              {smartSuggestion.reason}
            </p>
          </div>
        )}

        {/* New Name Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="custom-filename-input"
              className="text-xs font-semibold text-[#A0988E] uppercase tracking-wider"
            >
              New Filename
            </label>
            <input
              id="custom-filename-input"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#222222] border border-[#333333] focus:border-[#C75B12] focus:outline-hidden text-xs sm:text-sm font-mono text-[#F5E9DC] min-h-[44px]"
              placeholder="Enter new filename..."
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/30">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customName.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C75B12] hover:bg-[#d66518] disabled:opacity-50 text-[#F5E9DC] text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Renaming in Drive...' : 'Apply Rename'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
