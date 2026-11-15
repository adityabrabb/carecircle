/**
 * Tests for the ask-the-records answers and the AI fact list.
 */
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, MS_PER_HOUR } from '@/constants/care';
import {
   answerQuestion,
   type CareFacts,
   factLines,
   SUGGESTED_QUESTIONS,
} from '@/domain/assistant';
import type {
   Appointment,
   DocumentKind,
   DocumentRecord,
   DoctorQuestion,
} from '@/domain/types';
import {
   makeDose,
   makeMedication,
   makeReading,
   makeTask,
   NOON,
   PROFILE_ID,
} from './fixtures';

const NOT_UNDERSTOOD =
   'I can only answer from what is recorded here. ' +
   'Try one of the questions below.';

const MEDICINES = { label: 'Medicines', href: '/medicines' };
const CIRCLE = { label: 'Circle', href: '/circle' };
const APPOINTMENTS = { label: 'Appointments', href: '/appointments' };
const HEALTH = { label: 'Health', href: '/health' };

/** Purpose: a facts bundle with nothing recorded, overridden per test. */
function facts(overrides: Partial<CareFacts> = {}): CareFacts {
   return {
      now: NOON,
      elderName: 'Kamala',
      whenText: (at) => `at ${at}`,
      medications: [],
      doses: [],
      readings: [],
      appointments: [],
      tasks: [],
      questions: [],
      documents: [],
      memberNames: new Map([['family-1', 'Priya']]),
      ...overrides,
   };
}

/** Purpose: an appointment with sensible defaults, two days ahead. */
function visit(overrides: Partial<Appointment> = {}): Appointment {
   return {
      id: 'visit-1',
      profileId: PROFILE_ID,
      doctor: 'Dr. Rao',
      speciality: '',
      location: 'Clinic 2',
      at: NOON + 2*MS_PER_DAY,
      notes: '',
      status: 'upcoming',
      outcome: '',
      remindersSent: [],
      ...overrides,
   };
}

/** Purpose: a stored document's summary fields used by the assistant. */
function doc(
   id: string,
   title: string,
   kind: DocumentKind,
   at: number,
): Pick<DocumentRecord, 'id' | 'title' | 'kind' | 'at'> {
   return { id, title, kind, at };
}

/** Purpose: an unanswered or answered doctor question. */
function question(
   id: string,
   text: string,
   answered: boolean,
): DoctorQuestion {
   return { id, profileId: PROFILE_ID, text, at: NOON, answered };
}

describe('answerQuestion: refills', () => {
   it('lists medicines that will run out soon, with days left', () => {
      const low = makeMedication({ name: 'Calcium', stock: 2 });
      const answer = answerQuestion(
         'What is running low?',
         facts({ medications: [low] }),
      );
      expect(answer.understood).toBe(true);
      expect(answer.lines).toEqual(['Calcium: 2 left, about 1 day']);
      expect(answer.sources).toEqual([MEDICINES]);
   });

   it('says nothing is low when stock lasts beyond the warning', () => {
      const answer = answerQuestion(
         'What is running low?',
         facts({ medications: [makeMedication({ stock: 30 })] }),
      );
      expect(answer.lines).toEqual(['No medicine is running low.']);
   });

   it('ignores stopped medicines', () => {
      const stopped = makeMedication({
         name: 'Old',
         stock: 1,
         status: 'stopped',
      });
      const answer = answerQuestion(
         'Which medicines are running low?',
         facts({ medications: [stopped] }),
      );
      expect(answer.lines[0]).toBe('No medicine is running low.');
   });
});

describe('answerQuestion: tasks', () => {
   it('lists open tasks soonest first, with owner and due time', () => {
      const tasks = [
         makeTask({
            id: 'later',
            title: 'Order refill',
            ownerId: 'family-1',
            dueAt: NOON + 2*MS_PER_DAY,
         }),
         makeTask({
            id: 'sooner',
            title: 'Call clinic',
            ownerId: 'family-1',
            dueAt: NOON + MS_PER_DAY,
         }),
      ];
      const answer = answerQuestion(
         'What tasks are open?',
         facts({ tasks }),
      );
      expect(answer.lines).toEqual([
         `Call clinic (owner: Priya, due at ${NOON + MS_PER_DAY})`,
         `Order refill (owner: Priya, due at ${NOON + 2*MS_PER_DAY})`,
      ]);
      expect(answer.sources).toEqual([CIRCLE]);
   });

   it('marks an overdue task with OVERDUE', () => {
      const tasks = [
         makeTask({
            title: 'Refill pickup',
            ownerId: 'family-1',
            dueAt: NOON - MS_PER_HOUR,
         }),
      ];
      const answer = answerQuestion('Any pending tasks?', facts({ tasks }));
      expect(answer.lines[0]).toContain('OVERDUE: Refill pickup');
   });

   it('reports no open tasks when every task is done', () => {
      const tasks = [makeTask({ status: 'done' })];
      const answer = answerQuestion('What is to do?', facts({ tasks }));
      expect(answer.lines).toEqual(['No tasks are open.']);
   });
});

describe('answerQuestion: visits', () => {
   it('gives the next upcoming visit with its notes and brief link', () => {
      const appointments = [
         visit({ id: 'later', doctor: 'Dr. Shah', at: NOON + 5*MS_PER_DAY }),
         visit({ id: 'next', notes: 'Bring the BP log' }),
      ];
      const answer = answerQuestion(
         'When is my next doctor visit?',
         facts({ appointments }),
      );
      expect(answer.lines).toEqual([
         `Dr. Rao, at ${NOON + 2*MS_PER_DAY}, Clinic 2`,
         'Remember: Bring the BP log',
      ]);
      expect(answer.sources).toEqual([
         APPOINTMENTS,
         { label: 'Visit brief', href: '/appointments/next' },
      ]);
   });

   it('says no visit is planned when none is upcoming', () => {
      const appointments = [
         visit({ status: 'done', at: NOON - 2*MS_PER_DAY }),
      ];
      const answer = answerQuestion(
         'When is my doctor visit?',
         facts({ appointments }),
      );
      expect(answer.lines).toEqual(['No visit is planned.']);
      expect(answer.sources).toEqual([APPOINTMENTS]);
   });

   it('adds unanswered questions and test tasks when asked to prepare', () => {
      const appointments = [visit()];
      const questions = [
         question('q1', 'Why dizzy?', false),
         question('q2', 'Old one', true),
      ];
      const tasks = [
         makeTask({
            id: 'lab',
            kind: 'test',
            title: 'Blood sugar test',
            ownerId: 'family-1',
            dueAt: NOON + MS_PER_DAY,
         }),
         makeTask({ id: 'post', kind: 'task', title: 'Pick up post' }),
      ];
      const answer = answerQuestion(
         'What should I prepare before my next visit?',
         facts({ appointments, questions, tasks }),
      );
      expect(answer.lines).toContain('Question for the doctor: Why dizzy?');
      expect(answer.lines).toContain(
         `Blood sugar test (owner: Priya, due at ${NOON + MS_PER_DAY})`,
      );
      expect(answer.lines.join('\n')).not.toContain('Old one');
      expect(answer.lines.join('\n')).not.toContain('Pick up post');
   });

   it('leaves out the preparation items when not asked', () => {
      const answer = answerQuestion(
         'When is my next doctor visit?',
         facts({
            appointments: [visit()],
            questions: [question('q1', 'Why dizzy?', false)],
         }),
      );
      expect(answer.lines.join('\n')).not.toContain('Why dizzy?');
   });
});

describe('answerQuestion: what changed', () => {
   it('reports the share of due doses that were taken', () => {
      const doses = [
         makeDose({
            id: 'a',
            status: 'taken',
            confirmMethod: 'self',
            dueAt: NOON - MS_PER_HOUR,
         }),
         makeDose({
            id: 'b',
            status: 'skipped',
            dueAt: NOON - MS_PER_HOUR,
         }),
      ];
      const answer = answerQuestion('What changed this week?', facts({ doses }));
      expect(answer.lines[0]).toBe('1 of 2 doses due were taken (50%)');
      expect(answer.sources).toEqual([MEDICINES, HEALTH]);
   });

   it('adds the patterns the record shows', () => {
      const readings = [
         makeReading({ id: 'r1', value: 120, at: NOON - 2*MS_PER_DAY }),
         makeReading({ id: 'r2', value: 124, at: NOON - MS_PER_DAY }),
         makeReading({ id: 'r3', value: 128, at: NOON }),
      ];
      const answer = answerQuestion(
         'What changed this week?',
         facts({ readings }),
      );
      expect(answer.lines[1]).toContain('Blood pressure has risen');
   });

   it('says nothing notable when there is no data', () => {
      const answer = answerQuestion('What changed this week?', facts());
      expect(answer.lines).toEqual([
         'Nothing notable is recorded for the last week.',
      ]);
   });
});

describe('answerQuestion: readings', () => {
   it('gives the latest blood pressure reading', () => {
      const readings = [
         makeReading({ id: 'old', value: 120, value2: 78, at: NOON - MS_PER_DAY }),
         makeReading({ id: 'new', value: 138, value2: 86, at: NOON }),
      ];
      const answer = answerQuestion(
         'What is my blood pressure?',
         facts({ readings }),
      );
      expect(answer.lines).toEqual([`Blood pressure 138/86 on at ${NOON}`]);
      expect(answer.sources).toEqual([HEALTH]);
   });

   it('gives only the kind the question names', () => {
      const readings = [
         makeReading({ kind: 'glucose', value: 110, value2: 0 }),
         makeReading({ id: 'bp', value: 120, value2: 80 }),
      ];
      const answer = answerQuestion('How is my sugar?', facts({ readings }));
      expect(answer.lines).toEqual([`Blood sugar 110 mg/dL on at ${NOON}`]);
   });

   it('gives all three kinds for a bare reading question', () => {
      const readings = [makeReading({ id: 'bp', value: 120, value2: 80 })];
      const answer = answerQuestion('Show my reading', facts({ readings }));
      expect(answer.lines).toEqual([
         `Blood pressure 120/80 on at ${NOON}`,
         'No blood sugar reading is recorded.',
         'No weight reading is recorded.',
      ]);
   });
});

describe('answerQuestion: medicines and records', () => {
   it('describes each active medicine and its schedule', () => {
      const answer = answerQuestion(
         'What do I take today?',
         facts({ medications: [makeMedication()] }),
      );
      expect(answer.lines).toEqual([
         'Metformin 500 mg: 1 at breakfast and at dinner, after food',
      ]);
      expect(answer.sources).toEqual([MEDICINES]);
   });

   it('lists the three newest records, each linked to its file', () => {
      const documents = [
         doc('d1', 'Old scan', 'other', NOON - 4*MS_PER_DAY),
         doc('d2', 'Lab report', 'labReport', NOON - MS_PER_DAY),
         doc('d3', 'Discharge', 'discharge', NOON - 2*MS_PER_DAY),
         doc('d4', 'Prescription A', 'prescription', NOON - 3*MS_PER_DAY),
      ];
      const answer = answerQuestion(
         'Show my prescriptions',
         facts({ documents }),
      );
      expect(answer.lines).toEqual([
         `Lab report (at ${NOON - MS_PER_DAY})`,
         `Discharge (at ${NOON - 2*MS_PER_DAY})`,
         `Prescription A (at ${NOON - 3*MS_PER_DAY})`,
      ]);
      expect(answer.sources.map((source) => source.href)).toEqual([
         '/records/d2/file',
         '/records/d3/file',
         '/records/d4/file',
      ]);
   });

   it('says no records are uploaded when there are none', () => {
      const answer = answerQuestion('Any records?', facts());
      expect(answer.lines).toEqual(['No records are uploaded.']);
      expect(answer.sources).toEqual([]);
   });
});

describe('answerQuestion: combined and fallback', () => {
   it('combines matching intents in the fixed order', () => {
      const answer = answerQuestion(
         'What do I take today and what tasks are open?',
         facts({
            medications: [makeMedication()],
            tasks: [makeTask({ title: 'Call clinic', ownerId: 'family-1' })],
         }),
      );
      expect(answer.lines[0]).toMatch(/^Call clinic \(owner: Priya/);
      expect(answer.lines[1]).toBe(
         'Metformin 500 mg: 1 at breakfast and at dinner, after food',
      );
      expect(answer.sources).toEqual([CIRCLE, MEDICINES]);
   });

   it('de-duplicates sources by link', () => {
      const answer = answerQuestion(
         'What changed this week and what medicine do I take?',
         facts({ medications: [makeMedication()] }),
      );
      expect(answer.sources).toEqual([MEDICINES, HEALTH]);
   });

   it('says so when no rule understands the question', () => {
      const answer = answerQuestion('What is the weather like?', facts());
      expect(answer).toEqual({
         understood: false,
         lines: [NOT_UNDERSTOOD],
         sources: [],
      });
   });

   it('understands every suggested question', () => {
      expect(SUGGESTED_QUESTIONS).toHaveLength(5);
      for (const suggested of SUGGESTED_QUESTIONS) {
         expect(answerQuestion(suggested, facts()).understood).toBe(true);
      }
   });
});

describe('factLines', () => {
   it('numbers the facts and names stock in tablets', () => {
      const lines = factLines(
         facts({
            medications: [makeMedication({ name: 'Calcium', stock: 5 })],
         }),
      );
      expect(lines[0]).toBe('[1] Calcium: 5 tablets left');
   });

   it('uses the singular for one tablet', () => {
      const lines = factLines(
         facts({
            medications: [makeMedication({ name: 'Iron', stock: 1 })],
         }),
      );
      expect(lines[0]).toBe('[1] Iron: 1 tablet left');
   });

   it('covers open tasks, readings and the adherence sentence', () => {
      const lines = factLines(
         facts({
            tasks: [makeTask({ title: 'Call clinic', ownerId: 'family-1' })],
            readings: [makeReading({ id: 'bp', value: 120, value2: 80 })],
            doses: [
               makeDose({
                  status: 'taken',
                  confirmMethod: 'self',
                  dueAt: NOON - MS_PER_HOUR,
               }),
            ],
         }),
      );
      expect(lines.join('\n')).toContain('Open task: Call clinic');
      expect(lines.join('\n')).toContain('No weight reading is recorded.');
      expect(lines[lines.length - 1]).toBe(
         `[${lines.length}] 1 of 1 doses due were taken (100%)`,
      );
   });

   it('never includes an email address', () => {
      const lines = factLines(
         facts({
            medications: [makeMedication()],
            tasks: [makeTask({ ownerId: 'family-1' })],
         }),
      );
      expect(lines.join('\n')).not.toMatch(/@/);
   });
});
