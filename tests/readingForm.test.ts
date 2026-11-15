/**
 * Tests for the health reading form and chart series.
 */
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '@/constants/care';
import {
   chartSeries,
   parseReadingForm,
   type ReadingBase,
} from '@/domain/readingForm';
import {
   makeReading,
   NOON,
   PROFILE_ID,
} from './fixtures';

const BASE: ReadingBase = {
   id: 'reading-new',
   profileId: PROFILE_ID,
   byId: 'family-1',
   now: NOON,
};

/** Purpose: the error text when a form is rejected, or '' when accepted. */
function errorOf(values: Record<string, unknown>): string {
   const parsed = parseReadingForm(values, BASE);
   return parsed.ok ? '' : parsed.error;
}

describe('parseReadingForm: blood pressure', () => {
   it('stores systolic as value and diastolic as value2', () => {
      const parsed = parseReadingForm(
         { kind: 'bloodPressure', systolic: '128', diastolic: '82' },
         BASE,
      );
      expect(parsed).toEqual({
         ok: true,
         value: {
            id: 'reading-new',
            profileId: PROFILE_ID,
            kind: 'bloodPressure',
            value: 128,
            value2: 82,
            note: '',
            at: NOON,
            byId: 'family-1',
         },
      });
   });

   it('accepts the outer limits of each range', () => {
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '260', diastolic: '160' }),
      ).toBe('');
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '60', diastolic: '30' }),
      ).toBe('');
   });

   it('rejects values just outside the ranges', () => {
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '59', diastolic: '30' }),
      ).toBe('Top number (systolic) must be between 60 and 260.');
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '261', diastolic: '80' }),
      ).toBe('Top number (systolic) must be between 60 and 260.');
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '120', diastolic: '29' }),
      ).toBe('Bottom number (diastolic) must be between 30 and 160.');
   });

   it('requires diastolic to be lower than systolic', () => {
      const message = 'The bottom number must be lower than the top number.';
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '120', diastolic: '120' }),
      ).toBe(message);
      expect(
         errorOf({ kind: 'bloodPressure', systolic: '120', diastolic: '130' }),
      ).toBe(message);
   });

   it('rejects text that is not a whole number', () => {
      expect(
         errorOf({ kind: 'bloodPressure', systolic: 'high', diastolic: '80' }),
      ).toBe('Top number (systolic) must be a whole number.');
   });
});

describe('parseReadingForm: blood sugar, weight and symptoms', () => {
   it('accepts blood sugar at both limits and stores value2 as zero', () => {
      const low = parseReadingForm({ kind: 'glucose', value: '20' }, BASE);
      const high = parseReadingForm({ kind: 'glucose', value: '600' }, BASE);
      expect(low.ok && low.value.value).toBe(20);
      expect(high.ok && high.value.value2).toBe(0);
      expect(errorOf({ kind: 'glucose', value: '19' })).toBe(
         'Blood sugar must be between 20 and 600.',
      );
      expect(errorOf({ kind: 'glucose', value: '601' })).toBe(
         'Blood sugar must be between 20 and 600.',
      );
   });

   it('accepts decimal weight inside the limits', () => {
      const parsed = parseReadingForm({ kind: 'weight', value: '72.5' }, BASE);
      expect(parsed.ok && parsed.value.value).toBe(72.5);
      expect(errorOf({ kind: 'weight', value: '20' })).toBe('');
      expect(errorOf({ kind: 'weight', value: '300' })).toBe('');
      expect(errorOf({ kind: 'weight', value: '19.9' })).toBe(
         'Weight must be between 20 and 300.',
      );
      expect(errorOf({ kind: 'weight', value: '300.1' })).toBe(
         'Weight must be between 20 and 300.',
      );
   });

   it('requires a note for a symptom, within the length limit', () => {
      expect(errorOf({ kind: 'symptom', note: '   ' })).toBe(
         'Symptom is required.',
      );
      const longNote = 'a'.repeat(81);
      expect(errorOf({ kind: 'symptom', note: longNote })).toBe(
         'Symptom must be 80 characters or fewer.',
      );
      const parsed = parseReadingForm(
         { kind: 'symptom', note: 'Dizzy when standing' },
         BASE,
      );
      expect(parsed.ok && parsed.value.note).toBe('Dizzy when standing');
      expect(parsed.ok && parsed.value.value).toBe(0);
   });
});

describe('parseReadingForm: daily check-in and shared rules', () => {
   it('accepts moods 1 to 5 and rejects anything else', () => {
      expect(errorOf({ kind: 'checkIn', value: '1' })).toBe('');
      expect(errorOf({ kind: 'checkIn', value: '5' })).toBe('');
      expect(errorOf({ kind: 'checkIn', value: '0' })).toBe(
         'Mood must be between 1 and 5.',
      );
      expect(errorOf({ kind: 'checkIn', value: '6' })).toBe(
         'Mood must be between 1 and 5.',
      );
      expect(errorOf({ kind: 'checkIn', value: '3.5' })).toBe(
         'Mood must be a whole number.',
      );
   });

   it('treats the check-in note as optional', () => {
      const parsed = parseReadingForm({ kind: 'checkIn', value: '4' }, BASE);
      expect(parsed.ok && parsed.value.note).toBe('');
      expect(parsed.ok && parsed.value.value2).toBe(0);
   });

   it('limits the optional note on other kinds', () => {
      expect(
         errorOf({ kind: 'weight', value: '60', note: 'x'.repeat(1001) }),
      ).toBe('Note must be 1000 characters or fewer.');
   });

   it('rejects an unknown or missing kind', () => {
      expect(errorOf({ kind: 'pulse', value: '70' })).toBe(
         'Choose what to record.',
      );
      expect(errorOf({ value: '70' })).toBe('Choose what to record.');
   });
});

describe('chartSeries', () => {
   const readings = [
      makeReading({ id: 'a', kind: 'glucose', value: 110, at: NOON }),
      makeReading({ id: 'b', kind: 'bloodPressure', value: 130, at: NOON }),
      makeReading({
         id: 'c',
         kind: 'glucose',
         value: 95,
         at: NOON - 2*MS_PER_DAY,
      }),
   ];

   it('keeps only readings of the requested kind', () => {
      const series = chartSeries(readings, 'glucose', NOON, 30);
      expect(series.map((point) => point.value)).toEqual([95, 110]);
   });

   it('returns oldest first without changing the input order', () => {
      const before = readings.map((reading) => reading.id);
      const series = chartSeries(readings, 'glucose', NOON, 30);
      expect(series.map((point) => point.at)).toEqual([
         NOON - 2*MS_PER_DAY,
         NOON,
      ]);
      expect(readings.map((reading) => reading.id)).toEqual(before);
   });

   it('includes the window start and excludes the instant before it', () => {
      const start = NOON - 7*MS_PER_DAY;
      const edge = [
         makeReading({ id: 'edge', kind: 'weight', value: 70, at: start }),
         makeReading({ id: 'old', kind: 'weight', value: 71, at: start - 1 }),
      ];
      const series = chartSeries(edge, 'weight', NOON, 7);
      expect(series.map((point) => point.value)).toEqual([70]);
   });

   it('excludes readings recorded after now', () => {
      const future = [
         makeReading({ id: 'later', kind: 'weight', value: 80, at: NOON + 1 }),
      ];
      expect(chartSeries(future, 'weight', NOON, 30)).toEqual([]);
   });

   it('carries value2 for blood pressure pairs', () => {
      const pressure = [
         makeReading({ value: 120, value2: 80, at: NOON }),
      ];
      expect(chartSeries(pressure, 'bloodPressure', NOON, 30)).toEqual([
         { at: NOON, value: 120, value2: 80 },
      ]);
   });
});
