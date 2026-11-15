/**
 * Medical record tests.
 *
 * Purpose: check the rules for uploads, document kinds, search, file
 * names and inline display of medical records.
 */
import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_BYTES } from '@/constants/care';
import {
   checkUpload,
   filterDocuments,
   isInlineType,
   parseDocumentKind,
   safeFileName,
   type UploadInfo,
} from '@/domain/documentForm';
import type { DocumentRecord } from '@/domain/types';
import { NOON, PROFILE_ID } from './fixtures';

/** Purpose: a stored record with only the fields a test cares about. */
function makeDocument(
   overrides: Partial<DocumentRecord> = {},
): DocumentRecord {
   return {
      id: 'doc-1',
      profileId: PROFILE_ID,
      title: 'Report',
      kind: 'other',
      mime: 'application/pdf',
      data: '',
      summary: '',
      uploadedById: 'elder-1',
      at: NOON,
      ...overrides,
   };
}

/** Purpose: an upload description with a valid type and size. */
function makeUpload(overrides: Partial<UploadInfo> = {}): UploadInfo {
   return {
      name: 'scan.pdf',
      type: 'application/pdf',
      size: 1_000,
      ...overrides,
   };
}

describe('checkUpload', () => {
   it('accepts a PDF of normal size', () => {
      expect(checkUpload(makeUpload()).ok).toBe(true);
   });

   it('accepts JPEG, PNG and WebP pictures', () => {
      for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
         expect(checkUpload(makeUpload({ type })).ok).toBe(true);
      }
   });

   it('refuses types that are not documents or pictures', () => {
      for (const type of ['image/svg+xml', 'text/html', '', 'video/mp4']) {
         const result = checkUpload(makeUpload({ type }));
         expect(result.ok).toBe(false);
      }
   });

   it('refuses an empty file', () => {
      const result = checkUpload(makeUpload({ size: 0 }));
      expect(result).toEqual({ ok: false, error: 'The file is empty.' });
   });

   it('accepts a file exactly at the limit and refuses one byte more', () => {
      expect(checkUpload(makeUpload({ size: MAX_DOCUMENT_BYTES })).ok)
         .toBe(true);
      const over = checkUpload(makeUpload({ size: MAX_DOCUMENT_BYTES + 1 }));
      expect(over.ok).toBe(false);
      expect(over.ok ? '' : over.error).toContain('700 KB');
   });

   it('refuses a negative size', () => {
      expect(checkUpload(makeUpload({ size: -5 })).ok).toBe(false);
   });
});

describe('parseDocumentKind', () => {
   it('returns each known kind unchanged', () => {
      expect(parseDocumentKind('prescription')).toBe('prescription');
      expect(parseDocumentKind('labReport')).toBe('labReport');
      expect(parseDocumentKind('discharge')).toBe('discharge');
      expect(parseDocumentKind('other')).toBe('other');
   });

   it('treats unknown or non-text values as other', () => {
      expect(parseDocumentKind('xray')).toBe('other');
      expect(parseDocumentKind(undefined)).toBe('other');
      expect(parseDocumentKind(42)).toBe('other');
      expect(parseDocumentKind('')).toBe('other');
   });

   it('ignores surrounding spaces', () => {
      expect(parseDocumentKind('  labReport ')).toBe('labReport');
   });
});

describe('filterDocuments', () => {
   const records = [
      makeDocument({
         id: 'a',
         title: 'Blood test',
         kind: 'labReport',
         summary: 'Sugar slightly high',
         at: NOON - 3,
      }),
      makeDocument({
         id: 'b',
         title: 'Heart discharge',
         kind: 'discharge',
         summary: 'Stayed four nights',
         at: NOON - 1,
      }),
      makeDocument({
         id: 'c',
         title: 'Metformin prescription',
         kind: 'prescription',
         summary: 'Dr Rao, March',
         at: NOON - 2,
      }),
   ];

   it('returns everything for an empty query and empty kind', () => {
      expect(filterDocuments(records, '', '')).toHaveLength(3);
      expect(filterDocuments(records, '   ', '')).toHaveLength(3);
   });

   it('needs every word of the query to match', () => {
      const found = filterDocuments(records, 'heart nights', '');
      expect(found.map((item) => item.id)).toEqual(['b']);
      expect(filterDocuments(records, 'heart sugar', '')).toEqual([]);
   });

   it('matches case-insensitively in the title and the summary', () => {
      expect(filterDocuments(records, 'DR RAO', '').map((item) => item.id))
         .toEqual(['c']);
      expect(filterDocuments(records, 'SUGAR', '').map((item) => item.id))
         .toEqual(['a']);
   });

   it('filters by kind, with empty meaning all kinds', () => {
      const found = filterDocuments(records, '', 'prescription');
      expect(found.map((item) => item.id)).toEqual(['c']);
      expect(filterDocuments(records, 'test', 'discharge')).toEqual([]);
   });

   it('lists newest first without changing the input order', () => {
      const found = filterDocuments(records, '', '');
      expect(found.map((item) => item.id)).toEqual(['b', 'c', 'a']);
      expect(records.map((item) => item.id)).toEqual(['a', 'b', 'c']);
   });
});

describe('safeFileName', () => {
   it('replaces unsafe characters and adds the extension', () => {
      expect(safeFileName("Dr. Rao's report/../x", 'application/pdf'))
         .toBe('Dr-Rao-s-report-x.pdf');
   });

   it('removes dashes and underscores at the edges', () => {
      expect(safeFileName('  --Lab report--  ', 'image/png'))
         .toBe('Lab-report.png');
   });

   it('keeps the base name to 60 characters', () => {
      const name = safeFileName('a'.repeat(100), 'image/jpeg');
      expect(name).toBe(`${'a'.repeat(60)}.jpg`);
   });

   it('uses a fallback name when nothing safe is left', () => {
      expect(safeFileName('???', 'application/pdf')).toBe('record.pdf');
      expect(safeFileName('', 'application/pdf')).toBe('record.pdf');
   });

   it('maps each mime type to its extension', () => {
      expect(safeFileName('x', 'image/webp')).toBe('x.webp');
      expect(safeFileName('x', 'text/plain')).toBe('x.txt');
      expect(safeFileName('x', 'application/x-unknown')).toBe('x.bin');
   });

   it('never lets a prototype name become an extension', () => {
      expect(safeFileName('x', 'constructor')).toBe('x.bin');
   });
});

describe('isInlineType', () => {
   it('shows PDFs and pictures inline', () => {
      expect(isInlineType('application/pdf')).toBe(true);
      expect(isInlineType('image/jpeg')).toBe(true);
      expect(isInlineType('image/png')).toBe(true);
      expect(isInlineType('image/webp')).toBe(true);
   });

   it('downloads everything else, including SVG and HTML', () => {
      expect(isInlineType('image/svg+xml')).toBe(false);
      expect(isInlineType('text/html')).toBe(false);
      expect(isInlineType('text/plain')).toBe(false);
      expect(isInlineType('')).toBe(false);
   });
});
