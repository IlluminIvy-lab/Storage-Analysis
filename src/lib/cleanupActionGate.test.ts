import { describe, it, expect } from 'vitest';
import {
  isProtectedFile,
  isProtectedFolder,
  isCleanupEligible,
  validateCleanupPlan,
  validateFinalTrashCandidate,
} from './cleanupActionGate';
import { DuplicateMatch, DriveFileItem } from '../types';

describe('cleanupActionGate', () => {
  describe('isProtectedFile', () => {
    it('identifies 00_README.txt and variants as protected', () => {
      expect(isProtectedFile('00_README.txt')).toBe(true);
      expect(isProtectedFile('00_readme.txt')).toBe(true);
      expect(isProtectedFile('README.txt')).toBe(true);
      expect(isProtectedFile('readme.md')).toBe(true);
      expect(isProtectedFile('00_readme.md')).toBe(true);
      expect(isProtectedFile('00_readme.docx')).toBe(true);
    });

    it('returns false for regular files', () => {
      expect(isProtectedFile('Report_v1.docx')).toBe(false);
      expect(isProtectedFile('budget.xlsx')).toBe(false);
      expect(isProtectedFile('notes.txt')).toBe(false);
      expect(isProtectedFile(undefined)).toBe(false);
      expect(isProtectedFile('')).toBe(false);
    });
  });

  describe('isProtectedFolder', () => {
    it('protects Craft folder and its paths', () => {
      expect(isProtectedFolder('Craft')).toBe(true);
      expect(isProtectedFolder('craft')).toBe(true);
      expect(isProtectedFolder('/craft')).toBe(true);
      expect(isProtectedFolder('craft/subfolder')).toBe(true);
    });

    it('allows normal non-Craft folders', () => {
      expect(isProtectedFolder('Projects')).toBe(false);
      expect(isProtectedFolder('Craftsmanship')).toBe(false);
      expect(isProtectedFolder(undefined)).toBe(false);
    });
  });

  describe('isCleanupEligible', () => {
    const validOriginalFile: DriveFileItem = {
      id: 'orig-1',
      name: 'Project_Final.docx',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-03-01T10:00:00Z',
      size: 5000,
    };

    const validTargetFile: DriveFileItem = {
      id: 'target-1',
      name: 'Project_Copy.docx',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-02-01T10:00:00Z',
      size: 5000,
    };

    const safeMatch: DuplicateMatch = {
      id: 'match-1',
      type: 'exact',
      classification: 'content-exact',
      confidence: 1.0,
      originalFile: validOriginalFile,
      targetFile: validTargetFile,
      similarityScore: 1.0,
      reason: 'Verified content identical',
      signalUsed: 'content_statement',
      comparisonMethod: 'text_similarity',
      deletionEligible: true,
      requiresManualReview: false,
      isUncertain: false,
      hasSignificantDivergence: false,
      contentVerified: true,
    };

    it('approves safe verified duplicate match', () => {
      const result = isCleanupEligible(safeMatch);
      expect(result.eligible).toBe(true);
    });

    it('rejects match if target is a protected file (e.g. 00_README.txt)', () => {
      const matchWithProtectedTarget: DuplicateMatch = {
        ...safeMatch,
        targetFile: { ...validTargetFile, name: '00_README.txt' },
      };
      const result = isCleanupEligible(matchWithProtectedTarget);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/protected/i);
    });

    it('rejects match if original keeper is a protected file', () => {
      const matchWithProtectedOrig: DuplicateMatch = {
        ...safeMatch,
        originalFile: { ...validOriginalFile, name: '00_README.txt' },
      };
      const result = isCleanupEligible(matchWithProtectedOrig);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/protected/i);
    });

    it('rejects match with requiresManualReview true', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        requiresManualReview: true,
        uncertaintyReason: 'Requires human confirmation',
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('human confirmation');
    });

    it('rejects match with isUncertain true', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        isUncertain: true,
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
    });

    it('rejects match with hasSignificantDivergence true', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        hasSignificantDivergence: true,
        divergenceInfo: {
          hasSignificantDivergence: true,
          uniqueToTargetCount: 5,
          uniqueToOriginalCount: 2,
          divergencePercentage: 40,
          warningLevel: 'high',
          summaryMessage: 'Draft contains 400 new words of critical edits',
        },
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Draft contains 400 new words');
    });

    it('rejects classification probable-candidate', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        classification: 'probable-candidate',
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
    });

    it('rejects unverified size_and_name_match', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        comparisonMethod: 'size_and_name_match',
        contentVerified: false,
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
    });

    it('rejects match where target and original have identical ID', () => {
      const match: DuplicateMatch = {
        ...safeMatch,
        targetFile: { ...validTargetFile, id: 'same-id' },
        originalFile: { ...validOriginalFile, id: 'same-id' },
      };
      const result = isCleanupEligible(match);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/identical ID/i);
    });
  });

  describe('validateCleanupPlan', () => {
    it('partitions matches into validMatches and rejectedMatches', () => {
      const validMatch: DuplicateMatch = {
        id: 'v1',
        type: 'exact',
        confidence: 1.0,
        isUncertain: false,
        originalFile: { id: 'orig-1', name: 'FileA.pdf', mimeType: 'application/pdf', modifiedTime: '2026-03-01' },
        targetFile: { id: 't-1', name: 'FileA_dup.pdf', mimeType: 'application/pdf', modifiedTime: '2026-02-01' },
        similarityScore: 1.0,
        reason: 'Checksum matched',
        signalUsed: 'size_and_name',
        comparisonMethod: 'binary_checksum_match',
        contentVerified: true,
      };

      const invalidMatch: DuplicateMatch = {
        id: 'inv-1',
        type: 'exact',
        confidence: 0.8,
        isUncertain: false,
        originalFile: { id: 'orig-2', name: 'Notes.txt', mimeType: 'text/plain', modifiedTime: '2026-03-01' },
        targetFile: { id: 't-2', name: '00_README.txt', mimeType: 'text/plain', modifiedTime: '2026-02-01' },
        similarityScore: 1.0,
        reason: 'Duplicate',
        signalUsed: 'size_and_name',
      };

      const { validMatches, rejectedMatches } = validateCleanupPlan([validMatch, invalidMatch]);
      expect(validMatches.length).toBe(1);
      expect(validMatches[0].id).toBe('v1');
      expect(rejectedMatches.length).toBe(1);
      expect(rejectedMatches[0].match.id).toBe('inv-1');
      expect(rejectedMatches[0].reason).toMatch(/protected/i);
    });
  });

  describe('validateFinalTrashCandidate', () => {
    const file: DriveFileItem = {
      id: 'file-123',
      name: 'Draft_old.docx',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-01-01',
    };

    it('passes for approved plan candidate present in scan', () => {
      const res = validateFinalTrashCandidate('file-123', file, {
        currentScannedFiles: [file],
        approvedPlanTargetIds: new Set(['file-123']),
        alreadyTrashedIds: new Set(),
        isPlanApproved: true,
      });
      expect(res.valid).toBe(true);
    });

    it('rejects if plan was not approved', () => {
      const res = validateFinalTrashCandidate('file-123', file, {
        currentScannedFiles: [file],
        approvedPlanTargetIds: new Set(['file-123']),
        alreadyTrashedIds: new Set(),
        isPlanApproved: false,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/not been approved/i);
    });

    it('rejects if file is not in approvedPlanTargetIds', () => {
      const res = validateFinalTrashCandidate('file-123', file, {
        currentScannedFiles: [file],
        approvedPlanTargetIds: new Set(['other-file']),
        alreadyTrashedIds: new Set(),
        isPlanApproved: true,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/not included in the approved plan/i);
    });

    it('rejects if file was already trashed in current session', () => {
      const res = validateFinalTrashCandidate('file-123', file, {
        currentScannedFiles: [file],
        approvedPlanTargetIds: new Set(['file-123']),
        alreadyTrashedIds: new Set(['file-123']),
        isPlanApproved: true,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/already trashed/i);
    });

    it('rejects if file is no longer present in current scan state', () => {
      const res = validateFinalTrashCandidate('file-123', file, {
        currentScannedFiles: [{ ...file, id: 'diff-id' }],
        approvedPlanTargetIds: new Set(['file-123']),
        alreadyTrashedIds: new Set(),
        isPlanApproved: true,
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/no longer present/i);
    });
  });
});
