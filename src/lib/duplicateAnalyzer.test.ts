import { describe, it, expect } from 'vitest';
import { analyzeDuplicates, getBaseTitle } from './duplicateAnalyzer';
import { DriveFileItem } from '../types';

describe('duplicateAnalyzer', () => {
  describe('getBaseTitle', () => {
    it('normalizes filenames by stripping extensions, versions, and copy tags', () => {
      expect(getBaseTitle('Project_Proposal_v2.docx')).toBe('project_proposal');
      expect(getBaseTitle('Budget (1).xlsx')).toBe('budget');
      expect(getBaseTitle('Meeting Notes - Copy.txt')).toBe('meeting notes');
      expect(getBaseTitle('Report_Final_2026-03-01.pdf')).toBe('report');
    });
  });

  describe('analyzeDuplicates', () => {
    it('detects exact binary duplicates with verified SHA-256 contentHash as actionable', () => {
      const files: DriveFileItem[] = [
        {
          id: 'file-1',
          name: 'Quarterly_Report.pdf',
          mimeType: 'application/pdf',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 1048576,
          contentHash: 'abcd1234abcd1234abcd1234abcd1234',
        },
        {
          id: 'file-2',
          name: 'Quarterly_Report (1).pdf',
          mimeType: 'application/pdf',
          modifiedTime: '2026-02-01T10:00:00Z',
          size: 1048576,
          contentHash: 'abcd1234abcd1234abcd1234abcd1234',
        },
      ];

      const result = analyzeDuplicates(files);

      expect(result.actionableMatches.length).toBe(1);
      const match = result.actionableMatches[0];
      expect(match.type).toBe('exact');
      expect(match.classification).toBe('byte-exact');
      expect(match.originalFile.id).toBe('file-1'); // newer file kept
      expect(match.targetFile.id).toBe('file-2'); // older file targeted
      expect(match.deletionEligible).toBe(true);
    });

    it('routes MD5 metadata matches without verified contentHash to uncertainMatches for safety', () => {
      const files: DriveFileItem[] = [
        {
          id: 'md5-1',
          name: 'Quarterly_Report.pdf',
          mimeType: 'application/pdf',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 1048576,
          md5Checksum: 'abcd1234abcd1234abcd1234abcd1234',
        },
        {
          id: 'md5-2',
          name: 'Quarterly_Report (1).pdf',
          mimeType: 'application/pdf',
          modifiedTime: '2026-02-01T10:00:00Z',
          size: 1048576,
          md5Checksum: 'abcd1234abcd1234abcd1234abcd1234',
        },
      ];

      const result = analyzeDuplicates(files);

      // Should be in uncertainMatches because raw binary content was not directly verified
      expect(result.actionableMatches.length).toBe(0);
      expect(result.uncertainMatches.length).toBe(1);
      expect(result.uncertainMatches[0].classification).toBe('probable-candidate');
      expect(result.uncertainMatches[0].requiresManualReview).toBe(true);
    });

    it('never targets 00_README.txt or protected files for trashing', () => {
      const files: DriveFileItem[] = [
        {
          id: 'readme-1',
          name: '00_README.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-01-01T00:00:00Z',
          size: 100,
          contentHash: 'readme-hash-1234567890',
        },
        {
          id: 'readme-2',
          name: '00_README_copy.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-02-01T00:00:00Z',
          size: 100,
          contentHash: 'readme-hash-1234567890',
        },
      ];

      const result = analyzeDuplicates(files);

      // Neither actionableMatches nor uncertainMatches should ever trash 00_README.txt
      const trashTargets = result.actionableMatches.map((m) => m.targetFile.name);
      expect(trashTargets).not.toContain('00_README.txt');
    });

    it('routes size_and_name matches without verified checksum/content to uncertainMatches', () => {
      const files: DriveFileItem[] = [
        {
          id: 'unverified-1',
          name: 'Scan_Document.bin',
          mimeType: 'application/octet-stream',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 2048,
          // no checksum, no text content
        },
        {
          id: 'unverified-2',
          name: 'Scan_Document (Copy).bin',
          mimeType: 'application/octet-stream',
          modifiedTime: '2026-02-01T10:00:00Z',
          size: 2048,
          // no checksum, no text content
        },
      ];

      const result = analyzeDuplicates(files);

      // Should not be in actionableMatches because content cannot be verified
      expect(result.actionableMatches.some((m) => m.comparisonMethod === 'size_and_name_match' && m.contentVerified !== true)).toBe(false);
      // It should be routed to uncertainMatches with probable-candidate or uncertain status
      expect(result.uncertainMatches.length).toBeGreaterThanOrEqual(1);
      const uncertain = result.uncertainMatches[0];
      expect(uncertain.requiresManualReview).toBe(true);
      expect(uncertain.deletionEligible).toBe(false);
    });

    it('handles confident linear version drafts correctly when older content is subsumed by newer version', () => {
      const files: DriveFileItem[] = [
        {
          id: 'doc-newer',
          name: 'Notes_v2.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-02T10:00:00Z',
          size: 600,
          content: 'Line 1: Project overview and scope.\nLine 2: Implementation details.\nLine 3: Next steps and conclusions.',
          contentStatus: 'extracted',
        },
        {
          id: 'doc-older',
          name: 'Notes_v1.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 400,
          content: 'Line 1: Project overview and scope.\nLine 2: Implementation details.',
          contentStatus: 'extracted',
        },
      ];

      const result = analyzeDuplicates(files);

      expect(result.actionableMatches.length).toBe(1);
      const match = result.actionableMatches[0];
      expect(match.type).toBe('near-duplicate');
      expect(match.originalFile.id).toBe('doc-newer');
      expect(match.targetFile.id).toBe('doc-older');
      expect(match.deletionEligible).toBe(true);
      expect(match.contentVerified).toBe(true);
    });

    it('routes drafts with independent divergent edits to uncertainMatches for human review', () => {
      const files: DriveFileItem[] = [
        {
          id: 'doc-branch-a',
          name: 'Spec_v2_A.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-02T10:00:00Z',
          size: 500,
          content: 'Line 1: Common core architecture.\nLine 2: Unique branch A edits only.',
          contentStatus: 'extracted',
        },
        {
          id: 'doc-branch-b',
          name: 'Spec_v1_B.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 500,
          content: 'Line 1: Common core architecture.\nLine 2: Unique branch B edits only.',
          contentStatus: 'extracted',
        },
      ];

      const result = analyzeDuplicates(files);

      // Must NOT be actionable because independent edits exist
      expect(result.actionableMatches.length).toBe(0);
      expect(result.uncertainMatches.length).toBe(1);
      const uncertain = result.uncertainMatches[0];
      expect(uncertain.hasSignificantDivergence).toBe(true);
      expect(uncertain.requiresManualReview).toBe(true);
      expect(uncertain.deletionEligible).toBe(false);
    });

    it('identifies identical text documents with matching contentHash as exact matches', () => {
      const files: DriveFileItem[] = [
        {
          id: 'doc-1',
          name: 'Notes.txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-02T10:00:00Z',
          size: 500,
          content: 'Identical notes text.',
          contentHash: 'hash-identical-1234567890',
          contentStatus: 'extracted',
        },
        {
          id: 'doc-2',
          name: 'Notes (Copy).txt',
          mimeType: 'text/plain',
          modifiedTime: '2026-03-01T10:00:00Z',
          size: 500,
          content: 'Identical notes text.',
          contentHash: 'hash-identical-1234567890',
          contentStatus: 'extracted',
        },
      ];

      const result = analyzeDuplicates(files);

      expect(result.actionableMatches.length).toBe(1);
      const match = result.actionableMatches[0];
      expect(match.type).toBe('exact');
      expect(match.classification).toBe('content-exact');
      expect(match.originalFile.id).toBe('doc-1');
      expect(match.targetFile.id).toBe('doc-2');
    });
  });
});
