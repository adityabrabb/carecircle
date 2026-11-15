/**
 * Tests for the overview pulse and the care timeline.
 */
import { describe, expect, it } from 'vitest';
import { MS_PER_HOUR } from '@/constants/care';
import type { Observation, ObservationKind } from '@/domain/patterns';
import { describeChange } from '@/domain/medicationForm';
import { buildPulse, type PulseInput } from '@/domain/pulse';
import { buildTimeline, type TimelineInput } from '@/domain/timeline';
import type {
   Appointment,
   ChangeProposal,
   HandoverNote,
   HealthReading,
   Medication,
   ProposalKind,
   ProposalStatus,
} from '@/domain/types';
import {
   makeDose,
   makeMedication,
   makeReading,
   makeTask,
   NOON,
   PROFILE_ID,
} from './fixtures';

// ----- Builders -----------------------------------------------------------

const whenText = (at: number): string => `at ${at}`;

function makeVisit(overrides: Partial<Appointment> = {}): Appointment {
   return {
      id: 'visit-1',
      profileId: PROFILE_ID,
      doctor: 'Dr. Rao',
      speciality: '',
      location: '',
      at: NOON + 24 * MS_PER_HOUR,
      notes: '',
      status: 'upcoming',
      outcome: '',
      remindersSent: [],
      ...overrides,
   };
}

function makeObservation(kind: ObservationKind, title: string): Observation {
   return { kind, title, advice: '' };
}

function makeProposal(
   status: ProposalStatus,
   kind: ProposalKind = 'addMedication',
   medication: Medication = makeMedication({ id: 'med-2' }),
): ChangeProposal {
   return {
      id: `proposal-${status}`,
      profileId: PROFILE_ID,
      kind,
      proposedById: 'family-1',
      medication,
      note: '',
      status,
      createdAt: NOON - 2 * MS_PER_HOUR,
      decidedAt: NOON - MS_PER_HOUR,
   };
}

function makePulseInput(overrides: Partial<PulseInput> = {}): PulseInput {
   return {
      now: NOON,
      doses: [],
      medications: [],
      tasks: [],
      appointments: [],
      pendingProposals: 0,
      observations: [],
      whenText,
      ...overrides,
   };
}

const EMPTY_TIMELINE: TimelineInput = {
   doses: [],
   medications: [],
   readings: [],
   appointments: [],
   handovers: [],
   documents: [],
   tasks: [],
   proposals: [],
   memberNames: new Map<string, string>(),
};

const names = new Map<string, string>([
   ['elder-1', 'Kamala'],
   ['family-1', 'Asha'],
]);

// ----- Pulse: doses -------------------------------------------------------

describe('buildPulse: doses', () => {
   it('asks about due doses that are not confirmed', () => {
      const doses = [makeDose({ id: 'a' }), makeDose({ id: 'b' })];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.needsAttention).toEqual([
         '2 doses due are not confirmed yet',
      ]);
   });

   it('uses singular wording for one unconfirmed dose', () => {
      const pulse = buildPulse(makePulseInput({ doses: [makeDose()] }));
      expect(pulse.needsAttention).toEqual([
         '1 dose due is not confirmed yet',
      ]);
   });

   it('reports doses marked not sure', () => {
      const doses = [makeDose({ status: 'unsure' })];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.needsAttention).toEqual(['1 dose marked not sure']);
   });

   it('says all due doses are recorded when each is taken or skipped', () => {
      const doses = [
         makeDose({ id: 'a', status: 'taken', dueAt: NOON - MS_PER_HOUR }),
         makeDose({ id: 'b', status: 'skipped', dueAt: NOON - 2 * MS_PER_HOUR }),
      ];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.onTrack).toEqual(['All 2 doses due so far are recorded']);
      expect(pulse.needsAttention).toEqual([]);
   });

   it('uses singular wording when one dose is recorded', () => {
      const doses = [makeDose({ status: 'taken', dueAt: NOON - MS_PER_HOUR })];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.onTrack).toEqual(['The dose due so far is recorded']);
   });

   it('does not claim all recorded while one dose is unsure', () => {
      const doses = [
         makeDose({ id: 'a', status: 'taken', dueAt: NOON - MS_PER_HOUR }),
         makeDose({ id: 'b', status: 'unsure', dueAt: NOON - MS_PER_HOUR }),
      ];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.onTrack).toEqual([]);
      expect(pulse.needsAttention).toEqual(['1 dose marked not sure']);
   });

   it('counts later doses as coming up, not as needing attention', () => {
      const doses = [
         makeDose({ id: 'later', dueAt: NOON + MS_PER_HOUR }),
         makeDose({ id: 'later-2', dueAt: NOON + 2 * MS_PER_HOUR }),
      ];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.needsAttention).toEqual([]);
      expect(pulse.onTrack).toEqual([]);
      expect(pulse.upcoming).toEqual(['2 more doses later today']);
   });

   it('uses singular wording for one later dose', () => {
      const doses = [makeDose({ dueAt: NOON + MS_PER_HOUR })];
      const pulse = buildPulse(makePulseInput({ doses }));
      expect(pulse.upcoming).toEqual(['1 more dose later today']);
   });
});

// ----- Pulse: tasks, refills, changes, patterns ---------------------------

describe('buildPulse: tasks, refills and other lines', () => {
   it('lists each overdue open task on its own line', () => {
      const tasks = [
         makeTask({ id: 't1', title: 'Pay pharmacy', dueAt: NOON - 1000 }),
         makeTask({ id: 't2', title: 'Call Dr. Rao', dueAt: NOON - 2000 }),
      ];
      const pulse = buildPulse(makePulseInput({ tasks }));
      expect(pulse.needsAttention).toEqual([
         'Overdue: Call Dr. Rao',
         'Overdue: Pay pharmacy',
      ]);
      expect(pulse.onTrack).toEqual([]);
   });

   it('says no tasks are overdue when open tasks are all in time', () => {
      const tasks = [makeTask({ dueAt: NOON + 30 * MS_PER_HOUR })];
      const pulse = buildPulse(makePulseInput({ tasks }));
      expect(pulse.onTrack).toEqual(['No tasks are overdue']);
      expect(pulse.upcoming).toEqual([]);
   });

   it('lists open tasks due within 24 hours as due soon', () => {
      const tasks = [makeTask({ title: 'Blood test', dueAt: NOON + MS_PER_HOUR })];
      const pulse = buildPulse(makePulseInput({ tasks }));
      expect(pulse.upcoming).toEqual(['Due soon: Blood test']);
   });

   it('ignores completed tasks entirely', () => {
      const tasks = [
         makeTask({ status: 'done', dueAt: NOON - MS_PER_HOUR, doneAt: NOON }),
      ];
      const pulse = buildPulse(makePulseInput({ tasks }));
      expect(pulse).toEqual({
         onTrack: [],
         needsAttention: [],
         upcoming: [],
      });
   });

   it('flags a medicine that will run out within a week', () => {
      // Two doses a day from two anchors, so four tablets is two days.
      const medications = [
         makeMedication({ name: 'Metformin', stock: 4 }),
         makeMedication({ id: 'med-2', name: 'Plenty', stock: 100 }),
      ];
      const pulse = buildPulse(makePulseInput({ medications }));
      expect(pulse.needsAttention).toEqual([
         'Metformin: about 2 days left',
      ]);
   });

   it('uses singular wording for one day of medicine left', () => {
      const medications = [makeMedication({ stock: 2 })];
      const pulse = buildPulse(makePulseInput({ medications }));
      expect(pulse.needsAttention).toEqual(['Metformin: about 1 day left']);
   });

   it('never forecasts a stopped medicine', () => {
      const medications = [makeMedication({ status: 'stopped', stock: 0 })];
      const pulse = buildPulse(makePulseInput({ medications }));
      expect(pulse.needsAttention).toEqual([]);
   });

   it('reports medicine changes waiting for the elder', () => {
      const one = buildPulse(makePulseInput({ pendingProposals: 1 }));
      const two = buildPulse(makePulseInput({ pendingProposals: 2 }));
      expect(one.needsAttention).toEqual([
         "1 medicine change waiting for the elder's decision",
      ]);
      expect(two.needsAttention).toEqual([
         "2 medicine changes waiting for the elder's decision",
      ]);
   });

   it('shows at most three observation titles', () => {
      const observations = [
         makeObservation('missedTime', 'First'),
         makeObservation('unsureDoses', 'Second'),
         makeObservation('lowMood', 'Third'),
         makeObservation('weightChange', 'Fourth'),
      ];
      const pulse = buildPulse(makePulseInput({ observations }));
      expect(pulse.needsAttention).toEqual(['First', 'Second', 'Third']);
   });
});

// ----- Pulse: coming up and empty input -----------------------------------

describe('buildPulse: coming up and empty input', () => {
   it('lists visits within the next 48 hours with the doctor and time', () => {
      const at = NOON + 24 * MS_PER_HOUR;
      const appointments = [makeVisit({ at })];
      const pulse = buildPulse(makePulseInput({ appointments }));
      expect(pulse.upcoming).toEqual([`Dr. Rao, ${whenText(at)}`]);
   });

   it('leaves out visits beyond 48 hours, past visits and done visits', () => {
      const appointments = [
         makeVisit({ id: 'far', at: NOON + 49 * MS_PER_HOUR }),
         makeVisit({ id: 'now', at: NOON }),
         makeVisit({ id: 'done', status: 'done', at: NOON + MS_PER_HOUR }),
      ];
      const pulse = buildPulse(makePulseInput({ appointments }));
      expect(pulse.upcoming).toEqual([]);
   });

   it('sorts visits soonest first', () => {
      const appointments = [
         makeVisit({ id: 'later', doctor: 'Dr. B', at: NOON + 20 * MS_PER_HOUR }),
         makeVisit({ id: 'sooner', doctor: 'Dr. A', at: NOON + MS_PER_HOUR }),
      ];
      const pulse = buildPulse(makePulseInput({ appointments }));
      expect(pulse.upcoming).toEqual([
         `Dr. A, ${whenText(NOON + MS_PER_HOUR)}`,
         `Dr. B, ${whenText(NOON + 20 * MS_PER_HOUR)}`,
      ]);
   });

   it('returns empty lists, never zero-count lines, for empty input', () => {
      const pulse = buildPulse(makePulseInput());
      expect(pulse).toEqual({
         onTrack: [],
         needsAttention: [],
         upcoming: [],
      });
   });
});

// ----- Timeline: doses ----------------------------------------------------

describe('buildTimeline: doses', () => {
   const medications = [makeMedication()];
   const at = NOON - MS_PER_HOUR;

   it('shows a taken dose at the time it was resolved', () => {
      const doses = [makeDose({ status: 'taken', resolvedAt: at })];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, doses, medications },
         NOON,
         10,
      );
      expect(timeline).toEqual([
         { at, kind: 'dose', text: 'Metformin taken' },
      ]);
   });

   it('notes when a helper saw or assumed the dose was taken', () => {
      const seen = makeDose({
         status: 'taken',
         confirmMethod: 'observed',
         resolvedAt: at,
      });
      const assumed = makeDose({
         id: 'b',
         status: 'taken',
         confirmMethod: 'assumed',
         resolvedAt: at,
      });
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, doses: [seen, assumed], medications },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Metformin taken (seen by a helper)',
         'Metformin taken (assumed by a helper)',
      ]);
   });

   it('gives the reason for a skipped dose, and leaves it out if none', () => {
      const withReason = makeDose({
         status: 'skipped',
         reason: 'Felt sick',
         resolvedAt: at,
      });
      const without = makeDose({
         id: 'b',
         status: 'skipped',
         resolvedAt: at - 1,
      });
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, doses: [withReason, without], medications },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Metformin skipped by choice: Felt sick',
         'Metformin skipped by choice',
      ]);
   });

   it('shows a not-sure answer as a question, not as taken', () => {
      const doses = [makeDose({ status: 'unsure', resolvedAt: at })];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, doses, medications },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Metformin: not sure if taken',
      ]);
   });

   it('leaves unconfirmed doses out of the timeline', () => {
      const doses = [makeDose({ status: 'unconfirmed' })];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, doses, medications },
         NOON,
         10,
      );
      expect(timeline).toEqual([]);
   });
});

// ----- Timeline: other entry types ----------------------------------------

describe('buildTimeline: other entries', () => {
   const at = NOON - MS_PER_HOUR;

   it('describes each kind of health reading in plain words', () => {
      const readings: HealthReading[] = [
         makeReading({ id: 'bp', value: 138, value2: 86, at }),
         makeReading({ id: 'bg', kind: 'glucose', value: 150, at }),
         makeReading({ id: 'wt', kind: 'weight', value: 61.2, at }),
         makeReading({
            id: 'sym',
            kind: 'symptom',
            note: 'Dizzy',
            at,
         }),
         makeReading({ id: 'mood', kind: 'checkIn', value: 4, at }),
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, readings },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Blood pressure 138/86',
         'Blood sugar 150 mg/dL',
         'Weight 61.2 kg',
         'Symptom: Dizzy',
         'Check-in: Good',
      ]);
      expect(timeline.every((entry) => entry.kind === 'reading')).toBe(true);
   });

   it('shows visits that are over or cancelled, not upcoming ones', () => {
      const appointments = [
         makeVisit({ id: 'done', status: 'done', at }),
         makeVisit({ id: 'off', status: 'cancelled', at: at - 1 }),
         makeVisit({ id: 'next', status: 'upcoming', at: at - 2 }),
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, appointments },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Visited Dr. Rao',
         'Cancelled visit to Dr. Rao',
      ]);
   });

   it('names the author of a handover, or says Someone', () => {
      const handovers: HandoverNote[] = [
         {
            id: 'h1',
            profileId: PROFILE_ID,
            byId: 'family-1',
            text: 'Ate lunch well',
            at,
         },
         {
            id: 'h2',
            profileId: PROFILE_ID,
            byId: 'gone-9',
            text: 'Slept late',
            at: at - 1,
         },
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, handovers, memberNames: names },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Asha: Ate lunch well',
         'Someone: Slept late',
      ]);
   });

   it('says who added a record, using only its listed fields', () => {
      const documents = [
         {
            id: 'd1',
            title: 'Discharge note',
            at,
            uploadedById: 'family-1',
         },
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, documents, memberNames: names },
         NOON,
         10,
      );
      expect(timeline).toEqual([
         { at, kind: 'document', text: 'Asha added Discharge note' },
      ]);
   });

   it('shows completed tasks with who finished them', () => {
      const tasks = [
         makeTask({
            title: 'Refill',
            status: 'done',
            doneById: 'family-1',
            doneAt: at,
         }),
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, tasks, memberNames: names },
         NOON,
         10,
      );
      expect(timeline).toEqual([
         { at, kind: 'task', text: 'Asha finished: Refill' },
      ]);
   });

   it('shows decided medicine changes and leaves pending ones out', () => {
      const medication = makeMedication({
         id: 'med-2',
         name: 'B12',
         strength: '1000 mcg',
         anchors: ['breakfast'],
         food: 'any',
      });
      const change = describeChange('addMedication', medication);
      const proposals = [
         makeProposal('approved', 'addMedication', medication),
         makeProposal('rejected', 'addMedication', medication),
         makeProposal('emergencyApplied', 'addMedication', medication),
         makeProposal('pending', 'addMedication', medication),
      ];
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, proposals },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         `${change} approved`,
         `${change} rejected`,
         `${change} applied under the emergency plan`,
      ]);
      expect(timeline.every((entry) => entry.kind === 'change')).toBe(true);
   });
});

// ----- Timeline: order, cut-off and limit ---------------------------------

describe('buildTimeline: order, cut-off and limit', () => {
   const readings = [
      makeReading({ id: 'old', kind: 'weight', value: 60, at: NOON - 3000 }),
      makeReading({ id: 'new', kind: 'weight', value: 61, at: NOON - 1000 }),
      makeReading({ id: 'mid', kind: 'weight', value: 62, at: NOON - 2000 }),
   ];

   it('lists the newest entries first', () => {
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, readings },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Weight 61.0 kg',
         'Weight 62.0 kg',
         'Weight 60.0 kg',
      ]);
   });

   it('leaves out anything after now, and keeps anything exactly at now', () => {
      const future = makeReading({
         id: 'future',
         kind: 'symptom',
         note: 'Later',
         at: NOON + 1,
      });
      const atNow = makeReading({
         id: 'now',
         kind: 'symptom',
         note: 'Right now',
         at: NOON,
      });
      const timeline = buildTimeline(
         { ...EMPTY_TIMELINE, readings: [future, atNow] },
         NOON,
         10,
      );
      expect(timeline.map((entry) => entry.text)).toEqual([
         'Symptom: Right now',
      ]);
   });

   it('keeps only the newest entries up to the limit', () => {
      const two = buildTimeline({ ...EMPTY_TIMELINE, readings }, NOON, 2);
      expect(two.map((entry) => entry.text)).toEqual([
         'Weight 61.0 kg',
         'Weight 62.0 kg',
      ]);
   });

   it('returns nothing for a limit of zero', () => {
      const none = buildTimeline({ ...EMPTY_TIMELINE, readings }, NOON, 0);
      expect(none).toEqual([]);
   });
});
