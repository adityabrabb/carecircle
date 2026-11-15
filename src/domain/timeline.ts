/**
 * Care timeline.
 *
 * Purpose: one chronological list of what happened across every care
 * system (doses, readings, visits, handovers, records, tasks and medicine
 * changes), newest first. Pure: the caller loads the records and maps
 * documents down to the fields listed here, so no file contents reach
 * this code. Unconfirmed doses and future events are never listed.
 */
import { MOOD_LABELS } from '@/constants/labels';
import { describeChange } from '@/domain/medicationForm';
import type {
   Appointment,
   ChangeProposal,
   ConfirmMethod,
   DocumentRecord,
   DoseRecord,
   HandoverNote,
   HealthReading,
   Medication,
   ProposalStatus,
   Task,
} from '@/domain/types';

export type TimelineKind =
   | 'dose'
   | 'reading'
   | 'appointment'
   | 'handover'
   | 'document'
   | 'task'
   | 'change';

export interface TimelineEntry {
   at: number;
   kind: TimelineKind;
   text: string;
}

export interface TimelineInput {
   doses: readonly DoseRecord[];
   medications: readonly Medication[];
   readings: readonly HealthReading[];
   appointments: readonly Appointment[];
   handovers: readonly HandoverNote[];
   documents: readonly Pick<
      DocumentRecord,
      'id' | 'title' | 'at' | 'uploadedById'
   >[];
   tasks: readonly Task[];
   proposals: readonly ChangeProposal[];
   memberNames: ReadonlyMap<string, string>;
}

const UNKNOWN_PERSON = 'Someone';
const UNKNOWN_MEDICINE = 'A medicine';
const SUGAR_UNIT = 'mg/dL';
const WEIGHT_UNIT = 'kg';
const WEIGHT_DECIMALS = 1;

/** Purpose: the words that end a medicine change's timeline line. */
const DECISION_TEXT: Partial<Record<ProposalStatus, string>> = {
   approved: ' approved',
   rejected: ' rejected',
   emergencyApplied: ' applied under the emergency plan',
};

/** Purpose: a member's name, or a neutral word when they are unknown. */
function nameOf(names: ReadonlyMap<string, string>, id: string): string {
   return names.get(id) ?? UNKNOWN_PERSON;
}

/** Purpose: the note that says who confirmed a dose, if a helper did. */
function helperNote(method: ConfirmMethod | ''): string {
   if (method === 'observed') {
      return ' (seen by a helper)';
   }
   if (method === 'assumed') {
      return ' (assumed by a helper)';
   }
   return '';
}

/**
 * Purpose: the timeline line for a resolved dose, or null when the dose
 * is still unconfirmed and so is not an event yet.
 */
function doseText(dose: DoseRecord, name: string): string | null {
   if (dose.status === 'taken') {
      return `${name} taken${helperNote(dose.confirmMethod)}`;
   }
   if (dose.status === 'skipped') {
      return dose.reason
         ? `${name} skipped by choice: ${dose.reason}`
         : `${name} skipped by choice`;
   }
   if (dose.status === 'unsure') {
      return `${name}: not sure if taken`;
   }
   return null;
}

/** Purpose: the timeline line for one health reading. */
function readingText(reading: HealthReading): string {
   if (reading.kind === 'bloodPressure') {
      return `Blood pressure ${reading.value}/${reading.value2}`;
   }
   if (reading.kind === 'glucose') {
      return `Blood sugar ${reading.value} ${SUGAR_UNIT}`;
   }
   if (reading.kind === 'weight') {
      const kg = reading.value.toFixed(WEIGHT_DECIMALS);
      return `Weight ${kg} ${WEIGHT_UNIT}`;
   }
   if (reading.kind === 'symptom') {
      return `Symptom: ${reading.note}`;
   }
   return `Check-in: ${MOOD_LABELS[reading.value] ?? ''}`;
}

/** Purpose: the timeline line for a visit that is over or cancelled. */
function visitText(appointment: Appointment): string | null {
   if (appointment.status === 'done') {
      return `Visited ${appointment.doctor}`;
   }
   if (appointment.status === 'cancelled') {
      return `Cancelled visit to ${appointment.doctor}`;
   }
   return null;
}

/**
 * Purpose: every event the input holds, unsorted and unfiltered. The
 * caller applies the time cut-off and the limit.
 */
function allEvents(input: TimelineInput): TimelineEntry[] {
   const { memberNames } = input;
   const medicineNames = new Map(
      input.medications.map((medication) => [medication.id, medication.name]),
   );
   const events: TimelineEntry[] = [];

   // ----- Doses
   for (const dose of input.doses) {
      const name = medicineNames.get(dose.medicationId) ?? UNKNOWN_MEDICINE;
      const text = doseText(dose, name);
      if (text !== null) {
         events.push({ at: dose.resolvedAt, kind: 'dose', text });
      }
   }

   // ----- Health readings
   for (const reading of input.readings) {
      events.push({
         at: reading.at,
         kind: 'reading',
         text: readingText(reading),
      });
   }

   // ----- Visits
   for (const appointment of input.appointments) {
      const text = visitText(appointment);
      if (text !== null) {
         events.push({ at: appointment.at, kind: 'appointment', text });
      }
   }

   // ----- Handovers
   for (const handover of input.handovers) {
      const author = nameOf(memberNames, handover.byId);
      events.push({
         at: handover.at,
         kind: 'handover',
         text: `${author}: ${handover.text}`,
      });
   }

   // ----- Records
   for (const document of input.documents) {
      const uploader = nameOf(memberNames, document.uploadedById);
      events.push({
         at: document.at,
         kind: 'document',
         text: `${uploader} added ${document.title}`,
      });
   }

   // ----- Completed tasks
   for (const task of input.tasks) {
      if (task.status === 'done') {
         const who = nameOf(memberNames, task.doneById);
         events.push({
            at: task.doneAt,
            kind: 'task',
            text: `${who} finished: ${task.title}`,
         });
      }
   }

   // ----- Medicine changes that were decided
   for (const proposal of input.proposals) {
      const suffix = DECISION_TEXT[proposal.status];
      if (suffix !== undefined) {
         const change = describeChange(proposal.kind, proposal.medication);
         events.push({
            at: proposal.decidedAt,
            kind: 'change',
            text: `${change}${suffix}`,
         });
      }
   }

   return events;
}

/**
 * Purpose: the timeline for one moment: events at or before "now",
 * newest first, at most "limit" of them.
 */
export function buildTimeline(
   input: TimelineInput,
   now: number,
   limit: number,
): TimelineEntry[] {
   return allEvents(input)
      .filter((entry) => entry.at <= now)
      .sort((first, second) => second.at - first.at)
      .slice(0, Math.max(0, limit));
}
