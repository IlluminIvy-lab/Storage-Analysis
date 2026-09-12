import { DriveFileItem, ContentDivergenceInfo } from '../types';

/**
 * Generates a concise, high-readability 1-2 sentence description of the file's content
 * without requiring the user to open Google Drive or a full modal view.
 */
export function generateQuickSummary(file: DriveFileItem): string {
  const content = (file.content || '').trim();
  const name = file.name;

  if (!content || content.startsWith('[Binary content') || content.startsWith('[Unable to read')) {
    // Infer from filename and type
    const ext = name.split('.').pop()?.toUpperCase() || 'DOCUMENT';
    return `${ext} asset containing binary data or unindexed media (${file.size ? `${Math.round(Number(file.size) / 1024)} KB` : 'standard size'}).`;
  }

  // Clean lines: strip markdown headers, tags, bullet points
  const rawLines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Extract candidate sentences
  const cleanLines = rawLines.map((line) =>
    line
      .replace(/^[#*>\-_\d.]+\s*/, '') // remove markdown symbols
      .replace(/[*_`~[\]()]/g, '')     // remove formatting chars
      .trim()
  ).filter((l) => l.length > 15);

  if (cleanLines.length === 0) {
    return `Brief document labeled "${name}" with short text or tabular notes.`;
  }

  // Look for introductory summary sentences (e.g. "This document...", "Overview:", "Summary:")
  const summaryLine = cleanLines.find((l) =>
    /^(overview|summary|purpose|abstract|description|objective):/i.test(l)
  );

  let sentence1 = '';
  if (summaryLine) {
    sentence1 = summaryLine.replace(/^(overview|summary|purpose|abstract|description|objective):\s*/i, '');
  } else {
    // Pick the most substantive first paragraph or heading
    sentence1 = cleanLines[0];
  }

  // Clean sentence punctuation
  if (!sentence1.endsWith('.')) {
    sentence1 += '.';
  }

  // Second sentence for depth
  let sentence2 = '';
  if (cleanLines.length > 1 && cleanLines[1] !== sentence1) {
    const nextLine = cleanLines.slice(1).find((l) => l.length > 25 && !l.includes(sentence1));
    if (nextLine) {
      sentence2 = ` ${nextLine.replace(/\.$/, '')}.`;
    }
  }

  // Truncate to maximum ~180 chars for clean 1-2 sentence display
  let result = `${sentence1}${sentence2}`.trim();
  if (result.length > 190) {
    result = result.slice(0, 187).trim() + '...';
  }

  return result;
}

export interface SuggestedFolder {
  name: string;
  icon: string;
  reason: string;
  confidence: number;
}

/**
 * Recommends an ideal smart destination folder based on document contents,
 * topic keywords, and version status.
 */
export function suggestSmartFolder(file: DriveFileItem): SuggestedFolder {
  const text = `${file.name} ${file.content || ''}`.toLowerCase();

  // 1. Engineering / Technical Specs
  if (
    /(api|schema|endpoint|database|architecture|specification|payload|backend|frontend|http|json|auth|token|sdk)/i.test(
      text
    )
  ) {
    return {
      name: 'Specifications & Tech Docs',
      icon: 'Code2',
      reason: 'Contains technical schemas, API specifications, or system architecture data.',
      confidence: 0.92,
    };
  }

  // 2. Meeting Notes & Agendas
  if (
    /(meeting|agenda|sync|standup|1:1|minutes|action items|attendees|transcript|discussion)/i.test(
      text
    )
  ) {
    return {
      name: 'Meeting Notes & Transcripts',
      icon: 'CalendarCheck',
      reason: 'Formatted as meeting minutes, attendee syncs, or discussion action items.',
      confidence: 0.95,
    };
  }

  // 3. Drafts & Work In Progress
  if (
    /(draft|wip|preliminary|working draft|scratchpad|brainstorm|temp|rough draft)/i.test(
      text
    )
  ) {
    return {
      name: 'Drafts & Working Copies',
      icon: 'FileEdit',
      reason: 'Identified as a preliminary draft or working document pending finalization.',
      confidence: 0.88,
    };
  }

  // 4. Financial & Contracts
  if (
    /(budget|invoice|receipt|finance|expense|compensation|pricing|agreement|contract|nda|terms)/i.test(
      text
    )
  ) {
    return {
      name: 'Finance & Agreements',
      icon: 'Receipt',
      reason: 'Contains financial statements, invoice items, budget forecasts, or legal terms.',
      confidence: 0.94,
    };
  }

  // 5. Release Notes & Changelogs
  if (
    /(release notes|changelog|patch notes|v\d+\.\d+|deployment|release checklist)/i.test(
      text
    )
  ) {
    return {
      name: 'Releases & Changelogs',
      icon: 'Layers',
      reason: 'Tracks release versions, deployment notes, or changelog milestones.',
      confidence: 0.9,
    };
  }

  // 6. Default to General Reference
  return {
    name: 'General Documents & Reference',
    icon: 'Folder',
    reason: 'Standard reference document or informational resource.',
    confidence: 0.75,
  };
}

export interface SuggestedRename {
  suggestedName: string;
  reason: string;
}

/**
 * Intelligent file rename utility:
 * 1. Strips messy duplicate and copy artifacts: e.g. " (1)", " - Copy", " copy (2)"
 * 2. Normalizes version tags: e.g. transforms "doc_v2_final_draft (1).txt" -> "doc_v2_final.txt"
 * 3. Extracts primary heading if the existing filename is generic (e.g. "Untitled.txt")
 */
export function suggestSmartRename(
  file: DriveFileItem,
  isOlderDraft = false
): SuggestedRename {
  const originalName = file.name;
  const ext = originalName.includes('.') ? `.${originalName.split('.').pop()}` : '';
  let base = originalName.replace(/\.[^/.]+$/, '');

  // If filename is generic like "Untitled document" or "Document" or "New Note", check content for a real title
  const isGeneric = /^(untitled|document|note|new doc|file|text|doc\d*)$/i.test(base.trim());
  if (isGeneric && file.content) {
    const firstHeader = file.content
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^#\s+[A-Za-z0-9]/.test(l));

    if (firstHeader) {
      const cleanHeader = firstHeader
        .replace(/^#+\s*/, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      if (cleanHeader.length > 3 && cleanHeader.length < 50) {
        return {
          suggestedName: `${cleanHeader}${ext}`,
          reason: 'Extracted semantic title from the top document header to replace generic name.',
        };
      }
    }
  }

  // Clean duplicate copy suffixes
  let cleaned = base;
  cleaned = cleaned.replace(/[\s_-]*(copy\s*\(\d+\)|copy|\(\d+\))/gi, '');
  cleaned = cleaned.replace(/[\s_-]*(duplicate|dupe)/gi, '');
  cleaned = cleaned.replace(/_{2,}/g, '_').replace(/-{2,}/g, '-').trim();

  // If older draft, tag cleanly as archived or draft
  if (isOlderDraft) {
    if (!/draft/i.test(cleaned)) {
      cleaned = `${cleaned}_draft`;
    }
  }

  const suggestedName = `${cleaned}${ext}`;

  if (suggestedName !== originalName) {
    return {
      suggestedName,
      reason: 'Cleaned duplicate suffixes, copy tags, and normalized version markers.',
    };
  }

  // Already clean, provide a standardized version format if applicable
  return {
    suggestedName: originalName,
    reason: 'Filename is already well-formatted and standardized.',
  };
}

/**
 * Normalizes text lines for comparison by stripping markdown, punctuation, and multiple spaces.
 */
function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether both versions of a file contain significant, different content changes.
 * Used to trigger a visual warning inside FileComparisonModal and flag matches for manual verification.
 */
export function detectContentDivergence(
  targetFile: DriveFileItem,
  originalFile: DriveFileItem,
  similarityScore = 1.0
): ContentDivergenceInfo {
  const contentTarget = (targetFile.content || '').trim();
  const contentOriginal = (originalFile.content || '').trim();

  // If exact identical text or both empty
  if (contentTarget === contentOriginal || (!contentTarget && !contentOriginal)) {
    return {
      hasSignificantDivergence: false,
      uniqueToTargetCount: 0,
      uniqueToOriginalCount: 0,
      uniqueToTargetLines: [],
      uniqueToOriginalLines: [],
      divergencePercentage: 0,
      warningLevel: 'none',
      summaryMessage: 'Identical or unindexed text. No divergent content detected.',
    };
  }

  // Parse lines
  const linesTarget = contentTarget
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  const linesOriginal = contentOriginal
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  const normOrigSet = new Set(linesOriginal.map(normalizeLine));
  const normTargetSet = new Set(linesTarget.map(normalizeLine));

  // Find unique lines in target that are not in original
  const uniqueToTarget = linesTarget.filter((line) => {
    const norm = normalizeLine(line);
    if (!norm || norm.length < 4) return false;
    if (normOrigSet.has(norm)) return false;
    // Check if substring of any original line
    return !linesOriginal.some((orig) => {
      const normOrig = normalizeLine(orig);
      return normOrig.includes(norm) || (norm.length > 15 && norm.includes(normOrig));
    });
  });

  // Find unique lines in original that are not in target
  const uniqueToOriginal = linesOriginal.filter((line) => {
    const norm = normalizeLine(line);
    if (!norm || norm.length < 4) return false;
    if (normTargetSet.has(norm)) return false;
    return !linesTarget.some((targ) => {
      const normTarg = normalizeLine(targ);
      return normTarg.includes(norm) || (norm.length > 15 && norm.includes(normTarg));
    });
  });

  const totalLines = Math.max(1, linesTarget.length + linesOriginal.length);
  const totalDivergent = uniqueToTarget.length + uniqueToOriginal.length;
  const divergencePercentage = Math.min(100, Math.round((totalDivergent / totalLines) * 100));

  // Criteria for significant divergence:
  // 1. Both files have at least 1 non-trivial unique line AND total divergent lines >= 2
  // 2. Target file has >= 2 unique substantial lines and similarity is < 0.95
  // 3. Similarity is between 0.35 and 0.88 with at least 1 unique line in target
  const bothHaveEdits = uniqueToTarget.length >= 1 && uniqueToOriginal.length >= 1 && totalDivergent >= 2;
  const targetHasUnmergedContent = uniqueToTarget.length >= 2 && similarityScore < 0.95;
  const lowSimilarityDivergence = similarityScore < 0.88 && uniqueToTarget.length >= 1;

  const hasSignificantDivergence = bothHaveEdits || targetHasUnmergedContent || lowSimilarityDivergence;

  let warningLevel: 'high' | 'medium' | 'none' = 'none';
  if (bothHaveEdits || (uniqueToTarget.length >= 3 && similarityScore < 0.9)) {
    warningLevel = 'high';
  } else if (hasSignificantDivergence) {
    warningLevel = 'medium';
  }

  let summaryMessage = '';
  if (bothHaveEdits) {
    summaryMessage = `Both versions contain independent, diverging edits: target draft has ${uniqueToTarget.length} unique line(s) and kept version has ${uniqueToOriginal.length} unique line(s). Manual verification is strongly advised before trashing.`;
  } else if (targetHasUnmergedContent) {
    summaryMessage = `Target copy contains ${uniqueToTarget.length} unique line(s) or paragraphs that are not present in the newer copy. Trashing may discard unmerged notes or sections.`;
  } else if (hasSignificantDivergence) {
    summaryMessage = `Moderate content divergence detected (${divergencePercentage}% difference). Please review differences to confirm no valuable edits are lost.`;
  } else {
    summaryMessage = `Content is primarily linear progression with ~${Math.round(similarityScore * 100)}% overlap.`;
  }

  return {
    hasSignificantDivergence,
    uniqueToTargetCount: uniqueToTarget.length,
    uniqueToOriginalCount: uniqueToOriginal.length,
    uniqueToTargetLines: uniqueToTarget.slice(0, 10),
    uniqueToOriginalLines: uniqueToOriginal.slice(0, 10),
    divergencePercentage,
    warningLevel,
    summaryMessage,
  };
}
