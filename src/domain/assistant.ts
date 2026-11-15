/**
 * Ask the records.
 *
 * Purpose: answer a plain question from the stored records only, with a
 * link to where each fact lives. Keyword rules decide which facts to
 * show, and several can combine. When no rule understands the question
 * the answer says so instead of guessing. Pure functions: the caller
 * loads the records and formats the times.
 */
import { summariseAdherence } from '@/domain/adherence';
import type { AdherenceSummary } from '@/domain/adherence';
import { describeSchedule } from '@/domain/medicationForm';
import { detectPatterns } from '@/domain/patterns';
import { forecastAll } from '@/domain/refill';
import type {
   Appointment,
   DoctorQuestion,
   DocumentRecord,
   DoseRecord,
   HealthReading,
   Medication,
   Task,
} from '@/domain/types';
import { counted } from './text';

// ----- Types ------------------------------------------------------------

export interface CareFacts {
   now: number;
   elderName: string;
   /** Caller formats times; this module never reads the clock. */
   whenText: (at: number) => string;
   medications: readonly Medication[];
   /** Doses from the last 7 days only. */
   doses: readonly DoseRecord[];
   readings: readonly HealthReading[];
   appointments: readonly Appointment[];
   tasks: readonly Task[];
   questions: readonly DoctorQuestion[];
   documents: readonly Pick<DocumentRecord, 'id' | 'title' | 'kind' | 'at'>[];
   memberNames: ReadonlyMap<string, string>;
}

export interface AnswerSource {
   label: string;
   href: string;
}

export interface Answer {
   /** False when no rule matched the question. */
   understood: boolean;
   /** One fact per line, in plain language. */
   lines: string[];
   /** De-duplicated by href. */
   sources: AnswerSource[];
}

interface Part {
   lines: string[];
   sources: AnswerSource[];
}

interface ReadingKind {
   kind: HealthReading['kind'];
   words: readonly string[];
   label: string;
   show: (reading: HealthReading) => string;
}

// ----- Constants --------------------------------------------------------

/** The most recent documents listed for a records question. */
const LATEST_DOCUMENTS = 3;

const NOT_UNDERSTOOD =
   'I can only answer from what is recorded here. ' +
   'Try one of the questions below.';

const NOTHING_NOTABLE = 'Nothing notable is recorded for the last week.';

const SOURCE_MEDICINES: AnswerSource = {
   label: 'Medicines',
   href: '/medicines',
};
const SOURCE_CIRCLE: AnswerSource = { label: 'Circle', href: '/circle' };
const SOURCE_APPOINTMENTS: AnswerSource = {
   label: 'Appointments',
   href: '/appointments',
};
const SOURCE_HEALTH: AnswerSource = { label: 'Health', href: '/health' };

const REFILL_WORDS = ['refill', 'running low', 'stock', 'run out'];
const TASK_WORDS = ['task', 'pending', 'to do', 'needs to be done'];
const VISIT_WORDS = ['appointment', 'visit', 'doctor', 'prepare'];
const PREPARE_WORDS = ['prepare', 'before'];
const TREND_WORDS = [
   'what changed',
   'changed',
   'this week',
   'this month',
   'trend',
];
const MEDICINE_WORDS = ['medicine', 'tablet', 'what do i take', 'today'];
const RECORD_WORDS = ['prescription', 'report', 'record', 'document'];

const READING_KINDS: readonly ReadingKind[] = [
   {
      kind: 'bloodPressure',
      words: ['blood pressure', 'bp'],
      label: 'Blood pressure',
      show: (reading) => `${reading.value}/${reading.value2}`,
   },
   {
      kind: 'glucose',
      words: ['sugar', 'glucose'],
      label: 'Blood sugar',
      show: (reading) => `${reading.value} mg/dL`,
   },
   {
      kind: 'weight',
      words: ['weight'],
      label: 'Weight',
      show: (reading) => `${reading.value} kg`,
   },
];

/** A question about readings, with or without a kind named. */
const READING_WORDS = [
   ...READING_KINDS.flatMap((reading) => reading.words),
   'reading',
];

/** Questions offered as links; one per main intent. */
export const SUGGESTED_QUESTIONS: readonly string[] = [
   'Which medicines are running low?',
   'What tasks are still open?',
   'What should I prepare before my next visit?',
   'What changed this week?',
   'Which prescription records are uploaded?',
];

// ----- Helpers ----------------------------------------------------------

/**
 * Purpose: true when the lower-cased question uses any of the words, as
 * whole words, with an optional plural "s".
 */
function asks(text: string, words: readonly string[]): boolean {
   return words.some((word) => new RegExp(`\\b${word}s?\\b`).test(text));
}

/** Purpose: "1 day" or "3 days". */
function dayCount(days: number): string {
   return counted(days, 'day', 'days');
}

/** Purpose: "1 tablet" or "5 tablets". */
function tabletCount(count: number): string {
   return counted(count, 'tablet', 'tablets');
}

/** Purpose: a medicine's name and strength, without a stray space. */
function medicineLabel(medication: Medication): string {
   return `${medication.name} ${medication.strength}`.trim();
}

/** Purpose: medicines that are active, sorted by name. */
function activeMedicines(medications: readonly Medication[]): Medication[] {
   return medications
      .filter((medication) => medication.status === 'active')
      .sort((first, second) => first.name.localeCompare(second.name));
}

/** Purpose: open tasks, soonest first. */
function openTasks(tasks: readonly Task[]): Task[] {
   return tasks
      .filter((task) => task.status === 'open')
      .sort((first, second) => first.dueAt - second.dueAt);
}

/** Purpose: upcoming visits that have not yet happened, soonest first. */
function upcomingVisits(
   appointments: readonly Appointment[],
   now: number,
): Appointment[] {
   return appointments
      .filter(
         (appointment) =>
            appointment.status === 'upcoming' && appointment.at >= now,
      )
      .sort((first, second) => first.at - second.at);
}

/** Purpose: one open task in plain words, marked when overdue. */
function taskLine(task: Task, facts: CareFacts): string {
   const owner = facts.memberNames.get(task.ownerId) ?? 'unassigned';
   const overdue = task.dueAt < facts.now ? 'OVERDUE: ' : '';
   const due = facts.whenText(task.dueAt);
   return `${overdue}${task.title} (owner: ${owner}, due ${due})`;
}

/** Purpose: one visit in plain words: doctor, time and place. */
function visitText(visit: Appointment, facts: CareFacts): string {
   return [visit.doctor, facts.whenText(visit.at), visit.location]
      .filter(Boolean)
      .join(', ');
}

/** Purpose: the most recent reading of one kind, or null when none. */
function latestReading(
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

/** Purpose: the adherence sentence, shared by answers and fact lists. */
function adherenceSentence(summary: AdherenceSummary): string {
   if (summary.due === 0) {
      return 'No doses were due in the last week';
   }
   return (
      `${summary.taken} of ${summary.due} doses due were taken ` +
      `(${summary.takenPercent}%)`
   );
}

/** Purpose: drop repeated sources, keeping the first label per link. */
function uniqueSources(sources: readonly AnswerSource[]): AnswerSource[] {
   const byHref = new Map<string, AnswerSource>();
   for (const source of sources) {
      if (!byHref.has(source.href)) {
         byHref.set(source.href, source);
      }
   } // ----- end for each source
   return [...byHref.values()];
}

// ----- Intents ----------------------------------------------------------

/** Purpose: medicines that will run out soon. */
function refillPart(facts: CareFacts): Part {
   const low = forecastAll(facts.medications, facts.now).filter(
      (forecast) => forecast.needsRefill,
   );
   const lines =
      low.length === 0
         ? ['No medicine is running low.']
         : low.map(
              (forecast) =>
                 `${forecast.name}: ${forecast.stock} left, about ` +
                 dayCount(forecast.daysLeft),
           );
   return { lines, sources: [SOURCE_MEDICINES] };
}

/** Purpose: open tasks with their owner and due time. */
function taskPart(facts: CareFacts): Part {
   const open = openTasks(facts.tasks);
   const lines =
      open.length === 0
         ? ['No tasks are open.']
         : open.map((task) => taskLine(task, facts));
   return { lines, sources: [SOURCE_CIRCLE] };
}

/** Purpose: the next visit, plus preparation items when asked. */
function visitPart(facts: CareFacts, prepare: boolean): Part {
   const next = upcomingVisits(facts.appointments, facts.now)[0];
   if (!next) {
      return {
         lines: ['No visit is planned.'],
         sources: [SOURCE_APPOINTMENTS],
      };
   }
   const lines = [visitText(next, facts)];
   if (next.notes) {
      lines.push(`Remember: ${next.notes}`);
   }
   if (prepare) {
      for (const question of facts.questions) {
         if (!question.answered) {
            lines.push(`Question for the doctor: ${question.text}`);
         }
      }
      for (const task of openTasks(facts.tasks)) {
         if (task.kind === 'test') {
            lines.push(taskLine(task, facts));
         }
      }
   }
   return {
      lines,
      sources: [
         SOURCE_APPOINTMENTS,
         { label: 'Visit brief', href: `/appointments/${next.id}` },
      ],
   };
}

/** Purpose: adherence for the week and the patterns worth raising. */
function trendPart(facts: CareFacts): Part {
   const summary = summariseAdherence(facts.doses, facts.now);
   const observations = detectPatterns(
      facts.doses,
      facts.readings,
      facts.now,
   );
   const sources = [SOURCE_MEDICINES, SOURCE_HEALTH];
   if (summary.due === 0 && observations.length === 0) {
      return { lines: [NOTHING_NOTABLE], sources };
   }
   return {
      lines: [
         adherenceSentence(summary),
         ...observations.map((observation) => observation.title),
      ],
      sources,
   };
}

/** Purpose: the latest reading of each kind the question names. */
function readingPart(text: string, facts: CareFacts): Part {
   const named = READING_KINDS.filter((reading) =>
      asks(text, reading.words),
   );
   const wanted = named.length > 0 ? named : READING_KINDS;
   const lines = wanted.map((reading) => {
      const latest = latestReading(facts.readings, reading.kind);
      if (!latest) {
         return `No ${reading.label.toLowerCase()} reading is recorded.`;
      }
      const when = facts.whenText(latest.at);
      return `${reading.label} ${reading.show(latest)} on ${when}`;
   });
   return { lines, sources: [SOURCE_HEALTH] };
}

/** Purpose: each active medicine with its dose and schedule. */
function medicinePart(facts: CareFacts): Part {
   const active = activeMedicines(facts.medications);
   const lines =
      active.length === 0
         ? ['No active medicine is recorded.']
         : active.map(
              (medication) =>
                 `${medicineLabel(medication)}: ` +
                 `${medication.unitsPerDose} ` +
                 describeSchedule(medication),
           );
   return { lines, sources: [SOURCE_MEDICINES] };
}

/** Purpose: the newest uploaded records, each linked to its file. */
function recordPart(facts: CareFacts): Part {
   const latest = [...facts.documents]
      .sort((first, second) => second.at - first.at)
      .slice(0, LATEST_DOCUMENTS);
   if (latest.length === 0) {
      return { lines: ['No records are uploaded.'], sources: [] };
   }
   return {
      lines: latest.map(
         (document) =>
            `${document.title} (${facts.whenText(document.at)})`,
      ),
      sources: latest.map((document) => ({
         label: document.title,
         href: `/records/${document.id}/file`,
      })),
   };
}

// ----- Public functions -------------------------------------------------

/**
 * Purpose: answer a question from the records. Every intent whose
 * keywords appear in the question contributes its facts, in a fixed
 * order. With no match the answer says so and cites nothing.
 */
export function answerQuestion(question: string, facts: CareFacts): Answer {
   const text = question.toLowerCase();
   const parts: Part[] = [];
   if (asks(text, REFILL_WORDS)) {
      parts.push(refillPart(facts));
   }
   if (asks(text, TASK_WORDS)) {
      parts.push(taskPart(facts));
   }
   if (asks(text, VISIT_WORDS)) {
      parts.push(visitPart(facts, asks(text, PREPARE_WORDS)));
   }
   if (asks(text, TREND_WORDS)) {
      parts.push(trendPart(facts));
   }
   if (asks(text, READING_WORDS)) {
      parts.push(readingPart(text, facts));
   }
   if (asks(text, MEDICINE_WORDS)) {
      parts.push(medicinePart(facts));
   }
   if (asks(text, RECORD_WORDS)) {
      parts.push(recordPart(facts));
   }
   if (parts.length === 0) {
      return { understood: false, lines: [NOT_UNDERSTOOD], sources: [] };
   }
   return {
      understood: true,
      lines: parts.flatMap((part) => part.lines),
      sources: uniqueSources(parts.flatMap((part) => part.sources)),
   };
}

/**
 * Purpose: numbered plain-text facts for the AI fallback. Names only;
 * never passcodes, emails or document contents.
 */
export function factLines(facts: CareFacts): string[] {
   const texts: string[] = [];
   for (const medication of activeMedicines(facts.medications)) {
      texts.push(`${medication.name}: ${tabletCount(medication.stock)} left`);
   }
   for (const task of openTasks(facts.tasks)) {
      texts.push(`Open task: ${taskLine(task, facts)}`);
   }
   for (const visit of upcomingVisits(facts.appointments, facts.now)) {
      texts.push(`Upcoming visit: ${visitText(visit, facts)}`);
   }
   for (const reading of READING_KINDS) {
      const latest = latestReading(facts.readings, reading.kind);
      const label = reading.label.toLowerCase();
      if (latest) {
         const when = facts.whenText(latest.at);
         texts.push(
            `Latest ${label}: ${reading.show(latest)} on ${when}`,
         );
      } else {
         texts.push(`No ${label} reading is recorded.`);
      }
   }
   const summary = summariseAdherence(facts.doses, facts.now);
   texts.push(adherenceSentence(summary));
   return texts.map((text, index) => `[${index + 1}] ${text}`);
}
