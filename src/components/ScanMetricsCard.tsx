import React from 'react';
import { HardDrive, Activity, Percent, Clock, Zap, FileCheck, Trash2, AlertTriangle, Layers } from 'lucide-react';
import { CleanupMetrics } from '../types';
import { formatBytes } from '../lib/formatters';

interface ScanMetricsCardProps {
  metrics: CleanupMetrics;
  folderName: string;
  isPreTrash?: boolean; // If true, "Space to be Reclaimed" vs "Space Reclaimed"
}

export const ScanMetricsCard: React.FC<ScanMetricsCardProps> = ({
  metrics,
  folderName,
  isPreTrash = false,
}) => {
  const total = Math.max(1, metrics.totalScanned);
  const exactPct = Math.round((metrics.exactDuplicatesCount / total) * 100);
  const draftPct = Math.round((metrics.versionDraftsCount / total) * 100);
  const uncertainPct = Math.round((metrics.uncertainCount / total) * 100);
  const uniquePct = Math.max(0, 100 - exactPct - draftPct - uncertainPct);

  return (
    <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Title & Speed Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#C75B12]" />
            <h3 className="text-sm sm:text-base font-bold text-[#F5E9DC]">
              Scan Summary & Storage Metrics
            </h3>
          </div>
          <p className="text-xs text-[#A0988E] mt-0.5">
            Performance analytics and content duplication profile for folder &ldquo;{folderName}&rdquo;
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono text-[#C9A86A] bg-[#222222] border border-[#333333] px-2.5 py-1 rounded-xl flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#C9A86A]" />
            <span>{metrics.scanSpeedFilesPerSec} files/sec</span>
          </span>
          <span className="text-[11px] font-mono text-[#A0988E] bg-[#222222] border border-[#333333] px-2.5 py-1 rounded-xl flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{(metrics.scanDurationMs / 1000).toFixed(1)}s</span>
          </span>
        </div>
      </div>

      {/* 4-Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Reclaimed Space */}
        <div className="bg-[#131313] border border-[#262626] rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A0988E] text-xs">
            <span>{isPreTrash ? 'Est. Space Reclaimable' : 'Space Reclaimed'}</span>
            <HardDrive className="w-4 h-4 text-[#C75B12]" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[#F5E9DC]">
              {formatBytes(metrics.totalBytesReclaimed)}
            </span>
            <p className="text-[10px] text-[#888888] mt-0.5">
              from {metrics.exactDuplicatesCount + metrics.versionDraftsCount} older duplicate copies
            </p>
          </div>
        </div>

        {/* Duplication Rate */}
        <div className="bg-[#131313] border border-[#262626] rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A0988E] text-xs">
            <span>Duplication Rate</span>
            <Percent className="w-4 h-4 text-[#C9A86A]" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#F5E9DC]">
                {metrics.duplicationRate}%
              </span>
              <span className="text-[10px] text-[#C9A86A] font-semibold">
                of reviewed files
              </span>
            </div>
            <p className="text-[10px] text-[#888888] mt-0.5">
              redundant files identified
            </p>
          </div>
        </div>

        {/* Avg Content Similarity */}
        <div className="bg-[#131313] border border-[#262626] rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A0988E] text-xs">
            <span>Avg Match Similarity</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                {metrics.avgSimilarity}%
              </span>
              <span className="text-[10px] text-[#888888]">high confidence</span>
            </div>
            <p className="text-[10px] text-[#888888] mt-0.5">
              content overlap in duplicates
            </p>
          </div>
        </div>

        {/* Files Processed */}
        <div className="bg-[#131313] border border-[#262626] rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A0988E] text-xs">
            <span>Files Evaluated</span>
            <FileCheck className="w-4 h-4 text-[#A0988E]" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[#F5E9DC]">
              {metrics.totalScanned}
            </span>
            <p className="text-[10px] text-[#888888] mt-0.5">
              excluding Craft & 00_README
            </p>
          </div>
        </div>
      </div>

      {/* Composition Segmented Bar */}
      <div className="space-y-2 bg-[#131313] border border-[#242424] rounded-2xl p-3.5">
        <div className="flex items-center justify-between text-xs text-[#A0988E]">
          <span className="font-semibold text-[#D8D0C5]">File Distribution Breakdown</span>
          <span className="font-mono text-[11px] text-[#888888]">{metrics.totalScanned} total</span>
        </div>

        {/* Multi-segment Bar */}
        <div className="w-full h-3 bg-[#242424] rounded-full overflow-hidden flex">
          {uniquePct > 0 && (
            <div
              style={{ width: `${uniquePct}%` }}
              title={`Unique / Latest Kept: ${metrics.uniqueKeptCount} (${uniquePct}%)`}
              className="h-full bg-emerald-500/80 transition-all duration-500"
            />
          )}
          {exactPct > 0 && (
            <div
              style={{ width: `${exactPct}%` }}
              title={`Exact Duplicates: ${metrics.exactDuplicatesCount} (${exactPct}%)`}
              className="h-full bg-rose-500/80 transition-all duration-500"
            />
          )}
          {draftPct > 0 && (
            <div
              style={{ width: `${draftPct}%` }}
              title={`Older Drafts: ${metrics.versionDraftsCount} (${draftPct}%)`}
              className="h-full bg-amber-500/80 transition-all duration-500"
            />
          )}
          {uncertainPct > 0 && (
            <div
              style={{ width: `${uncertainPct}%` }}
              title={`Flagged Uncertain: ${metrics.uncertainCount} (${uncertainPct}%)`}
              className="h-full bg-[#C9A86A] transition-all duration-500"
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />
            <span className="truncate">Unique/Kept: <strong>{metrics.uniqueKeptCount}</strong> ({uniquePct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shrink-0" />
            <span className="truncate">Exact Dups: <strong>{metrics.exactDuplicatesCount}</strong> ({exactPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" />
            <span className="truncate">Older Drafts: <strong>{metrics.versionDraftsCount}</strong> ({draftPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#C9A86A]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C9A86A] shrink-0" />
            <span className="truncate">Uncertain: <strong>{metrics.uncertainCount}</strong> ({uncertainPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
