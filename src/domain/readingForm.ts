/**
 * Health reading form.
 *
 * Purpose: turn the health forms (blood pressure, blood sugar, weight,
 * symptom and daily check-in) into a checked HealthReading, and pick the
 * readings a chart needs. Pure functions only: the caller supplies the
 * id, the member and the time, so every rule here can be unit-tested.
 */
import {
   MOOD_MAX,
   MOOD_MIN,
   MS_PER_DAY,
} from '@/constants/care';
import type {
   HealthReading,
   ReadingKind,
   Result,
} from '@/domain/types';
import {
   cleanText,
   optionalText,
   parseInteger,
   parseNumber,
   requireName,
} from '@/domain/validation';

/** Allowed input ranges, shown on the forms and enforced here. */
export const READING_LIMITS = {
   systolic: { min: 60, max: 260 },
   diastolic: { min: 30, max: 160 },
   glucose: { min: 20, max: 600 },
   weight: { min: 20, max: 300 },
} as const;

const READING_KINDS: readonly ReadingKind[] = [
   'bloodPressure',
   'glucose',
   'weight',
   'symptom',
   'checkIn',
];

/** Values that do not apply to a kind are stored as zero. */
const NOT_APPLICABLE = 0;

export interface ReadingBase {
   id: string;
   profileId: string;
   byId: string;
   now: number;
}

export interface ChartPoint {
   at: number;
   value: number;
   value2: number;
}

interface Measure {
   value: number;
   value2: number;
}

/** Purpose: true when the text names one of the five reading kinds. */
function isReadingKind(text: string): text is ReadingKind {
   return READING_KINDS.some((candidate) => candidate === text);
}

/** Purpose: check a blood pressure pair; diastolic must be lower. */
function parseBloodPressure(
   values: Readonly<Record<string, unknown>>,
): Result<Measure> {
   const systolic = parseInteger(
      values.systolic,
      'Top number (systolic)',
      READING_LIMITS.systolic.min,
      READING_LIMITS.systolic.max,
   );
   if (!systolic.ok) {
      return systolic;
   }
   const diastolic = parseInteger(
      values.diastolic,
      'Bottom number (diastolic)',
      READING_LIMITS.diastolic.min,
      READING_LIMITS.diastolic.max,
   );
   if (!diastolic.ok) {
      return diastolic;
   }
   if (diastolic.value >= systolic.value) {
      return {
         ok: false,
         error: 'The bottom number must be lower than the top number.',
      };
   }
   return {
      ok: true,
      value: { value: systolic.value, value2: diastolic.value },
   };
}

/** Purpose: check a whole-number blood sugar reading in mg/dL. */
function parseGlucose(
   values: Readonly<Record<string, unknown>>,
): Result<Measure> {
   const sugar = parseInteger(
      values.value,
      'Blood sugar',
      READING_LIMITS.glucose.min,
      READING_LIMITS.glucose.max,
   );
   if (!sugar.ok) {
      return sugar;
   }
   return { ok: true, value: { value: sugar.value, value2: NOT_APPLICABLE } };
}

/** Purpose: check a weight in kg; decimals are allowed. */
function parseWeight(
   values: Readonly<Record<string, unknown>>,
): Result<Measure> {
   const weight = parseNumber(
      values.value,
      'Weight',
      READING_LIMITS.weight.min,
      READING_LIMITS.weight.max,
   );
   if (!weight.ok) {
      return weight;
   }
   return { ok: true, value: { value: weight.value, value2: NOT_APPLICABLE } };
}

/** Purpose: check a mood from the daily check-in, 1 to 5. */
function parseCheckIn(
   values: Readonly<Record<string, unknown>>,
): Result<Measure> {
   const mood = parseInteger(values.value, 'Mood', MOOD_MIN, MOOD_MAX);
   if (!mood.ok) {
      return mood;
   }
   return { ok: true, value: { value: mood.value, value2: NOT_APPLICABLE } };
}

/**
 * Purpose: the numbers for one kind, or an error. A symptom has no
 * number; its note is the entry.
 */
function parseMeasure(
   kind: ReadingKind,
   values: Readonly<Record<string, unknown>>,
): Result<Measure> {
   switch (kind) {
      case 'bloodPressure':
         return parseBloodPressure(values);
      case 'glucose':
         return parseGlucose(values);
      case 'weight':
         return parseWeight(values);
      case 'checkIn':
         return parseCheckIn(values);
      case 'symptom':
         return {
            ok: true,
            value: { value: NOT_APPLICABLE, value2: NOT_APPLICABLE },
         };
   }
}

/**
 * Purpose: a checked reading from the submitted form. A symptom needs a
 * note; every other kind takes an optional note. The time is the moment
 * of the request, in the profile's clock.
 */
export function parseReadingForm(
   values: Readonly<Record<string, unknown>>,
   base: ReadingBase,
): Result<HealthReading> {
   const kindText = cleanText(values.kind);
   if (!isReadingKind(kindText)) {
      return { ok: false, error: 'Choose what to record.' };
   }
   const measure = parseMeasure(kindText, values);
   if (!measure.ok) {
      return measure;
   }
   const note =
      kindText === 'symptom'
         ? requireName(values.note, 'Symptom')
         : optionalText(values.note, 'Note');
   if (!note.ok) {
      return note;
   }
   return {
      ok: true,
      value: {
         id: base.id,
         profileId: base.profileId,
         kind: kindText,
         value: measure.value.value,
         value2: measure.value.value2,
         note: note.value,
         at: base.now,
         byId: base.byId,
      },
   };
}

/**
 * Purpose: readings of one kind within the last `days` days before
 * `now`, oldest first. The input array is not changed.
 */
export function chartSeries(
   readings: readonly HealthReading[],
   kind: ReadingKind,
   now: number,
   days: number,
): ChartPoint[] {
   const from = now - days*MS_PER_DAY;
   return readings
      .filter(
         (reading) =>
            reading.kind === kind && reading.at >= from && reading.at <= now,
      )
      .sort((first, second) => first.at - second.at)
      .map((reading) => ({
         at: reading.at,
         value: reading.value,
         value2: reading.value2,
      }));
}

/** Purpose: the most recent reading of one kind, or null when none. */
export function latestReading(
   readings: readonly HealthReading[],
   kind: HealthReading['kind'],
): HealthReading | null {
   let latest: HealthReading | null = null;
   for (const reading of readings) {
      if (
         reading.kind === kind &&
         (latest === null || reading.at > latest.at)
      ) {
         latest = reading;
      }
   } // ----- end for each reading
   return latest;
}
