import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  FolderLock,
  ShieldCheck,
  Play,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  ExternalLink,
  GitCompare,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Download,
  Square,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  getStoredToken,
  getCachedUser,
  isStoredTokenExpired,
  auth,
} from './lib/firebase';
import {
  findFolderByName,
  listAllFilesInFolder,
  readFileContent,
  moveFileToTrash,
  restoreFileFromTrash,
  renameFile,
} from './lib/driveApi';
import { analyzeDuplicates } from './lib/duplicateAnalyzer';
import {
  DriveFileItem,
  DuplicateMatch,
  CleanupReport,
  ScanStage,
  CleanupMetrics,
  HistoryAction,
  DriveFolderItem,
  ScanType,
  FileTypeFilter,
  AutoSelectPreferences,
} from './types';
import { computeScanMetrics } from './lib/formatters';
import { isFileMatchingFilter } from './lib/scanFilterUtils';
import {
  exportReport,
  exportReportToCsv,
  exportReportToMarkdown,
  exportReportToText,
  ReportExportFormat,
} from './lib/exportReport';
import {
  getSavedAutoSelectPreferences,
  saveAutoSelectPreferences,
  evaluateAutoSelectMatchIds,
  realignMatchWithPreferences,
} from './lib/autoSelectUtils';
import {
  validateCleanupPlan,
  validateFinalTrashCandidate,
  isCleanupEligible,
} from './lib/cleanupActionGate';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
import { ScanProgress } from './components/ScanProgress';
import { ConfirmationModal } from './components/ConfirmationModal';
import { FileComparisonModal } from './components/FileComparisonModal';
import { ReportView } from './components/ReportView';
import { ScanMetricsCard } from './components/ScanMetricsCard';
import { TrashBinMonitor } from './components/TrashBinMonitor';
import { MatchesView } from './components/MatchesView';
import { UndoActionBar } from './components/UndoActionBar';
import { ActivityTrackerDrawer } from './components/ActivityTrackerDrawer';
import { SmartRenameModal } from './components/SmartRenameModal';
import { SmartFolderModal } from './components/SmartFolderModal';
import { SmartScanReviewView } from './components/SmartScanReviewView';
import { ScanConfigurationCard } from './components/ScanConfigurationCard';
import { LeftDrawerMenu } from './components/LeftDrawerMenu';
import { QuickViewModal } from './components/QuickViewModal';
import { ScanSummaryModal } from './components/ScanSummaryModal';
import { AdvancedAutoSelectModal } from './components/AdvancedAutoSelectModal';
import { DownloadReportModal } from './components/DownloadReportModal';

export default function App() {
  // Restore user & Drive token from persistent session on mount
  const [user, setUser] = useState<User | null>(
    () => (auth.currentUser as User | null) || (getCachedUser() as unknown as User | null)
  );
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState<boolean>(() => isStoredTokenExpired());

  // Active view: cleanup agent vs trash monitor
  const [activeView, setActiveView] = useState<'cleanup' | 'trash_monitor'>('cleanup');
  const [sessionTrashedFileIds, setSessionTrashedFileIds] = useState<string[]>([]);

  // Navigation Left Drawer Menu & Appearance state
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'compact' | 'standard' | 'spacious'>('standard');

  // Quick View Modal state
  const [quickViewFile, setQuickViewFile] = useState<DriveFileItem | null>(null);
  const [quickViewMatch, setQuickViewMatch] = useState<DuplicateMatch | null>(null);

  // Scan configuration & state
  const [targetFolder, setTargetFolder] = useState<DriveFolderItem>({
    id: 'root',
    name: 'Entire Google Drive',
  });
  const [scanType, setScanType] = useState<ScanType>('duplicates_and_drafts');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [customExtensions, setCustomExtensions] = useState<string[]>(['.docx', '.md', '.txt']);

  const folderName = targetFolder.name;
  const [scanStage, setScanStage] = useState<ScanStage>('idle');
  const [currentActionText, setCurrentActionText] = useState<string>('');
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanDurationMs, setScanDurationMs] = useState<number>(0);
  const [scanMetrics, setScanMetrics] = useState<CleanupMetrics | null>(null);

  // Results
  const [scannedFiles, setScannedFiles] = useState<DriveFileItem[]>([]);
  const [actionableMatches, setActionableMatches] = useState<DuplicateMatch[]>([]);
  const [uncertainMatches, setUncertainMatches] = useState<DuplicateMatch[]>([]);
  const [uniqueFiles, setUniqueFiles] = useState<DriveFileItem[]>([]);
  const [report, setReport] = useState<CleanupReport | null>(null);

  // Modals & Enhanced Features
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [selectedComparison, setSelectedComparison] = useState<DuplicateMatch | null>(null);
  const [isTrashing, setIsTrashing] = useState<boolean>(false);
  const [isScanSummaryOpen, setIsScanSummaryOpen] = useState<boolean>(false);

  // Bulk selection & smart intelligence state
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [keptMatchIds, setKeptMatchIds] = useState<string[]>([]);
  const [smartRenameTargetFile, setSmartRenameTargetFile] = useState<DriveFileItem | null>(null);
  const [smartFolderTargetFile, setSmartFolderTargetFile] = useState<DriveFileItem | null>(null);

  // Advanced Auto-Select Preferences & Modal State
  const [isAutoSelectModalOpen, setIsAutoSelectModalOpen] = useState<boolean>(false);
  const [autoSelectPreferences, setAutoSelectPreferences] = useState<AutoSelectPreferences>(() =>
    getSavedAutoSelectPreferences()
  );
  const [downloadModalReport, setDownloadModalReport] = useState<CleanupReport | null>(null);

  const handleSaveAutoSelectPreferences = (newPrefs: AutoSelectPreferences) => {
    setAutoSelectPreferences(newPrefs);
    saveAutoSelectPreferences(newPrefs);

    // If matches already exist in current scan session, realign keeper vs duplicate based on new preferences:
    if (actionableMatches.length > 0) {
      const realigned = actionableMatches.map((m) => realignMatchWithPreferences(m, newPrefs));
      setActionableMatches(realigned);
      if (newPrefs.enabled && newPrefs.autoApplyOnScan) {
        const newSelected = evaluateAutoSelectMatchIds(realigned, newPrefs);
        setSelectedMatchIds(newSelected);
      } else if (!newPrefs.enabled) {
        // When Auto-Select is toggled OFF, clear automatic selection for manual review
        setSelectedMatchIds([]);
      }
    }
  };

  const handleToggleAutoSelect = (enabled?: boolean) => {
    const nextEnabled = enabled !== undefined ? enabled : !autoSelectPreferences.enabled;
    const updated: AutoSelectPreferences = {
      ...autoSelectPreferences,
      enabled: nextEnabled,
    };
    handleSaveAutoSelectPreferences(updated);
  };

  const handleApplyAutoSelectRules = () => {
    // Force evaluation if user explicitly taps the Auto-Select button
    const selectedIds = evaluateAutoSelectMatchIds(actionableMatches, autoSelectPreferences, true);
    setSelectedMatchIds(selectedIds);
  };

  // Activity Tracker & 7-10s Undo Action
  const [recentActions, setRecentActions] = useState<HistoryAction[]>([]);
  const [activeUndoAction, setActiveUndoAction] = useState<HistoryAction | null>(null);
  const [isActivityTrackerOpen, setIsActivityTrackerOpen] = useState<boolean>(false);

  useEffect(() => {
    // Listen for Drive API 401 unauthorized signals to prompt a 1-tap refresh
    const handleAuthExpired = () => {
      setIsTokenExpired(true);
    };
    window.addEventListener('drive_auth_expired', handleAuthExpired);

    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        if (accessToken) {
          setToken(accessToken);
          setIsTokenExpired(false);
        }
      },
      () => {
        // Only clear if auth truly signed out
        setUser(null);
        setToken(null);
        setIsTokenExpired(false);
      }
    );

    return () => {
      window.removeEventListener('drive_auth_expired', handleAuthExpired);
      unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setIsTokenExpired(false);
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setAuthError(err.message || 'Failed to authenticate with Google Drive.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn({ loginHint: user?.email || undefined });
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setIsTokenExpired(false);
      }
    } catch (err: any) {
      console.error('Session refresh failed:', err);
      setAuthError(err.message || 'Failed to refresh Google Drive connection.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setIsTokenExpired(false);
    setScanStage('idle');
    setReport(null);
    setScannedFiles([]);
    setActionableMatches([]);
    setUncertainMatches([]);
    setKeptMatchIds([]);
  };

  // Workflow cancellation ref and handler
  const isCancelledRef = useRef<boolean>(false);

  const handleStopWorkflow = () => {
    isCancelledRef.current = true;
    setIsTrashing(false);
    setIsConfirmationOpen(false);
    setScanStage('idle');
    setCurrentActionText('Workflow stopped by user.');
  };

  // Fetch AI Cleanup Insight via Gemini API
  const fetchGeminiInsight = async (
    currentReport: CleanupReport,
    matchesForInsight?: DuplicateMatch[]
  ) => {
    setReport((prev) => (prev ? { ...prev, isLoadingInsight: true } : null));

    try {
      const listToProcess = matchesForInsight || actionableMatches;
      const matchesPayload =
        listToProcess.length > 0
          ? listToProcess.map((m) => ({
              name: m.targetFile.name,
              originalName: m.originalFile.name,
              type: m.type,
              reason: m.reason,
            }))
          : currentReport.trashedFiles.map((t) => ({
              name: t.trashedFile.name,
              originalName: t.keptOriginalFile.name,
              type: t.type,
              reason: t.reason,
            }));

      // Helper to compute tailored fallback insight based on reviewed files
      const computeClientInsight = () => {
        if (!matchesPayload || matchesPayload.length === 0) {
          return 'No duplicate files or draft redundancies were detected across your reviewed files.';
        }
        let exactCount = 0;
        let draftCount = 0;
        const extCounts: Record<string, number> = {};
        for (const m of matchesPayload) {
          if (m.type === 'exact') exactCount++;
          else draftCount++;
          const ext = m.name?.includes('.') ? m.name.slice(m.name.lastIndexOf('.')) : 'documents';
          extCounts[ext] = (extCounts[ext] || 0) + 1;
        }
        const topExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'documents';
        if (exactCount >= draftCount) {
          return `Most duplicates identified are exact identical copies across your ${topExt} records.`;
        }
        return `Most duplicates identified are older revision drafts and redundant copies of your ${topExt} documents.`;
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch('/api/gemini/cleanup-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderName: currentReport.folderName,
            matches: matchesPayload,
            totalScanned: currentReport.totalFilesReviewed,
            totalUniqueKept: currentReport.totalUniqueKept,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.insight) {
            setReport((prev) =>
              prev ? { ...prev, cleanupInsight: data.insight, isLoadingInsight: false } : null
            );
            return;
          }
        }
      } catch (networkErr) {
        clearTimeout(timeoutId);
        console.warn('Notice: Gemini insight API request fell back to local synthesis:', networkErr);
      }

      setReport((prev) =>
        prev
          ? {
              ...prev,
              cleanupInsight: computeClientInsight(),
              isLoadingInsight: false,
            }
          : null
      );
    } catch (err) {
      console.warn('Notice: Cleanup insight synthesis completed via fallback:', err);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              cleanupInsight:
                'Most duplicates identified are older revision drafts and redundant copies of your working documents.',
              isLoadingInsight: false,
            }
          : null
      );
    }
  };

  /**
   * Executes the cleanup workflow on the selected target folder.
   * Runs the Smart Scan (with Review) flow, applying duplicate detection settings and file type filters.
   */
  const startCleanupScan = async () => {
    const accessToken = token || getAccessToken();
    if (!accessToken || isTokenExpired) {
      setIsTokenExpired(true);
      setErrorMessage('Google Workspace session requires a quick refresh. Please tap "Refresh Drive Session" above.');
      return;
    }

    setErrorMessage(null);
    setReport(null);
    setActionableMatches([]);
    setUncertainMatches([]);
    setScannedFiles([]);
    setScanMetrics(null);
    setKeptMatchIds([]);
    isCancelledRef.current = false;
    const startTime = Date.now();

    try {
      // Step 1: Target folder verification
      setScanStage('locating_folder');
      const targetFolderId = targetFolder.id || 'root';
      const isEntireDrive = targetFolderId === 'root';
      const targetFolderName = isEntireDrive ? 'Entire Google Drive' : (targetFolder.name || 'Entire Google Drive');

      setCurrentActionText(
        isEntireDrive
          ? 'Preparing recursive scan across entire Google Drive (skipping Craft)...'
          : `Targeting folder "${targetFolderName}" in Google Drive...`
      );

      // CRITICAL SAFETY REQUIREMENT: Never allow targeting Craft
      if (targetFolderName.toLowerCase() === 'craft') {
        throw new Error('Access to the "Craft" folder is strictly restricted per policy.');
      }

      if (isCancelledRef.current) return;

      // Step 2: Enumerate files (recursive crawl across all subfolders at every depth)
      setScanStage('fetching_files');
      setCurrentActionText(
        isEntireDrive
          ? 'Scanning entire Drive recursively across all subfolders (skipping Craft)...'
          : `Enumerating files and subfolders in "${targetFolderName}" (skipping Craft)...`
      );

      const enumeratedFiles = await listAllFilesInFolder(
        targetFolderId,
        accessToken,
        (count, currentFolder) => {
          setCurrentActionText(
            isEntireDrive
              ? `Found ${count} files (scanning folder "${currentFolder}")...`
              : `Found ${count} files in "${currentFolder}"...`
          );
        },
        targetFolderName
      );

      if (isCancelledRef.current) return;

      // Apply File Type Filter and exclude 00_README.txt / protected key files entirely
      const rawFiles = enumeratedFiles
        .filter((file) => isFileMatchingFilter(file, fileTypeFilter, customExtensions))
        .filter((file) => !/^(?:00_)?readme\.txt$/i.test(file.name?.trim() || ''));

      if (rawFiles.length === 0) {
        const duration = Date.now() - startTime;
        setScanDurationMs(duration);
        setScanStage('completed');
        const emptyReport: CleanupReport = {
          timestamp: new Date().toISOString(),
          folderName: targetFolderName,
          totalFilesReviewed: 0,
          totalExactDuplicates: 0,
          totalVersionDrafts: 0,
          totalTrashed: 0,
          totalUniqueKept: 0,
          scanDurationMs: duration,
          cleanupInsight: 'No files matched your scan configuration in this folder.',
          isLoadingInsight: false,
          trashedFiles: [],
          uncertainFiles: [],
          keptFiles: [],
        };
        setReport(emptyReport);
        return;
      }

      // Step 3: Read file content
      setScanStage('reading_contents');
      setTotalCount(rawFiles.length);
      setProcessedCount(0);

      const filesWithContent: DriveFileItem[] = [];
      for (let i = 0; i < rawFiles.length; i++) {
        if (isCancelledRef.current) {
          setCurrentActionText('Scan stopped by user.');
          setScanStage('idle');
          return;
        }

        const file = rawFiles[i];
        setCurrentActionText(`Reading content of "${file.name}" (${i + 1} of ${rawFiles.length})...`);
        
        try {
          const { text, hash, contentStatus, extractedWordCount, sizeBytes } = await readFileContent(file, accessToken);
          filesWithContent.push({
            ...file,
            content: text,
            contentHash: hash,
            contentStatus,
            extractedWordCount,
            size: sizeBytes !== undefined ? sizeBytes : file.size,
          });
        } catch (err) {
          console.warn(`Could not read file ${file.name}:`, err);
          filesWithContent.push({
            ...file,
            contentStatus: 'unavailable',
          });
        }

        setProcessedCount(i + 1);
      }

      if (isCancelledRef.current) {
        setCurrentActionText('Scan stopped by user.');
        setScanStage('idle');
        return;
      }

      setScannedFiles(filesWithContent);

      // Step 4: Analyze duplicates, draft versions & content divergence
      setScanStage('analyzing_duplicates');
      setCurrentActionText(
        scanType === 'exact_only'
          ? 'Comparing exact checksums and byte-level duplicates...'
          : 'Comparing content hashes, text overlap, and draft chronology...'
      );

      const analysis = analyzeDuplicates(filesWithContent, {
        exactOnly: scanType === 'exact_only',
        preferences: autoSelectPreferences,
      });

      if (isCancelledRef.current) {
        setCurrentActionText('Scan stopped by user.');
        setScanStage('idle');
        return;
      }

      setActionableMatches(analysis.actionableMatches);
      setUncertainMatches(analysis.uncertainMatches);
      setUniqueFiles(analysis.uniqueFiles);

      const duration = Date.now() - startTime;
      setScanDurationMs(duration);

      const computed = computeScanMetrics(
        filesWithContent.length,
        analysis.actionableMatches,
        analysis.uncertainMatches,
        analysis.uniqueFiles.length,
        duration
      );
      setScanMetrics(computed);

      // SMART SCAN (WITH REVIEW) WORKFLOW:
      // Pre-select according to user-defined Auto-Select preferences (or empty if disabled):
      const initialSelectedIds = autoSelectPreferences.enabled
        ? autoSelectPreferences.autoApplyOnScan
          ? evaluateAutoSelectMatchIds(analysis.actionableMatches, autoSelectPreferences)
          : analysis.actionableMatches
              .filter((m) => !m.hasSignificantDivergence)
              .map((m) => m.id)
        : [];
      setSelectedMatchIds(initialSelectedIds);
      setScanStage('smart_review');
      setIsScanSummaryOpen(true);
      setCurrentActionText(
        `Scan Complete: Categorized ${analysis.actionableMatches.length} proposed items into safety tiers.`
      );
    } catch (err: any) {
      console.error('Scan failed:', err);
      setErrorMessage(err.message || 'An error occurred during scan.');
      setScanStage('error');
    }
  };

  const createProposedReport = (): CleanupReport => {
    const isProtectedKeyFile = (fileName?: string) =>
      /^(?:00_)?readme\.txt$/i.test(fileName?.trim() || '');

    const validActionable = actionableMatches.filter(
      (m) => !isProtectedKeyFile(m.targetFile?.name) && !isProtectedKeyFile(m.originalFile?.name)
    );
    const validUnique = uniqueFiles.filter((f) => !isProtectedKeyFile(f?.name));
    const validUncertain = uncertainMatches.filter(
      (u) => !isProtectedKeyFile(u.fileB?.name) && !isProtectedKeyFile(u.fileA?.name)
    );

    return {
      timestamp: new Date().toISOString(),
      folderName,
      isProposedReport: true,
      totalFilesReviewed: scannedFiles.filter((f) => !isProtectedKeyFile(f.name)).length,
      totalExactDuplicates: validActionable.filter((m) => m.type === 'exact').length,
      totalVersionDrafts: validActionable.filter((m) => m.type !== 'exact').length,
      totalTrashed: 0,
      totalUniqueKept: validUnique.length,
      scanDurationMs,
      metrics: scanMetrics || undefined,
      trashedFiles: validActionable.map((m) => ({
        trashedFile: m.targetFile,
        keptOriginalFile: m.originalFile,
        type: m.type,
        reason: m.reason,
        similarity: m.similarityScore,
        comparisonMethod: m.comparisonMethod,
        trashedSuccess: false,
        isProposed: true,
      })),
      uncertainFiles: validUncertain.map((m) => ({
        fileA: m.originalFile,
        fileB: m.targetFile,
        reason: m.reason,
        similarity: m.similarityScore,
        comparisonMethod: m.comparisonMethod,
      })),
      keptFiles: validUnique,
    };
  };

  const handleExportProposedReport = (format: ReportExportFormat = 'markdown') => {
    const proposed = createProposedReport();
    exportReport(proposed, format);
  };

  const handleOpenProposedReportModal = () => {
    setDownloadModalReport(createProposedReport());
  };

  const handleExportProposedCsv = () => {
    handleExportProposedReport('csv');
  };

  /**
   * Executes the moving of duplicate/older drafts to Google Drive Trash.
   */
  const handleConfirmTrash = async () => {
    const accessToken = token || getAccessToken();
    if (!accessToken) return;

    const candidateMatches =
      selectedMatchIds.length > 0
        ? actionableMatches.filter((m) => selectedMatchIds.includes(m.id))
        : actionableMatches;

    if (candidateMatches.length === 0) return;

    // Centralized Safety Gate: Validate entire cleanup plan before execution
    const { validMatches, rejectedMatches } = validateCleanupPlan(candidateMatches);

    if (rejectedMatches.length > 0) {
      console.warn(
        `Safety gate excluded ${rejectedMatches.length} matches from plan execution:`,
        rejectedMatches
      );
    }

    if (validMatches.length === 0) {
      setErrorMessage(
        `No eligible files to trash. ${rejectedMatches.length} file(s) require manual review or are protected.`
      );
      setIsConfirmationOpen(false);
      return;
    }

    const approvedPlanTargetIds = new Set(validMatches.map((m) => m.targetFile.id));

    setIsTrashing(true);
    setScanStage('trashing');
    setProcessedCount(0);
    setTotalCount(validMatches.length);

    const trashedResults: CleanupReport['trashedFiles'] = [];
    let exactCount = 0;
    let draftCount = 0;

    for (let i = 0; i < validMatches.length; i++) {
      if (isCancelledRef.current) {
        setCurrentActionText('Trashing stopped by user.');
        break;
      }

      const match = validMatches[i];

      // Final individual candidate verification right before API call
      const finalCheck = validateFinalTrashCandidate(match.targetFile.id, match.targetFile, {
        currentScannedFiles: scannedFiles,
        alreadyTrashedIds: new Set(sessionTrashedFileIds),
        approvedPlanTargetIds,
        isPlanApproved: true,
      });

      if (!finalCheck.valid) {
        console.warn(`Final safety check rejected file "${match.targetFile.name}": ${finalCheck.reason}`);
        trashedResults.push({
          trashedFile: match.targetFile,
          keptOriginalFile: match.originalFile,
          type: match.type,
          reason: match.reason,
          signalUsed: match.signalUsed,
          similarity: match.similarityScore,
          comparisonMethod: match.comparisonMethod,
          trashedSuccess: false,
          error: `Safety Gate Blocked: ${finalCheck.reason}`,
        });
        setProcessedCount(i + 1);
        continue;
      }

      setCurrentActionText(
        `Moving older copy "${match.targetFile.name}" to Drive Trash (${i + 1}/${validMatches.length})...`
      );

      try {
        await moveFileToTrash(match.targetFile.id, accessToken);
        trashedResults.push({
          trashedFile: match.targetFile,
          keptOriginalFile: match.originalFile,
          type: match.type,
          reason: match.reason,
          signalUsed: match.signalUsed,
          similarity: match.similarityScore,
          comparisonMethod: match.comparisonMethod,
          trashedSuccess: true,
        });

        if (match.type === 'exact') exactCount++;
        else draftCount++;
      } catch (err: any) {
        console.error(`Failed to trash file ${match.targetFile.name}:`, err);
        const specificError =
          err?.message ||
          (typeof err === 'string' ? err : 'Permission denied or file unavailable in Drive');
        trashedResults.push({
          trashedFile: match.targetFile,
          keptOriginalFile: match.originalFile,
          type: match.type,
          reason: match.reason,
          signalUsed: match.signalUsed,
          similarity: match.similarityScore,
          comparisonMethod: match.comparisonMethod,
          trashedSuccess: false,
          error: specificError,
        });
      }

      setProcessedCount(i + 1);
    }

    // Generate Final Cleanup Report with guaranteed non-contradictory single status per file
    const successfulTrashed = trashedResults.filter((r) => r.trashedSuccess);
    const newTrashedIds = successfulTrashed.map((r) => r.trashedFile.id);
    setSessionTrashedFileIds((prev) => Array.from(new Set([...prev, ...newTrashedIds])));

    const isProtectedKeyFile = (fileName?: string) =>
      /^(?:00_)?readme\.txt$/i.test(fileName?.trim() || '');

    // Eliminate duplicate entries across categories:
    // Any target file attempted for trash must not appear in uncertain or kept
    const attemptedTargetIds = new Set(trashedResults.map((r) => r.trashedFile.id));

    const deduplicatedUncertain = uncertainMatches
      .filter((m) => !attemptedTargetIds.has(m.targetFile.id) && !isProtectedKeyFile(m.targetFile?.name))
      .map((m) => ({
        fileA: m.originalFile,
        fileB: m.targetFile,
        reason: m.reason,
        similarity: m.similarityScore,
        comparisonMethod: m.comparisonMethod,
      }));

    const deduplicatedKept = uniqueFiles.filter(
      (f) => !attemptedTargetIds.has(f.id) && !isProtectedKeyFile(f.name)
    );

    const generatedReport: CleanupReport = {
      timestamp: new Date().toISOString(),
      folderName,
      totalFilesReviewed: scannedFiles.filter((f) => !isProtectedKeyFile(f.name)).length,
      totalExactDuplicates: exactCount,
      totalVersionDrafts: draftCount,
      totalTrashed: successfulTrashed.length,
      totalUniqueKept: deduplicatedKept.length,
      scanDurationMs,
      metrics: scanMetrics || undefined,
      trashedFiles: trashedResults.filter((r) => !isProtectedKeyFile(r.trashedFile?.name)),
      uncertainFiles: deduplicatedUncertain,
      keptFiles: deduplicatedKept,
    };

    setReport(generatedReport);
    setIsTrashing(false);
    setIsConfirmationOpen(false);
    setScanStage('completed');
    fetchGeminiInsight(generatedReport, validMatches);

    // Register Bulk Action in History with 9-second Undo Window
    if (successfulTrashed.length > 0) {
      const newAction: HistoryAction = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'bulk_trash',
        timestamp: Date.now(),
        title: `Cleaned up ${successfulTrashed.length} duplicates`,
        description: `Moved ${successfulTrashed.length} draft/duplicate files in "${folderName}" to Drive Trash`,
        items: successfulTrashed.map((r) => ({
          fileId: r.trashedFile.id,
          fileName: r.trashedFile.name,
        })),
        undoAvailableUntil: Date.now() + 9000,
        canUndo: true,
      };

      setRecentActions((prev) => [newAction, ...prev]);
      setActiveUndoAction(newAction);
    }
  };

  const updateFileNameInState = (fileId: string, newName: string) => {
    setActionableMatches((prev) =>
      prev.map((m) => {
        let updatedTarget = m.targetFile;
        let updatedOriginal = m.originalFile;
        if (m.targetFile.id === fileId) {
          updatedTarget = { ...m.targetFile, name: newName };
        }
        if (m.originalFile.id === fileId) {
          updatedOriginal = { ...m.originalFile, name: newName };
        }
        return { ...m, targetFile: updatedTarget, originalFile: updatedOriginal };
      })
    );

    setScannedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
    );

    setUniqueFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
    );

    if (report) {
      setReport({
        ...report,
        trashedFiles: report.trashedFiles.map((t) => ({
          ...t,
          trashedFile: t.trashedFile.id === fileId ? { ...t.trashedFile, name: newName } : t.trashedFile,
          keptOriginalFile:
            t.keptOriginalFile.id === fileId ? { ...t.keptOriginalFile, name: newName } : t.keptOriginalFile,
        })),
      });
    }
  };

  const handleApplyRename = async (fileId: string, newName: string, oldName: string) => {
    const accessToken = token || getAccessToken();
    if (!accessToken) return;

    await renameFile(fileId, newName, accessToken);
    updateFileNameInState(fileId, newName);

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'rename',
      timestamp: Date.now(),
      title: 'Renamed File',
      description: `Renamed "${oldName}" to "${newName}"`,
      items: [{ fileId, fileName: newName, previousName: oldName, newName }],
      undoAvailableUntil: Date.now() + 9000,
      canUndo: true,
    };

    setRecentActions((prev) => [newAction, ...prev]);
    setActiveUndoAction(newAction);
  };

  const handleConfirmSmartFolder = (fileId: string, folderNameVal: string) => {
    const target = scannedFiles.find((f) => f.id === fileId);
    const fileName = target ? target.name : fileId;

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'organize_folder',
      timestamp: Date.now(),
      title: `Categorized Folder`,
      description: `Assigned "${fileName}" to "${folderNameVal}"`,
      items: [{ fileId, fileName, folderName: folderNameVal }],
      undoAvailableUntil: Date.now() + 9000,
      canUndo: false,
    };

    setRecentActions((prev) => [newAction, ...prev]);
  };

  const handleTrashSingleMatch = async (match: DuplicateMatch) => {
    const accessToken = token || getAccessToken();
    if (!accessToken) return;

    // Safety Gate: Verify eligibility and final candidate state
    const eligibility = isCleanupEligible(match);
    if (!eligibility.eligible) {
      setErrorMessage(`Cannot trash "${match.targetFile.name}": ${eligibility.reason}`);
      return;
    }

    const finalCheck = validateFinalTrashCandidate(match.targetFile.id, match.targetFile, {
      currentScannedFiles: scannedFiles,
      alreadyTrashedIds: new Set(sessionTrashedFileIds),
      isPlanApproved: true,
    });
    if (!finalCheck.valid) {
      setErrorMessage(`Cannot trash "${match.targetFile.name}": ${finalCheck.reason}`);
      return;
    }

    await moveFileToTrash(match.targetFile.id, accessToken);
    setActionableMatches((prev) => prev.filter((m) => m.id !== match.id));
    setSessionTrashedFileIds((prev) => [...prev, match.targetFile.id]);

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'trash',
      timestamp: Date.now(),
      title: 'Moved to Drive Trash',
      description: `Target duplicate "${match.targetFile.name}" moved to Trash`,
      items: [{ fileId: match.targetFile.id, fileName: match.targetFile.name }],
      undoAvailableUntil: Date.now() + 9000,
      canUndo: true,
    };

    setRecentActions((prev) => [newAction, ...prev]);
    setActiveUndoAction(newAction);
  };

  const handleBulkTrashMatches = async (matchesToTrash: DuplicateMatch[]) => {
    const accessToken = token || getAccessToken();
    if (!accessToken || matchesToTrash.length === 0) return;

    // Centralized Safety Gate: validate bulk candidate batch
    const { validMatches, rejectedMatches } = validateCleanupPlan(matchesToTrash);
    if (rejectedMatches.length > 0) {
      console.warn(`Bulk trash filtered out ${rejectedMatches.length} ineligible matches:`, rejectedMatches);
    }

    if (validMatches.length === 0) {
      setErrorMessage(
        `None of the selected ${matchesToTrash.length} files are eligible for trash cleanup (protected or require review).`
      );
      return;
    }

    const approvedPlanTargetIds = new Set(validMatches.map((m) => m.targetFile.id));
    const trashedResults: DriveFileItem[] = [];

    for (const m of validMatches) {
      const finalCheck = validateFinalTrashCandidate(m.targetFile.id, m.targetFile, {
        currentScannedFiles: scannedFiles,
        alreadyTrashedIds: new Set(sessionTrashedFileIds),
        approvedPlanTargetIds,
        isPlanApproved: true,
      });

      if (!finalCheck.valid) {
        console.warn(`Safety gate skipped "${m.targetFile.name}": ${finalCheck.reason}`);
        continue;
      }

      try {
        await moveFileToTrash(m.targetFile.id, accessToken);
        trashedResults.push(m.targetFile);
      } catch (err) {
        console.error(`Failed to trash ${m.targetFile.name}:`, err);
      }
    }

    const trashedIds = new Set(trashedResults.map((t) => t.id));
    setActionableMatches((prev) => prev.filter((m) => !trashedIds.has(m.targetFile.id)));
    setSelectedMatchIds([]);
    setSessionTrashedFileIds((prev) => [...prev, ...trashedResults.map((t) => t.id)]);

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'bulk_trash',
      timestamp: Date.now(),
      title: `Bulk Trashed ${trashedResults.length} Files`,
      description: `Moved ${trashedResults.length} selected duplicates to Google Drive Trash`,
      items: trashedResults.map((t) => ({ fileId: t.id, fileName: t.name })),
      undoAvailableUntil: Date.now() + 9000,
      canUndo: true,
    };

    setRecentActions((prev) => [newAction, ...prev]);
    setActiveUndoAction(newAction);
  };

  const handleBulkSmartRename = (matchesList: DuplicateMatch[]) => {
    if (matchesList.length > 0) {
      setSmartRenameTargetFile(matchesList[0].targetFile);
    }
  };

  const handleBulkSmartFolder = (matchesList: DuplicateMatch[]) => {
    if (matchesList.length > 0) {
      setSmartFolderTargetFile(matchesList[0].targetFile);
    }
  };

  const handleKeepAll = () => {
    const allIds = actionableMatches.map((m) => m.id);
    setKeptMatchIds(allIds);
    setSelectedMatchIds([]);

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'keep_all',
      timestamp: Date.now(),
      title: 'Kept All Duplicates',
      description: `Marked all ${allIds.length} duplicates as kept / ignored (0 files trashed).`,
      items: actionableMatches.map((m) => ({
        fileId: m.targetFile.id,
        fileName: m.targetFile.name,
      })),
      undoAvailableUntil: Date.now() + 9000,
      canUndo: true,
    };

    setRecentActions((prev) => [newAction, ...prev]);
    setActiveUndoAction(newAction);
    setCurrentActionText(
      `All ${allIds.length} duplicates marked as kept. Zero files staged for trashing.`
    );
  };

  const handleResetKept = () => {
    setKeptMatchIds([]);
    // Restore safe default selection
    const safeIds = actionableMatches
      .filter((m) => !m.hasSignificantDivergence)
      .map((m) => m.id);
    setSelectedMatchIds(safeIds);
  };

  const handleToggleKeepMatch = (id: string) => {
    setKeptMatchIds((prev) => {
      const isCurrentlyKept = prev.includes(id);
      if (isCurrentlyKept) {
        return prev.filter((x) => x !== id);
      } else {
        setSelectedMatchIds((sel) => sel.filter((x) => x !== id));
        return [...prev, id];
      }
    });
  };

  const handleFinalizeKeepAll = () => {
    const isProtectedKeyFile = (fileName?: string) =>
      /^(?:00_)?readme\.txt$/i.test(fileName?.trim() || '');

    const validUncertain = uncertainMatches
      .filter((u) => !isProtectedKeyFile(u.fileB?.name) && !isProtectedKeyFile(u.fileA?.name))
      .map((m) => ({
        fileA: m.originalFile,
        fileB: m.targetFile,
        reason: m.reason,
        similarity: m.similarityScore,
      }));

    // Deduplicate kept files
    const keptMap = new Map<string, DriveFileItem>();
    for (const file of uniqueFiles) {
      if (!isProtectedKeyFile(file.name)) keptMap.set(file.id, file);
    }
    for (const match of actionableMatches) {
      if (!isProtectedKeyFile(match.targetFile.name)) keptMap.set(match.targetFile.id, match.targetFile);
      if (!isProtectedKeyFile(match.originalFile.name)) keptMap.set(match.originalFile.id, match.originalFile);
    }
    const finalKept = Array.from(keptMap.values());

    const generatedReport: CleanupReport = {
      timestamp: new Date().toISOString(),
      folderName,
      totalFilesReviewed: scannedFiles.filter((f) => !isProtectedKeyFile(f.name)).length,
      totalExactDuplicates: actionableMatches.filter((m) => m.type === 'exact').length,
      totalVersionDrafts: actionableMatches.filter((m) => m.type !== 'exact').length,
      totalTrashed: 0,
      totalUniqueKept: finalKept.length,
      scanDurationMs,
      metrics: scanMetrics || undefined,
      trashedFiles: [],
      uncertainFiles: validUncertain,
      keptFiles: finalKept,
    };

    setReport(generatedReport);
    setScanStage('completed');
    fetchGeminiInsight(generatedReport, actionableMatches);
    setCurrentActionText(
      `Cleanup report finalized: Kept all ${actionableMatches.length} duplicates. 0 files trashed.`
    );
  };

  const handleExecuteUndo = async (action: HistoryAction) => {
    const accessToken = token || getAccessToken();
    if (!accessToken) return;

    try {
      if (action.type === 'trash' || action.type === 'bulk_trash') {
        for (const item of action.items) {
          await restoreFileFromTrash(item.fileId, accessToken);
        }
        setSessionTrashedFileIds((prev) =>
          prev.filter((id) => !action.items.some((i) => i.fileId === id))
        );
      } else if (action.type === 'restore') {
        for (const item of action.items) {
          await moveFileToTrash(item.fileId, accessToken);
        }
        setSessionTrashedFileIds((prev) => [...prev, ...action.items.map((i) => i.fileId)]);
      } else if (action.type === 'rename') {
        for (const item of action.items) {
          if (item.previousName) {
            await renameFile(item.fileId, item.previousName, accessToken);
            updateFileNameInState(item.fileId, item.previousName);
          }
        }
      } else if (action.type === 'keep_all') {
        setKeptMatchIds([]);
        const safeIds = actionableMatches
          .filter((m) => !m.hasSignificantDivergence)
          .map((m) => m.id);
        setSelectedMatchIds(safeIds);
      }

      setRecentActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, isUndone: true } : a))
      );
      setActiveUndoAction(null);
    } catch (err: any) {
      console.error('Undo execution failed:', err);
      setErrorMessage(`Undo failed: ${err.message}`);
    }
  };

  const handleRestoreFile = async (fileId: string) => {
    const accessToken = token || getAccessToken();
    if (!accessToken) return;

    const restoredName =
      report?.trashedFiles.find((t) => t.trashedFile.id === fileId)?.trashedFile.name || fileId;

    await restoreFileFromTrash(fileId, accessToken);
    setSessionTrashedFileIds((prev) => prev.filter((id) => id !== fileId));
    if (report) {
      setReport({
        ...report,
        trashedFiles: report.trashedFiles.filter((t) => t.trashedFile.id !== fileId),
        totalTrashed: Math.max(0, report.totalTrashed - 1),
      });
    }

    const newAction: HistoryAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'restore',
      timestamp: Date.now(),
      title: 'Restored File',
      description: `Restored "${restoredName}" back to active Drive folder`,
      items: [{ fileId, fileName: restoredName }],
      undoAvailableUntil: Date.now() + 9000,
      canUndo: true,
    };

    setRecentActions((prev) => [newAction, ...prev]);
    setActiveUndoAction(newAction);
  };

  return (
    <div className={`min-h-screen ${isLightMode ? 'bg-[#f4efe8] text-[#1a1714]' : 'bg-[#111111] text-[#F5E9DC]'} flex flex-col antialiased selection:bg-[#C75B12]/30 selection:text-[#F5E9DC]`}>
      <Navbar
        user={user}
        onLogout={handleSignOut}
        activeView={activeView}
        onViewChange={setActiveView}
        sessionTrashedCount={sessionTrashedFileIds.length}
        activityCount={recentActions.length}
        onOpenActivityTracker={() => setIsActivityTrackerOpen(true)}
        isTokenExpired={isTokenExpired}
        onRefreshToken={handleRefreshToken}
        onOpenLeftDrawer={() => setIsLeftDrawerOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {!user ? (
          <AuthScreen
            onSignIn={handleSignIn}
            isLoading={isLoggingIn}
            error={authError}
          />
        ) : activeView === 'trash_monitor' ? (
          <TrashBinMonitor
            token={token}
            sessionTrashedFileIds={sessionTrashedFileIds}
            onItemRestored={handleRestoreFile}
          />
        ) : (
          <div className="space-y-6">
            {/* If Google Workspace token needs 1-tap refresh while user remains logged in */}
            {isTokenExpired && (
              <div className="bg-[#1c1812] border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#F5E9DC]">
                        Google Workspace Session Needs Quick Refresh
                      </span>
                      <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        Account Stayed Connected
                      </span>
                    </div>
                    <p className="text-xs text-[#C9A86A]">
                      Your account ({user.displayName || user.email}) is securely remembered across sessions. Tap below to refresh your Google Drive permission without losing your setup.
                    </p>
                  </div>
                </div>
                <button
                  id="refresh-drive-session-btn"
                  onClick={handleRefreshToken}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#C75B12] hover:bg-[#b04f0e] text-[#F5E9DC] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 min-h-[44px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                  <span>{isLoggingIn ? 'Refreshing...' : 'Refresh Drive Session'}</span>
                </button>
              </div>
            )}

            {/* Scan Configuration Screen (Idle) or Active Scan Header */}
            {scanStage === 'idle' ? (
              <ScanConfigurationCard
                token={token}
                targetFolder={targetFolder}
                scanType={scanType}
                fileTypeFilter={fileTypeFilter}
                customExtensions={customExtensions}
                onTargetFolderChange={setTargetFolder}
                onScanTypeChange={setScanType}
                onFileTypeFilterChange={setFileTypeFilter}
                onCustomExtensionsChange={setCustomExtensions}
                onStartScan={startCleanupScan}
                isLoading={false}
                autoSelectPreferences={autoSelectPreferences}
                onOpenAutoSelectModal={() => setIsAutoSelectModalOpen(true)}
                onToggleAutoSelect={handleToggleAutoSelect}
              />
            ) : (
              <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A86A]">
                        Scan Target &bull; {targetFolder.name}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F5E9DC]">
                      {targetFolder.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#A0988E]">
                      <span className="px-2 py-0.5 rounded-md bg-[#242424] border border-[#333333] text-[#F5E9DC]">
                        {scanType === 'exact_only' ? 'Exact Duplicates Only' : 'Duplicates + Draft/Version Detection'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#242424] border border-[#333333] text-[#A0988E]">
                        Filter: {fileTypeFilter === 'all' ? 'All Files' : fileTypeFilter}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 text-[11px] font-medium">
                    <button
                      onClick={() => setIsLeftDrawerOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#282828] border border-[#333333] text-[#C9A86A] flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="View active safeguards and protection policies"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Safeguards & Policies Active</span>
                    </button>
                    {scanStage !== 'completed' && (
                      <button
                        onClick={handleStopWorkflow}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold"
                        title="Stop current running analysis or workflow"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop Workflow</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-1">
                  <strong className="font-semibold text-rose-200">Operation Error</strong>
                  <p>{errorMessage}</p>
                  <button
                    onClick={() => startCleanupScan()}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}

            {/* In-Progress Scan Visualizer */}
            {['locating_folder', 'fetching_files', 'reading_contents', 'analyzing_duplicates', 'trashing'].includes(
              scanStage
            ) && (
              <ScanProgress
                stage={scanStage}
                currentActionText={currentActionText}
                processedCount={processedCount}
                totalCount={totalCount}
                folderName={folderName}
                onStopScan={handleStopWorkflow}
              />
            )}

            {/* Smart Review Stage (Interactive Safety Tiers & Divergence Verification) */}
            {scanStage === 'smart_review' && (
              <SmartScanReviewView
                folderName={folderName}
                actionableMatches={actionableMatches}
                uncertainMatches={uncertainMatches}
                uniqueFiles={uniqueFiles}
                metrics={scanMetrics}
                selectedMatchIds={selectedMatchIds}
                keptMatchIds={keptMatchIds}
                onCancelWorkflow={handleStopWorkflow}
                onOpenSummary={() => setIsScanSummaryOpen(true)}
                onExportReport={handleExportProposedReport}
                onOpenExportModal={handleOpenProposedReportModal}
                onToggleSelectMatch={(id) => {
                  setSelectedMatchIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  );
                }}
                onSelectSafeOnly={() => {
                  const safeIds = actionableMatches
                    .filter((m) => !m.hasSignificantDivergence)
                    .map((m) => m.id);
                  setSelectedMatchIds(safeIds);
                }}
                onSelectAll={() => setSelectedMatchIds(actionableMatches.map((m) => m.id))}
                onDeselectAll={() => setSelectedMatchIds([])}
                onKeepAll={handleKeepAll}
                onResetKept={handleResetKept}
                onToggleKeepMatch={handleToggleKeepMatch}
                onFinalizeKeepAll={handleFinalizeKeepAll}
                onOpenComparison={(match) => setSelectedComparison(match)}
                onOpenQuickView={(file, match) => {
                  setQuickViewFile(file);
                  setQuickViewMatch(match || null);
                }}
                onProceedToDetailedResults={() => setScanStage('ready_for_review')}
                onConfirmTrashApproved={() => setIsConfirmationOpen(true)}
                autoSelectPreferences={autoSelectPreferences}
                onOpenAutoSelectModal={() => setIsAutoSelectModalOpen(true)}
                onApplyAutoSelectRules={handleApplyAutoSelectRules}
                onToggleAutoSelect={handleToggleAutoSelect}
              />
            )}

            {/* Ready for Review Stage (Granular Results & Full Filter Bar) */}
            {scanStage === 'ready_for_review' && (
              <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#262626]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C75B12]" />
                      <h3 className="text-base font-bold text-[#F5E9DC]">
                        Proposed Cleanup Plan ({actionableMatches.length} candidates)
                      </h3>
                    </div>
                    <p className="text-xs text-[#A0988E] mt-0.5">
                      Reviewed {scannedFiles.length} files. Filter results, inspect diffs, and select files to trash.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsScanSummaryOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[#C9A86A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                      title="View concise findings overview and quick triage options"
                    >
                      <Sparkles className="w-4 h-4 text-[#C9A86A]" />
                      <span>Summary</span>
                    </button>
                    <button
                      onClick={() => setScanStage('smart_review')}
                      className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[#C9A86A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                      title="Switch to tiered safety review stage"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Smart Review Tiers</span>
                    </button>

                    {/* Export Plan Report Trigger & Direct Format Buttons */}
                    <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#2e2e2e]">
                      <button
                        id="export-proposed-modal-btn"
                        onClick={handleOpenProposedReportModal}
                        className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] text-[#F5E9DC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                        title="Download proposed cleanup report in Markdown, Text, or CSV format"
                      >
                        <Download className="w-3.5 h-3.5 text-[#C75B12]" />
                        <span>Export Plan</span>
                      </button>
                      <button
                        id="export-proposed-md-btn"
                        onClick={() => handleExportProposedReport('markdown')}
                        className="px-2 py-1.5 rounded-lg hover:bg-[#242424] text-[#C75B12] hover:text-[#d66518] text-[11px] font-bold transition-colors cursor-pointer min-h-[36px]"
                        title="Download as Markdown Document (.md)"
                      >
                        .MD
                      </button>
                      <button
                        id="export-proposed-txt-btn"
                        onClick={() => handleExportProposedReport('text')}
                        className="px-2 py-1.5 rounded-lg hover:bg-[#242424] text-[#C9A86A] hover:text-[#e0bb77] text-[11px] font-bold transition-colors cursor-pointer min-h-[36px]"
                        title="Download as Plain Text Document (.txt)"
                      >
                        .TXT
                      </button>
                      <button
                        id="export-proposed-csv-btn"
                        onClick={() => handleExportProposedReport('csv')}
                        className="px-2 py-1.5 rounded-lg hover:bg-[#242424] text-emerald-400 hover:text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer min-h-[36px]"
                        title="Download as CSV Spreadsheet (.csv)"
                      >
                        .CSV
                      </button>
                    </div>

                    <button
                      onClick={() => startCleanupScan()}
                      className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] text-[#A0988E] hover:text-[#F5E9DC] text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
                    >
                      Re-scan
                    </button>
                    <button
                      onClick={handleStopWorkflow}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                      title="Cancel review and return to scan configuration"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Workflow</span>
                    </button>
                    <button
                      id="confirm-trash-btn"
                      onClick={() => setIsConfirmationOpen(true)}
                      disabled={selectedMatchIds.length === 0 && actionableMatches.length === 0}
                      className="px-5 py-2.5 rounded-xl bg-[#C75B12] hover:bg-[#d66518] disabled:opacity-50 text-[#F5E9DC] text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        Execute Trash ({selectedMatchIds.length > 0 ? selectedMatchIds.length : actionableMatches.length})
                      </span>
                    </button>
                  </div>
                </div>

                {/* Scan Summary Metrics Pre-Execution */}
                {scanMetrics && (
                  <ScanMetricsCard
                    metrics={scanMetrics}
                    folderName={folderName}
                    isPreTrash={true}
                  />
                )}

                {/* Match Lists & Enhanced Controls (Grid/List, Smart Folder, Smart Rename, Hover Summary, Bulk Actions) */}
                <MatchesView
                  matches={actionableMatches}
                  uncertainMatches={uncertainMatches}
                  selectedMatchIds={selectedMatchIds}
                  onToggleSelectMatch={(id) => {
                    setSelectedMatchIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    );
                  }}
                  onSelectAll={() => setSelectedMatchIds(actionableMatches.map((m) => m.id))}
                  onDeselectAll={() => setSelectedMatchIds([])}
                  onOpenComparison={(match) => setSelectedComparison(match)}
                  onOpenQuickView={(file, match) => {
                    setQuickViewFile(file);
                    setQuickViewMatch(match || null);
                  }}
                  onOpenSmartRename={(file) => setSmartRenameTargetFile(file)}
                  onOpenSmartFolder={(file) => setSmartFolderTargetFile(file)}
                  onTrashSingleMatch={handleTrashSingleMatch}
                  onBulkTrashMatches={handleBulkTrashMatches}
                  onBulkSmartRename={handleBulkSmartRename}
                  onBulkSmartFolder={handleBulkSmartFolder}
                  autoSelectPreferences={autoSelectPreferences}
                  onOpenAutoSelectModal={() => setIsAutoSelectModalOpen(true)}
                  onApplyAutoSelectRules={handleApplyAutoSelectRules}
                  onToggleAutoSelect={handleToggleAutoSelect}
                />
              </div>
            )}

            {/* Completed Final Report */}
            {scanStage === 'completed' && report && (
              <ReportView
                report={report}
                onRestoreFile={handleRestoreFile}
                onOpenComparison={(match) => setSelectedComparison(match)}
                onRefreshInsight={() => fetchGeminiInsight(report)}
                onRestartScan={() => {
                  setScanStage('idle');
                  setReport(null);
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* 7-10 Second Undo Floating Bar */}
      <UndoActionBar
        activeAction={activeUndoAction}
        onUndo={handleExecuteUndo}
        onDismiss={() => setActiveUndoAction(null)}
      />

      {/* Activity Tracker Slide-Out Drawer */}
      <ActivityTrackerDrawer
        isOpen={isActivityTrackerOpen}
        onClose={() => setIsActivityTrackerOpen(false)}
        actions={recentActions}
        onUndoAction={handleExecuteUndo}
        onClearHistory={() => setRecentActions([])}
      />

      {/* Smart Rename Modal */}
      <SmartRenameModal
        isOpen={smartRenameTargetFile !== null}
        file={smartRenameTargetFile}
        onClose={() => setSmartRenameTargetFile(null)}
        onApplyRename={handleApplyRename}
      />

      {/* Smart Folder Suggestion Modal */}
      <SmartFolderModal
        isOpen={smartFolderTargetFile !== null}
        file={smartFolderTargetFile}
        onClose={() => setSmartFolderTargetFile(null)}
        onConfirmFolder={handleConfirmSmartFolder}
      />

      {/* Concise Scan Findings Summary & Quick Triage Modal */}
      <ScanSummaryModal
        isOpen={isScanSummaryOpen}
        onClose={() => setIsScanSummaryOpen(false)}
        folderName={targetFolder.id === 'root' ? 'Entire Google Drive' : targetFolder.name}
        scannedFiles={scannedFiles}
        actionableMatches={actionableMatches}
        uncertainMatches={uncertainMatches}
        uniqueFiles={uniqueFiles}
        onReviewAllDetails={() => {
          setIsScanSummaryOpen(false);
          setScanStage('smart_review');
        }}
        onSelectExactOnlyAndReview={() => {
          const exactIds = actionableMatches
            .filter((m) => m.type === 'exact')
            .map((m) => m.id);
          setSelectedMatchIds(exactIds);
          setIsScanSummaryOpen(false);
          setScanStage('smart_review');
        }}
        onKeepEverythingForNow={() => {
          handleKeepAll();
          setIsScanSummaryOpen(false);
          setScanStage('smart_review');
        }}
        onExportReport={handleExportProposedReport}
      />

      {/* Confirmation Modal (Mandatory for destructive trash operations) */}
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        matchesToTrash={
          validateCleanupPlan(
            selectedMatchIds.length > 0
              ? actionableMatches.filter((m) => selectedMatchIds.includes(m.id))
              : actionableMatches
          ).validMatches
        }
        onConfirm={handleConfirmTrash}
        onCancel={() => setIsConfirmationOpen(false)}
        isTrashing={isTrashing}
      />

      {/* Side-by-side comparison modal */}
      <FileComparisonModal
        match={selectedComparison}
        onClose={() => setSelectedComparison(null)}
      />

      {/* Quick View Snippet & Metadata Modal */}
      <QuickViewModal
        isOpen={quickViewFile !== null}
        file={quickViewFile}
        match={quickViewMatch}
        onClose={() => {
          setQuickViewFile(null);
          setQuickViewMatch(null);
        }}
        onOpenFullComparison={(match) => {
          setQuickViewFile(null);
          setQuickViewMatch(null);
          setSelectedComparison(match);
        }}
      />

      {/* Left Drawer Pullout Menu (Display/Appearance, Navigation, Results Management, Safeguards) */}
      <LeftDrawerMenu
        isOpen={isLeftDrawerOpen}
        onClose={() => setIsLeftDrawerOpen(false)}
        activeView={activeView}
        onViewChange={(v) => {
          setActiveView(v);
          setIsLeftDrawerOpen(false);
        }}
        onOpenActivityTracker={() => {
          setIsLeftDrawerOpen(false);
          setIsActivityTrackerOpen(true);
        }}
        activityCount={recentActions.length}
        sessionTrashedCount={sessionTrashedFileIds.length}
        isLightMode={isLightMode}
        onToggleTheme={() => setIsLightMode((prev) => !prev)}
        fontSize={fontSize}
        onChangeFontSize={(size) => setFontSize(size)}
        currentFolder={targetFolder}
        matchesCount={actionableMatches.length}
        selectedMatchesCount={selectedMatchIds.length}
        onSelectAllMatches={() => setSelectedMatchIds(actionableMatches.map((m) => m.id))}
        onDeselectAllMatches={() => setSelectedMatchIds([])}
        onExportReport={actionableMatches.length > 0 ? handleExportProposedReport : undefined}
        onExportCsv={actionableMatches.length > 0 ? () => handleExportProposedReport('csv') : undefined}
        onNewScan={() => {
          setIsLeftDrawerOpen(false);
          setScanStage('idle');
          setReport(null);
        }}
        autoSelectPreferences={autoSelectPreferences}
        onOpenAutoSelectModal={() => setIsAutoSelectModalOpen(true)}
        onToggleAutoSelect={handleToggleAutoSelect}
      />

      {/* Advanced Auto-Select Preferences Modal */}
      <AdvancedAutoSelectModal
        isOpen={isAutoSelectModalOpen}
        onClose={() => setIsAutoSelectModalOpen(false)}
        preferences={autoSelectPreferences}
        initialPreferences={autoSelectPreferences}
        onSavePreferences={handleSaveAutoSelectPreferences}
        currentMatches={actionableMatches}
        candidateMatches={actionableMatches}
        onApplyToCurrent={(newPrefs) => {
          handleSaveAutoSelectPreferences(newPrefs);
          if (actionableMatches.length > 0) {
            const realigned = actionableMatches.map((m) => realignMatchWithPreferences(m, newPrefs));
            setActionableMatches(realigned);
            const selected = evaluateAutoSelectMatchIds(realigned, newPrefs);
            setSelectedMatchIds(selected);
          }
        }}
      />

      {/* Download Report Modal (Markdown / Text / CSV with preview & copy) */}
      {downloadModalReport && (
        <DownloadReportModal
          isOpen={downloadModalReport !== null}
          onClose={() => setDownloadModalReport(null)}
          report={downloadModalReport}
        />
      )}
    </div>
  );
}
