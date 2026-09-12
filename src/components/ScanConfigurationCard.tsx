import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  Sparkles,
  CheckCheck,
  FileText,
  Filter,
  ShieldCheck,
  FolderLock,
  Search,
  X,
  RefreshCw,
  Check,
  HardDrive,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  SlidersHorizontal,
} from 'lucide-react';
import { DriveFolderItem, ScanType, FileTypeFilter } from '../types';
import { listDriveFolders } from '../lib/driveApi';
import { COMMON_EXTENSIONS } from '../lib/scanFilterUtils';

interface ScanConfigurationCardProps {
  token: string | null;
  targetFolder: DriveFolderItem;
  scanType: ScanType;
  fileTypeFilter: FileTypeFilter;
  customExtensions: string[];
  onTargetFolderChange: (folder: DriveFolderItem) => void;
  onScanTypeChange: (type: ScanType) => void;
  onFileTypeFilterChange: (filter: FileTypeFilter) => void;
  onCustomExtensionsChange: (extensions: string[]) => void;
  onStartScan: () => void;
  isLoading?: boolean;
}

export const ScanConfigurationCard: React.FC<ScanConfigurationCardProps> = ({
  token,
  targetFolder,
  scanType,
  fileTypeFilter,
  customExtensions,
  onTargetFolderChange,
  onScanTypeChange,
  onFileTypeFilterChange,
  onCustomExtensionsChange,
  onStartScan,
  isLoading = false,
}) => {
  // Folder browser state
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolderItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState<string>('');
  const [folderError, setFolderError] = useState<string | null>(null);

  // Custom extension input state
  const [newExtensionInput, setNewExtensionInput] = useState<string>('');

  // Fetch folders when browser opens
  const fetchFolders = async () => {
    if (!token) return;
    setIsLoadingFolders(true);
    setFolderError(null);
    try {
      const folders = await listDriveFolders(token);
      setDriveFolders(folders);
    } catch (err: any) {
      console.error('Failed to load drive folders:', err);
      setFolderError(err.message || 'Failed to list folders from Google Drive.');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  useEffect(() => {
    if (isBrowserOpen && driveFolders.length === 0) {
      fetchFolders();
    }
  }, [isBrowserOpen, token]);

  const filteredFolders = driveFolders.filter((f) =>
    f.name.toLowerCase().includes(folderSearchQuery.toLowerCase().trim())
  );

  const handleSelectFolder = (folder: DriveFolderItem) => {
    onTargetFolderChange(folder);
    setIsBrowserOpen(false);
  };

  const handleSelectRoot = () => {
    onTargetFolderChange({ id: 'root', name: 'My Drive (Root)' });
    setIsBrowserOpen(false);
  };

  const handleToggleExtension = (ext: string) => {
    const clean = ext.toLowerCase().trim();
    if (customExtensions.includes(clean)) {
      onCustomExtensionsChange(customExtensions.filter((e) => e !== clean));
    } else {
      onCustomExtensionsChange([...customExtensions, clean]);
    }
  };

  const handleAddCustomExtension = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newExtensionInput.trim().toLowerCase();
    if (!clean) return;
    const formatted = clean.startsWith('.') ? clean : `.${clean}`;
    if (!customExtensions.includes(formatted)) {
      onCustomExtensionsChange([...customExtensions, formatted]);
    }
    setNewExtensionInput('');
  };

  return (
    <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 animate-in fade-in duration-200">
      {/* Header & Safeguards Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#262626]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
              Google Drive Agent Ready
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5E9DC] tracking-tight">
            Scan Configuration
          </h2>
          <p className="text-xs text-[#A0988E] max-w-xl leading-relaxed">
            Select your target Drive folder, choose duplicate detection depth, and apply optional file type filters before running smart review.
          </p>
        </div>

        {/* Safeguard status badges */}
        <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 text-[11px] font-medium">
          <span
            className="px-2.5 py-1 rounded-lg bg-[#222222] border border-[#333333] text-[#A0988E] flex items-center gap-1.5"
            title="Policy rule: 'Craft' folder is never accessed"
          >
            <FolderLock className="w-3.5 h-3.5 text-[#C75B12]" />
            <span>&ldquo;Craft&rdquo; Skipped</span>
          </span>
          <span
            className="px-2.5 py-1 rounded-lg bg-[#222222] border border-[#333333] text-[#A0988E] flex items-center gap-1.5"
            title="Policy rule: 00_README.txt answer key is never read or moved"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>00_README Protected</span>
          </span>
          <span
            className="px-2.5 py-1 rounded-lg bg-[#222222] border border-[#333333] text-[#C9A86A] flex items-center gap-1.5"
            title="Signals: Content version language supersedes timestamp"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Content &gt; Timestamp</span>
          </span>
        </div>
      </div>

      {/* 1. TARGET FOLDER SELECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#F5E9DC] flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#C75B12]" />
            <span>1. Target Folder</span>
          </label>
          <span className="text-[11px] text-[#A0988E]">
            {targetFolder.id === 'root' ? 'Default: My Drive' : 'Custom folder selected'}
          </span>
        </div>

        {/* Selected Folder Pill / Banner */}
        <div className="bg-[#1e1e1e] border border-[#333333] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#262626] border border-[#383838] flex items-center justify-center shrink-0">
              {targetFolder.id === 'root' ? (
                <HardDrive className="w-5 h-5 text-[#C9A86A]" />
              ) : (
                <FolderOpen className="w-5 h-5 text-[#C75B12]" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-[#F5E9DC] flex items-center gap-2">
                <span>{targetFolder.name}</span>
                {targetFolder.id === 'root' && (
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#C9A86A]/20 text-[#C9A86A] border border-[#C9A86A]/30">
                    Root
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#A0988E]">
                {targetFolder.id === 'root'
                  ? 'All files and subfolders in My Drive will be evaluated (skipping Craft)'
                  : `Folder ID: ${targetFolder.id}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {targetFolder.id !== 'root' && (
              <button
                type="button"
                onClick={handleSelectRoot}
                className="px-3 py-2 rounded-xl bg-[#252525] hover:bg-[#2e2e2e] border border-[#3a3a3a] text-xs font-medium text-[#A0988E] hover:text-[#F5E9DC] transition-colors cursor-pointer min-h-[44px]"
                title="Switch back to My Drive root"
              >
                Reset to Root
              </button>
            )}
            <button
              id="browse-drive-folders-btn"
              type="button"
              onClick={() => setIsBrowserOpen((prev) => !prev)}
              className="px-4 py-2 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] border border-[#444444] text-xs font-semibold text-[#F5E9DC] flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
            >
              <Folder className="w-4 h-4 text-[#C9A86A]" />
              <span>{isBrowserOpen ? 'Close Browser' : 'Browse Folders'}</span>
              {isBrowserOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#A0988E]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#A0988E]" />
              )}
            </button>
          </div>
        </div>

        {/* FOLDER BROWSER DRAWER */}
        {isBrowserOpen && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="folder-search-input"
                  type="text"
                  value={folderSearchQuery}
                  onChange={(e) => setFolderSearchQuery(e.target.value)}
                  placeholder="Search folders by name (e.g. 'TEST', 'Documents')..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#1e1e1e] border border-[#333333] text-xs text-[#F5E9DC] placeholder-[#777777] focus:outline-none focus:border-[#C75B12] min-h-[44px]"
                />
                {folderSearchQuery && (
                  <button
                    onClick={() => setFolderSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#888888] hover:text-[#F5E9DC]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectRoot}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] ${
                    targetFolder.id === 'root'
                      ? 'bg-[#C75B12]/20 border-[#C75B12] text-[#F5E9DC]'
                      : 'bg-[#222222] border-[#333333] text-[#A0988E] hover:text-[#F5E9DC]'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Pick My Drive (Root)</span>
                </button>
                <button
                  type="button"
                  onClick={fetchFolders}
                  disabled={isLoadingFolders}
                  className="p-2.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Reload folders from Drive"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingFolders ? 'animate-spin text-[#C75B12]' : ''}`} />
                </button>
              </div>
            </div>

            {/* Folder error */}
            {folderError && (
              <p className="text-xs text-rose-400 p-2 bg-rose-950/20 border border-rose-500/20 rounded-xl">
                {folderError}
              </p>
            )}

            {/* Folder list */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#222222]">
              {isLoadingFolders ? (
                <div className="py-8 text-center text-xs text-[#888888] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C75B12]" />
                  <span>Loading folders from Google Drive...</span>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#888888]">
                  {folderSearchQuery
                    ? `No folder matching "${folderSearchQuery}" found in Drive.`
                    : 'No folders found. You can scan "My Drive (Root)".'}
                </div>
              ) : (
                filteredFolders.map((folder) => {
                  const isSelected = targetFolder.id === folder.id;
                  const isPastTest = folder.name.toLowerCase() === 'test';
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSelectFolder(folder)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer min-h-[44px] ${
                        isSelected
                          ? 'bg-[#C75B12]/20 border border-[#C75B12]/50 text-[#F5E9DC]'
                          : 'hover:bg-[#202020] text-[#D5CDBC]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#C75B12]' : 'text-[#C9A86A]'}`} />
                        <span className="text-xs font-semibold truncate">{folder.name}</span>
                        {isPastTest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#333333] text-[#A0988E]">
                            Past target
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isSelected ? (
                          <span className="text-[11px] font-bold text-[#C75B12] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#777777]">Tap to Select</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. SCAN TYPE SELECTION */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-[#F5E9DC] flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#C75B12]" />
          <span>2. Scan Type</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Duplicates + Draft/Version Detection */}
          <button
            type="button"
            id="scan-type-version-btn"
            onClick={() => onScanTypeChange('duplicates_and_drafts')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer min-h-[44px] relative flex flex-col justify-between gap-2 ${
              scanType === 'duplicates_and_drafts'
                ? 'bg-[#221c16] border-[#C75B12] shadow-md shadow-[#C75B12]/10 ring-1 ring-[#C75B12]'
                : 'bg-[#1b1b1b] border-[#2e2e2e] hover:border-[#3d3d3d]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C9A86A]" />
                <span className="text-xs font-bold text-[#F5E9DC]">
                  Duplicates + Draft/Version Detection
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#C75B12]/20 text-[#C75B12] border border-[#C75B12]/30">
                Full Comparison
              </span>
            </div>
            <p className="text-[11px] text-[#A0988E] leading-relaxed">
              Full content comparison. Detects exact duplicates plus drafts, version keywords (v1, draft, final, supersedes), linear progression, and divergence warnings.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#C9A86A] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A86A]" />
              <span>Recommended for full cleanup & version management</span>
            </div>
          </button>

          {/* Exact Duplicates Only */}
          <button
            type="button"
            id="scan-type-exact-btn"
            onClick={() => onScanTypeChange('exact_only')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer min-h-[44px] relative flex flex-col justify-between gap-2 ${
              scanType === 'exact_only'
                ? 'bg-[#221c16] border-[#C75B12] shadow-md shadow-[#C75B12]/10 ring-1 ring-[#C75B12]'
                : 'bg-[#1b1b1b] border-[#2e2e2e] hover:border-[#3d3d3d]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-[#C9A86A]" />
                <span className="text-xs font-bold text-[#F5E9DC]">
                  Exact Duplicates Only
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#333333] text-[#A0988E] border border-[#444444]">
                Fast Mode
              </span>
            </div>
            <p className="text-[11px] text-[#A0988E] leading-relaxed">
              Fast, byte-level and hash matches only. Ignores semantic draft/version variations; only flags identical content copies.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#A0988E] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Preserves version rules when picking which identical copy to keep</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. FILE TYPE FILTER (OPTIONAL) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#F5E9DC] flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#C75B12]" />
            <span>3. File Type Filter (Optional)</span>
          </label>
          <span className="text-[11px] text-[#A0988E]">
            {fileTypeFilter === 'all'
              ? 'All files in folder will be scanned'
              : `Filtered: ${fileTypeFilter}`}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Files', desc: 'Scan all files' },
            { id: 'documents', label: 'Documents & Text', desc: '.docx, .doc, .txt, .md, Docs' },
            { id: 'markdown_text', label: 'Markdown & Notes', desc: '.md, .txt' },
            { id: 'office', label: 'Office & Worksheets', desc: '.docx, .xlsx, .pptx' },
            { id: 'custom', label: 'Custom Extensions', desc: 'Select or type extensions' },
          ].map((tab) => {
            const isSelected = fileTypeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFileTypeFilterChange(tab.id as FileTypeFilter)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#C75B12] text-[#F5E9DC] border-[#C75B12] shadow-sm'
                    : 'bg-[#1e1e1e] hover:bg-[#252525] text-[#A0988E] hover:text-[#F5E9DC] border-[#333333]'
                }`}
                title={tab.desc}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Extensions selector if 'custom' is active */}
        {fileTypeFilter === 'custom' && (
          <div className="bg-[#151515] border border-[#2a2a2a] rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
            <div className="text-[11px] text-[#A0988E]">
              Select common file extensions or type your own:
            </div>

            {/* Common pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {COMMON_EXTENSIONS.map((ext) => {
                const isActive = customExtensions.includes(ext);
                return (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => handleToggleExtension(ext)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer min-h-[38px] flex items-center gap-1 ${
                      isActive
                        ? 'bg-[#C9A86A]/20 border-[#C9A86A] text-[#F5E9DC]'
                        : 'bg-[#202020] border-[#333333] text-[#888888] hover:text-[#F5E9DC]'
                    }`}
                  >
                    <span>{ext}</span>
                    {isActive && <Check className="w-3 h-3 text-[#C9A86A]" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Input */}
            <form onSubmit={handleAddCustomExtension} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newExtensionInput}
                onChange={(e) => setNewExtensionInput(e.target.value)}
                placeholder="Add extension (e.g. .py, .log, .json)"
                className="flex-1 px-3 py-2 rounded-xl bg-[#1e1e1e] border border-[#333333] text-xs text-[#F5E9DC] placeholder-[#777777] focus:outline-none focus:border-[#C75B12] min-h-[44px]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] border border-[#444444] text-xs font-semibold text-[#F5E9DC] cursor-pointer min-h-[44px]"
              >
                Add
              </button>
            </form>

            {customExtensions.length > 0 && (
              <div className="text-[11px] text-[#A0988E] flex items-center gap-1.5">
                <span>Active filters:</span>
                <strong className="text-[#F5E9DC]">{customExtensions.join(', ')}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PRIMARY ACTION BUTTON */}
      <div className="pt-3 border-t border-[#262626]">
        <button
          id="run-cleanup-btn"
          type="button"
          onClick={onStartScan}
          disabled={isLoading}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#C75B12] to-[#b3510e] hover:from-[#d66518] hover:to-[#c25810] disabled:opacity-50 text-[#F5E9DC] text-sm font-bold shadow-xl shadow-[#C75B12]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer min-h-[48px]"
          title="Start Smart Scan with interactive safety tier review"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Preparing Scan...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-[#C9A86A]" />
              <span>Start Smart Scan (with Review)</span>
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-[#777777] mt-2">
          Scans folder &bull; Builds review list &bull; Waits for your explicit approval before trashing
        </p>
      </div>
    </div>
  );
};
