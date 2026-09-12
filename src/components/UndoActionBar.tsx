import React, { useEffect, useState } from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';
import { HistoryAction } from '../types';

interface UndoActionBarProps {
  action: HistoryAction | null;
  onUndo: (action: HistoryAction) => Promise<void>;
  onDismiss: () => void;
}

export const UndoActionBar: React.FC<UndoActionBarProps> = ({
  action,
  onUndo,
  onDismiss,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(9);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);

  useEffect(() => {
    if (!action) return;

    const calcRemaining = () => {
      const msLeft = action.undoAvailableUntil - Date.now();
      return Math.max(0, Math.ceil(msLeft / 1000));
    };

    setSecondsRemaining(calcRemaining());

    const interval = setInterval(() => {
      const remaining = calcRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [action, onDismiss]);

  if (!action || secondsRemaining <= 0) {
    return null;
  }

  const handleUndoClick = async () => {
    setIsUndoing(true);
    try {
      await onUndo(action);
    } finally {
      setIsUndoing(false);
    }
  };

  const pct = Math.min(100, Math.max(0, (secondsRemaining / 9) * 100));

  return (
    <div
      id="undo-action-banner"
      role="region"
      aria-label="Undo action banner"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl bg-[#181818] border-2 border-[#C75B12] rounded-2xl shadow-2xl p-3.5 sm:p-4 text-[#F5E9DC] animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Animated Countdown Circle or Icon */}
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#2a2a2a]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#C75B12] transition-all duration-200"
                strokeDasharray={`${pct}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[11px] font-bold font-mono text-[#F5E9DC]">
              {secondsRemaining}s
            </span>
          </div>

          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold truncate text-[#F5E9DC]">
              {action.title}
            </h4>
            <p className="text-[11px] text-[#A0988E] truncate">
              {action.description}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="undo-action-btn"
            onClick={handleUndoClick}
            disabled={isUndoing}
            className="px-4 py-2 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-[#F5E9DC] text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
            <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
          </button>

          <button
            onClick={onDismiss}
            aria-label="Dismiss undo banner"
            className="p-2 rounded-xl text-[#888888] hover:text-[#F5E9DC] hover:bg-[#262626] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
