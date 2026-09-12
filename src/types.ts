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
  trashed?: boolean;
  summaryDescription?: string;
  suggestedFolder?: {
    name: string;
    icon: string;
    reason: string;
    confidence: number;
  };
  suggestedRename?: {
    suggestedName: string;
    reason: string;
  };
}

export type DuplicateType = 'exact' | 'near-duplicate' | 'unique';

export type ViewMode = 'grid' | 'list';

export type ScanType = 'exact_only' | 'duplicates_and_drafts';

export type FileTypeFilter = 'all' | 'documents' | 'markdown_text' | 'office' | 'custom';

export interface DriveFolderItem {
  id: string;
  name: string;
  parentId?: string;
  modifiedTime?: string;
}

export interface ScanConfig {
  targetFolder: DriveFolderItem;
  scanType: ScanType;
  fileTypeFilter: FileTypeFilter;
  customExtensions: string[];
}

export interface HistoryActionItem {
  fileId: string;
  fileName: string;
  previousName?: string;
  newName?: string;
  folderName?: string;
}

export interface HistoryAction {
  id: string;
  type: 'trash' | 'restore' | 'rename' | 'bulk_trash' | 'organize_folder' | 'keep_all';
  timestamp: number;
  title: string;
  description: string;
  items: HistoryActionItem[];
  undoAvailableUntil: number; // epoch timestamp ms (expires after 7-10s)
  canUndo: boolean;
  isUndone?: boolean;
}

export interface ContentDivergenceInfo {
  hasSignificantDivergence: boolean;
  uniqueToTargetCount: number;
  uniqueToOriginalCount: number;
  uniqueToTargetLines?: string[];
  uniqueToOriginalLines?: string[];
  divergencePercentage: number;
  warningLevel: 'high' | 'medium' | 'none';
  summaryMessage: string;
}

export interface DuplicateMatch {
  id: string;
  type: DuplicateType;
  confidence: number; // 0 to 1
  reason: string;
  signalUsed?: 'content_statement' | 'modified_timestamp' | 'none';
  signalDetails?: string;
  originalFile: DriveFileItem; // The most recently modified or verified newer copy to KEEP
  targetFile: DriveFileItem;   // The older or superseded copy to TRASH
  similarityScore: number;
  isUncertain: boolean;
  uncertaintyReason?: string;
  hasSignificantDivergence?: boolean;
  divergenceInfo?: ContentDivergenceInfo;
}

export interface CleanupMetrics {
  totalScanned: number;
  exactDuplicatesCount: number;
  versionDraftsCount: number;
  uncertainCount: number;
  uniqueKeptCount: number;
  totalBytesReclaimed: number;
  duplicationRate: number; // 0 - 100 percentage
  avgSimilarity: number;   // 0 - 100 percentage
  scanDurationMs: number;
  scanSpeedFilesPerSec: number;
}

export interface CleanupReport {
  timestamp: string;
  folderName: string;
  totalFilesReviewed: number;
  totalExactDuplicates: number;
  totalVersionDrafts: number;
  totalTrashed: number;
  totalUniqueKept: number;
  scanDurationMs?: number;
  metrics?: CleanupMetrics;
  cleanupInsight?: string;
  isLoadingInsight?: boolean;
  trashedFiles: Array<{
    trashedFile: DriveFileItem;
    keptOriginalFile: DriveFileItem;
    type: DuplicateType;
    reason: string;
    signalUsed?: 'content_statement' | 'modified_timestamp' | 'none';
    similarity: number;
    trashedSuccess: boolean;
    error?: string;
  }>;
  uncertainFiles: Array<{
    fileA: DriveFileItem;
    fileB: DriveFileItem;
    reason: string;
    similarity: number;
  }>;
  keptFiles: DriveFileItem[];
}

export type ScanStage = 
  | 'idle'
  | 'locating_folder'
  | 'fetching_files'
  | 'reading_contents'
  | 'analyzing_duplicates'
  | 'ready_for_review'
  | 'smart_review'
  | 'trashing'
  | 'completed'
  | 'error';
