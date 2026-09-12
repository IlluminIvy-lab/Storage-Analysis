import React, { useState } from 'react';
import { FolderPlus, Sparkles, X, Check, Folder, Info } from 'lucide-react';
import { DriveFileItem } from '../types';
import { suggestSmartFolder, SuggestedFolder } from '../lib/smartFileIntelligence';

interface SmartFolderModalProps {
  isOpen: boolean;
  file: DriveFileItem | null;
  onClose: () => void;
  onConfirmFolder: (fileId: string, folderName: string) => void;
}

export const SmartFolderModal: React.FC<SmartFolderModalProps> = ({
  isOpen,
  file,
  onClose,
  onConfirmFolder,
}) => {
  if (!isOpen || !file) return null;

  const suggestion = suggestSmartFolder(file);
  const [selectedFolder, setSelectedFolder] = useState<string>(suggestion.name);

  const availableFolders = [
    'Specifications & Tech Docs',
    'Meeting Notes & Transcripts',
    'Drafts & Working Copies',
    'Finance & Agreements',
    'Releases & Changelogs',
    'General Documents & Reference',
  ];

  const handleApply = () => {
    onConfirmFolder(file.id, selectedFolder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#181818] border border-[#2c2c2c] rounded-3xl shadow-2xl p-5 sm:p-6 text-[#F5E9DC] space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Smart Folder Recommendation"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#222222] text-[#C9A86A]">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5E9DC]">
                Smart Folder Suggestion
              </h3>
              <p className="text-xs text-[#A0988E]">
                Categorizes content into ideal destination folders
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

        {/* Target File */}
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] text-xs space-y-1">
          <span className="text-[#888888] text-[11px] uppercase tracking-wider font-semibold">
            Target File
          </span>
          <p className="font-mono text-[#F5E9DC] truncate font-bold">
            {file.name}
          </p>
        </div>

        {/* AI Recommendation Spotlight */}
        <div className="p-4 rounded-2xl bg-[#C75B12]/10 border border-[#C75B12]/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#C9A86A] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C75B12]" />
              Recommended Destination
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#181818] text-emerald-400 border border-emerald-500/20">
              {Math.round(suggestion.confidence * 100)}% match
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold text-[#F5E9DC]">
            <Folder className="w-4 h-4 text-[#C75B12]" />
            <span>{suggestion.name}</span>
          </div>

          <p className="text-[11px] text-[#A0988E] leading-relaxed">
            {suggestion.reason}
          </p>
        </div>

        {/* Alternate Folders */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#A0988E] uppercase tracking-wider">
            Select or Override Destination
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableFolders.map((fName) => (
              <button
                key={fName}
                type="button"
                onClick={() => setSelectedFolder(fName)}
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center gap-2 cursor-pointer min-h-[44px] ${
                  selectedFolder === fName
                    ? 'bg-[#C75B12]/20 border-[#C75B12] text-[#F5E9DC] font-bold'
                    : 'bg-[#1f1f1f] border-[#2c2c2c] text-[#A0988E] hover:text-[#F5E9DC] hover:border-[#3a3a3a]'
                }`}
              >
                <Folder className="w-3.5 h-3.5 shrink-0 text-[#C9A86A]" />
                <span className="truncate">{fName}</span>
              </button>
            ))}
          </div>
        </div>

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
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            <Check className="w-4 h-4" />
            <span>Apply Folder Categorization</span>
          </button>
        </div>
      </div>
    </div>
  );
};
