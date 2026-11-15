/**
 * Reminder check ("tick").
 *
 * Purpose: the periodic job that keeps care moving. For one profile it
 * reminds the elder of doses that are due, climbs the escalation ladder
 * for doses nobody confirmed, sends appointment reminders, and raises a
 * refill task when a medicine is running low. It is safe to run as
 * often as wanted: each email is sent once, tracked on the record it
 * belongs to. Side effects: writes doses, appointments, tasks,
 * notifications and the profile; sends emails.
 */
import { appBaseUrl, sessionSecret } from '@/config/env';
import {
   ACTION_LINK_HOURS,
   APPOINTMENT_DAY_NOTICE_HOURS,
   APPOINTMENT_HOUR_NOTICE_HOURS,
   LEVEL_ELDER,
   MS_PER_DAY,
   MS_PER_HOUR,
   MS_PER_MINUTE,
} from '@/constants/care';
import {
   appointmentEmail,
   doseReminderEmail,
   escalationEmail,
   refillEmail,
   type DoseLine,
} from '@/domain/emails';
import { nextEscalation } from '@/domain/escalation';
import { can } from '@/domain/permissions';
import { forecastAll } from '@/domain/refill';
import { needsRefillTask, pickOwners } from '@/domain/tasks';
import { formatLocal } from '@/domain/time';
import { signToken } from '@/domain/tokens';
import type {
   CareProfile,
   DoseRecord,
   Medication,
   Member,
} from '@/domain/types';
import { anchorLabel } from '@/i18n/strings';
import { foodNote, loadCurrentDoses } from '@/services/care';
import { nowFor } from '@/services/clock';
import { sendToMember } from '@/services/email';
import { newId } from '@/services/ids';
import { getStore } from '@/store';

/** Pages run the check themselves when it last ran longer ago. */
const TICK_STALE_MINUTES = 5;

/** A dose may climb at most this many levels in one check. */
const MAX_LEVELS_PER_TICK = 3;

export interface TickReport {
   emails: number;
   escalations: number;
   appointmentReminders: number;
   refillTasks: number;
}

/** Purpose: the email line describing a dose of a medicine. */
function doseLine(
   medication: Medication | undefined,
   language: CareProfile['language'],
): DoseLine {
   return {
      name: medication?.name ?? 'Medicine',
      strength: medication?.strength ?? '',
      foodNote: medication ? foodNote(medication, language) : '',
   };
}

/** Purpose: a signed link that opens one dose for one member. */
function doseLink(profile: CareProfile, memberId: string, doseId: string): string {
   const token = signToken(
      {
         purpose: 'dose',
         profileId: profile.id,
         memberId,
         subject: doseId,
         expiresAt: Date.now() + ACTION_LINK_HOURS*MS_PER_HOUR,
      },
      sessionSecret(),
   );
   return `${appBaseUrl()}/dose/${token}`;
}

/**
 * Purpose: remind and escalate for every open dose. Emails are grouped
 * so a person gets one message per level and due time, not one per
 * pill. Returns how many emails and escalations happened.
 */
async function tickDoses(
   profile: CareProfile,
   members: readonly Member[],
   now: number,
): Promise<{ emails: number; escalations: number }> {
   const store = getStore();
   const current = await loadCurrentDoses(profile, now);
   const medications = new Map(
      current.medications.map((medication) => [medication.id, medication]),
   );
   // ----- Group key: level, recipient and due time.
   const groups = new Map<
      string,
      { level: number; recipient: Member; doses: DoseRecord[] }
   >();
   const changed: DoseRecord[] = [];
   let escalations = 0;

   for (const original of [...current.carriedOver, ...current.today]) {
      let dose = original;
      for (let climb = 0; climb < MAX_LEVELS_PER_TICK; climb += 1) {
         const step = nextEscalation(
            dose,
            members,
            now,
            profile.utcOffsetMinutes,
            medications.get(dose.medicationId)?.critical ?? false,
            profile.sharingPaused,
         );
         if (!step) {
            break;
         }
         dose = { ...dose, escalationLevel: step.level };
         if (step.level > LEVEL_ELDER) {
            escalations += 1;
         }
         for (const recipient of step.recipients) {
            const key = `${step.level}|${recipient.id}|${dose.dueAt}`;
            const group = groups.get(key) ?? {
               level: step.level,
               recipient,
               doses: [],
            };
            group.doses.push(dose);
            groups.set(key, group);
         }
      } // ----- end climb
      if (dose !== original) {
         changed.push(dose);
      }
   } // ----- end for each dose

   if (changed.length > 0) {
      await store.putMany('doses', changed);
   }

   let emails = 0;
   for (const group of groups.values()) {
      const first = group.doses[0];
      if (!first) {
         continue;
      }
      const lines = group.doses.map((dose) =>
         doseLine(medications.get(dose.medicationId), profile.language),
      );
      const content =
         group.level === LEVEL_ELDER
            ? doseReminderEmail(
                 profile.elderName,
                 anchorLabel(profile.language, first.anchor).toLowerCase(),
                 lines,
                 doseLink(profile, group.recipient.id, first.id),
              )
            : escalationEmail(
                 group.recipient.name,
                 profile.elderName,
                 formatLocal(first.dueAt, profile.utcOffsetMinutes),
                 lines,
                 `${appBaseUrl()}/home`,
              );
      await sendToMember(
         profile,
         group.recipient,
         group.level === LEVEL_ELDER ? 'doseReminder' : 'doseEscalation',
         content,
         first.id,
      );
      emails += 1;
   }
   return { emails, escalations };
}

/**
 * Purpose: send the day-before and two-hours-before reminders for
 * upcoming appointments to the elder and everyone allowed to see
 * appointments. Each reminder kind is sent once per appointment.
 */
async function tickAppointments(
   profile: CareProfile,
   members: readonly Member[],
   now: number,
): Promise<number> {
   const store = getStore();
   const appointments = await store.list('appointments', profile.id);
   const recipients = members.filter(
      (member) =>
         member.email !== '' && can(member, 'viewAppointments', profile),
   );
   let sent = 0;
   for (const appointment of appointments) {
      if (appointment.status !== 'upcoming' || appointment.at <= now) {
         continue;
      }
      const hoursAway = (appointment.at - now)/MS_PER_HOUR;
      const due: string[] = [];
      if (
         hoursAway <= APPOINTMENT_DAY_NOTICE_HOURS &&
         !appointment.remindersSent.includes('day')
      ) {
         due.push('day');
      }
      if (
         hoursAway <= APPOINTMENT_HOUR_NOTICE_HOURS &&
         !appointment.remindersSent.includes('hour')
      ) {
         due.push('hour');
      }
      if (due.length === 0) {
         continue;
      }
      for (const recipient of recipients) {
         await sendToMember(
            profile,
            recipient,
            'appointmentReminder',
            appointmentEmail(
               recipient.name,
               profile.elderName,
               appointment.doctor,
               formatLocal(appointment.at, profile.utcOffsetMinutes),
               appointment.location,
               appointment.notes,
               `${appBaseUrl()}/appointments/${appointment.id}`,
            ),
            appointment.id,
         );
         sent += 1;
      }
      await store.put('appointments', {
         ...appointment,
         remindersSent: [...appointment.remindersSent, ...due],
      });
   } // ----- end for each appointment
   return sent;
}

/**
 * Purpose: raise a refill task, with a named owner and backup, for each
 * medicine that will run out soon, and email the owner.
 */
async function tickRefills(
   profile: CareProfile,
   members: readonly Member[],
   now: number,
): Promise<{ tasks: number; emails: number }> {
   const store = getStore();
   const [medications, tasks] = await Promise.all([
      store.list('medications', profile.id),
      store.list('tasks', profile.id),
   ]);
   let created = 0;
   let emails = 0;
   for (const forecast of forecastAll(medications, now)) {
      if (!needsRefillTask(forecast, tasks, now)) {
         continue;
      }
      const owners = pickOwners(members);
      if (!owners.ownerId) {
         continue;
      }
      await store.put('tasks', {
         id: newId(),
         profileId: profile.id,
         title: `Refill ${forecast.name}`,
         kind: 'refill',
         ownerId: owners.ownerId,
         backupId: owners.backupId,
         dueAt: Math.max(now, forecast.runsOutAt - 2*MS_PER_DAY),
         status: 'open',
         createdById: 'system',
         doneById: '',
         doneAt: 0,
         relatedId: forecast.medicationId,
      });
      created += 1;
      const owner = members.find((member) => member.id === owners.ownerId);
      if (owner && owner.email !== '' && !profile.sharingPaused) {
         await sendToMember(
            profile,
            owner,
            'refill',
            refillEmail(
               owner.name,
               profile.elderName,
               forecast.name,
               forecast.daysLeft,
               `${appBaseUrl()}/circle`,
            ),
            forecast.medicationId,
         );
         emails += 1;
      }
   }
   return { tasks: created, emails };
}

/**
 * Purpose: run the whole reminder check for one profile and note when
 * it ran.
 */
export async function runTick(profile: CareProfile): Promise<TickReport> {
   const store = getStore();
   const now = nowFor(profile);
   const members = await store.list('members', profile.id);
   const doses = await tickDoses(profile, members, now);
   const appointmentReminders = await tickAppointments(profile, members, now);
   const refills = await tickRefills(profile, members, now);
   await store.putProfile({ ...profile, lastTickAt: Date.now() });
   return {
      emails: doses.emails + appointmentReminders + refills.emails,
      escalations: doses.escalations,
      appointmentReminders,
      refillTasks: refills.tasks,
   };
}

/**
 * Purpose: run the check when it has not run recently. Pages call this
 * so reminders still go out if the scheduler is late or missing.
 */
export async function tickIfStale(profile: CareProfile): Promise<void> {
   const stale =
      Date.now() - profile.lastTickAt > TICK_STALE_MINUTES*MS_PER_MINUTE;
   if (stale) {
      await runTick(profile);
   }
}
