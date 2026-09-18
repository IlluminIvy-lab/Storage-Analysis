import { describe, it, expect } from 'vitest';
import { escapeCsv, formatDateForCsv, isProtectedKeyFile } from './exportReport';

describe('exportReport utilities', () => {
  describe('escapeCsv and Formula Injection Protection (CWE-1236)', () => {
    it('escapes standard strings without modification', () => {
      expect(escapeCsv('Simple Text')).toBe('"Simple Text"');
      expect(escapeCsv(1234)).toBe('"1234"');
    });

    it('handles null and undefined gracefully', () => {
      expect(escapeCsv(null)).toBe('""');
      expect(escapeCsv(undefined)).toBe('""');
    });

    it('doubles internal quotes', () => {
      expect(escapeCsv('Hello "World"')).toBe('"Hello ""World"""');
    });

    it('prefixes formula injection trigger characters with a single quote', () => {
      // =, +, -, @, \t, \r
      expect(escapeCsv('=SUM(A1:A10)')).toBe('"\'' + '=SUM(A1:A10)"');
      expect(escapeCsv('+12345678')).toBe('"\'' + '+12345678"');
      expect(escapeCsv('-cmd.exe')).toBe('"\'' + '-cmd.exe"');
      expect(escapeCsv('@SUM(1+1)')).toBe('"\'' + '@SUM(1+1)"');
      expect(escapeCsv('\tTabPrefix')).toBe('"\'' + '\tTabPrefix"');
    });

    it('handles commas and newlines properly in escaped strings', () => {
      expect(escapeCsv('Item 1, Item 2')).toBe('"Item 1, Item 2"');
      expect(escapeCsv('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });
  });

  describe('formatDateForCsv', () => {
    it('formats valid ISO dates', () => {
      const date = '2026-03-01T12:00:00.000Z';
      expect(formatDateForCsv(date)).toBe('2026-03-01T12:00:00.000Z');
    });

    it('handles timestamps and Date objects', () => {
      const d = new Date('2026-01-15T08:30:00.000Z');
      expect(formatDateForCsv(d)).toBe('2026-01-15T08:30:00.000Z');
      expect(formatDateForCsv(d.getTime())).toBe('2026-01-15T08:30:00.000Z');
    });

    it('handles N/A and empty values gracefully', () => {
      expect(formatDateForCsv('N/A')).toBe('N/A');
      expect(formatDateForCsv(undefined)).toBe('N/A');
      expect(formatDateForCsv('')).toBe('N/A');
    });

    it('returns raw string for invalid dates without throwing', () => {
      expect(formatDateForCsv('not-a-real-date')).toBe('not-a-real-date');
    });
  });

  describe('isProtectedKeyFile', () => {
    it('protects 00_README.txt and readme.txt', () => {
      expect(isProtectedKeyFile('00_README.txt')).toBe(true);
      expect(isProtectedKeyFile('README.txt')).toBe(true);
      expect(isProtectedKeyFile('readme.md')).toBe(true);
      expect(isProtectedKeyFile('00_readme.txt')).toBe(true);
    });

    it('does not flag normal user files', () => {
      expect(isProtectedKeyFile('meeting_notes.txt')).toBe(false);
      expect(isProtectedKeyFile('readme_final_v2.txt')).toBe(false);
      expect(isProtectedKeyFile('my_file.pdf')).toBe(false);
    });
  });
});
