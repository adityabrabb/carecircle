/**
 * Prescription reading: checking the model's output.
 *
 * Purpose: turn the untrusted text a model returns for a prescription
 * photo into safe medicine drafts, then compare those drafts with the
 * medicines already on the list. Nothing here is saved; a person checks
 * each draft through the normal medicine form. Pure functions.
 */
import {
   MAX_NAME_LENGTH,
   MAX_UNITS_PER_DOSE,
   ROUTINE_ANCHORS,
} from '@/constants/care';
import type {
   FoodRule,
   Medication,
   RoutineAnchor,
} from '@/domain/types';
import { cleanText } from '@/domain/validation';

// ----- Limits and defaults ----------------------------------------------

const MAX_DRAFTS = 12;
const MAX_STRENGTH_LENGTH = 80;
const MAX_PURPOSE_LENGTH = 120;
const DEFAULT_ANCHORS: readonly RoutineAnchor[] = ['breakfast'];
const DEFAULT_FOOD: FoodRule = 'any';
const DEFAULT_UNITS = 1;
const FOOD_RULES: readonly FoodRule[] = ['before', 'after', 'with', 'any'];

/** Anything that is not a letter or digit, for matching names. */
const NAME_JUNK = /[^\p{L}\p{N}]/gu;
const SPACES = /\s+/g;

// ----- Types ------------------------------------------------------------

export interface DraftMedicine {
   name: string;
   strength: string;
   purpose: string;
   anchors: RoutineAnchor[];
   food: FoodRule;
   unitsPerDose: number;
}

export type DraftStatus = 'new' | 'changed' | 'same';

export interface ComparedDraft {
   draft: DraftMedicine;
   status: DraftStatus;
   matchId: string;
}

// ----- Helpers ----------------------------------------------------------

/** Purpose: true for a plain object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Purpose: a name reduced to lower-case letters and digits, for matching. */
function normaliseName(name: string): string {
   return name.toLowerCase().replace(NAME_JUNK, '');
}

/** Purpose: clean model text and cut it to a maximum length. */
function clipText(raw: unknown, max: number): string {
   return cleanText(raw).slice(0, max).trim();
}

/** Purpose: the list of medicines, from either accepted shape. */
function listOf(raw: unknown): unknown[] {
   if (Array.isArray(raw)) {
      return raw;
   }
   if (isRecord(raw) && Array.isArray(raw.medicines)) {
      return raw.medicines;
   }
   return [];
}

/**
 * Purpose: the valid routine times the model named, de-duplicated and in
 * day order. Falls back to breakfast when none are valid.
 */
function parseAnchors(raw: unknown): RoutineAnchor[] {
   if (!Array.isArray(raw)) {
      return [...DEFAULT_ANCHORS];
   }
   const given = raw.map((item) => cleanText(item).toLowerCase());
   const anchors = ROUTINE_ANCHORS.filter((anchor) => given.includes(anchor));
   return anchors.length > 0 ? anchors : [...DEFAULT_ANCHORS];
}

/** Purpose: the food rule named by the model, defaulting to "any". */
function parseFood(raw: unknown): FoodRule {
   const text = cleanText(raw).toLowerCase();
   return FOOD_RULES.find((rule) => rule === text) ?? DEFAULT_FOOD;
}

/** Purpose: a whole number of units in range, defaulting to one. */
function parseUnits(raw: unknown): number {
   const value = typeof raw === 'number' ? raw : Number(cleanText(raw));
   const whole =
      Number.isInteger(value) && value >= 1 && value <= MAX_UNITS_PER_DOSE;
   return whole ? value : DEFAULT_UNITS;
}

/** Purpose: one medicine from the model, or null when it has no name. */
function parseDraft(item: unknown): DraftMedicine | null {
   if (!isRecord(item)) {
      return null;
   }
   const name = clipText(item.name, MAX_NAME_LENGTH);
   if (normaliseName(name) === '') {
      return null;
   }
   return {
      name,
      strength: clipText(item.strength, MAX_STRENGTH_LENGTH),
      purpose: clipText(item.purpose, MAX_PURPOSE_LENGTH),
      anchors: parseAnchors(item.anchors),
      food: parseFood(item.food),
      unitsPerDose: parseUnits(item.unitsPerDose),
   };
}

/** Purpose: strength text compared ignoring case and extra spaces only. */
function sameStrength(first: string, second: string): boolean {
   const collapse = (text: string): string =>
      text.toLowerCase().replace(SPACES, ' ').trim();
   return collapse(first) === collapse(second);
}

/** Purpose: true when two lists hold the same anchors, in any order. */
function sameAnchors(
   first: readonly RoutineAnchor[],
   second: readonly RoutineAnchor[],
): boolean {
   const left = new Set(first);
   const right = new Set(second);
   return left.size === right.size && [...left].every((a) => right.has(a));
}

/** Purpose: true when a draft matches the medicine on the list exactly. */
function isSame(draft: DraftMedicine, medication: Medication): boolean {
   return (
      sameStrength(draft.strength, medication.strength) &&
      sameAnchors(draft.anchors, medication.anchors) &&
      draft.food === medication.food &&
      draft.unitsPerDose === medication.unitsPerDose
   );
}

// ----- Public functions -------------------------------------------------

/**
 * Purpose: turn untrusted model output into safe drafts. Accepts
 * { medicines: [...] } or a bare array; anything else gives no drafts.
 */
export function parseExtraction(raw: unknown): DraftMedicine[] {
   const drafts: DraftMedicine[] = [];
   const seen = new Set<string>();
   for (const item of listOf(raw)) {
      if (drafts.length >= MAX_DRAFTS) {
         break;
      }
      const draft = parseDraft(item);
      if (draft === null) {
         continue;
      }
      const key = normaliseName(draft.name);
      if (seen.has(key)) {
         continue;
      }
      seen.add(key);
      drafts.push(draft);
   }
   return drafts;
}

/**
 * Purpose: say, for each draft, whether it is new, different from an
 * active medicine with the same name, or already on the list. Stopped and
 * pending medicines are ignored.
 */
export function compareWithCurrent(
   drafts: readonly DraftMedicine[],
   medications: readonly Medication[],
): ComparedDraft[] {
   const active = medications.filter(
      (medication) => medication.status === 'active',
   );
   return drafts.map((draft) => {
      const key = normaliseName(draft.name);
      const match =
         key === ''
            ? undefined
            : active.find((medication) => normaliseName(medication.name) === key);
      if (!match) {
         return { draft, status: 'new', matchId: '' };
      }
      return {
         draft,
         status: isSame(draft, match) ? 'same' : 'changed',
         matchId: match.id,
      };
   });
}

/** Purpose: active medicines that the prescription does not mention. */
export function notOnPrescription(
   drafts: readonly DraftMedicine[],
   medications: readonly Medication[],
): Medication[] {
   const named = new Set(drafts.map((draft) => normaliseName(draft.name)));
   return medications.filter(
      (medication) =>
         medication.status === 'active' &&
         !named.has(normaliseName(medication.name)),
   );
}
