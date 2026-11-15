/**
 * Tests for local time and the routine-based medication schedule.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE } from '@/constants/care';
import {
   doseId,
   dosesPerDay,
   dueMinutes,
   isScheduledOn,
   mergeDay,
   plannedDoses,
} from '@/domain/schedule';
import {
   clockToMinutes,
   formatClock,
   formatLocal,
   isDateKey,
   localDateKey,
   localHour,
   localToInstant,
   minutesToClock,
   shiftDateKey,
} from '@/domain/time';
import { makeDose, makeMedication, NOON, TODAY } from './fixtures';

const IST = 330;

describe('time helpers', () => {
   it('converts clock text to minutes and back', () => {
      expect(clockToMinutes('08:30')).toBe(510);
      expect(minutesToClock(510)).toBe('08:30');
      expect(minutesToClock(-30)).toBe('23:30');
   });

   it('rejects text that is not a 24-hour time', () => {
      expect(clockToMinutes('24:00')).toBe(-1);
      expect(clockToMinutes('8:30')).toBe(-1);
      expect(clockToMinutes('')).toBe(-1);
   });

   it('finds the local day across the UTC date line', () => {
      const lateEveningUtc = Date.parse('2026-11-14T20:00:00Z');
      expect(localDateKey(lateEveningUtc, IST)).toBe('2026-11-15');
      expect(localDateKey(lateEveningUtc, 0)).toBe('2026-11-14');
   });

   it('validates date keys', () => {
      expect(isDateKey('2026-02-28')).toBe(true);
      expect(isDateKey('2026-02-30')).toBe(false);
      expect(isDateKey('15-11-2026')).toBe(false);
   });

   it('maps a local day and minute to the right instant', () => {
      expect(localToInstant(TODAY, 12*60, IST)).toBe(NOON);
      expect(Number.isNaN(localToInstant('bad', 0, IST))).toBe(true);
   });

   it('reads the local hour and shifts days', () => {
      expect(localHour(NOON, IST)).toBe(12);
      expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
   });

   it('formats times for people', () => {
      expect(formatClock(0)).toBe('12:00 AM');
      expect(formatClock(20*60 + 30)).toBe('8:30 PM');
      expect(formatLocal(NOON, IST)).toBe('15 Nov, 12:00 PM');
   });
});

describe('dueMinutes', () => {
   it('moves meal doses by the food rule', () => {
      expect(dueMinutes(DEFAULT_ROUTINE, 'breakfast', 'before')).toBe(480);
      expect(dueMinutes(DEFAULT_ROUTINE, 'breakfast', 'after')).toBe(540);
      expect(dueMinutes(DEFAULT_ROUTINE, 'breakfast', 'with')).toBe(510);
   });

   it('does not move doses that are not at a meal', () => {
      expect(dueMinutes(DEFAULT_ROUTINE, 'sleep', 'after')).toBe(22*60);
   });

   it('reports a broken routine time', () => {
      const routine = { ...DEFAULT_ROUTINE, lunch: 'noon' };
      expect(dueMinutes(routine, 'lunch', 'any')).toBe(-1);
   });
});

describe('plannedDoses', () => {
   it('plans one unconfirmed dose per anchor in day order', () => {
      const planned = plannedDoses(
         makeMedication({ anchors: ['dinner', 'breakfast'] }),
         DEFAULT_ROUTINE,
         TODAY,
         IST,
      );
      expect(planned.map((dose) => dose.anchor)).toEqual([
         'breakfast',
         'dinner',
      ]);
      expect(planned.every((dose) => dose.status === 'unconfirmed')).toBe(
         true,
      );
      expect(planned[0]?.id).toBe(doseId('med-1', TODAY, 'breakfast'));
      expect(planned[0]?.dueAt).toBe(localToInstant(TODAY, 540, IST));
   });

   it('plans nothing for a medicine awaiting approval or stopped', () => {
      for (const status of ['pendingApproval', 'stopped'] as const) {
         const planned = plannedDoses(
            makeMedication({ status }),
            DEFAULT_ROUTINE,
            TODAY,
            IST,
         );
         expect(planned).toEqual([]);
      }
   });

   it('respects start and end dates', () => {
      const medication = makeMedication({
         startDate: '2026-11-10',
         endDate: '2026-11-20',
      });
      expect(isScheduledOn(medication, '2026-11-09')).toBe(false);
      expect(isScheduledOn(medication, '2026-11-10')).toBe(true);
      expect(isScheduledOn(medication, '2026-11-21')).toBe(false);
   });

   it('skips an anchor whose routine time is invalid', () => {
      const planned = plannedDoses(
         makeMedication({ anchors: ['lunch'] }),
         { ...DEFAULT_ROUTINE, lunch: '' },
         TODAY,
         IST,
      );
      expect(planned).toEqual([]);
   });

   it('counts each anchor once per day', () => {
      const medication = makeMedication({
         anchors: ['breakfast', 'breakfast', 'sleep'],
      });
      expect(dosesPerDay(medication)).toBe(2);
   });
});

describe('mergeDay', () => {
   it('keeps stored records and creates only the missing ones', () => {
      const taken = makeDose({ id: 'a', status: 'taken', dueAt: 2 });
      const planned = [
         makeDose({ id: 'a', dueAt: 2 }),
         makeDose({ id: 'b', dueAt: 1 }),
      ];
      const merged = mergeDay(planned, [taken]);
      expect(merged.toCreate.map((dose) => dose.id)).toEqual(['b']);
      expect(merged.day.map((dose) => dose.id)).toEqual(['b', 'a']);
      expect(merged.day[1]?.status).toBe('taken');
   });
});
