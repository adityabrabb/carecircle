'use server';

/**
 * Medicine actions.
 *
 * Purpose: add, change and stop medicines, decide proposals, and
 * update stock. Each action checks input and permissions, then hands
 * the change to the medicines service, which applies the consent
 * rules.
 */
import { fail, field, fields, succeed } from '@/app/actions/helpers';
import {
   ALLOWED_DOCUMENT_TYPES,
   MAX_PHOTO_BYTES,
   MAX_STOCK,
} from '@/constants/care';
import { parseMedicationForm } from '@/domain/medicationForm';
import { can } from '@/domain/permissions';
import type { ProposalKind, Result } from '@/domain/types';
import { optionalText, parseInteger } from '@/domain/validation';
import { newId } from '@/services/ids';
import {
   decideProposal,
   setStock,
   submitChange,
   type ChangeOutcome,
} from '@/services/medicines';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/medicines';

const OUTCOME_TEXT: Record<ChangeOutcome, string> = {
   applied: 'Saved.',
   proposed: 'Sent for approval. Nothing changes until the elder agrees.',
   emergencyApplied:
      'Applied under the emergency plan. The elder has been told.',
};

/**
 * Purpose: read an uploaded pill photo as a data URL. An empty upload
 * is fine; a file that is too large or not an image is refused.
 */
async function readPhoto(form: FormData): Promise<Result<string>> {
   const file = form.get('photo');
   if (!(file instanceof File) || file.size === 0) {
      return { ok: true, value: '' };
   }
   if (
      !file.type.startsWith('image/') ||
      !ALLOWED_DOCUMENT_TYPES.includes(file.type)
   ) {
      return { ok: false, error: 'The photo must be a JPEG, PNG or WebP.' };
   }
   if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: 'The photo is too large. Use a smaller one.' };
   }
   const bytes = Buffer.from(await file.arrayBuffer());
   return {
      ok: true,
      value: `data:${file.type};base64,${bytes.toString('base64')}`,
   };
}

/** Purpose: add a new medicine or change an existing one. */
export async function saveMedicationAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   const existingId = field(form, 'medicationId');
   const existing = existingId
      ? await getStore().get('medications', profile.id, existingId)
      : null;
   if (existingId && !existing) {
      fail(PAGE, 'That medicine was not found.');
   }
   const photo = await readPhoto(form);
   if (!photo.ok) {
      fail(PAGE, photo.error);
   }
   const parsed = parseMedicationForm(
      {
         values: Object.fromEntries(form.entries()),
         anchors: fields(form, 'anchors'),
         photo: photo.value,
      },
      {
         id: existing?.id ?? newId(),
         profileId: profile.id,
         now,
         existing,
      },
   );
   if (!parsed.ok) {
      fail(PAGE, parsed.error);
   }
   const note = optionalText(field(form, 'note'), 'Note');
   if (!note.ok) {
      fail(PAGE, note.error);
   }
   const kind: ProposalKind = existing ? 'editMedication' : 'addMedication';
   const outcome = await submitChange(
      profile,
      member,
      kind,
      parsed.value,
      note.value,
      field(form, 'urgent') === 'on',
      now,
   );
   if (!outcome.ok) {
      fail(PAGE, outcome.error);
   }
   succeed(PAGE, OUTCOME_TEXT[outcome.value]);
}

/** Purpose: stop a medicine (kept on file as stopped). */
export async function stopMedicationAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   const medication = await getStore().get(
      'medications',
      profile.id,
      field(form, 'medicationId'),
   );
   if (!medication) {
      fail(PAGE, 'That medicine was not found.');
   }
   const outcome = await submitChange(
      profile,
      member,
      'stopMedication',
      medication,
      '',
      field(form, 'urgent') === 'on',
      now,
   );
   if (!outcome.ok) {
      fail(PAGE, outcome.error);
   }
   succeed(PAGE, OUTCOME_TEXT[outcome.value]);
}

/** Purpose: the elder approves or rejects a proposal. */
export async function decideProposalAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   const approve = field(form, 'decision') === 'approve';
   const result = await decideProposal(
      profile,
      member,
      field(form, 'proposalId'),
      approve,
      now,
   );
   if (!result.ok) {
      fail(PAGE, result.error);
   }
   succeed(PAGE, approve ? 'Approved. The change is now active.' : 'Rejected.');
}

/** Purpose: correct the number of tablets in stock. */
export async function setStockAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'viewMedications', profile)) {
      fail(PAGE, 'You are not allowed to see medicines.');
   }
   const stock = parseInteger(field(form, 'stock'), 'Stock', 0, MAX_STOCK);
   if (!stock.ok) {
      fail(PAGE, stock.error);
   }
   const result = await setStock(
      profile,
      member,
      field(form, 'medicationId'),
      stock.value,
      now,
   );
   if (!result.ok) {
      fail(PAGE, result.error);
   }
   succeed(PAGE, `Stock for ${result.value.name} set to ${stock.value}.`);
}
