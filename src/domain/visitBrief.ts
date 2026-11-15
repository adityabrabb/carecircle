/**
 * Visit brief.
 *
 * Purpose: answer "what changed since my last visit?" for a doctor
 * appointment. The brief is built by rule from the stored record:
 * adherence, medicine changes, readings, symptoms, patterns and the
 * elder's own questions. Nothing in it is generated or guessed.
 */
import { summariseAdherence, type AdherenceSummary } from '@/domain/adherence';
import { describeSchedule } from '@/domain/medicationForm';
import { detectPatterns, type Observation } from '@/domain/patterns';
import type {
   Appointment,
   DoctorQuestion,
   DoseRecord,
   HealthReading,
   Medication,
} from '@/domain/types';

export interface ReadingChange {
   label: string;
   first: string;
   latest: string;
   count: number;
}

export interface VisitBrief {
   /** Start of the period the brief covers. */
   since: number;
   adherence: AdherenceSummary;
   currentMedicines: string[];
   medicineChanges: string[];
   readingChanges: ReadingChange[];
   symptoms: string[];
   skipReasons: string[];
   observations: Observation[];
   questions: string[];
}

/** With no earlier visit the brief looks back this many days. */
const DEFAULT_LOOKBACK_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/**
 * Purpose: when the period for the brief begins: the most recent
 * completed visit before this appointment, or a month back.
 */
export function briefStart(
   appointment: Appointment,
   all: readonly Appointment[],
   now: number,
): number {
   const earlier = all
      .filter(
         (other) =>
            other.id !== appointment.id &&
            other.status === 'done' &&
            other.at < Math.min(appointment.at, now),
      )
      .sort((first, second) => second.at - first.at);
   return earlier[0]?.at ?? now - DEFAULT_LOOKBACK_DAYS*MS_PER_DAY;
}

/** Purpose: one reading as text, with its unit. */
function readingText(reading: HealthReading): string {
   if (reading.kind === 'bloodPressure') {
      return `${reading.value}/${reading.value2}`;
   }
   if (reading.kind === 'glucose') {
      return `${reading.value} mg/dL`;
   }
   return `${reading.value} kg`;
}

/** Purpose: first and latest value of one kind of reading. */
function changeFor(
   readings: readonly HealthReading[],
   kind: HealthReading['kind'],
   label: string,
): ReadingChange[] {
   const series = readings
      .filter((reading) => reading.kind === kind)
      .sort((first, second) => first.at - second.at);
   const first = series[0];
   const latest = series[series.length - 1];
   if (!first || !latest) {
      return [];
   }
   return [
      {
         label,
         first: readingText(first),
         latest: readingText(latest),
         count: series.length,
      },
   ];
}

/**
 * Purpose: build the brief for an appointment from the full record.
 */
export function buildVisitBrief(
   since: number,
   now: number,
   medications: readonly Medication[],
   doses: readonly DoseRecord[],
   readings: readonly HealthReading[],
   questions: readonly DoctorQuestion[],
): VisitBrief {
   const inPeriod = (at: number): boolean => at >= since && at <= now;
   const periodDoses = doses.filter((dose) => inPeriod(dose.dueAt));
   const periodReadings = readings.filter((reading) => inPeriod(reading.at));
   return {
      since,
      adherence: summariseAdherence(periodDoses, now),
      currentMedicines: medications
         .filter((medication) => medication.status === 'active')
         .map(
            (medication) =>
               `${medication.name} ${medication.strength}: ` +
               `${medication.unitsPerDose} ${describeSchedule(medication)}`,
         ),
      medicineChanges: medications
         .filter(
            (medication) =>
               medication.status !== 'pendingApproval' &&
               medication.updatedAt > since,
         )
         .map((medication) =>
            medication.status === 'stopped'
               ? `${medication.name} was stopped`
               : `${medication.name} was added or changed`,
         ),
      readingChanges: [
         ...changeFor(periodReadings, 'bloodPressure', 'Blood pressure'),
         ...changeFor(periodReadings, 'glucose', 'Blood sugar'),
         ...changeFor(periodReadings, 'weight', 'Weight'),
      ],
      symptoms: periodReadings
         .filter((reading) => reading.kind === 'symptom' && reading.note)
         .sort((first, second) => first.at - second.at)
         .map((reading) => reading.note),
      skipReasons: periodDoses
         .filter((dose) => dose.status === 'skipped' && dose.reason !== '')
         .map((dose) => dose.reason),
      observations: detectPatterns(doses, readings, now),
      questions: questions
         .filter((question) => !question.answered)
         .sort((first, second) => first.at - second.at)
         .map((question) => question.text),
   };
}
