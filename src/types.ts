export type ContentStatus = 'extracted' | 'unavailable' | 'empty';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string | number;
  md5Checksum?: string;
  parents?: string[];
  content?: string;
  contentHash?: string;
  contentStatus?: ContentStatus;
  extractedWordCount?: number;
  trashed?: boolean;
  summaryDescription?: string;
  suggestedFolder?: { name: string; icon: string; reason: string; confidence: number };
  suggestedRename?: { suggestedName: string; reason: string };
}

/** Legacy values remain supported while new scans can use explicit verification tiers. */
export type DuplicateType =
  | 'exact'
  | 'near-duplicate'
  | 'unique'
  | 'byte-exact'
  | 'content-exact'
  | 'probable-candidate';

export type ViewMode = 'grid' | 'list';
export type ScanType = 'exact_only' | 'duplicates_and_drafts';
export type FileTypeFilter = 'all' | 'documents' | 'markdown_text' | 'office' | 'custom';

export interface DriveFolderItem { id: string; name: string; parentId?: string; modifiedTime?: string; }
export interface ScanConfig { targetFolder: DriveFolderItem; scanType: ScanType; fileTypeFilter: FileTypeFilter; customExtensions: string[]; }
export interface HistoryActionItem { fileId: string; fileName: string; previousName?: string; newName?: string; folderName?: string; }
export interface HistoryAction { id: string; type: 'trash' | 'restore' | 'rename' | 'bulk_trash' | 'organize_folder' | 'keep_all'; timestamp: number; title: string; description: string; items: HistoryActionItem[]; undoAvailableUntil: number; canUndo: boolean; isUndone?: boolean; }

export interface ContentDivergenceInfo { hasSignificantDivergence: boolean; uniqueToTargetCount: number; uniqueToOriginalCount: number; uniqueToTargetLines?: string[]; uniqueToOriginalLines?: string[]; divergencePercentage: number; warningLevel: 'high' | 'medium' | 'none'; summaryMessage: string; }

export interface DuplicateMatch {
  id: string;
  type: DuplicateType;
  confidence: number;
  reason: string;
  signalUsed?: 'content_statement' | 'modified_timestamp' | 'size_and_name' | 'none';
  signalDetails?: string;
  comparisonMethod?: 'text_similarity' | 'size_and_name_match' | 'binary_checksum_match' | 'none';
  originalFile: DriveFileItem;
  targetFile: DriveFileItem;
  similarityScore: number;
  isUncertain: boolean;
  /** Explicit safety state. These are intentionally separate from confidence. */
  requiresManualReview?: boolean;
  deletionEligible?: boolean;
  contentVerified?: boolean;
  uncertaintyReason?: string;
  hasSignificantDivergence?: boolean;
  divergenceInfo?: ContentDivergenceInfo;
}

export interface CleanupMetrics { totalScanned: number; exactDuplicatesCount: number; versionDraftsCount: number; uncertainCount: number; uniqueKeptCount: number; totalBytesReclaimed: number; duplicationRate: number; avgSimilarity: number; scanDurationMs: number; scanSpeedFilesPerSec: number; }
export interface CleanupReport { timestamp: string; folderName: string; isProposedReport?: boolean; totalFilesReviewed: number; totalExactDuplicates: number; totalVersionDrafts: number; totalTrashed: number; totalUniqueKept: number; scanDurationMs?: number; metrics?: CleanupMetrics; cleanupInsight?: string; isLoadingInsight?: boolean; trashedFiles: Array<{ trashedFile: DriveFileItem; keptOriginalFile: DriveFileItem; type: DuplicateType; reason: string; signalUsed?: DuplicateMatch['signalUsed']; comparisonMethod?: DuplicateMatch['comparisonMethod']; similarity: number; trashedSuccess: boolean; isProposed?: boolean; error?: string; }>; uncertainFiles: Array<{ fileA: DriveFileItem; fileB: DriveFileItem; reason: string; similarity: number; comparisonMethod?: DuplicateMatch['comparisonMethod']; }>; keptFiles: DriveFileItem[]; }

export type ScanStage = 'idle' | 'locating_folder' | 'fetching_files' | 'reading_contents' | 'analyzing_duplicates' | 'ready_for_review' | 'smart_review' | 'trashing' | 'completed' | 'error';
export type KeeperPreference = 'newer' | 'older' | 'largest' | 'smallest' | 'cleanest_name';

export interface AutoSelectPreferences {
  enabled: boolean;
  keeperPreference: KeeperPreference;
  secondaryPreference: KeeperPreference;
  respectContentSignals: boolean;
  autoSelectExact: boolean;
  autoSelectDrafts: boolean;
  autoSelectDivergent: boolean;
  minSimilarityThreshold: number;
  autoSelectUncertain: boolean;
  autoApplyOnScan: boolean;
}

/** Personal assisted-cleanup mode: scanning never stages files automatically. */
export const DEFAULT_AUTO_SELECT_PREFERENCES: AutoSelectPreferences = {
  enabled: false,
  keeperPreference: 'newer',
  secondaryPreference: 'largest',
  respectContentSignals: true,
  autoSelectExact: false,
  autoSelectDrafts: false,
  autoSelectDivergent: false,
  minSimilarityThreshold: 0.75,
  autoSelectUncertain: false,
  autoApplyOnScan: false,
};
