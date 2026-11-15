/**
 * Escalation ladder.
 *
 * Purpose: decide who should hear about a dose that nobody has
 * confirmed. The elder is reminded first, then the caretakers, then the
 * family. The ladder stops when the dose is resolved or when a member
 * says they are handling it, and it waits during quiet hours unless the
 * medicine is marked critical.
 */
import {
   CARETAKER_DELAY_MINUTES,
   FAMILY_DELAY_MINUTES,
   LEVEL_CARETAKER,
   LEVEL_ELDER,
   LEVEL_FAMILY,
   MS_PER_MINUTE,
   QUIET_END_HOUR,
   QUIET_START_HOUR,
} from '@/constants/care';
import { localHour } from '@/domain/time';
import type { DoseRecord, Member, Role } from '@/domain/types';

export interface EscalationStep {
   /** The level this step raises the dose to. */
   level: number;
   /** Members to email for this step. */
   recipients: Member[];
}

/** Purpose: true during the hours when other people are not disturbed. */
export function isQuietHour(hour: number): boolean {
   if (QUIET_START_HOUR > QUIET_END_HOUR) {
      return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
   }
   return hour >= QUIET_START_HOUR && hour < QUIET_END_HOUR;
}

/** Purpose: the level a dose should have reached by "now". */
export function levelDue(dose: DoseRecord, now: number): number {
   const minutesLate = (now - dose.dueAt)/MS_PER_MINUTE;
   if (minutesLate < 0) {
      return 0;
   }
   if (minutesLate >= FAMILY_DELAY_MINUTES) {
      return LEVEL_FAMILY;
   }
   if (minutesLate >= CARETAKER_DELAY_MINUTES) {
      return LEVEL_CARETAKER;
   }
   return LEVEL_ELDER;
}

/** Purpose: the role contacted at each level of the ladder. */
function roleForLevel(level: number): Role {
   if (level === LEVEL_CARETAKER) {
      return 'caretaker';
   }
   if (level === LEVEL_FAMILY) {
      return 'family';
   }
   return 'elder';
}

/**
 * Purpose: active members of a role who have an email address, in the
 * order the elder set for the ladder.
 */
function contactable(members: readonly Member[], role: Role): Member[] {
   return members
      .filter(
         (member) =>
            member.role === role && member.active && member.email !== '',
      )
      .sort(
         (first, second) => first.escalationOrder - second.escalationOrder,
      );
}

/**
 * Purpose: the next step to take for one dose, or null when nothing
 * should be sent. Only one level is climbed per call so every level's
 * email is sent and recorded, even after a long gap.
 */
export function nextEscalation(
   dose: DoseRecord,
   members: readonly Member[],
   now: number,
   utcOffsetMinutes: number,
   critical: boolean,
   sharingPaused: boolean,
): EscalationStep | null {
   if (dose.status === 'taken' || dose.status === 'skipped') {
      return null;
   }
   const target = levelDue(dose, now);
   if (target <= dose.escalationLevel) {
      return null;
   }
   const level = dose.escalationLevel + 1;
   if (level === LEVEL_ELDER) {
      return { level, recipients: contactable(members, 'elder') };
   }
   // ----- Beyond this point other people are contacted.
   if (dose.acknowledgedById !== '' || sharingPaused) {
      return null;
   }
   if (!critical && isQuietHour(localHour(now, utcOffsetMinutes))) {
      return null;
   }
   return { level, recipients: contactable(members, roleForLevel(level)) };
}
