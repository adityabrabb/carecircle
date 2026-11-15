/**
 * Daily pulse.
 *
 * Purpose: answer "what is happening with this person's care, and what
 * needs attention next?" in three short lists: on track, needs attention
 * and coming up. Pure functions; the caller loads the records and
 * formats the times, so this file never reads the clock or the store.
 */
import { MS_PER_HOUR } from '@/constants/care';
import type { Observation } from '@/domain/patterns';
import { forecastAll } from '@/domain/refill';
import type {
   Appointment,
   DoseRecord,
   Medication,
   Task,
} from '@/domain/types';

/** An appointment this close to now is listed as coming up. */
const UPCOMING_HOURS = 48;

/** An open task due this close to now is listed as due soon. */
const DUE_SOON_HOURS = 24;

/** At most this many observation titles reach the pulse. */
const OBSERVATION_LIMIT = 3;

export interface PulseInput {
   now: number;
   /** Today's and carried-over doses. */
   doses: readonly DoseRecord[];
   medications: readonly Medication[];
   tasks: readonly Task[];
   appointments: readonly Appointment[];
   pendingProposals: number;
   /** From detectPatterns; only the first few titles are shown. */
   observations: readonly Observation[];
   /** The caller formats times, so this file stays pure. */
   whenText: (at: number) => string;
}

export interface Pulse {
   onTrack: string[];
   needsAttention: string[];
   upcoming: string[];
}

/** Purpose: a count with the right noun, such as "1 dose" or "3 doses". */
function counted(count: number, one: string, many: string): string {
   return `${count} ${count === 1 ? one : many}`;
}

/**
 * Purpose: the dose lines for the pulse. Only doses that are already due
 * count; a dose still in the future is not yet a question for anyone.
 */
function doseLines(
   doses: readonly DoseRecord[],
   now: number,
): { attention: string[]; recorded: string | null } {
   const due = doses.filter((dose) => dose.dueAt <= now);
   const unconfirmed = due.filter(
      (dose) => dose.status === 'unconfirmed',
   ).length;
   const unsure = due.filter((dose) => dose.status === 'unsure').length;
   const attention: string[] = [];
   if (unconfirmed > 0) {
      const verb = unconfirmed === 1 ? 'is' : 'are';
      attention.push(
         `${counted(unconfirmed, 'dose', 'doses')} due ${verb} ` +
            'not confirmed yet',
      );
   }
   if (unsure > 0) {
      attention.push(`${counted(unsure, 'dose', 'doses')} marked not sure`);
   }
   const allRecorded = due.every(
      (dose) => dose.status === 'taken' || dose.status === 'skipped',
   );
   let recorded: string | null = null;
   if (due.length > 0 && allRecorded) {
      recorded =
         due.length === 1
            ? 'The dose due so far is recorded'
            : `All ${due.length} doses due so far are recorded`;
   }
   return { attention, recorded };
}

/**
 * Purpose: build the pulse for one profile at one moment. Zero counts
 * never produce a line, so an empty input leaves every list empty.
 */
export function buildPulse(input: PulseInput): Pulse {
   const { now } = input;
   const onTrack: string[] = [];
   const needsAttention: string[] = [];
   const upcoming: string[] = [];

   // ----- Doses
   const doses = doseLines(input.doses, now);
   needsAttention.push(...doses.attention);
   if (doses.recorded !== null) {
      onTrack.push(doses.recorded);
   }

   // ----- Tasks
   const openTasks = input.tasks
      .filter((task) => task.status === 'open')
      .sort((first, second) => first.dueAt - second.dueAt);
   const overdue = openTasks.filter((task) => task.dueAt < now);
   const dueSoonWindow = DUE_SOON_HOURS * MS_PER_HOUR;
   const dueSoon = openTasks.filter(
      (task) => task.dueAt >= now && task.dueAt - now <= dueSoonWindow,
   );
   for (const task of overdue) {
      needsAttention.push(`Overdue: ${task.title}`);
   }
   if (openTasks.length > 0 && overdue.length === 0) {
      onTrack.push('No tasks are overdue');
   }

   // ----- Refills
   for (const forecast of forecastAll(input.medications, now)) {
      if (forecast.needsRefill) {
         const days = counted(forecast.daysLeft, 'day', 'days');
         needsAttention.push(`${forecast.name}: about ${days} left`);
      }
   }

   // ----- Medicine changes waiting for the elder
   if (input.pendingProposals > 0) {
      const changes = counted(
         input.pendingProposals,
         'medicine change',
         'medicine changes',
      );
      needsAttention.push(`${changes} waiting for the elder's decision`);
   }

   // ----- Patterns, kept to a short list
   for (const observation of input.observations.slice(0, OBSERVATION_LIMIT)) {
      needsAttention.push(observation.title);
   }

   // ----- Coming up
   const upcomingWindow = UPCOMING_HOURS * MS_PER_HOUR;
   const visits = input.appointments
      .filter(
         (appointment) =>
            appointment.status === 'upcoming' &&
            appointment.at > now &&
            appointment.at <= now + upcomingWindow,
      )
      .sort((first, second) => first.at - second.at);
   for (const visit of visits) {
      upcoming.push(`${visit.doctor}, ${input.whenText(visit.at)}`);
   }
   const laterToday = input.doses.filter((dose) => dose.dueAt > now).length;
   if (laterToday > 0) {
      upcoming.push(
         counted(laterToday, 'more dose later today', 'more doses later today'),
      );
   }
   for (const task of dueSoon) {
      upcoming.push(`Due soon: ${task.title}`);
   }

   return { onTrack, needsAttention, upcoming };
}
