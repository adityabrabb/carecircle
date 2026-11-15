/**
 * Tests for dose confirmation, adherence, refills and escalation.
 */
import { describe, expect, it } from 'vitest';
import {
   CARETAKER_DELAY_MINUTES,
   FAMILY_DELAY_MINUTES,
   LEVEL_CARETAKER,
   LEVEL_ELDER,
   LEVEL_FAMILY,
   MS_PER_DAY,
   MS_PER_HOUR,
   MS_PER_MINUTE,
} from '@/constants/care';
import { adherenceByDay, summariseAdherence } from '@/domain/adherence';
import {
   acknowledgeDose,
   confirmDose,
   evidenceFor,
   isOpen,
   stockChange,
} from '@/domain/doses';
import {
   isQuietHour,
   levelDue,
   nextEscalation,
} from '@/domain/escalation';
import { forecastAll, forecastRefill } from '@/domain/refill';
import {
   makeDose,
   makeMedication,
   makeMember,
   NOON,
} from './fixtures';

const IST = 330;
const elderTap = {
   status: 'taken',
   byId: 'elder-1',
   byRole: 'elder',
   method: 'assumed',
   reason: '',
} as const;

describe('confirmDose', () => {
   it('records the elder’s own tap as self evidence', () => {
      const result = confirmDose(makeDose(), elderTap, NOON);
      expect(result.ok).toBe(true);
      if (result.ok) {
         expect(result.value.status).toBe('taken');
         expect(result.value.confirmMethod).toBe('self');
         expect(result.value.resolvedAt).toBe(NOON);
      }
   });

   it('refuses to confirm a dose twice, to prevent doubling up', () => {
      const taken = makeDose({ status: 'taken' });
      const result = confirmDose(taken, elderTap, NOON);
      expect(result.ok).toBe(false);
   });

   it('lets an unsure dose be resolved later', () => {
      const unsure = makeDose({ status: 'unsure' });
      const result = confirmDose(
         unsure,
         { ...elderTap, byRole: 'caretaker', method: 'observed' },
         NOON,
      );
      expect(result.ok && result.value.confirmMethod).toBe('observed');
   });

   it('refuses a dose that is far in the future', () => {
      const later = makeDose({ dueAt: NOON + 3*MS_PER_HOUR });
      expect(confirmDose(later, elderTap, NOON).ok).toBe(false);
   });

   it('lets only the elder choose to skip', () => {
      const skip = { ...elderTap, status: 'skipped', reason: ' upset ' } as const;
      const byElder = confirmDose(makeDose(), skip, NOON);
      expect(byElder.ok && byElder.value.reason).toBe('upset');
      expect(byElder.ok && byElder.value.confirmMethod).toBe('');
      const byHelper = confirmDose(
         makeDose(),
         { ...skip, byRole: 'family' },
         NOON,
      );
      expect(byHelper.ok).toBe(false);
   });

   it('grades a helper’s evidence', () => {
      expect(evidenceFor('caretaker', 'observed')).toBe('observed');
      expect(evidenceFor('family', 'self')).toBe('assumed');
      expect(evidenceFor('elder', 'assumed')).toBe('self');
   });
});

describe('dose helpers', () => {
   it('acknowledges only doses that are still open', () => {
      expect(acknowledgeDose(makeDose(), 'family-1').acknowledgedById).toBe(
         'family-1',
      );
      const taken = makeDose({ status: 'taken' });
      expect(acknowledgeDose(taken, 'family-1').acknowledgedById).toBe('');
   });

   it('knows which doses are open', () => {
      expect(isOpen(makeDose())).toBe(true);
      expect(isOpen(makeDose({ status: 'unsure' }))).toBe(true);
      expect(isOpen(makeDose({ status: 'skipped' }))).toBe(false);
   });

   it('lowers stock only when a dose becomes taken', () => {
      expect(stockChange('unconfirmed', 'taken', 2)).toBe(-2);
      expect(stockChange('unconfirmed', 'skipped', 2)).toBe(0);
      expect(stockChange('unconfirmed', 'unsure', 2)).toBe(0);
      expect(stockChange('taken', 'taken', 2)).toBe(0);
   });
});

describe('summariseAdherence', () => {
   const doses = [
      makeDose({ id: '1', status: 'taken', confirmMethod: 'self' }),
      makeDose({ id: '2', status: 'taken', confirmMethod: 'assumed' }),
      makeDose({ id: '3', status: 'skipped' }),
      makeDose({ id: '4', status: 'unsure' }),
      makeDose({ id: '5', dueAt: NOON - MS_PER_HOUR }),
      makeDose({ id: '6', dueAt: NOON + MS_PER_HOUR }),
   ];

   it('keeps unconfirmed apart from skipped and ignores the future', () => {
      const summary = summariseAdherence(doses, NOON);
      expect(summary.due).toBe(5);
      expect(summary.taken).toBe(2);
      expect(summary.skipped).toBe(1);
      expect(summary.unsure).toBe(1);
      expect(summary.unconfirmed).toBe(1);
      expect(summary.takenPercent).toBe(40);
   });

   it('reports how firm the evidence is', () => {
      const summary = summariseAdherence(doses, NOON);
      expect(summary.firmEvidence).toBe(1);
      expect(summary.assumedEvidence).toBe(1);
   });

   it('returns zero percent when nothing was due', () => {
      expect(summariseAdherence([], NOON).takenPercent).toBe(0);
   });

   it('groups by day, oldest first', () => {
      const days = adherenceByDay(
         [
            makeDose({ id: 'b', dateKey: '2026-11-15' }),
            makeDose({ id: 'a', dateKey: '2026-11-14', status: 'taken' }),
         ],
         NOON,
      );
      expect(days.map((day) => day.dateKey)).toEqual([
         '2026-11-14',
         '2026-11-15',
      ]);
      expect(days[0]?.summary.takenPercent).toBe(100);
   });
});

describe('refill forecast', () => {
   it('estimates days left from stock and daily use', () => {
      const forecast = forecastRefill(makeMedication({ stock: 30 }), NOON);
      expect(forecast.daysLeft).toBe(15);
      expect(forecast.runsOutAt).toBe(NOON + 15*MS_PER_DAY);
      expect(forecast.needsRefill).toBe(false);
   });

   it('asks for a refill inside the warning window', () => {
      const forecast = forecastRefill(makeMedication({ stock: 10 }), NOON);
      expect(forecast.daysLeft).toBe(5);
      expect(forecast.needsRefill).toBe(true);
   });

   it('never asks for a refill of a stopped medicine', () => {
      const forecast = forecastRefill(
         makeMedication({ stock: 0, status: 'stopped' }),
         NOON,
      );
      expect(forecast.needsRefill).toBe(false);
      expect(forecast.daysLeft).toBe(-1);
   });

   it('sorts the most urgent first and drops unknowns', () => {
      const all = forecastAll(
         [
            makeMedication({ id: 'a', stock: 40 }),
            makeMedication({ id: 'b', stock: 4 }),
            makeMedication({ id: 'c', status: 'stopped' }),
         ],
         NOON,
      );
      expect(all.map((forecast) => forecast.medicationId)).toEqual(['b', 'a']);
   });
});

describe('escalation ladder', () => {
   const members = [
      makeMember('elder'),
      makeMember('caretaker'),
      makeMember('family', { id: 'family-2', escalationOrder: 2 }),
      makeMember('family', { id: 'family-1', escalationOrder: 1 }),
   ];
   const due = makeDose({ dueAt: NOON });
   const minutes = (count: number) => NOON + count*MS_PER_MINUTE;

   it('works out the level a dose has reached', () => {
      expect(levelDue(due, minutes(-1))).toBe(0);
      expect(levelDue(due, minutes(1))).toBe(LEVEL_ELDER);
      expect(levelDue(due, minutes(CARETAKER_DELAY_MINUTES))).toBe(
         LEVEL_CARETAKER,
      );
      expect(levelDue(due, minutes(FAMILY_DELAY_MINUTES))).toBe(LEVEL_FAMILY);
   });

   it('reminds the elder first', () => {
      const step = nextEscalation(due, members, minutes(1), IST, false, false);
      expect(step?.level).toBe(LEVEL_ELDER);
      expect(step?.recipients.map((member) => member.role)).toEqual(['elder']);
   });

   it('climbs one level per call so no email is skipped', () => {
      const late = minutes(FAMILY_DELAY_MINUTES + 5);
      const first = nextEscalation(due, members, late, IST, false, false);
      expect(first?.level).toBe(LEVEL_ELDER);
      const second = nextEscalation(
         { ...due, escalationLevel: LEVEL_ELDER },
         members,
         late,
         IST,
         false,
         false,
      );
      expect(second?.level).toBe(LEVEL_CARETAKER);
      const third = nextEscalation(
         { ...due, escalationLevel: LEVEL_CARETAKER },
         members,
         late,
         IST,
         false,
         false,
      );
      expect(third?.level).toBe(LEVEL_FAMILY);
      expect(third?.recipients.map((member) => member.id)).toEqual([
         'family-1',
         'family-2',
      ]);
   });

   it('stops once the dose is resolved', () => {
      const taken = makeDose({ status: 'taken', dueAt: NOON });
      expect(
         nextEscalation(taken, members, minutes(90), IST, false, false),
      ).toBeNull();
   });

   it('stops climbing when someone is handling it', () => {
      const handled = makeDose({
         dueAt: NOON,
         escalationLevel: LEVEL_ELDER,
         acknowledgedById: 'caretaker-1',
      });
      expect(
         nextEscalation(handled, members, minutes(90), IST, false, false),
      ).toBeNull();
   });

   it('tells nobody else while sharing is paused', () => {
      const reminded = makeDose({ dueAt: NOON, escalationLevel: LEVEL_ELDER });
      expect(
         nextEscalation(reminded, members, minutes(90), IST, false, true),
      ).toBeNull();
   });

   it('waits during quiet hours unless the medicine is critical', () => {
      const night = Date.parse('2026-11-15T18:00:00Z');
      const bedtime = makeDose({
         dueAt: night - 2*MS_PER_HOUR,
         escalationLevel: LEVEL_ELDER,
      });
      expect(isQuietHour(23)).toBe(true);
      expect(isQuietHour(12)).toBe(false);
      expect(
         nextEscalation(bedtime, members, night, IST, false, false),
      ).toBeNull();
      expect(
         nextEscalation(bedtime, members, night, IST, true, false)?.level,
      ).toBe(LEVEL_CARETAKER);
   });

   it('skips members who are inactive or have no email', () => {
      const quiet = [
         makeMember('elder'),
         makeMember('caretaker', { active: false }),
         makeMember('caretaker', { id: 'caretaker-2', email: '' }),
      ];
      const step = nextEscalation(
         makeDose({ dueAt: NOON, escalationLevel: LEVEL_ELDER }),
         quiet,
         minutes(45),
         IST,
         false,
         false,
      );
      expect(step?.recipients).toEqual([]);
   });
});
