import { DriveFileItem, DuplicateMatch } from '../types';
import { detectContentDivergence } from './smartFileIntelligence';

/**
 * Normalizes text by removing non-alphanumeric noise and extra whitespaces.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a normalized base title by removing file extensions, version indicators,
 * date stamps, and common copy suffixes (e.g. " (1)", "_v2", "-draft").
 */
export function getBaseTitle(filename: string): string {
  // Strip extension
  let base = filename.replace(/\.[^/.]+$/, '');
  // Strip copy suffixes like " (1)", " - Copy", " copy"
  base = base.replace(/[\s_-]*(copy|\(\d+\)|\bcopy\b)/gi, '');
  // Strip version suffixes like "_v1", "-v2.3", "_final", "_draft", "_revised"
  base = base.replace(/[\s_-]*(v\d+(\.\d+)?|draft|final|revised|wip|temp)/gi, '');
  // Strip trailing dates like "_2024-05-12" or "(2024)"
  base = base.replace(/[\s_-]*(\d{4}[-_]\d{2}[-_]\d{2}|\d{8})/g, '');
  return normalizeText(base);
}

/**
 * Calculates Jaccard similarity coefficient between two sets of word tokens.
 */
function calculateJaccardSimilarity(textA: string, textB: string): number {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 2));

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = wordsA.size + wordsB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Calculates n-gram character similarity for tighter sentence/paragraph structure.
 */
function calculateNgramSimilarity(textA: string, textB: string, n = 3): number {
  if (textA === textB) return 1.0;
  if (!textA || !textB) return 0.0;

  const getGrams = (str: string) => {
    const s = str.toLowerCase().replace(/\s+/g, ' ');
    const grams = new Map<string, number>();
    for (let i = 0; i <= s.length - n; i++) {
      const gram = s.substring(i, i + n);
      grams.set(gram, (grams.get(gram) || 0) + 1);
    }
    return grams;
  };

  const gramsA = getGrams(textA);
  const gramsB = getGrams(textB);

  let intersection = 0;
  let totalA = 0;
  let totalB = 0;

  for (const [, count] of gramsA) totalA += count;
  for (const [, count] of gramsB) totalB += count;

  for (const [gram, countA] of gramsA) {
    if (gramsB.has(gram)) {
      intersection += Math.min(countA, gramsB.get(gram)!);
    }
  }

  const total = totalA + totalB;
  return total === 0 ? 0 : (2 * intersection) / total;
}

/**
 * Compares two filenames for semantic draft/version title similarity.
 */
function calculateTitleSimilarity(nameA: string, nameB: string): number {
  const baseA = getBaseTitle(nameA);
  const baseB = getBaseTitle(nameB);

  if (baseA === baseB && baseA.length > 0) return 1.0;
  if (!baseA || !baseB) return 0.0;

  // Check if one base title contains the other
  if (baseA.includes(baseB) || baseB.includes(baseA)) {
    const minLen = Math.min(baseA.length, baseB.length);
    const maxLen = Math.max(baseA.length, baseB.length);
    return minLen / maxLen >= 0.6 ? 0.85 : 0.6;
  }

  return calculateNgramSimilarity(baseA, baseB, 2);
}

interface ContentSignals {
  versionNum: number | null;
  isFinal: boolean;
  isDraft: boolean;
  isRevised: boolean;
  supersedesOther: boolean;
  supersededByOther: boolean;
  explicitQuotes: string[];
}

/**
 * Checks if a filename has an explicit copy suffix (e.g. " (1)", "_copy", " - Copy").
 */
export function hasCopySuffix(filename: string): boolean {
  const base = filename.replace(/\.[^/.]+$/, '');
  return /[\s_-]*(?:copy|\(\d+\))\s*$/i.test(base);
}

/**
 * Analyzes content and title for explicit version indicators:
 * Words or phrases like "draft", "final", "revised", "supersedes", "v1"/"v2",
 * version numbers, or one file explicitly referencing the other.
 */
function extractVersionSignals(file: DriveFileItem, otherFile?: DriveFileItem): ContentSignals {
  const content = (file.content || '').slice(0, 100000); // Analyze content where headers, changelogs, or body live
  const lowerContent = content.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const combined = `${lowerName}\n${lowerContent}`;

  let versionNum: number | null = null;
  let isFinal = false;
  let isDraft = false;
  let isRevised = false;
  let supersedesOther = false;
  let supersededByOther = false;
  const explicitQuotes: string[] = [];

  // Check version numbers in filename and content (e.g. v2, v2.1, version 3, v1)
  const vMatch = combined.match(/\b(?:version|ver\.?|v)\s*[:=-]?\s*(\d+(?:\.\d+)?)\b/i);
  if (vMatch) {
    versionNum = parseFloat(vMatch[1]);
    explicitQuotes.push(`Version ${vMatch[1]}`);
  }

  // Check for "final", "approved", "published", "complete"
  if (/\b(?:final|approved|published|status:\s*final|finalized)\b/i.test(combined)) {
    isFinal = true;
    explicitQuotes.push('marked as "final/approved"');
  }

  // Check for "draft", "preliminary", "working draft", "rough draft", "wip"
  // Exclude clauses that mention superseding older drafts so the current document isn't misidentified as a draft
  const contentExcludingSupersession = lowerContent.replace(
    /(?:supersedes|replaces|obsoletes)[^\n.]{0,80}/gi,
    ''
  );
  const isDraftInName = /\b(?:draft|preliminary|wip)\b/i.test(lowerName);
  const isDraftInBody = /\b(?:draft|preliminary|working draft|rough draft|wip|in-progress|status:\s*draft)\b/i.test(
    contentExcludingSupersession
  );

  if (isDraftInName || (isDraftInBody && !isFinal)) {
    isDraft = true;
    explicitQuotes.push('marked as "draft"');
  }

  // Check for "revised", "revision", "updated"
  if (/\b(?:revised|revision|updated version|amended)\b/i.test(combined)) {
    isRevised = true;
    explicitQuotes.push('marked as "revised/updated"');
  }

  // Check if this file explicitly mentions superseding / replacing the other file
  if (otherFile) {
    const rawOtherName = otherFile.name.replace(/\.[^/.]+$/, '');
    const otherTokens = rawOtherName.split(/[\s_\-.]+/).filter((t) => t.length > 1);
    const baseTokens = getBaseTitle(otherFile.name).split(/\s+/).filter((t) => t.length > 1);

    const patternsToTry: string[] = [];
    if (otherTokens.length > 0) {
      patternsToTry.push(otherTokens.map(escapeRegex).join('[\\s_\\-]+'));
    }
    if (baseTokens.length > 0 && baseTokens.join(' ') !== otherTokens.join(' ')) {
      patternsToTry.push(baseTokens.map(escapeRegex).join('[\\s_\\-]+'));
    }
    patternsToTry.push(escapeRegex(rawOtherName.toLowerCase()));

    for (const pat of patternsToTry) {
      const supersedesRegex = new RegExp(
        `(?:supersedes|replaces|obsoletes|continuation of|updated from)[^\\n\\r.]{0,100}?${pat}`,
        'i'
      );
      if (supersedesRegex.test(lowerContent) || supersedesRegex.test(lowerName)) {
        supersedesOther = true;
        explicitQuotes.push(`explicitly states that it supersedes/replaces "${otherFile.name}"`);
        break;
      }

      const supersededByRegex = new RegExp(
        `(?:superseded by|replaced by|obsoleted by)[^\\n\\r.]{0,100}?${pat}`,
        'i'
      );
      if (supersededByRegex.test(lowerContent) || supersededByRegex.test(lowerName)) {
        supersededByOther = true;
        explicitQuotes.push(`explicitly states that it is superseded by "${otherFile.name}"`);
        break;
      }
    }

    // General supersedes statement (e.g. "This document supersedes all previous drafts", "Supersedes previous version")
    // Applies ONLY IF otherFile is related (shares base title, title similarity >= 0.35, or content similarity >= 0.25)
    if (!supersedesOther) {
      const generalSupersedesRegex =
        /\b(?:this\s+(?:document|version|draft|file)\s+supersedes|supersedes\s+(?:all\s+)?(?:previous|earlier|prior|past)\s+(?:drafts?|versions?|copies|notes?)|supersedes\s+(?:the\s+)?(?:previous|earlier|prior)\s+(?:draft|version)|supersedes\s*:\s*(?:previous|earlier|prior|draft|v\d+)|supersedes\s+draft|supersedes\s+v\d+|supersedes\s+prior|replaces\s+(?:all\s+)?(?:previous|earlier|prior)\s+(?:drafts?|versions?)|replaces\s+earlier\s+drafts?)\b/i;

      if (generalSupersedesRegex.test(lowerContent)) {
        const baseThis = getBaseTitle(file.name);
        const baseOther = getBaseTitle(otherFile.name);
        const isRelated =
          (baseThis.length > 2 && baseOther.length > 2 && (baseThis === baseOther || baseThis.includes(baseOther) || baseOther.includes(baseThis))) ||
          calculateTitleSimilarity(file.name, otherFile.name) >= 0.35;

        if (isRelated) {
          supersedesOther = true;
          explicitQuotes.push('explicitly states that it supersedes previous drafts/versions');
        }
      }
    }
  }

  return {
    versionNum,
    isFinal,
    isDraft,
    isRevised,
    supersedesOther,
    supersededByOther,
    explicitQuotes,
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface SeniorityDecision {
  keeper: DriveFileItem;
  olderOrDuplicate: DriveFileItem;
  signalUsed: 'content_statement' | 'modified_timestamp' | 'none';
  reason: string;
  isUncertain: boolean;
  uncertaintyReason?: string;
}

/**
 * Implements the USER's strict priority order for deciding which version is newer:
 * 
 * a. First, look for explicit content signals — words or phrases like "draft," "final," "revised,"
 *    "supersedes," "v1"/"v2," version numbers, or one file explicitly referencing the other.
 *    If the content itself states which one replaces which, use that — this OVERRIDES timestamps completely.
 * b. Only if content gives no such signal, fall back to modified timestamp.
 * c. If two files were modified within the same few minutes of each other (<= 5 minutes), treat timestamp
 *    as unreliable and require a content-based signal before acting — if none exists, flag as uncertain.
 *    NOTE: Exact byte/hash-identical duplicates contain identical content with no divergence, so timestamp
 *    unreliability does NOT apply to exact duplicates.
 */
export function decideNewerVersion(
  fileA: DriveFileItem,
  fileB: DriveFileItem,
  matchType: 'exact' | 'near-duplicate'
): SeniorityDecision {
  const sigA = extractVersionSignals(fileA, fileB);
  const sigB = extractVersionSignals(fileB, fileA);

  // Check rule a: Explicit content signals
  // 1. Explicit superseding declaration
  if (sigA.supersedesOther || sigB.supersededByOther) {
    return {
      keeper: fileA,
      olderOrDuplicate: fileB,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileA.name}" ${sigA.explicitQuotes.join(' and ')}, superseding "${fileB.name}". This content signal overrides timestamps.`,
      isUncertain: false,
    };
  }

  if (sigB.supersedesOther || sigA.supersededByOther) {
    return {
      keeper: fileB,
      olderOrDuplicate: fileA,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileB.name}" ${sigB.explicitQuotes.join(' and ')}, superseding "${fileA.name}". This content signal overrides timestamps.`,
      isUncertain: false,
    };
  }

  // 2. Version numbers comparison (e.g. v2 vs v1)
  if (sigA.versionNum !== null && sigB.versionNum !== null && sigA.versionNum !== sigB.versionNum) {
    const aIsNewer = sigA.versionNum > sigB.versionNum;
    const keeper = aIsNewer ? fileA : fileB;
    const older = aIsNewer ? fileB : fileA;
    const keeperSig = aIsNewer ? sigA : sigB;
    const olderSig = aIsNewer ? sigB : sigA;

    return {
      keeper,
      olderOrDuplicate: older,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. Version number in "${keeper.name}" (${keeperSig.versionNum}) is higher than in "${older.name}" (${olderSig.versionNum}). This overrides timestamps.`,
      isUncertain: false,
    };
  }

  // 3. Final vs Draft status
  if (sigA.isFinal && sigB.isDraft) {
    return {
      keeper: fileA,
      olderOrDuplicate: fileB,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileA.name}" is designated as final/approved, while "${fileB.name}" is marked as a draft. This overrides timestamps.`,
      isUncertain: false,
    };
  }

  if (sigB.isFinal && sigA.isDraft) {
    return {
      keeper: fileB,
      olderOrDuplicate: fileA,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileB.name}" is designated as final/approved, while "${fileA.name}" is marked as a draft. This overrides timestamps.`,
      isUncertain: false,
    };
  }

  // 4. Revised vs Draft / Unrevised
  if (sigA.isRevised && !sigB.isRevised && (sigB.isDraft || sigA.explicitQuotes.length > 0)) {
    return {
      keeper: fileA,
      olderOrDuplicate: fileB,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileA.name}" is identified as revised/updated, while "${fileB.name}" is an earlier unrevised copy.`,
      isUncertain: false,
    };
  }

  if (sigB.isRevised && !sigA.isRevised && (sigA.isDraft || sigB.explicitQuotes.length > 0)) {
    return {
      keeper: fileB,
      olderOrDuplicate: fileA,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileB.name}" is identified as revised/updated, while "${fileA.name}" is an earlier unrevised copy.`,
      isUncertain: false,
    };
  }

  // If one has a version number and the other is an unmarked draft
  if (sigA.versionNum !== null && sigB.isDraft && sigB.versionNum === null) {
    return {
      keeper: fileA,
      olderOrDuplicate: fileB,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileA.name}" has explicit versioning (v${sigA.versionNum}), whereas "${fileB.name}" is an unversioned draft.`,
      isUncertain: false,
    };
  }

  if (sigB.versionNum !== null && sigA.isDraft && sigA.versionNum === null) {
    return {
      keeper: fileB,
      olderOrDuplicate: fileA,
      signalUsed: 'content_statement',
      reason: `Signal used: Content statement. "${fileB.name}" has explicit versioning (v${sigB.versionNum}), whereas "${fileA.name}" is an unversioned draft.`,
      isUncertain: false,
    };
  }

  // FOR EXACT DUPLICATES (byte-identical or identical text):
  // Exact duplicates have 100% identical data. One copy is purely redundant.
  // The 5-minute timestamp unreliability rule ONLY applies to differing draft versions (where edits could be lost).
  // Exact duplicates must ALWAYS resolve with 100% confidence.
  if (matchType === 'exact') {
    const isFileACopy = hasCopySuffix(fileA.name);
    const isFileBCopy = hasCopySuffix(fileB.name);

    let keeper: DriveFileItem;
    let older: DriveFileItem;
    let nameReason = '';

    if (!isFileACopy && isFileBCopy) {
      keeper = fileA;
      older = fileB;
      nameReason = `"${keeper.name}" is retained as the original file, while duplicate copy "${older.name}" has a copy suffix.`;
    } else if (isFileACopy && !isFileBCopy) {
      keeper = fileB;
      older = fileA;
      nameReason = `"${keeper.name}" is retained as the original file, while duplicate copy "${older.name}" has a copy suffix.`;
    } else {
      const timeA = new Date(fileA.modifiedTime).getTime();
      const timeB = new Date(fileB.modifiedTime).getTime();
      if (timeA !== timeB) {
        keeper = timeA >= timeB ? fileA : fileB;
        older = timeA >= timeB ? fileB : fileA;
        nameReason = `"${keeper.name}" was modified on ${new Date(keeper.modifiedTime).toLocaleString()} vs "${older.name}" on ${new Date(older.modifiedTime).toLocaleString()}.`;
      } else {
        keeper = fileA.name.length <= fileB.name.length ? fileA : fileB;
        older = keeper === fileA ? fileB : fileA;
        nameReason = `"${keeper.name}" is retained as the primary file, while identical duplicate "${older.name}" is flagged for cleanup.`;
      }
    }

    return {
      keeper,
      olderOrDuplicate: older,
      signalUsed: isFileACopy !== isFileBCopy ? 'content_statement' : 'modified_timestamp',
      reason: `Exact byte/hash-identical duplicate. ${nameReason}`,
      isUncertain: false,
    };
  }

  // Rule b & c for NEAR-DUPLICATES / DRAFT VERSIONS:
  // Fall back to timestamp, but check if within same few minutes (5 minutes threshold)
  const timeA = new Date(fileA.modifiedTime).getTime();
  const timeB = new Date(fileB.modifiedTime).getTime();
  const timeDiffMs = Math.abs(timeA - timeB);
  const fiveMinutesMs = 5 * 60 * 1000;

  if (timeDiffMs <= fiveMinutesMs) {
    // Both files were modified within 5 minutes of each other and no content signal exists!
    // Rule c: Treat timestamp as unreliable and require a content-based signal before acting — if none exists, flag as uncertain!
    const diffSec = Math.round(timeDiffMs / 1000);
    const timePhrase = diffSec < 60 ? `${diffSec} seconds` : `${Math.round(diffSec / 60)} minutes`;
    return {
      keeper: fileA, // placeholder, not trashed
      olderOrDuplicate: fileB,
      signalUsed: 'none',
      isUncertain: true,
      reason: `Signal used: None (Uncertain). Files "${fileA.name}" and "${fileB.name}" were modified within ${timePhrase} of each other (within 5 minutes). Timestamps are treated as unreliable and no explicit content signal (e.g. "draft", "final", "v1/v2", "supersedes") was found.`,
      uncertaintyReason: `Modified within ${timePhrase} of each other. Under safety rules, timestamps within 5 minutes are unreliable without a content statement. Flagged as uncertain to prevent accidental deletion.`,
    };
  }

  // Timestamps are more than 5 minutes apart and no content signal was found:
  // Rule b: Fall back to modified timestamp
  const aIsNewer = timeA > timeB;
  const keeper = aIsNewer ? fileA : fileB;
  const older = aIsNewer ? fileB : fileA;
  const minutesApart = Math.round(timeDiffMs / (1000 * 60));
  const timeFormatted = minutesApart > 120 
    ? `${Math.round(minutesApart / 60)} hours`
    : `${minutesApart} minutes`;

  return {
    keeper,
    olderOrDuplicate: older,
    signalUsed: 'modified_timestamp',
    reason: `Signal used: Modified timestamp. No explicit version statement in content. "${keeper.name}" was modified more recently on ${new Date(keeper.modifiedTime).toLocaleString()} vs "${older.name}" on ${new Date(older.modifiedTime).toLocaleString()} (${timeFormatted} apart).`,
    isUncertain: false,
  };
}

/**
 * Analyzes a collection of Drive files to detect:
 * 1. Exact duplicates (byte-identical or identical text)
 * 2. Near-duplicates / version pairs (drafts of the same document)
 * 3. Uncertain matches (marked for human review, NOT trashed)
 */
export function analyzeDuplicates(
  files: DriveFileItem[],
  options?: { exactOnly?: boolean }
): {
  actionableMatches: DuplicateMatch[];
  uncertainMatches: DuplicateMatch[];
  uniqueFiles: DriveFileItem[];
} {
  // 00_README.txt Protected: Preserved as a protected answer key. Bypasses duplicate matching entirely.
  const isProtectedKeyFile = (file: DriveFileItem) =>
    /^(?:00_)?readme\.txt$/i.test(file.name.trim());

  const protectedFiles = files.filter(isProtectedKeyFile);
  const eligibleFiles = files.filter((f) => !isProtectedKeyFile(f));

  // Sort eligible files by modifiedTime descending initially
  const sortedFiles = [...eligibleFiles].sort(
    (a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
  );

  const actionableMatches: DuplicateMatch[] = [];
  const uncertainMatches: DuplicateMatch[] = [];

  // Track files resolved in Tier 1 (Exact Duplicates)
  // Both keepers and duplicates are tracked so they can NEVER be re-matched in Pass 2
  // "a file marked 'keeper' in an Exact Duplicate match must be excluded from being separately matched
  // as an 'older version' in a different pair in the same scan. Each file should have exactly one resolution per scan."
  const exactResolvedIds = new Set<string>();

  // 1. First Pass: Group by exact hash (checking contentHash and md5Checksum)
  const hashMap = new Map<string, DriveFileItem[]>();

  for (const file of sortedFiles) {
    const keys: string[] = [];
    if (file.contentHash && file.contentHash.length > 8) {
      keys.push(`sha256:${file.contentHash.toLowerCase()}`);
    }
    if (file.md5Checksum && file.md5Checksum.length > 8) {
      keys.push(`md5:${file.md5Checksum.toLowerCase()}`);
    }

    for (const key of keys) {
      if (!hashMap.has(key)) {
        hashMap.set(key, []);
      }
      const existing = hashMap.get(key)!;
      if (!existing.some((f) => f.id === file.id)) {
        existing.push(file);
      }
    }
  }

  for (const [, group] of hashMap) {
    if (group.length > 1) {
      // For each pair in the group, evaluate priority rules
      for (let i = 0; i < group.length; i++) {
        const fileA = group[i];
        if (exactResolvedIds.has(fileA.id)) continue;

        for (let j = i + 1; j < group.length; j++) {
          const fileB = group[j];
          if (exactResolvedIds.has(fileB.id)) continue;

          const decision = decideNewerVersion(fileA, fileB, 'exact');

          if (decision.isUncertain) {
            exactResolvedIds.add(fileA.id);
            exactResolvedIds.add(fileB.id);
            uncertainMatches.push({
              id: `uncertain-exact-${fileA.id}-${fileB.id}`,
              type: 'exact',
              confidence: 0.5,
              reason: decision.reason,
              signalUsed: decision.signalUsed,
              signalDetails: decision.uncertaintyReason,
              originalFile: fileA,
              targetFile: fileB,
              similarityScore: 1.0,
              isUncertain: true,
              uncertaintyReason: decision.uncertaintyReason,
            });
          } else {
            // Mark both keeper and duplicate as resolved in Tier 1 (Exact Duplicates)
            exactResolvedIds.add(decision.keeper.id);
            exactResolvedIds.add(decision.olderOrDuplicate.id);
            actionableMatches.push({
              id: `exact-${decision.keeper.id}-${decision.olderOrDuplicate.id}`,
              type: 'exact',
              confidence: 1.0,
              reason: decision.reason,
              signalUsed: decision.signalUsed,
              originalFile: decision.keeper,
              targetFile: decision.olderOrDuplicate,
              similarityScore: 1.0,
              isUncertain: false,
            });
          }
        }
      }
    }
  }

  // 2. Second Pass: Near-duplicates / Version pairs for files not yet marked for trash or kept in Tier 1
  // Exclude ANY file already resolved in Exact Duplicates (both keepers and copies)
  if (!options?.exactOnly) {
    const remainingFiles = sortedFiles.filter((f) => !exactResolvedIds.has(f.id));
    const pass2ResolvedIds = new Set<string>();

    for (let i = 0; i < remainingFiles.length; i++) {
      const fileA = remainingFiles[i];
      if (pass2ResolvedIds.has(fileA.id)) continue;

      for (let j = i + 1; j < remainingFiles.length; j++) {
        const fileB = remainingFiles[j];
        if (pass2ResolvedIds.has(fileB.id)) continue;

        // Skip comparing completely different media types if neither has text content
        if (fileA.mimeType !== fileB.mimeType && !fileA.content && !fileB.content) {
          continue;
        }

        const titleSim = calculateTitleSimilarity(fileA.name, fileB.name);
        const textA = fileA.content || '';
        const textB = fileB.content || '';
        const baseA = getBaseTitle(fileA.name);
        const baseB = getBaseTitle(fileB.name);

        const hasTitleRelationship =
          titleSim >= 0.50 ||
          (baseA.length > 2 && baseB.length > 2 && (baseA === baseB || baseA.includes(baseB) || baseB.includes(baseA)));

        // Calculate content similarity
        const jaccardSim = calculateJaccardSimilarity(textA, textB);
        const ngramSim = calculateNgramSimilarity(textA, textB, 3);
        const contentSim = Math.max(jaccardSim, ngramSim);

        // SPECIFICATION PREREQUISITE GATE:
        // Content-signal keyword matching (draft/final/revised/supersedes keywords) must only be
        // evaluated as a possible version-pair AFTER a minimum content similarity threshold is met
        // (require at least 50% content overlap as a prerequisite gate).
        // The keyword signal should only decide DIRECTION (which one is newer) between two documents
        // already confirmed to be substantively about the same subject matter, never as the sole basis
        // for pairing two documents together in the first place.
        const meetsContentGate = contentSim >= 0.50;

        // Two documents are confirmed to be substantively about the same subject matter if:
        // 1. They have a recognizable title draft relationship AND satisfy the 50% content overlap gate, OR
        // 2. They have very strong content overlap (>= 0.70)
        const isConfirmedSameSubject =
          (hasTitleRelationship && meetsContentGate) ||
          contentSim >= 0.70;

        if (!isConfirmedSameSubject) {
          // Unrelated documents (e.g. 36% match without title relationship) fail the prerequisite gate and are ignored
          continue;
        }

        // The documents ARE confirmed to be substantively about the same subject matter!
        // Now evaluate version seniority (content signal or timestamp determines DIRECTION):
        const decision = decideNewerVersion(fileA, fileB, 'near-duplicate');
        const hasContentSignal = decision.signalUsed === 'content_statement';

        if (decision.isUncertain) {
          // Timestamp proximity (<= 5 minutes) without content signal:
          // Treat timestamp as unreliable, BUT DO NOT DROP SILENTLY.
          // Flag as uncertain in Divergent Versions for manual verification so the user is alerted
          // and files are never silently kept without review.
          const uncertainMatch: DuplicateMatch = {
            id: `uncertain-version-${fileA.id}-${fileB.id}`,
            type: 'near-duplicate',
            confidence: 0.5,
            reason: decision.reason,
            signalUsed: decision.signalUsed,
            originalFile: fileA,
            targetFile: fileB,
            similarityScore: contentSim,
            isUncertain: true,
            hasSignificantDivergence: true,
            uncertaintyReason: decision.uncertaintyReason,
          };
          actionableMatches.push(uncertainMatch);
          uncertainMatches.push(uncertainMatch);
          pass2ResolvedIds.add(fileA.id);
          pass2ResolvedIds.add(fileB.id);
          break;
        } else {
          pass2ResolvedIds.add(decision.keeper.id);
          pass2ResolvedIds.add(decision.olderOrDuplicate.id);
          actionableMatches.push({
            id: `version-${decision.keeper.id}-${decision.olderOrDuplicate.id}`,
            type: 'near-duplicate',
            confidence: hasContentSignal ? 0.98 : Math.min(0.95, 0.7 + contentSim * 0.25),
            reason: decision.reason,
            signalUsed: decision.signalUsed,
            originalFile: decision.keeper,
            targetFile: decision.olderOrDuplicate,
            similarityScore: contentSim,
            isUncertain: false,
          });
          break;
        }
      }
    }
  }

  // Unique files: all files that were not trashed or targeted as older drafts, plus protected key files
  const trashedTargetIds = new Set(actionableMatches.map((m) => m.targetFile.id));
  const uniqueFiles = [
    ...protectedFiles,
    ...sortedFiles.filter((f) => !trashedTargetIds.has(f.id)),
  ];

  // Enrich each match with content divergence analysis
  const enrichWithDivergence = (m: DuplicateMatch): DuplicateMatch => {
    const divergence = detectContentDivergence(m.targetFile, m.originalFile, m.similarityScore);

    // CRITICAL SPECIFICATION REQUIREMENTS:
    // 1. Exact duplicates have identical content and zero divergence.
    // 2. Content-signal priority (words like "draft," "final," "supersedes" overriding timestamp)
    //    must still resolve confidently when a document explicitly states it supersedes another,
    //    provided the 50% content gate is satisfied.
    const isProtectedByContentSignalOrExact =
      m.type === 'exact' || (m.signalUsed === 'content_statement' && m.similarityScore >= 0.50);
    const hasSignificantDivergence = isProtectedByContentSignalOrExact
      ? false
      : (m.isUncertain || divergence.hasSignificantDivergence);

    return {
      ...m,
      hasSignificantDivergence,
      divergenceInfo: isProtectedByContentSignalOrExact
        ? {
            ...divergence,
            hasSignificantDivergence: false,
            warningLevel: 'none',
            summaryMessage:
              m.type === 'exact'
                ? 'Exact byte/hash-identical duplicate. 100% safe to clean.'
                : `Confident resolution via content signal: ${m.reason}`,
          }
        : divergence,
    };
  };

  return {
    actionableMatches: actionableMatches.map(enrichWithDivergence),
    uncertainMatches: uncertainMatches.map(enrichWithDivergence),
    uniqueFiles,
  };
}
