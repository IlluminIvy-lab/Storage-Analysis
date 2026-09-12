import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Search,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Filter,
  Layers,
} from 'lucide-react';
import { DriveFileItem } from '../types';
import { listFilesInTrash, restoreFileFromTrash } from '../lib/driveApi';
import { formatBytes, getEstimatedFileSize } from '../lib/formatters';

interface TrashBinMonitorProps {
  token: string | null;
  sessionTrashedFileIds?: string[];
  onItemRestored?: (fileId: string) => void;
}

export const TrashBinMonitor: React.FC<TrashBinMonitorProps> = ({
  token,
  sessionTrashedFileIds = [],
  onItemRestored,
}) => {
  const [trashFiles, setTrashFiles] = useState<DriveFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'session'>('all');
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isBulkRestoring, setIsBulkRestoring] = useState<boolean>(false);

  const fetchTrash = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const files = await listFilesInTrash(token, 100);
      setTrashFiles(files);
    } catch (err: any) {
      console.error('Failed to fetch trash items:', err);
      setError(err.message || 'Unable to retrieve items from Google Drive Trash.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, [token]);

  const handleRestoreSingle = async (file: DriveFileItem) => {
    if (!token) return;
    setRestoringIds((prev) => new Set(prev).add(file.id));
    setActionNotice(null);

    try {
      await restoreFileFromTrash(file.id, token);
      setTrashFiles((prev) => prev.filter((f) => f.id !== file.id));
      setActionNotice(`Successfully restored "${file.name}" back to Drive.`);
      if (onItemRestored) {
        onItemRestored(file.id);
      }
    } catch (err: any) {
      console.error(`Failed to restore ${file.name}:`, err);
      setError(`Failed to restore "${file.name}": ${err.message}`);
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  const handleRestoreAllSessionItems = async () => {
    if (!token || sessionTrashedFileIds.length === 0) return;
    const itemsToRestore = trashFiles.filter((f) => sessionTrashedFileIds.includes(f.id));
    if (itemsToRestore.length === 0) return;

    setIsBulkRestoring(true);
    setActionNotice(null);
    let successCount = 0;

    for (const item of itemsToRestore) {
      try {
        await restoreFileFromTrash(item.id, token);
        successCount++;
        if (onItemRestored) {
          onItemRestored(item.id);
        }
      } catch (e) {
        console.error(`Failed to bulk restore ${item.name}:`, e);
      }
    }

    await fetchTrash();
    setIsBulkRestoring(false);
    setActionNotice(`Restored ${successCount} session item(s) back to Drive folders.`);
  };

  // Filtered files
  const filteredFiles = trashFiles.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'session') {
      return sessionTrashedFileIds.includes(f.id);
    }
    return true;
  });

  const sessionTrashedCountInTrash = trashFiles.filter((f) => sessionTrashedFileIds.includes(f.id)).length;
  const totalTrashBytes = trashFiles.reduce((acc, f) => acc + getEstimatedFileSize(f), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
                Live Google Drive Trash Monitor
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#F5E9DC]">
              Drive Trash Bin & Recovery Center
            </h2>
            <p className="text-xs text-[#A0988E] max-w-2xl leading-relaxed">
              Inspect files currently in Google Drive Trash. Files trashed by the cleanup agent can be instantly reviewed, audited, and restored to their original location with one click.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://drive.google.com/drive/trash"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Open Drive Trash</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={fetchTrash}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#F5E9DC] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
              title="Refresh Trash Bin"
            >
              <RefreshCw className={`w-4 h-4 text-[#C9A86A] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3 Overview Stat Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-[#121212] border border-[#242424] rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#A0988E]">Total Files in Drive Trash</span>
              <p className="text-xl font-bold font-mono text-[#F5E9DC] mt-0.5">
                {isLoading ? '...' : trashFiles.length}
              </p>
            </div>
            <Trash2 className="w-6 h-6 text-rose-400/70" />
          </div>

          <div className="bg-[#121212] border border-[#242424] rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#A0988E]">Estimated Trash Size</span>
              <p className="text-xl font-bold font-mono text-[#C9A86A] mt-0.5">
                {isLoading ? '...' : formatBytes(totalTrashBytes)}
              </p>
            </div>
            <HardDrive className="w-6 h-6 text-[#C9A86A]/70" />
          </div>

          <div className="bg-[#121212] border border-[#242424] rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#A0988E]">Session Trashed Active</span>
              <p className="text-xl font-bold font-mono text-[#F5E9DC] mt-0.5">
                {sessionTrashedCountInTrash}
              </p>
            </div>
            <Layers className="w-6 h-6 text-[#C75B12]/70" />
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar: Search, Filters & Bulk Actions */}
      <div className="bg-[#181818] border border-[#2c2c2c] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search items in Trash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#121212] border border-[#2c2c2c] focus:border-[#C75B12] rounded-xl text-xs text-[#F5E9DC] placeholder-[#777777] outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
              activeFilter === 'all'
                ? 'bg-[#C75B12] text-[#F5E9DC]'
                : 'bg-[#222222] text-[#A0988E] hover:text-[#F5E9DC] border border-[#333333]'
            }`}
          >
            All Trash ({trashFiles.length})
          </button>
          <button
            onClick={() => setActiveFilter('session')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
              activeFilter === 'session'
                ? 'bg-[#C75B12] text-[#F5E9DC]'
                : 'bg-[#222222] text-[#A0988E] hover:text-[#F5E9DC] border border-[#333333]'
            }`}
          >
            This Session ({sessionTrashedCountInTrash})
          </button>

          {sessionTrashedCountInTrash > 0 && (
            <button
              onClick={handleRestoreAllSessionItems}
              disabled={isBulkRestoring}
              className="px-3.5 py-1.5 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] border border-[#444444] text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
              title="Restore all items moved to trash by this cleanup session"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isBulkRestoring ? 'animate-spin' : ''}`} />
              <span>{isBulkRestoring ? 'Restoring...' : `Restore All Session (${sessionTrashedCountInTrash})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-12 text-center text-xs text-[#888888] space-y-3">
            <RefreshCw className="w-6 h-6 text-[#C75B12] animate-spin mx-auto" />
            <p>Fetching Google Drive Trash contents...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-10 text-center text-xs text-[#888888] space-y-2">
            <Trash2 className="w-8 h-8 text-[#444444] mx-auto" />
            <p className="font-semibold text-[#D8D0C5]">No trashed files found.</p>
            <p className="text-[#666666]">
              {searchQuery
                ? 'No trashed files match your search query.'
                : activeFilter === 'session'
                ? 'No files from this session are currently in trash.'
                : 'Google Drive Trash is completely empty.'}
            </p>
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSessionItem = sessionTrashedFileIds.includes(file.id);
            const isRestoring = restoringIds.has(file.id);
            const fileSize = getEstimatedFileSize(file);

            return (
              <div
                key={file.id}
                className="bg-[#181818] border border-[#282828] hover:border-[#383838] rounded-2xl p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#F5E9DC] truncate max-w-sm sm:max-w-md">
                        {file.name}
                      </span>
                      {isSessionItem && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C75B12]/20 text-[#C9A86A] border border-[#C75B12]/40">
                          This Session
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#888888] flex-wrap">
                      <span>Size: <strong className="text-[#A0988E]">{formatBytes(fileSize)}</strong></span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(file.modifiedTime).toLocaleString()}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono text-[10px] text-[#666666]">{file.mimeType.replace('application/vnd.google-apps.', '')}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => handleRestoreSingle(file)}
                    disabled={isRestoring}
                    className="px-3.5 py-2 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                    title="Restore file back to Drive folder"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                  </button>

                  <a
                    href={`https://drive.google.com/file/d/${file.id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] transition-colors flex items-center justify-center min-h-[40px] min-w-[40px]"
                    title="View in Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
