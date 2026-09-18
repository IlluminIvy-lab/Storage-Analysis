import React from 'react';
import {
  X,
  Sliders,
  SlidersHorizontal,
  FolderLock,
  ShieldCheck,
  BrainCircuit,
  Eye,
  Trash2,
  FolderSync,
  History,
  FileSpreadsheet,
  RotateCcw,
  Moon,
  Sun,
  Monitor,
  Check,
  Sparkles,
  Layers,
  LayoutGrid,
  List,
  Filter,
  ArrowRight,
  FileCode,
  FileText,
  FolderDown,
} from 'lucide-react';
import { DriveFolderItem, DuplicateMatch, CleanupReport, ViewMode, AutoSelectPreferences } from '../types';
import { getKeeperPreferenceSummary } from '../lib/autoSelectUtils';
import { ReportExportFormat } from '../lib/exportReport';

interface LeftDrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  // Navigation & View
  activeView: 'cleanup' | 'trash_monitor';
  onViewChange: (view: 'cleanup' | 'trash_monitor') => void;
  onOpenActivityTracker: () => void;
  activityCount: number;
  sessionTrashedCount: number;
  // Appearance & Display
  isLightMode: boolean;
  onToggleTheme: () => void;
  fontSize: 'compact' | 'standard' | 'spacious';
  onChangeFontSize: (size: 'compact' | 'standard' | 'spacious') => void;
  // Result Management & Filters
  currentFolder: DriveFolderItem;
  matchesCount: number;
  selectedMatchesCount: number;
  onSelectAllMatches?: () => void;
  onDeselectAllMatches?: () => void;
  onExportCsv?: () => void;
  onExportReport?: (format: ReportExportFormat) => void;
  onNewScan?: () => void;
  // Automation & Rules
  autoSelectPreferences?: AutoSelectPreferences;
  onOpenAutoSelectModal?: () => void;
  onToggleAutoSelect?: (enabled?: boolean) => void;
}

export const LeftDrawerMenu: React.FC<LeftDrawerMenuProps> = ({
  isOpen,
  onClose,
  activeView,
  onViewChange,
  onOpenActivityTracker,
  activityCount,
  sessionTrashedCount,
  isLightMode,
  onToggleTheme,
  fontSize,
  onChangeFontSize,
  currentFolder,
  matchesCount,
  selectedMatchesCount,
  onSelectAllMatches,
  onDeselectAllMatches,
  onExportCsv,
  onExportReport,
  onNewScan,
  autoSelectPreferences,
  onOpenAutoSelectModal,
  onToggleAutoSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="left-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-start bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="left-drawer-panel"
        className="w-full max-w-sm bg-[#161616] border-r border-[#2c2c2c] h-full flex flex-col shadow-2xl text-[#F5E9DC] animate-in slide-in-from-left duration-250 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Agent Navigation and Settings"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#262626] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shadow-sm shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#F5E9DC]">
                Menu &amp; Management
              </h2>
              <span className="text-[10px] text-[#A0988E] block">
                Preferences &bull; Policy Tracker &bull; Actions
              </span>
            </div>
          </div>

          <button
            id="close-left-drawer-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#252525] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close Left Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* SECTION 1: NAVIGATION & MAIN VIEWS */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A] block">
              Navigation
            </span>

            <div className="grid grid-cols-1 gap-2">
              <button
                id="drawer-nav-cleanup"
                onClick={() => {
                  onViewChange('cleanup');
                  onClose();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer min-h-[44px] ${
                  activeView === 'cleanup'
                    ? 'bg-[#C75B12]/20 border-[#C75B12] text-[#F5E9DC]'
                    : 'bg-[#1b1b1b] border-[#292929] text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#222222]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderSync className="w-4 h-4 text-[#C75B12]" />
                  <div>
                    <span className="font-semibold block text-xs">Cleanup Agent</span>
                    <span className="text-[10px] text-[#888888]">Target: &ldquo;{currentFolder.name}&rdquo;</span>
                  </div>
                </div>
                {activeView === 'cleanup' && <Check className="w-4 h-4 text-[#C75B12]" />}
              </button>

              <button
                id="drawer-nav-trash-monitor"
                onClick={() => {
                  onViewChange('trash_monitor');
                  onClose();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer min-h-[44px] ${
                  activeView === 'trash_monitor'
                    ? 'bg-[#C75B12]/20 border-[#C75B12] text-[#F5E9DC]'
                    : 'bg-[#1b1b1b] border-[#292929] text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#222222]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <div>
                    <span className="font-semibold block text-xs">Google Drive Trash Monitor</span>
                    <span className="text-[10px] text-[#888888]">
                      {sessionTrashedCount > 0 ? `${sessionTrashedCount} items trashed this session` : 'Inspect & recover files'}
                    </span>
                  </div>
                </div>
                {sessionTrashedCount > 0 && (
                  <span className="text-[10px] font-mono bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                    {sessionTrashedCount}
                  </span>
                )}
              </button>

              <button
                id="drawer-nav-activity-log"
                onClick={() => {
                  onClose();
                  onOpenActivityTracker();
                }}
                className="w-full p-3 rounded-xl bg-[#1b1b1b] border border-[#292929] text-[#A0988E] hover:text-[#F5E9DC] hover:bg-[#222222] flex items-center justify-between text-left transition-colors cursor-pointer min-h-[44px]"
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-[#C9A86A]" />
                  <div>
                    <span className="font-semibold block text-xs">Activity Audit Tracker</span>
                    <span className="text-[10px] text-[#888888]">Undo recent actions &amp; audit history</span>
                  </div>
                </div>
                {activityCount > 0 && (
                  <span className="text-[10px] font-mono bg-[#C75B12] text-white px-2 py-0.5 rounded-full font-bold">
                    {activityCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SECTION 2: FILE & RESULT MANAGEMENT */}
          {matchesCount > 0 && (
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A] block">
                File &amp; Result Management
              </span>

              <div className="p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#292929] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A0988E]">Detected Candidates</span>
                  <span className="font-mono font-bold text-[#F5E9DC]">{matchesCount} pairs</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A0988E]">Selected for Action</span>
                  <span className="font-mono font-bold text-[#C75B12]">{selectedMatchesCount} files</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#292929]">
                  {onSelectAllMatches && (
                    <button
                      id="drawer-select-all-btn"
                      onClick={() => {
                        onSelectAllMatches();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-[#F5E9DC] text-[11px] font-medium transition-colors cursor-pointer text-center"
                    >
                      Select All
                    </button>
                  )}
                  {onDeselectAllMatches && (
                    <button
                      id="drawer-clear-sel-btn"
                      onClick={() => {
                        onDeselectAllMatches();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-[#A0988E] hover:text-[#F5E9DC] text-[11px] font-medium transition-colors cursor-pointer text-center"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {(onExportReport || onExportCsv) && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-semibold text-[#A0988E] flex items-center gap-1.5 px-0.5">
                      <FolderDown className="w-3.5 h-3.5 text-[#C75B12]" />
                      <span>Export Scan Plan Report</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        id="drawer-export-md-btn"
                        type="button"
                        onClick={() => {
                          if (onExportReport) onExportReport('markdown');
                          else if (onExportCsv) onExportCsv();
                          onClose();
                        }}
                        className="py-2 px-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[11px] font-semibold text-[#F5E9DC] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
                        title="Download Markdown Document (.md)"
                      >
                        <FileCode className="w-3.5 h-3.5 text-[#C75B12]" />
                        <span>.MD</span>
                      </button>
                      <button
                        id="drawer-export-txt-btn"
                        type="button"
                        onClick={() => {
                          if (onExportReport) onExportReport('text');
                          else if (onExportCsv) onExportCsv();
                          onClose();
                        }}
                        className="py-2 px-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[11px] font-semibold text-[#F5E9DC] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
                        title="Download Plain Text Document (.txt)"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
                        <span>.TXT</span>
                      </button>
                      <button
                        id="drawer-export-csv-btn"
                        type="button"
                        onClick={() => {
                          if (onExportReport) onExportReport('csv');
                          else if (onExportCsv) onExportCsv();
                          onClose();
                        }}
                        className="py-2 px-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[11px] font-semibold text-[#F5E9DC] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
                        title="Download CSV Spreadsheet (.csv)"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>.CSV</span>
                      </button>
                    </div>
                  </div>
                )}

                {onNewScan && (
                  <button
                    id="drawer-new-scan-btn"
                    onClick={() => {
                      onNewScan();
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-xs font-medium text-[#A0988E] hover:text-[#F5E9DC] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-configure / New Scan</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SECTION: AUTOMATION & ADVANCED AUTO-SELECT */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A] block">
              Automation &amp; Auto-Select
            </span>

            <div className="p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#292929] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[#F5E9DC] block">
                      Auto-Select
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                        autoSelectPreferences?.enabled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#262626] text-[#888888] border border-[#333333]'
                      }`}
                    >
                      {autoSelectPreferences?.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#A0988E] block mt-0.5 leading-relaxed">
                    {autoSelectPreferences ? getKeeperPreferenceSummary(autoSelectPreferences) : 'Always prefer newer files'}
                  </span>
                </div>

                {onToggleAutoSelect && autoSelectPreferences && (
                  <button
                    id="drawer-toggle-auto-select-btn"
                    type="button"
                    role="switch"
                    aria-checked={autoSelectPreferences.enabled}
                    onClick={() => onToggleAutoSelect(!autoSelectPreferences.enabled)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] items-center px-0.5 ${
                      autoSelectPreferences.enabled ? 'bg-[#C75B12]' : 'bg-[#333333]'
                    }`}
                    title={autoSelectPreferences.enabled ? 'Turn Auto-Select OFF' : 'Turn Auto-Select ON'}
                  >
                    <span className="sr-only">Toggle Auto-Select</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#F5E9DC] shadow ring-0 transition duration-200 ease-in-out ${
                        autoSelectPreferences.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                )}
              </div>

              {onOpenAutoSelectModal && (
                <button
                  id="drawer-open-auto-select-btn"
                  onClick={() => {
                    onOpenAutoSelectModal();
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[#F5E9DC]/80 hover:text-[#F5E9DC] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#C9A86A]" />
                  <span>Configure Rules &amp; Keeper Strategy</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 3: DISPLAY & APPEARANCE OPTIONS */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A] block">
              Display &amp; Appearance
            </span>

            <div className="p-3.5 rounded-2xl bg-[#1a1a1a] border border-[#292929] space-y-3.5">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#F5E9DC] block">Color Theme</span>
                  <span className="text-[10px] text-[#888888]">
                    {isLightMode ? 'Soft Beige Light Theme' : 'Deep Charcoal Dark (Default)'}
                  </span>
                </div>
                <button
                  id="drawer-theme-toggle"
                  onClick={onToggleTheme}
                  className="px-3 py-1.5 rounded-xl bg-[#252525] hover:bg-[#303030] border border-[#3a3a3a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  aria-label="Toggle Color Theme"
                >
                  {isLightMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#C9A86A]" />
                      <span>Dark</span>
                    </>
                  )}
                </button>
              </div>

              {/* Density / Font Scaling */}
              <div className="space-y-1.5 pt-2 border-t border-[#292929]">
                <span className="text-[11px] font-medium text-[#A0988E] block">Display Density</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#141414] p-1 rounded-xl border border-[#262626]">
                  {(['compact', 'standard', 'spacious'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onChangeFontSize(mode)}
                      className={`py-1 rounded-lg text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                        fontSize === mode
                          ? 'bg-[#C75B12] text-[#F5E9DC] font-bold shadow-xs'
                          : 'text-[#888888] hover:text-[#D8D0C5]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: SAFEGUARDS & POLICY TRACKING PANEL */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A86A] block">
              Safeguards &amp; Policy Tracking
            </span>

            <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#292929] space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Trash2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F5E9DC] block text-xs">Non-Destructive Drive Trash:</strong>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    Files are safely moved to Google Drive Trash (never permanently deleted; 30-day recovery window).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-[#242424]">
                <ShieldCheck className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F5E9DC] block text-xs">Interactive Approval Required:</strong>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    Zero automated trashing. Candidates must be inspected and explicitly approved before any action is executed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-[#242424]">
                <History className="w-4 h-4 text-[#C75B12] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F5E9DC] block text-xs">Session Audit Trail &amp; Undo:</strong>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    Every move or trash action is logged with original folder IDs and can be restored in one click.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-[#242424]">
                <BrainCircuit className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F5E9DC] block text-xs">Intelligence Hierarchy:</strong>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    Explicit content statements (draft, final, v1/v2, supersedes) strictly override modified timestamps.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#262626] bg-[#141414] flex items-center justify-between text-[11px] text-[#777777]">
          <span>Notes by Ivy &bull; Drive Agent</span>
          <span>v2.4 Production</span>
        </div>
      </div>
    </div>
  );
};
