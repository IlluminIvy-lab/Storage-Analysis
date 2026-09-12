import React from 'react';
import { ShieldCheck, LogOut, FolderLock, Sparkles, Trash2, FolderSync, History, RefreshCw, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  activeView?: 'cleanup' | 'trash_monitor';
  onViewChange?: (view: 'cleanup' | 'trash_monitor') => void;
  sessionTrashedCount?: number;
  onOpenActivityTracker?: () => void;
  activityCount?: number;
  isTokenExpired?: boolean;
  onRefreshToken?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  activeView = 'cleanup',
  onViewChange,
  sessionTrashedCount = 0,
  onOpenActivityTracker,
  activityCount = 0,
  isTokenExpired = false,
  onRefreshToken,
}) => {
  return (
    <header className="w-full bg-[#161616] border-b border-[#252525] px-4 py-2.5 sticky top-0 z-30">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C75B12]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#F5E9DC] tracking-tight leading-none">
                  Drive Cleanup Agent
                </h1>
                <span className="text-[10px] font-semibold bg-[#C75B12]/25 text-[#F5E9DC] px-2 py-0.5 rounded-full border border-[#C75B12]/30">
                  TEST Scope
                </span>
              </div>
              <p className="text-[11px] text-[#A0988E] flex items-center gap-1 mt-0.5">
                <FolderLock className="w-3 h-3 text-[#C9A86A]" />
                <span>&ldquo;Craft&rdquo; skipped &bull; 00_README protected</span>
              </p>
            </div>
          </div>

          {/* Mobile sign-out, refresh and activity */}
          {user && (
            <div className="sm:hidden flex items-center gap-1.5">
              {isTokenExpired && onRefreshToken && (
                <button
                  onClick={onRefreshToken}
                  title="Session Expired - Tap to Refresh"
                  className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 min-h-[44px] min-w-[44px] flex items-center justify-center animate-pulse"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {onOpenActivityTracker && (
                <button
                  onClick={onOpenActivityTracker}
                  title="Past Actions Tracker"
                  className="p-2 rounded-lg bg-[#222222] text-[#C9A86A] hover:text-[#F5E9DC] min-h-[44px] min-w-[44px] flex items-center justify-center relative"
                >
                  <History className="w-4 h-4" />
                  {activityCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-[#C75B12] text-white rounded-full w-4 h-4 flex items-center justify-center">
                      {activityCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 rounded-lg bg-[#222222] text-[#A0988E] hover:text-[#F5E9DC] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Activity Tracker trigger button on Desktop */}
            {onOpenActivityTracker && (
              <button
                onClick={onOpenActivityTracker}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202020] hover:bg-[#282828] border border-[#333333] text-xs font-semibold text-[#F5E9DC] transition-colors cursor-pointer min-h-[38px]"
                title="View audit log of past actions & undo"
              >
                <History className="w-3.5 h-3.5 text-[#C75B12]" />
                <span>Activity Log</span>
                {activityCount > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-[#C75B12] text-white px-1.5 py-0.2 rounded-full">
                    {activityCount}
                  </span>
                )}
              </button>
            )}

            {/* View switcher tabs */}
            {onViewChange && (
              <div className="flex items-center bg-[#111111] p-1 rounded-xl border border-[#2a2a2a]">
                <button
                  id="tab-cleanup-view"
                  onClick={() => onViewChange('cleanup')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] ${
                    activeView === 'cleanup'
                      ? 'bg-[#C75B12] text-[#F5E9DC]'
                      : 'text-[#888888] hover:text-[#D8D0C5]'
                  }`}
                >
                  <FolderSync className="w-3.5 h-3.5" />
                  <span>Cleanup Agent</span>
                </button>

                <button
                  id="tab-trash-monitor-view"
                  onClick={() => onViewChange('trash_monitor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] ${
                    activeView === 'trash_monitor'
                      ? 'bg-[#C75B12] text-[#F5E9DC]'
                      : 'text-[#888888] hover:text-[#D8D0C5]'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trash Monitor</span>
                  {sessionTrashedCount > 0 && (
                    <span className="text-[10px] font-mono bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
                      {sessionTrashedCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Desktop signout */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex flex-col text-right">
                <span className="text-xs font-medium text-[#F5E9DC] truncate max-w-[130px]">
                  {user.displayName || user.email}
                </span>
                {isTokenExpired && onRefreshToken ? (
                  <button
                    onClick={onRefreshToken}
                    className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center justify-end gap-1 cursor-pointer transition-colors"
                    title="Click to refresh Google Drive session"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
                    Session Expired &bull; Refresh
                  </button>
                ) : (
                  <span className="text-[10px] text-[#A0988E] flex items-center justify-end gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    Stayed Logged In
                  </span>
                )}
              </div>
              <button
                id="logout-btn"
                onClick={onLogout}
                title="Sign Out"
                className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
              >
                <LogOut className="w-4 h-4 text-[#A0988E]" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

