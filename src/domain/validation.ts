/**
 * Input validation.
 *
 * Purpose: check and clean everything a person types before it is
 * stored. Each function returns a Result so callers show a clear
 * message instead of crashing on bad input.
 */
import {
   MAX_NAME_LENGTH,
   MAX_TEXT_LENGTH,
   ROUTINE_ANCHORS,
} from '@/constants/care';
import { clockToMinutes, isDateKey } from '@/domain/time';
import type {
   Language,
   Result,
   Role,
   Routine,
   RoutineAnchor,
} from '@/domain/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const COLOUR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ROLES: readonly Role[] = ['elder', 'caretaker', 'family'];

/** Purpose: trim text and remove control characters. */
export function cleanText(raw: unknown): string {
   if (typeof raw !== 'string') {
      return '';
   }
   return raw.replace(CONTROL_CHARACTERS, '').trim();
}

/** Purpose: a required short text such as a name. */
export function requireName(raw: unknown, label: string): Result<string> {
   const text = cleanText(raw);
   if (text === '') {
      return { ok: false, error: `${label} is required.` };
   }
   if (text.length > MAX_NAME_LENGTH) {
      return {
         ok: false,
         error: `${label} must be ${MAX_NAME_LENGTH} characters or fewer.`,
      };
   }
   return { ok: true, value: text };
}

/** Purpose: an optional longer text such as a note. */
export function optionalText(raw: unknown, label: string): Result<string> {
   const text = cleanText(raw);
   if (text.length > MAX_TEXT_LENGTH) {
      return {
         ok: false,
         error: `${label} must be ${MAX_TEXT_LENGTH} characters or fewer.`,
      };
   }
   return { ok: true, value: text };
}

/** Purpose: an email address; empty is allowed when not required. */
export function parseEmail(raw: unknown, required: boolean): Result<string> {
   const text = cleanText(raw).toLowerCase();
   if (text === '') {
      return required
         ? { ok: false, error: 'Email is required.' }
         : { ok: true, value: '' };
   }
   if (text.length > MAX_NAME_LENGTH*2 || !EMAIL_PATTERN.test(text)) {
      return { ok: false, error: 'Enter a valid email address.' };
   }
   return { ok: true, value: text };
}

/** Purpose: a whole number inside a range. */
export function parseInteger(
   raw: unknown,
   label: string,
   min: number,
   max: number,
): Result<number> {
   const text = cleanText(raw);
   if (!/^-?\d+$/.test(text)) {
      return { ok: false, error: `${label} must be a whole number.` };
   }
   const value = Number(text);
   if (value < min || value > max) {
      return {
         ok: false,
         error: `${label} must be between ${min} and ${max}.`,
      };
   }
   return { ok: true, value };
}

/** Purpose: a number, possibly with decimals, inside a range. */
export function parseNumber(
   raw: unknown,
   label: string,
   min: number,
   max: number,
): Result<number> {
   const text = cleanText(raw);
   if (!/^-?\d+(\.\d+)?$/.test(text)) {
      return { ok: false, error: `${label} must be a number.` };
   }
   const value = Number(text);
   if (value < min || value > max) {
      return {
         ok: false,
         error: `${label} must be between ${min} and ${max}.`,
      };
   }
   return { ok: true, value };
}

/** Purpose: a 24-hour "HH:MM" time. */
export function parseClock(raw: unknown, label: string): Result<string> {
   const text = cleanText(raw);
   if (clockToMinutes(text) < 0) {
      return { ok: false, error: `${label} must be a time like 08:30.` };
   }
   return { ok: true, value: text };
}

/** Purpose: a "YYYY-MM-DD" day; empty is allowed when not required. */
export function parseDateKey(
   raw: unknown,
   label: string,
   required: boolean,
): Result<string> {
   const text = cleanText(raw);
   if (text === '' && !required) {
      return { ok: true, value: '' };
   }
   if (!isDateKey(text)) {
      return { ok: false, error: `${label} must be a valid date.` };
   }
   return { ok: true, value: text };
}

/** Purpose: one of the three roles. */
export function parseRole(raw: unknown): Result<Role> {
   const text = cleanText(raw);
   const role = ROLES.find((candidate) => candidate === text);
   return role
      ? { ok: true, value: role }
      : { ok: false, error: 'Choose a role.' };
}

/** Purpose: a supported language, defaulting to English. */
export function parseLanguage(raw: unknown): Language {
   return cleanText(raw) === 'hi' ? 'hi' : 'en';
}

/** Purpose: the routine anchors ticked on a form, at least one. */
export function parseAnchors(raw: readonly unknown[]): Result<RoutineAnchor[]> {
   const ticked = raw.map(cleanText);
   const anchors = ROUTINE_ANCHORS.filter((anchor) =>
      ticked.includes(anchor),
   );
   if (anchors.length === 0) {
      return { ok: false, error: 'Choose at least one time of day.' };
   }
   return { ok: true, value: [...anchors] };
}

/** Purpose: a full routine, every anchor a valid time, in day order. */
export function parseRoutine(
   raw: Readonly<Record<string, unknown>>,
): Result<Routine> {
   const routine: Partial<Routine> = {};
   let previous = -1;
   for (const anchor of ROUTINE_ANCHORS) {
      const parsed = parseClock(raw[anchor], anchor);
      if (!parsed.ok) {
         return parsed;
      }
      const minutes = clockToMinutes(parsed.value);
      if (minutes <= previous) {
         return {
            ok: false,
            error: 'Routine times must run in order through the day.',
         };
      }
      previous = minutes;
      routine[anchor] = parsed.value;
   }
   return { ok: true, value: routine as Routine };
}

/** Purpose: a "#rrggbb" colour, with a calm default. */
export function parseColour(raw: unknown): string {
   const text = cleanText(raw);
   return COLOUR_PATTERN.test(text) ? text.toLowerCase() : '#c2410c';
}
