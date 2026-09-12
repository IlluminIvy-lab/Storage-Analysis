import React from 'react';
import {
  History,
  X,
  Trash2,
  RotateCcw,
  Edit3,
  FolderPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { HistoryAction } from '../types';

interface ActivityTrackerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actions: HistoryAction[];
  onUndoAction: (action: HistoryAction) => Promise<void>;
  onClearHistory: () => void;
}

export const ActivityTrackerDrawer: React.FC<ActivityTrackerDrawerProps> = ({
  isOpen,
  onClose,
  actions,
  onUndoAction,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  const getActionIcon = (type: HistoryAction['type']) => {
    switch (type) {
      case 'trash':
      case 'bulk_trash':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case 'restore':
        return <RotateCcw className="w-4 h-4 text-emerald-400" />;
      case 'rename':
        return <Edit3 className="w-4 h-4 text-[#C9A86A]" />;
      case 'organize_folder':
        return <FolderPlus className="w-4 h-4 text-sky-400" />;
      default:
        return <Clock className="w-4 h-4 text-[#A0988E]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#181818] border-l border-[#2c2c2c] h-full flex flex-col shadow-2xl text-[#F5E9DC] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Recent and Past Actions Tracker"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#222222] text-[#C75B12]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#F5E9DC]">
                Past Actions Tracker
              </h3>
              <p className="text-[11px] text-[#A0988E]">
                Audit log of all cleanup and rename operations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close activity tracker"
            className="p-2 rounded-xl text-[#888888] hover:text-[#F5E9DC] hover:bg-[#222222] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {actions.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[#777777] space-y-2">
              <History className="w-10 h-10 text-[#333333] stroke-1" />
              <p className="text-xs">No recent actions recorded yet.</p>
              <p className="text-[11px] text-[#555555]">
                Actions like trashing duplicates, renaming, or restoring files will appear here with one-click rollback options.
              </p>
            </div>
          ) : (
            actions.map((act) => {
              const timeStr = new Date(act.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={act.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    act.isUndone
                      ? 'bg-[#141414] border-[#222222] opacity-60'
                      : 'bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#3a3a3a]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-[#262626] shrink-0 mt-0.5">
                        {getActionIcon(act.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#F5E9DC] truncate">
                            {act.title}
                          </span>
                          {act.isUndone && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Undone
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#A0988E] mt-0.5 leading-relaxed">
                          {act.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] text-[#777777] font-mono shrink-0">
                      {timeStr}
                    </span>
                  </div>

                  {/* Affected Files */}
                  {act.items.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#262626] space-y-1 text-[11px]">
                      {act.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[#888888] hover:text-[#F5E9DC] gap-2"
                        >
                          <span className="truncate font-mono">
                            {item.fileName}
                            {item.previousName && item.newName && (
                              <span className="text-[#C9A86A]">
                                {' '}
                                &rarr; {item.newName}
                              </span>
                            )}
                          </span>
                          <a
                            href={`https://drive.google.com/file/d/${item.fileId}/view`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#666666] hover:text-[#C75B12] p-1"
                            title="View in Google Drive"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Undo Button */}
                  {!act.isUndone && act.canUndo && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => onUndoAction(act)}
                        className="px-3 py-1.5 rounded-xl bg-[#262626] hover:bg-[#C75B12] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Revert / Undo</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        {actions.length > 0 && (
          <div className="p-4 border-t border-[#262626] bg-[#141414] flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              {actions.length} action{actions.length === 1 ? '' : 's'} recorded
            </span>
            <button
              onClick={onClearHistory}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer p-2 rounded-lg hover:bg-rose-500/10 transition-colors min-h-[44px] flex items-center"
            >
              Clear Log
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
