/**
 * Medical record rules.
 *
 * Purpose: check an upload before it is stored, read the document kind a
 * form sends, search and order records, and build the safe download name
 * and display type used when a record is opened. Pure functions only.
 */
import {
   ALLOWED_DOCUMENT_TYPES,
   MAX_DOCUMENT_BYTES,
} from '@/constants/care';
import type {
   DocumentKind,
   DocumentRecord,
   Result,
} from '@/domain/types';
import { cleanText } from '@/domain/validation';

export interface UploadInfo {
   name: string;
   type: string;
   size: number;
}

const DOCUMENT_KINDS: readonly DocumentKind[] = [
   'prescription',
   'labReport',
   'discharge',
   'other',
];
const BYTES_PER_KILOBYTE = 1_000;
const MAX_FILE_NAME_LENGTH = 60;
const DEFAULT_FILE_NAME = 'record';
const DEFAULT_EXTENSION = '.bin';
const INLINE_TYPES: readonly string[] = [
   'application/pdf',
   'image/jpeg',
   'image/png',
   'image/webp',
];
const EXTENSIONS = new Map<string, string>([
   ['application/pdf', '.pdf'],
   ['image/jpeg', '.jpg'],
   ['image/png', '.png'],
   ['image/webp', '.webp'],
   ['text/plain', '.txt'],
]);
const UNSAFE_RUN = /[^A-Za-z0-9_-]+/g;
const EDGE_MARKS = /^[-_]+|[-_]+$/g;
const WORD_SEPARATOR = /\s+/;

/**
 * Purpose: a file may be stored only when its type is allowed and its
 * size is above zero and within the upload limit.
 */
export function checkUpload(file: UploadInfo): Result<UploadInfo> {
   if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return {
         ok: false,
         error: 'The file must be a PDF, JPEG, PNG or WebP.',
      };
   }
   if (file.size <= 0) {
      return { ok: false, error: 'The file is empty.' };
   }
   if (file.size > MAX_DOCUMENT_BYTES) {
      const limit = MAX_DOCUMENT_BYTES / BYTES_PER_KILOBYTE;
      return {
         ok: false,
         error: `The file is too large. The limit is ${limit} KB.`,
      };
   }
   return { ok: true, value: file };
}

/** Purpose: the kind a form sent; anything unknown counts as other. */
export function parseDocumentKind(raw: unknown): DocumentKind {
   const text = cleanText(raw);
   return DOCUMENT_KINDS.find((kind) => kind === text) ?? 'other';
}

/**
 * Purpose: records whose title and summary together hold every word of
 * the query, ignoring case. An empty kind means all kinds. The result is
 * newest first and the input array is left unchanged.
 */
export function filterDocuments(
   documents: readonly DocumentRecord[],
   query: string,
   kind: string,
): DocumentRecord[] {
   const words = cleanText(query)
      .toLowerCase()
      .split(WORD_SEPARATOR)
      .filter((word) => word !== '');
   return documents
      .filter((document) => kind === '' || document.kind === kind)
      .filter((document) => {
         const text = `${document.title} ${document.summary}`.toLowerCase();
         return words.every((word) => text.includes(word));
      })
      .sort((first, second) => second.at - first.at);
}

/**
 * Purpose: a download name made only of letters, digits, dashes and
 * underscores, with an extension taken from the mime type.
 */
export function safeFileName(title: string, mime: string): string {
   const base = title
      .replace(UNSAFE_RUN, '-')
      .slice(0, MAX_FILE_NAME_LENGTH)
      .replace(EDGE_MARKS, '');
   const extension = EXTENSIONS.get(mime) ?? DEFAULT_EXTENSION;
   return `${base || DEFAULT_FILE_NAME}${extension}`;
}

/** Purpose: true when the browser may show the file inline. */
export function isInlineType(mime: string): boolean {
   return INLINE_TYPES.includes(mime);
}
