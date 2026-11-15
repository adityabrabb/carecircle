/**
 * Daily care.
 *
 * Purpose: load the doses for the current day, creating any that are
 * not stored yet, and record what happens to each dose. Side effects:
 * reads and writes doses and medicines, writes audit records, and
 * emails caretakers when the elder is unsure about a dose.
 */
import { appBaseUrl } from '@/config/env';
import {
   acknowledgeDose,
   confirmDose,
   isOpen,
   stockChange,
} from '@/domain/doses';
import { unsureDoseEmail } from '@/domain/emails';
import { can } from '@/domain/permissions';
import { mergeDay, plannedDoses } from '@/domain/schedule';
import { localDateKey, shiftDateKey } from '@/domain/time';
import type {
   CareProfile,
   ConfirmMethod,
   DoseRecord,
   DoseStatus,
   Medication,
   Member,
   Result,
} from '@/domain/types';
import { anchorLabel, t } from '@/i18n/strings';
import { recordAudit } from '@/services/audit';
import { sendToMember } from '@/services/email';
import { getStore } from '@/store';

export interface CurrentDoses {
   dateKey: string;
   medications: Medication[];
   /** Every dose planned for today, in time order. */
   today: DoseRecord[];
   /** Doses from yesterday that nobody has resolved. */
   carriedOver: DoseRecord[];
}

/** Purpose: the food instruction of a medicine, in a language. */
export function foodNote(
   medication: Medication,
   language: CareProfile['language'],
): string {
   if (medication.food === 'before') {
      return t(language, 'beforeFood');
   }
   if (medication.food === 'after') {
      return t(language, 'afterFood');
   }
   if (medication.food === 'with') {
      return t(language, 'withFood');
   }
   return '';
}

/**
 * Purpose: today's doses plus yesterday's unresolved ones. Missing dose
 * records for today are created; existing ones are never overwritten.
 */
export async function loadCurrentDoses(
   profile: CareProfile,
   now: number,
): Promise<CurrentDoses> {
   const store = getStore();
   const dateKey = localDateKey(now, profile.utcOffsetMinutes);
   const yesterday = shiftDateKey(dateKey, -1);
   const [medications, stored] = await Promise.all([
      store.list('medications', profile.id),
      store.listIn('doses', profile.id, 'dateKey', [dateKey, yesterday]),
   ]);
   const planned = medications.flatMap((medication) =>
      plannedDoses(
         medication,
         profile.routine,
         dateKey,
         profile.utcOffsetMinutes,
      ),
   );
   const { day, toCreate } = mergeDay(
      planned,
      stored.filter((dose) => dose.dateKey === dateKey),
   );
   if (toCreate.length > 0) {
      await store.putMany('doses', toCreate);
   }
   return {
      dateKey,
      medications,
      today: day,
      carriedOver: stored
         .filter((dose) => dose.dateKey === yesterday && isOpen(dose))
         .sort((first, second) => first.dueAt - second.dueAt),
   };
}

/**
 * Purpose: record what happened to a dose on behalf of a member. Checks
 * the member's permission, applies the dose rules, lowers the stock
 * when the dose was taken, and tells caretakers when the answer was
 * "not sure".
 */
export async function recordDose(
   profile: CareProfile,
   member: Member,
   doseId: string,
   status: Exclude<DoseStatus, 'unconfirmed'>,
   method: ConfirmMethod,
   reason: string,
   now: number,
): Promise<Result<DoseRecord>> {
   if (!can(member, 'confirmDoses', profile)) {
      return { ok: false, error: 'You are not allowed to record doses.' };
   }
   const store = getStore();
   const dose = await store.get('doses', profile.id, doseId);
   if (!dose) {
      return { ok: false, error: 'That dose was not found.' };
   }
   const medication = await store.get(
      'medications',
      profile.id,
      dose.medicationId,
   );
   if (!medication) {
      return { ok: false, error: 'That medicine was not found.' };
   }
   const confirmed = confirmDose(
      dose,
      { status, byId: member.id, byRole: member.role, method, reason },
      now,
   );
   if (!confirmed.ok) {
      return confirmed;
   }
   await store.put('doses', confirmed.value);
   const change = stockChange(dose.status, status, medication.unitsPerDose);
   if (change !== 0) {
      await store.put('medications', {
         ...medication,
         stock: Math.max(0, medication.stock + change),
      });
   }
   await recordAudit(
      profile,
      member,
      `Dose ${status}`,
      `${medication.name}, ${anchorLabel('en', dose.anchor)}` +
         (confirmed.value.confirmMethod
            ? ` (${confirmed.value.confirmMethod})`
            : ''),
   );
   if (status === 'unsure') {
      await tellCaretakersUnsure(profile, medication);
   }
   return confirmed;
}

/**
 * Purpose: email the caretakers (or family when there are none) that
 * the elder is not sure a dose was taken. Skipped while sharing is
 * paused.
 */
async function tellCaretakersUnsure(
   profile: CareProfile,
   medication: Medication,
): Promise<void> {
   if (profile.sharingPaused) {
      return;
   }
   const members = await getStore().list('members', profile.id);
   const active = members.filter(
      (member) => member.active && member.email !== '',
   );
   const caretakers = active.filter((member) => member.role === 'caretaker');
   const recipients =
      caretakers.length > 0
         ? caretakers
         : active.filter((member) => member.role === 'family');
   for (const recipient of recipients) {
      await sendToMember(
         profile,
         recipient,
         'unsureDose',
         unsureDoseEmail(
            recipient.name,
            profile.elderName,
            {
               name: medication.name,
               strength: medication.strength,
               foodNote: foodNote(medication, 'en'),
            },
            `${appBaseUrl()}/home`,
         ),
         medication.id,
      );
   }
}

/**
 * Purpose: record that a member is handling an unresolved dose, which
 * stops further escalation.
 */
export async function recordAcknowledge(
   profile: CareProfile,
   member: Member,
   doseId: string,
): Promise<Result<DoseRecord>> {
   if (!can(member, 'viewMedications', profile)) {
      return { ok: false, error: 'You are not allowed to see doses.' };
   }
   const store = getStore();
   const dose = await store.get('doses', profile.id, doseId);
   if (!dose) {
      return { ok: false, error: 'That dose was not found.' };
   }
   const updated = acknowledgeDose(dose, member.id);
   await store.put('doses', updated);
   await recordAudit(profile, member, 'Dose acknowledged', doseId);
   return { ok: true, value: updated };
}
