'use server';

/**
 * Health reading actions.
 *
 * Purpose: record a blood pressure, blood sugar, weight, symptom or
 * daily check-in, and delete an entry. Anyone the elder allowed to see
 * health readings may add one; only the elder or the person who recorded
 * an entry may delete it.
 */
import { fail, field, succeed } from '@/app/actions/helpers';
import { READING_LABELS } from '@/constants/labels';
import { can, isOwner } from '@/domain/permissions';
import { parseReadingForm } from '@/domain/readingForm';
import { recordAudit } from '@/services/audit';
import { newId } from '@/services/ids';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/health';

/** The form fields a reading can carry; each is read as text. */
const READING_FIELDS = [
   'kind',
   'systolic',
   'diastolic',
   'value',
   'note',
] as const;

/** Purpose: add a health reading from the form. */
export async function addReadingAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'viewHealth', profile)) {
      fail(PAGE, 'You are not allowed to record health readings.');
   }
   const values = Object.fromEntries(
      READING_FIELDS.map((name) => [name, field(form, name)]),
   );
   const parsed = parseReadingForm(values, {
      id: newId(),
      profileId: profile.id,
      byId: member.id,
      now,
   });
   if (!parsed.ok) {
      fail(PAGE, parsed.error);
   }
   await getStore().put('readings', parsed.value);
   await recordAudit(
      profile,
      member,
      'Reading added',
      READING_LABELS[parsed.value.kind],
   );
   succeed(PAGE, 'Reading saved.');
}

/**
 * Purpose: delete one health reading. Side effect: removes the record.
 * Allowed for the elder and for the member who recorded the reading.
 */
export async function deleteReadingAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   const store = getStore();
   const reading = await store.get(
      'readings',
      profile.id,
      field(form, 'readingId'),
   );
   if (!reading) {
      fail(PAGE, 'That entry was not found.');
   }
   if (!isOwner(member, profile) && reading.byId !== member.id) {
      fail(PAGE, 'Only the elder or the person who recorded it can delete it.');
   }
   await store.remove('readings', profile.id, reading.id);
   await recordAudit(
      profile,
      member,
      'Reading deleted',
      READING_LABELS[reading.kind],
   );
   succeed(PAGE, 'Entry deleted.');
}
