/**
 * Dose confirmation.
 *
 * Purpose: the rules for recording what happened to a dose. A dose has
 * four answers, not two: taken, skipped by choice, "not sure if I took
 * it", and unconfirmed. Silence is never recorded as a missed dose, and
 * a dose can never be confirmed twice, which guards against doubling up.
 */
import { EARLY_CONFIRM_MINUTES, MS_PER_MINUTE } from '@/constants/care';
import type {
   ConfirmMethod,
   DoseRecord,
   DoseStatus,
   Result,
   Role,
} from '@/domain/types';

export interface Confirmation {
   status: Exclude<DoseStatus, 'unconfirmed'>;
   byId: string;
   byRole: Role;
   /** Only meaningful when someone other than the elder confirms. */
   method: ConfirmMethod;
   reason: string;
}

/**
 * Purpose: decide how firmly a confirmation is known. The elder's own
 * tap is always "self"; another person must say whether they saw the
 * dose taken or are assuming it.
 */
export function evidenceFor(
   byRole: Role,
   method: ConfirmMethod,
): ConfirmMethod {
   if (byRole === 'elder') {
      return 'self';
   }
   return method === 'observed' ? 'observed' : 'assumed';
}

/**
 * Purpose: apply a confirmation to a dose and return the new record.
 * Fails when the dose is already resolved, is too far in the future, or
 * when someone other than the elder tries to record a skip by choice
 * (only the elder may decide to skip).
 */
export function confirmDose(
   dose: DoseRecord,
   confirmation: Confirmation,
   now: number,
): Result<DoseRecord> {
   if (dose.status === 'taken' || dose.status === 'skipped') {
      return {
         ok: false,
         error: 'This dose is already recorded. Do not take it again.',
      };
   }
   if (now < dose.dueAt - EARLY_CONFIRM_MINUTES*MS_PER_MINUTE) {
      return { ok: false, error: 'It is too early to record this dose.' };
   }
   if (confirmation.status === 'skipped' && confirmation.byRole !== 'elder') {
      return {
         ok: false,
         error: 'Only the elder can choose to skip a dose.',
      };
   }
   const isTaken = confirmation.status === 'taken';
   return {
      ok: true,
      value: {
         ...dose,
         status: confirmation.status,
         confirmedById: confirmation.byId,
         confirmMethod: isTaken
            ? evidenceFor(confirmation.byRole, confirmation.method)
            : '',
         reason: confirmation.reason.trim(),
         resolvedAt: now,
      },
   };
}

/**
 * Purpose: record that a member is dealing with an unresolved dose so
 * the escalation ladder stops climbing. Has no effect on a dose that is
 * already taken or skipped.
 */
export function acknowledgeDose(
   dose: DoseRecord,
   memberId: string,
): DoseRecord {
   if (dose.status === 'taken' || dose.status === 'skipped') {
      return dose;
   }
   return { ...dose, acknowledgedById: memberId };
}

/** Purpose: true while a dose still needs someone to resolve it. */
export function isOpen(dose: DoseRecord): boolean {
   return dose.status === 'unconfirmed' || dose.status === 'unsure';
}

/**
 * Purpose: units to take off the stock for a confirmation. Stock only
 * falls when a dose is confirmed as taken, never because it was
 * scheduled.
 */
export function stockChange(
   previous: DoseStatus,
   next: DoseStatus,
   unitsPerDose: number,
): number {
   if (previous !== 'taken' && next === 'taken') {
      return -unitsPerDose;
   }
   return 0;
}

/**
 * Purpose: the safety advice shown when the elder is not sure whether
 * they took a dose. The app never tells anyone to take another dose.
 */
export const UNSURE_ADVICE =
   'Do not take another dose to make up. Your caretaker has been told. ' +
   'If you feel unwell, call your doctor.';
