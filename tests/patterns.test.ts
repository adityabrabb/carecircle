/**
 * Tests for pattern detection and the visit brief.
 */
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, MS_PER_HOUR } from '@/constants/care';
import { detectPatterns } from '@/domain/patterns';
import type { Appointment } from '@/domain/types';
import { briefStart, buildVisitBrief } from '@/domain/visitBrief';
import {
   makeDose,
   makeMedication,
   makeReading,
   NOON,
   PROFILE_ID,
} from './fixtures';

/** Purpose: an instant a number of days before the test's "now". */
const daysAgo = (days: number): number => NOON - days*MS_PER_DAY;

/** Purpose: blood pressure readings, oldest first, one per day. */
function pressures(values: readonly (readonly [number, number])[]) {
   return values.map(([value, value2], index) =>
      makeReading({
         id: `bp-${index}`,
         value,
         value2,
         at: daysAgo(values.length - index),
      }),
   );
}

const kinds = (
   doses: Parameters<typeof detectPatterns>[0],
   readings: Parameters<typeof detectPatterns>[1],
) => detectPatterns(doses, readings, NOON).map((found) => found.kind);

describe('detectPatterns: medicines', () => {
   const missed = [1, 2, 4].map((days) =>
      makeDose({
         id: `sleep-${days}`,
         anchor: 'sleep',
         dateKey: `day-${days}`,
         dueAt: daysAgo(days),
      }),
   );

   it('flags a time of day that often goes unconfirmed', () => {
      const found = detectPatterns(missed, [], NOON);
      expect(found[0]?.kind).toBe('missedTime');
      expect(found[0]?.title).toContain('Bedtime');
      expect(found[0]?.title).toContain('3 of the last 7 days');
   });

   it('never suggests changing the timing without the doctor', () => {
      const found = detectPatterns(missed, [], NOON);
      expect(found[0]?.advice).toContain('Do not change the timing');
   });

   it('ignores doses that are not yet due, resolved, or too old', () => {
      const doses = [
         makeDose({
            id: 'future',
            anchor: 'sleep',
            dueAt: NOON + MS_PER_HOUR,
         }),
         makeDose({
            id: 'taken',
            anchor: 'sleep',
            status: 'taken',
            dueAt: daysAgo(1),
            dateKey: 'a',
         }),
         makeDose({
            id: 'old',
            anchor: 'sleep',
            dueAt: daysAgo(9),
            dateKey: 'b',
         }),
         ...missed.slice(0, 2),
      ];
      expect(kinds(doses, [])).toEqual([]);
   });

   it('flags repeated not-sure answers', () => {
      const doses = [1, 2].map((days) =>
         makeDose({ id: `u-${days}`, status: 'unsure', dueAt: daysAgo(days) }),
      );
      expect(kinds(doses, [])).toEqual(['unsureDoses']);
      expect(kinds(doses.slice(0, 1), [])).toEqual([]);
   });
});

describe('detectPatterns: readings', () => {
   it('flags a rising run of blood pressure', () => {
      const readings = pressures([
         [120, 78],
         [124, 80],
         [128, 82],
      ]);
      expect(kinds([], readings)).toEqual(['pressureRising']);
   });

   it('flags a high latest reading with a caveat about targets', () => {
      const found = detectPatterns([], pressures([[150, 92]]), NOON);
      expect(found[0]?.kind).toBe('pressureHigh');
      expect(found[0]?.advice).toContain('different target');
   });

   it('stays quiet for steady, normal readings', () => {
      const readings = pressures([
         [122, 80],
         [118, 78],
         [121, 79],
      ]);
      expect(kinds([], readings)).toEqual([]);
   });

   it('flags blood sugar outside the reference, either way', () => {
      const high = makeReading({ kind: 'glucose', value: 210, value2: 0 });
      const low = makeReading({ kind: 'glucose', value: 60, value2: 0 });
      const fine = makeReading({ kind: 'glucose', value: 120, value2: 0 });
      expect(kinds([], [high])).toEqual(['glucoseHigh']);
      expect(kinds([], [low])).toEqual(['glucoseLow']);
      expect(kinds([], [fine])).toEqual([]);
   });

   it('groups a symptom noted more than once', () => {
      const readings = [
         makeReading({
            id: 's1',
            kind: 'symptom',
            note: 'Dizzy after lunch',
            at: daysAgo(2),
         }),
         makeReading({
            id: 's2',
            kind: 'symptom',
            note: 'Dizzy after lunch again',
            at: daysAgo(1),
         }),
         makeReading({
            id: 's3',
            kind: 'symptom',
            note: 'Knee pain',
            at: daysAgo(1),
         }),
      ];
      const found = detectPatterns([], readings, NOON);
      expect(found.map((item) => item.kind)).toEqual(['repeatedSymptom']);
      expect(found[0]?.title).toContain('2 times');
   });

   it('flags a low check-in and a notable weight change', () => {
      const readings = [
         makeReading({ id: 'm', kind: 'checkIn', value: 2, value2: 0 }),
         makeReading({
            id: 'w1',
            kind: 'weight',
            value: 64,
            value2: 0,
            at: daysAgo(6),
         }),
         makeReading({
            id: 'w2',
            kind: 'weight',
            value: 61.5,
            value2: 0,
            at: daysAgo(1),
         }),
      ];
      expect(kinds([], readings)).toEqual(['lowMood', 'weightChange']);
   });

   it('reports nothing when there is no data', () => {
      expect(detectPatterns([], [], NOON)).toEqual([]);
   });
});

describe('visit brief', () => {
   const visit = (overrides: Partial<Appointment>): Appointment => ({
      id: 'next',
      profileId: PROFILE_ID,
      doctor: 'Dr. Rao',
      speciality: '',
      location: '',
      at: NOON + 2*MS_PER_DAY,
      notes: '',
      status: 'upcoming',
      outcome: '',
      remindersSent: [],
      ...overrides,
   });

   it('starts from the last completed visit', () => {
      const next = visit({});
      const all = [
         next,
         visit({ id: 'old', status: 'done', at: daysAgo(40) }),
         visit({ id: 'last', status: 'done', at: daysAgo(20) }),
         visit({ id: 'cancelled', status: 'cancelled', at: daysAgo(5) }),
      ];
      expect(briefStart(next, all, NOON)).toBe(daysAgo(20));
   });

   it('looks back a month when there is no earlier visit', () => {
      const next = visit({});
      expect(briefStart(next, [next], NOON)).toBe(daysAgo(30));
   });

   it('summarises only the period since the last visit', () => {
      const brief = buildVisitBrief(
         daysAgo(10),
         NOON,
         [
            makeMedication({ id: 'kept', updatedAt: daysAgo(30) }),
            makeMedication({ id: 'new', name: 'B12', updatedAt: daysAgo(2) }),
            makeMedication({
               id: 'gone',
               name: 'Old',
               status: 'stopped',
               updatedAt: daysAgo(3),
            }),
            makeMedication({
               id: 'wait',
               name: 'Maybe',
               status: 'pendingApproval',
               updatedAt: daysAgo(1),
            }),
         ],
         [
            makeDose({
               id: 'in',
               status: 'taken',
               confirmMethod: 'self',
               dueAt: daysAgo(3),
            }),
            makeDose({
               id: 'skip',
               status: 'skipped',
               reason: 'Felt sick',
               dueAt: daysAgo(2),
            }),
            makeDose({ id: 'before', status: 'taken', dueAt: daysAgo(15) }),
         ],
         [
            makeReading({ id: 'r1', value: 130, value2: 84, at: daysAgo(8) }),
            makeReading({ id: 'r2', value: 138, value2: 86, at: daysAgo(1) }),
            makeReading({ id: 'r0', value: 110, value2: 70, at: daysAgo(20) }),
            makeReading({
               id: 's',
               kind: 'symptom',
               note: 'Dizzy',
               at: daysAgo(1),
            }),
         ],
         [
            {
               id: 'q1',
               profileId: PROFILE_ID,
               text: 'Why dizzy?',
               at: daysAgo(1),
               answered: false,
            },
            {
               id: 'q2',
               profileId: PROFILE_ID,
               text: 'Old one',
               at: daysAgo(9),
               answered: true,
            },
         ],
      );
      expect(brief.adherence.due).toBe(2);
      expect(brief.adherence.takenPercent).toBe(50);
      expect(brief.skipReasons).toEqual(['Felt sick']);
      expect(brief.currentMedicines).toHaveLength(2);
      expect(brief.medicineChanges).toEqual([
         'B12 was added or changed',
         'Old was stopped',
      ]);
      expect(brief.readingChanges).toEqual([
         {
            label: 'Blood pressure',
            first: '130/84',
            latest: '138/86',
            count: 2,
         },
      ]);
      expect(brief.symptoms).toEqual(['Dizzy']);
      expect(brief.questions).toEqual(['Why dizzy?']);
   });
});
