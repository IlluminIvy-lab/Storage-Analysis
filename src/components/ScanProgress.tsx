import React from 'react';
import { Loader2, CheckCircle2, FileSearch, FileText, BrainCircuit, Trash2, Square } from 'lucide-react';
import { ScanStage } from '../types';

interface ScanProgressProps {
  stage: ScanStage;
  currentActionText: string;
  processedCount: number;
  totalCount: number;
  folderName: string;
  onStopScan?: () => void;
}

export const ScanProgress: React.FC<ScanProgressProps> = ({
  stage,
  currentActionText,
  processedCount,
  totalCount,
  folderName,
  onStopScan,
}) => {
  const steps = [
    {
      id: 'locating',
      label: `Find "${folderName}" folder`,
      icon: FileSearch,
      active: stage === 'locating_folder',
      done: ['fetching_files', 'reading_contents', 'analyzing_duplicates', 'ready_for_review', 'trashing', 'completed'].includes(stage),
    },
    {
      id: 'fetching',
      label: 'Enumerate and index Drive files',
      icon: FileText,
      active: stage === 'fetching_files',
      done: ['reading_contents', 'analyzing_duplicates', 'ready_for_review', 'trashing', 'completed'].includes(stage),
    },
    {
      id: 'reading',
      label: 'Read file contents & compute hashes',
      icon: Loader2,
      active: stage === 'reading_contents',
      done: ['analyzing_duplicates', 'ready_for_review', 'trashing', 'completed'].includes(stage),
    },
    {
      id: 'analyzing',
      label: 'Identify exact duplicates & draft versions',
      icon: BrainCircuit,
      active: stage === 'analyzing_duplicates',
      done: ['ready_for_review', 'trashing', 'completed'].includes(stage),
    },
    {
      id: 'trashing',
      label: 'Execute Drive trash cleanup',
      icon: Trash2,
      active: stage === 'trashing',
      done: stage === 'completed',
    },
  ];

  const percentage = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  return (
    <div className="w-full bg-[#171717] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C75B12]/20 flex items-center justify-center text-[#C75B12] shrink-0">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F5E9DC]">
              Processing Folder: <span className="text-[#C9A86A]">{folderName}</span>
            </h3>
            <p className="text-xs text-[#A0988E]">{currentActionText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {totalCount > 0 && (
            <span className="text-xs font-mono text-[#C9A86A] bg-[#222222] px-2.5 py-1 rounded-md border border-[#333333]">
              {processedCount} / {totalCount} ({percentage}%)
            </span>
          )}

          {onStopScan && (
            <button
              id="stop-scan-btn"
              type="button"
              onClick={onStopScan}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] shrink-0"
              title="Stop running scan or analysis"
            >
              <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
              <span>Stop Analysis</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C75B12] to-[#C9A86A] transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* Step checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#262626]">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                step.active
                  ? 'bg-[#C75B12]/15 text-[#F5E9DC] font-medium border border-[#C75B12]/30'
                  : step.done
                  ? 'text-[#C9A86A]/80'
                  : 'text-[#666666]'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : step.active ? (
                <Loader2 className="w-3.5 h-3.5 text-[#C75B12] animate-spin shrink-0" />
              ) : (
                <Icon className="w-3.5 h-3.5 opacity-60 shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
