import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List,
  Trash2,
  GitCompare,
  ExternalLink,
  Sparkles,
  FolderPlus,
  Folder,
  FileText,
  CheckSquare,
  Square,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { DuplicateMatch, DriveFileItem, ViewMode, AutoSelectPreferences } from '../types';
import { generateQuickSummary, suggestSmartFolder, suggestSmartRename } from '../lib/smartFileIntelligence';
import { getKeeperPreferenceSummary } from '../lib/autoSelectUtils';

export type ResultCategoryFilter = 'all' | 'exact' | 'near-duplicate' | 'divergent' | 'uncertain';
export type SimilarityFilter = 'all' | 'high' | 'moderate' | 'low';
export type SignalFilter = 'all' | 'content' | 'timestamp';
export type SortOption = 'sim_desc' | 'sim_asc' | 'name_asc' | 'date_desc' | 'size_desc';

interface MatchesViewProps {
  matches: DuplicateMatch[];
  uncertainMatches?: DuplicateMatch[];
  selectedMatchIds: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectMatch?: (id: string) => void;
  onSelectAll?: (ids?: string[]) => void;
  onDeselectAll: () => void;
  onOpenComparison: (match: DuplicateMatch) => void;
  onOpenQuickView?: (file: DriveFileItem, match?: DuplicateMatch) => void;
  onOpenSmartRename: (file: DriveFileItem) => void;
  onOpenSmartFolder: (file: DriveFileItem) => void;
  onTrashSingle?: (match: DuplicateMatch) => void;
  onTrashSingleMatch?: (match: DuplicateMatch) => void;
  onBulkTrash?: (matches: DuplicateMatch[]) => void;
  onBulkTrashMatches?: (matches: DuplicateMatch[]) => void;
  onBulkSmartRename: (matches: DuplicateMatch[]) => void;
  onBulkSmartFolder: (matches: DuplicateMatch[]) => void;
  autoSelectPreferences?: AutoSelectPreferences;
  onOpenAutoSelectModal?: () => void;
  onApplyAutoSelectRules?: () => void;
  onToggleAutoSelect?: (enabled?: boolean) => void;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  matches,
  uncertainMatches = [],
  selectedMatchIds,
  onToggleSelect,
  onToggleSelectMatch,
  onSelectAll,
  onDeselectAll,
  onOpenComparison,
  onOpenQuickView,
  onOpenSmartRename,
  onOpenSmartFolder,
  onTrashSingle,
  onTrashSingleMatch,
  onBulkTrash,
  onBulkTrashMatches,
  onBulkSmartRename,
  onBulkSmartFolder,
  autoSelectPreferences,
  onOpenAutoSelectModal,
  onApplyAutoSelectRules,
  onToggleAutoSelect,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Comprehensive Scan Results Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ResultCategoryFilter>('all');
  const [similarityFilter, setSimilarityFilter] = useState<SimilarityFilter>('all');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('sim_desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());

  // Handle unified callbacks
  const handleToggle = (id: string) => {
    if (onToggleSelectMatch) onToggleSelectMatch(id);
    else if (onToggleSelect) onToggleSelect(id);
  };

  const handleBulkTrashAction = (selected: DuplicateMatch[]) => {
    if (onBulkTrashMatches) onBulkTrashMatches(selected);
    else if (onBulkTrash) onBulkTrash(selected);
  };

  // Combine matches if uncertain requested (deduplicated by match id)
  const allCandidateMatches = useMemo(() => {
    const seen = new Set<string>();
    const combined: DuplicateMatch[] = [];
    for (const m of [...matches, ...uncertainMatches]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        combined.push(m);
      }
    }
    return combined;
  }, [matches, uncertainMatches]);

  // Counts for category badges
  const exactCount = matches.filter((m) => m.type === 'exact').length;
  const draftCount = matches.filter((m) => m.type === 'near-duplicate').length;
  const divergentCount = matches.filter((m) => m.hasSignificantDivergence).length;
  const uncertainCount = uncertainMatches.length;

  // Filter and Sort Engine
  const filteredMatches = useMemo(() => {
    let list = [...allCandidateMatches];

    // 1. Category Filter
    if (categoryFilter === 'exact') {
      list = list.filter((m) => m.type === 'exact');
    } else if (categoryFilter === 'near-duplicate') {
      list = list.filter((m) => m.type === 'near-duplicate' && !m.isUncertain);
    } else if (categoryFilter === 'divergent') {
      list = list.filter((m) => m.hasSignificantDivergence);
    } else if (categoryFilter === 'uncertain') {
      list = list.filter((m) => m.isUncertain);
    }

    // 2. Search Query (name, reason, content snippet)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.targetFile.name.toLowerCase().includes(q) ||
          m.originalFile.name.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.targetFile.content && m.targetFile.content.toLowerCase().includes(q))
      );
    }

    // 3. Similarity Range Filter
    if (similarityFilter === 'high') {
      list = list.filter((m) => m.similarityScore >= 0.9);
    } else if (similarityFilter === 'moderate') {
      list = list.filter((m) => m.similarityScore >= 0.6 && m.similarityScore < 0.9);
    } else if (similarityFilter === 'low') {
      list = list.filter((m) => m.similarityScore < 0.6);
    }

    // 4. Signal Filter
    if (signalFilter === 'content') {
      list = list.filter(
        (m) => m.signalUsed === 'content_statement' || m.reason.includes('Signal used: Content')
      );
    } else if (signalFilter === 'timestamp') {
      list = list.filter(
        (m) => m.signalUsed === 'modified_timestamp' || m.reason.includes('Signal used: Modified timestamp')
      );
    }

    // 5. Sorting
    list.sort((a, b) => {
      switch (sortOption) {
        case 'sim_desc':
          return b.similarityScore - a.similarityScore;
        case 'sim_asc':
          return a.similarityScore - b.similarityScore;
        case 'name_asc':
          return a.targetFile.name.localeCompare(b.targetFile.name);
        case 'date_desc':
          return new Date(b.targetFile.modifiedTime).getTime() - new Date(a.targetFile.modifiedTime).getTime();
        case 'date_asc' as any:
          return new Date(a.targetFile.modifiedTime).getTime() - new Date(b.targetFile.modifiedTime).getTime();
        case 'size_desc':
          return (Number(b.targetFile.size) || 0) - (Number(a.targetFile.size) || 0);
        default:
          return 0;
      }
    });

    return list;
  }, [allCandidateMatches, categoryFilter, searchQuery, similarityFilter, signalFilter, sortOption]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    similarityFilter !== 'all' ||
    signalFilter !== 'all' ||
    sortOption !== 'sim_desc';

  const resetAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setSimilarityFilter('all');
    setSignalFilter('all');
    setSortOption('sim_desc');
  };

  const allSelected =
    filteredMatches.length > 0 &&
    filteredMatches.every((m) => selectedMatchIds.includes(m.id));

  const someSelected = selectedMatchIds.length > 0;

  const toggleExpand = (id: string) => {
    setExpandedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedMatches = useMemo(() => {
    const idSet = new Set(selectedMatchIds);
    return allCandidateMatches.filter((m) => idSet.has(m.id));
  }, [allCandidateMatches, selectedMatchIds]);

  return (
    <div className="space-y-4">
      {/* SCAN RESULTS FILTER CONTROL PANEL */}
      <div className="p-4 bg-[#151515] border border-[#262626] rounded-2xl space-y-3 shadow-lg">
        {/* Row 1: Search bar, Category Pills, View Mode */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by file name, phrase, or extension..."
              className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-[#C75B12] rounded-xl pl-9 pr-8 py-2 text-xs text-[#F5E9DC] placeholder-[#777777] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#F5E9DC] p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-xl border border-[#2a2a2a] shrink-0 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Switch to Grid View"
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] ${
                viewMode === 'grid'
                  ? 'bg-[#2a2a2a] text-[#F5E9DC] font-bold shadow-xs'
                  : 'text-[#888888] hover:text-[#F5E9DC]'
              }`}
              title="Grid View (Visual cards with description section)"
            >
              <LayoutGrid className="w-4 h-4 text-[#C9A86A]" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Switch to List View"
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] ${
                viewMode === 'list'
                  ? 'bg-[#2a2a2a] text-[#F5E9DC] font-bold shadow-xs'
                  : 'text-[#888888] hover:text-[#F5E9DC]'
              }`}
              title="List View (Compact table layout with hover descriptions)"
            >
              <List className="w-4 h-4 text-[#C9A86A]" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Row 2: Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#222222]">
          <span className="text-[11px] font-semibold text-[#888888] mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#C75B12]" />
            <span>Category:</span>
          </span>

          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-[#C75B12] text-[#F5E9DC]'
                : 'bg-[#1e1e1e] text-[#888888] hover:text-[#F5E9DC] border border-[#2b2b2b]'
            }`}
          >
            All Results ({allCandidateMatches.length})
          </button>

          <button
            onClick={() => setCategoryFilter('exact')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              categoryFilter === 'exact'
                ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50'
                : 'bg-[#1e1e1e] text-[#888888] hover:text-[#F5E9DC] border border-[#2b2b2b]'
            }`}
          >
            Exact Duplicates ({exactCount})
          </button>

          <button
            onClick={() => setCategoryFilter('near-duplicate')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              categoryFilter === 'near-duplicate'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-[#1e1e1e] text-[#888888] hover:text-[#F5E9DC] border border-[#2b2b2b]'
            }`}
          >
            Draft Versions ({draftCount})
          </button>

          <button
            onClick={() => setCategoryFilter('divergent')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'divergent'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-[#1e1e1e] text-amber-400 hover:text-amber-200 border border-amber-500/20'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Divergent ({divergentCount})</span>
          </button>

          {uncertainCount > 0 && (
            <button
              onClick={() => setCategoryFilter('uncertain')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                categoryFilter === 'uncertain'
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                : 'bg-[#1e1e1e] text-[#888888] hover:text-[#F5E9DC] border border-[#2b2b2b]'
              }`}
            >
              Uncertain ({uncertainCount})
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-[11px] text-[#C9A86A] hover:underline flex items-center gap-1 cursor-pointer py-1"
            >
              <span>{showAdvancedFilters ? 'Fewer Filters' : 'More Filters & Sort'}</span>
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Row 3: Advanced Dropdown Filters (Similarity, Signal, Sort Order) */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-[#222222] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs animate-in fade-in duration-150">
            {/* Similarity Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider block">
                Similarity Range
              </label>
              <select
                value={similarityFilter}
                onChange={(e) => setSimilarityFilter(e.target.value as SimilarityFilter)}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-[#F5E9DC] outline-none cursor-pointer"
              >
                <option value="all">All Similarity Levels (0% - 100%)</option>
                <option value="high">High Similarity (90% - 100%)</option>
                <option value="moderate">Moderate Drafts (60% - 89%)</option>
                <option value="low">Substantial Differences (&lt; 60%)</option>
              </select>
            </div>

            {/* Signal Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider block">
                Decision Signal
              </label>
              <select
                value={signalFilter}
                onChange={(e) => setSignalFilter(e.target.value as SignalFilter)}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-[#F5E9DC] outline-none cursor-pointer"
              >
                <option value="all">All Decision Signals</option>
                <option value="content">Explicit Content Signal (v1/v2, "final")</option>
                <option value="timestamp">Timestamp Chronology Signal</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider block">
                Sort Results By
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-[#F5E9DC] outline-none cursor-pointer"
              >
                <option value="sim_desc">Similarity (Highest First)</option>
                <option value="sim_asc">Similarity (Lowest First &bull; Divergent)</option>
                <option value="name_asc">File Name (A to Z)</option>
                <option value="date_desc">Modified Time (Newest First)</option>
                <option value="size_desc">File Size (Largest First)</option>
              </select>
            </div>
          </div>
        )}

        {/* Row 4: Active Filter Chips & Selection Controls */}
        <div className="pt-2 border-t border-[#222222] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-select check all */}
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  onDeselectAll();
                } else {
                  const ids = filteredMatches.map((m) => m.id);
                  if (onSelectAll) onSelectAll(ids);
                }
              }}
              className="px-3 py-1 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-xs font-medium text-[#F5E9DC] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[34px]"
              title={allSelected ? 'Deselect all' : 'Select all filtered'}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-[#C75B12]" />
              ) : (
                <Square className="w-4 h-4 text-[#888888]" />
              )}
              <span>{allSelected ? 'Deselect All' : 'Select All Filtered'}</span>
            </button>

            {/* Auto-Select according to user preferences */}
            {onApplyAutoSelectRules && (
              <button
                id="btn-run-auto-select-rules"
                type="button"
                onClick={onApplyAutoSelectRules}
                className="px-3 py-1 rounded-xl bg-[#C75B12]/15 hover:bg-[#C75B12]/25 border border-[#C75B12]/40 text-xs font-semibold text-[#C75B12] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[34px]"
                title="Apply persistent auto-select rules"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C75B12]" />
                <span>Auto-Select</span>
              </button>
            )}

            {/* Quick Auto-Select ON/OFF toggle */}
            {onToggleAutoSelect && autoSelectPreferences && (
              <button
                id="btn-matches-toggle-auto-select"
                type="button"
                onClick={() => onToggleAutoSelect(!autoSelectPreferences.enabled)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 min-h-[34px] cursor-pointer ${
                  autoSelectPreferences.enabled
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-[#222222] border-[#383838] text-[#888888] hover:text-[#F5E9DC]'
                }`}
                title={
                  autoSelectPreferences.enabled
                    ? 'Auto-Select is currently ON (click to turn OFF)'
                    : 'Auto-Select is currently OFF (click to turn ON)'
                }
              >
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {autoSelectPreferences.enabled ? 'Auto: ON' : 'Auto: OFF'}
                </span>
              </button>
            )}

            {/* Open Auto-Select settings */}
            {onOpenAutoSelectModal && (
              <button
                id="btn-open-auto-select-settings"
                type="button"
                onClick={onOpenAutoSelectModal}
                className="px-2.5 py-1 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC]/80 hover:text-[#F5E9DC] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[34px]"
                title={autoSelectPreferences ? getKeeperPreferenceSummary(autoSelectPreferences) : 'Configure Auto-Select rules'}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#C9A86A]" />
                <span className="text-[11px] text-[#C9A86A] font-medium">Rules</span>
              </button>
            )}

            <span className="text-xs text-[#888888]">
              Showing <strong className="text-[#F5E9DC]">{filteredMatches.length}</strong> of{' '}
              {allCandidateMatches.length} pairs
            </span>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-2 py-1 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] text-[#C9A86A] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Active filter badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#C9A86A] text-[10px] font-medium flex items-center gap-1 border border-[#3a3a3a]">
                <span>Category: {categoryFilter}</span>
                <button onClick={() => setCategoryFilter('all')} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {similarityFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#C9A86A] text-[10px] font-medium flex items-center gap-1 border border-[#3a3a3a]">
                <span>Similarity: {similarityFilter}</span>
                <button onClick={() => setSimilarityFilter('all')} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#C9A86A] text-[10px] font-medium flex items-center gap-1 border border-[#3a3a3a]">
                <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                <button onClick={() => setSearchQuery('')} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Action Sticky Toolbar (Appears when items are selected) */}
      {someSelected && (
        <div className="p-3 bg-gradient-to-r from-[#C75B12]/20 to-[#1f1f1f] border border-[#C75B12]/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C75B12] animate-pulse" />
            <span className="text-xs font-bold text-[#F5E9DC]">
              {selectedMatchIds.length} item{selectedMatchIds.length === 1 ? '' : 's'} selected for bulk action
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onBulkSmartRename(selectedMatches)}
              className="px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-xs font-semibold text-[#C9A86A] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Rename</span>
            </button>

            <button
              onClick={() => onBulkSmartFolder(selectedMatches)}
              className="px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-xs font-semibold text-sky-400 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Suggest Folders</span>
            </button>

            <button
              onClick={() => handleBulkTrashAction(selectedMatches)}
              className="px-3.5 py-1.5 rounded-xl bg-[#C75B12] hover:bg-[#d66518] text-xs font-bold text-[#F5E9DC] flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[40px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move Selected to Trash ({selectedMatchIds.length})</span>
            </button>

            <button
              onClick={onDeselectAll}
              className="text-xs text-[#888888] hover:text-[#F5E9DC] px-2 py-1 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Items Display: GRID or LIST */}
      {filteredMatches.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#888888] bg-[#141414] rounded-2xl border border-[#222222] space-y-3">
          <Filter className="w-6 h-6 text-[#555555] mx-auto" />
          <p className="text-sm font-semibold text-[#D8D0C5]">
            No scan results match the current filters.
          </p>
          <p className="text-xs text-[#888888]">
            Try adjusting your search query, category selection, or similarity threshold.
          </p>
          <button
            onClick={resetAllFilters}
            className="px-4 py-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] text-[#C9A86A] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Filters</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredMatches.map((m) => {
            const isSelected = selectedMatchIds.includes(m.id);
            const targetSummary = generateQuickSummary(m.targetFile);
            const folderSuggestion = suggestSmartFolder(m.targetFile);
            const isDivergent = m.hasSignificantDivergence;

            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 text-xs transition-all relative ${
                  isSelected
                    ? 'bg-[#211a14] border-[#C75B12] shadow-md shadow-[#C75B12]/10'
                    : isDivergent
                    ? 'bg-[#181310] border-amber-500/40 hover:border-amber-500/60'
                    : 'bg-[#1a1a1a] border-[#2c2c2c] hover:border-[#3d3d3d]'
                }`}
              >
                {/* Header & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(m.id)}
                        className="mt-0.5 text-[#A0988E] hover:text-[#C75B12] cursor-pointer"
                        aria-label={isSelected ? 'Deselect file' : 'Select file'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#C75B12]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#666666]" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="font-bold text-[#F5E9DC] truncate text-sm">
                            {m.targetFile.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#888888] block mt-0.5">
                          Modified: {new Date(m.targetFile.modifiedTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Type & Signal Badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          m.type === 'exact'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isDivergent
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {m.type === 'exact'
                          ? 'Exact Duplicate'
                          : isDivergent
                          ? 'Divergent Draft'
                          : 'Older Draft'}
                      </span>

                      {isDivergent && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Verify Diff</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1 or 2 Sentence File Description Box (Without Opening File) */}
                  <div className="p-2.5 rounded-xl bg-[#131313] border border-[#242424] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C9A86A]">
                      <FileText className="w-3 h-3" />
                      <span>Executive Overview (1-2 Sentences)</span>
                    </div>
                    <p className="text-[11px] text-[#D8D0C5] leading-relaxed italic">
                      &ldquo;{targetSummary}&rdquo;
                    </p>
                  </div>

                  {/* Compared With Kept File */}
                  <div className="p-2.5 rounded-xl bg-[#151515] border border-[#222222] text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-emerald-400 font-medium">
                      <span className="truncate">
                        Keeping: &ldquo;{m.originalFile.name}&rdquo;
                      </span>
                      <span className="text-[10px] text-[#C9A86A] bg-[#1a1a1a] px-2 py-0.5 rounded-md font-mono border border-[#2a2a2a] shrink-0">
                        {m.comparisonMethod === 'size_and_name_match'
                          ? 'Size & Name Match'
                          : m.comparisonMethod === 'binary_checksum_match'
                          ? 'Byte Checksum Match'
                          : m.comparisonMethod === 'none'
                          ? 'Unreadable'
                          : `${Math.round(m.similarityScore * 100)}% match`}
                      </span>
                    </div>
                    <p className="text-[#888888] line-clamp-2">{m.reason}</p>
                  </div>

                  {/* Smart Folder Suggestion Chip */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenSmartFolder(m.targetFile)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[11px] text-sky-300 flex items-center gap-1.5 cursor-pointer transition-colors max-w-[80%]"
                      title={`Recommended folder: ${folderSuggestion.name}. Click to organize.`}
                    >
                      <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">
                        Suggested: <strong>{folderSuggestion.name}</strong>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenSmartRename(m.targetFile)}
                      className="p-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#C9A86A] hover:text-[#F5E9DC] cursor-pointer"
                      title="Smart File Rename"
                      aria-label="Smart file rename"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {onOpenQuickView && (
                      <button
                        type="button"
                        onClick={() => onOpenQuickView(m.targetFile, m)}
                        className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#383838] text-xs font-semibold text-[#F5E9DC] hover:text-[#C9A86A] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Quick View snippet & last modified date"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#C75B12]" />
                        <span>Quick View</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenComparison(m)}
                      className={`text-xs flex items-center gap-1 font-semibold cursor-pointer ${
                        isDivergent ? 'text-amber-300 hover:text-amber-200' : 'text-[#C9A86A] hover:text-[#F5E9DC]'
                      }`}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      <span>{isDivergent ? 'Inspect Diff' : 'Full Diff'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://drive.google.com/file/d/${m.targetFile.id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#888888] hover:text-[#F5E9DC] flex items-center gap-1 p-1"
                      title="Open in Google Drive"
                    >
                      <span>Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="border border-[#262626] rounded-2xl bg-[#171717] overflow-hidden">
          <div className="divide-y divide-[#262626]">
            {filteredMatches.map((m) => {
              const isSelected = selectedMatchIds.includes(m.id);
              const isExpanded = expandedFileIds.has(m.id);
              const targetSummary = generateQuickSummary(m.targetFile);
              const folderSuggestion = suggestSmartFolder(m.targetFile);
              const isDivergent = m.hasSignificantDivergence;

              return (
                <div
                  key={m.id}
                  className={`p-3.5 transition-colors relative ${
                    isSelected
                      ? 'bg-[#221c17]'
                      : isDivergent
                      ? 'bg-[#18130f] hover:bg-[#1f1710]'
                      : 'hover:bg-[#1f1f1f]'
                  }`}
                  onMouseEnter={() => setHoveredFileId(m.targetFile.id)}
                  onMouseLeave={() => setHoveredFileId(null)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Checkbox + File Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(m.id)}
                        className="text-[#A0988E] hover:text-[#C75B12] cursor-pointer shrink-0"
                        aria-label={isSelected ? 'Deselect file' : 'Select file'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#C75B12]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#666666]" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="font-bold text-[#F5E9DC] text-xs truncate">
                            {m.targetFile.name}
                          </span>
                          {isDivergent && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Divergent</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#888888] mt-0.5">
                          <span>
                            Replaced by: &ldquo;{m.originalFile.name}&rdquo;
                          </span>
                          <span>&bull;</span>
                          <span className="text-[#C9A86A] font-mono">
                            {m.comparisonMethod === 'size_and_name_match'
                              ? 'Size & Name Match'
                              : m.comparisonMethod === 'binary_checksum_match'
                              ? 'Byte Checksum Match'
                              : m.comparisonMethod === 'none'
                              ? 'Unreadable'
                              : `${Math.round(m.similarityScore * 100)}% match`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badges & Quick Action Icons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
                      {/* Quick View Button */}
                      {onOpenQuickView && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickView(m.targetFile, m)}
                          className="px-2.5 py-1 rounded-md bg-[#242424] hover:bg-[#2f2f2f] border border-[#3a3a3a] text-xs font-semibold text-[#F5E9DC] hover:text-[#C9A86A] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Quick View document snippet & last modified date"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#C75B12]" />
                          <span>Quick View</span>
                        </button>
                      )}

                      {/* Smart Folder Tag */}
                      <button
                        type="button"
                        onClick={() => onOpenSmartFolder(m.targetFile)}
                        className="px-2 py-0.5 rounded-md bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[10px] text-sky-300 flex items-center gap-1 cursor-pointer"
                        title={`Suggested: ${folderSuggestion.name}`}
                      >
                        <Folder className="w-3 h-3 text-sky-400" />
                        <span className="hidden md:inline">{folderSuggestion.name}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenSmartRename(m.targetFile)}
                        className="p-1 rounded-md bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#C9A86A] hover:text-[#F5E9DC] cursor-pointer"
                        title="Smart Rename"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenComparison(m)}
                        className={`p-1 rounded-md border text-xs cursor-pointer flex items-center gap-1 ${
                          isDivergent
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                            : 'bg-[#222222] hover:bg-[#2c2c2c] border-[#333333] text-[#A0988E] hover:text-[#F5E9DC]'
                        }`}
                        title="Diff Comparison"
                      >
                        <GitCompare className="w-3 h-3" />
                        {isDivergent && <span className="text-[10px] font-bold">Diff</span>}
                      </button>

                      {/* Quick Description Expander */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(m.id)}
                        className="px-2 py-1 rounded-md bg-[#222222] hover:bg-[#2a2a2a] text-[10px] text-[#C9A86A] flex items-center gap-1 cursor-pointer"
                        title="Toggle 1-2 sentence description"
                      >
                        <Info className="w-3 h-3" />
                        <span>Summary</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded 1-2 sentence description section in List Mode */}
                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#121212] border border-[#262626] text-xs space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-[#C9A86A]">
                        <FileText className="w-3 h-3" />
                        <span>Quick Content Summary (Without Opening)</span>
                      </div>
                      <p className="text-[#D8D0C5] text-[11px] leading-relaxed italic">
                        &ldquo;{targetSummary}&rdquo;
                      </p>
                      <p className="text-[10px] text-[#777777] pt-1">
                        Reasoning: {m.reason}
                      </p>
                    </div>
                  )}

                  {/* Desktop Quick Hover Popover */}
                  {hoveredFileId === m.targetFile.id && !isExpanded && (
                    <div className="hidden lg:block absolute left-8 top-full z-30 w-96 p-3 bg-[#111111] border border-[#C75B12]/60 rounded-xl shadow-2xl text-[11px] text-[#F5E9DC] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                      <span className="font-semibold text-[#C9A86A] block text-[10px] uppercase">
                        Quick Preview Summary
                      </span>
                      <p className="italic text-[#E0D5C9] mt-0.5">
                        &ldquo;{targetSummary}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
