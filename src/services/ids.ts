/**
 * Identifiers.
 *
 * Purpose: make record identifiers and the short circle code a family
 * types to reach its profile. Both come from the system's secure
 * random source.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { CIRCLE_CODE_LENGTH } from '@/constants/care';

/** Letters and digits that are hard to confuse when read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Purpose: a new unique record identifier. */
export function newId(): string {
   return randomUUID();
}

/** Purpose: a new circle code such as "K7PM2XQA". */
export function newCircleCode(): string {
   let code = '';
   for (let index = 0; index < CIRCLE_CODE_LENGTH; index += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)] ?? 'A';
   }
   return code;
}

/** Purpose: tidy a typed circle code for lookup. */
export function normaliseCircleCode(raw: string): string {
   return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
