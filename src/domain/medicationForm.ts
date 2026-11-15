/**
 * Medicine form.
 *
 * Purpose: turn the values typed into the medicine form into a checked
 * Medication record, and describe a medicine change in plain words for
 * approval screens and emails. Pure functions.
 */
import {
   MAX_STOCK,
   MAX_UNITS_PER_DOSE,
} from '@/constants/care';
import type {
   FoodRule,
   Medication,
   ProposalKind,
   Result,
} from '@/domain/types';
import {
   cleanText,
   optionalText,
   parseAnchors,
   parseColour,
   parseDateKey,
   parseInteger,
   requireName,
} from '@/domain/validation';

const FOOD_RULES: readonly FoodRule[] = ['before', 'after', 'with', 'any'];

const FOOD_TEXT: Record<FoodRule, string> = {
   before: 'before food',
   after: 'after food',
   with: 'with food',
   any: '',
};

const ANCHOR_TEXT: Record<string, string> = {
   wake: 'on waking',
   breakfast: 'at breakfast',
   lunch: 'at lunch',
   evening: 'in the evening',
   dinner: 'at dinner',
   sleep: 'at bedtime',
};

export interface MedicationFormInput {
   values: Readonly<Record<string, unknown>>;
   anchors: readonly unknown[];
   /** Checked photo as a data URL, or empty to keep the current one. */
   photo: string;
}

export interface MedicationFormBase {
   id: string;
   profileId: string;
   now: number;
   /** The medicine being edited, when this is not a new one. */
   existing: Medication | null;
}

/** Purpose: the food rule named on the form, defaulting to "any". */
function parseFood(raw: unknown): FoodRule {
   const text = cleanText(raw);
   return FOOD_RULES.find((rule) => rule === text) ?? 'any';
}

/**
 * Purpose: build a Medication from form input. The returned record is
 * always "active"; the caller decides whether it is applied or held as
 * a proposal for the elder.
 */
export function parseMedicationForm(
   input: MedicationFormInput,
   base: MedicationFormBase,
): Result<Medication> {
   const { values } = input;
   const name = requireName(values.name, 'Medicine name');
   if (!name.ok) {
      return name;
   }
   const strength = optionalText(values.strength, 'Strength');
   if (!strength.ok) {
      return strength;
   }
   const purpose = optionalText(values.purpose, 'What it is for');
   if (!purpose.ok) {
      return purpose;
   }
   const anchors = parseAnchors(input.anchors);
   if (!anchors.ok) {
      return anchors;
   }
   const unitsPerDose = parseInteger(
      values.unitsPerDose,
      'Tablets per dose',
      1,
      MAX_UNITS_PER_DOSE,
   );
   if (!unitsPerDose.ok) {
      return unitsPerDose;
   }
   const stock = parseInteger(values.stock, 'Tablets in stock', 0, MAX_STOCK);
   if (!stock.ok) {
      return stock;
   }
   const startDate = parseDateKey(values.startDate, 'Start date', false);
   if (!startDate.ok) {
      return startDate;
   }
   const endDate = parseDateKey(values.endDate, 'End date', false);
   if (!endDate.ok) {
      return endDate;
   }
   if (
      startDate.value !== '' &&
      endDate.value !== '' &&
      endDate.value < startDate.value
   ) {
      return { ok: false, error: 'End date must be after the start date.' };
   }
   return {
      ok: true,
      value: {
         id: base.id,
         profileId: base.profileId,
         name: name.value,
         purpose: purpose.value,
         strength: strength.value,
         anchors: anchors.value,
         food: parseFood(values.food),
         unitsPerDose: unitsPerDose.value,
         stock: stock.value,
         colour: parseColour(values.colour),
         photo: input.photo || base.existing?.photo || '',
         critical: cleanText(values.critical) === 'on',
         status: 'active',
         startDate: startDate.value,
         endDate: endDate.value,
         updatedAt: base.now,
      },
   };
}

/** Purpose: when and how a medicine is taken, in plain words. */
export function describeSchedule(medication: Medication): string {
   const times = medication.anchors
      .map((anchor) => ANCHOR_TEXT[anchor] ?? anchor)
      .join(' and ');
   const food = FOOD_TEXT[medication.food];
   return food ? `${times}, ${food}` : times;
}

/** Purpose: one sentence describing a proposed change. */
export function describeChange(
   kind: ProposalKind,
   medication: Medication,
): string {
   const label = `${medication.name} ${medication.strength}`.trim();
   if (kind === 'stopMedication') {
      return `Stop ${label}`;
   }
   const verb = kind === 'addMedication' ? 'Add' : 'Change';
   return `${verb} ${label}: ${medication.unitsPerDose} ${describeSchedule(
      medication,
   )}`;
}

/**
 * Purpose: the medicine record to store when a proposal is approved.
 * A stop proposal keeps the medicine on file as "stopped" so history
 * is never lost.
 */
export function medicationAfterApproval(
   kind: ProposalKind,
   medication: Medication,
   now: number,
): Medication {
   return {
      ...medication,
      status: kind === 'stopMedication' ? 'stopped' : 'active',
      updatedAt: now,
   };
}
