'use server';

/**
 * Medical record actions.
 *
 * Purpose: upload a prescription, lab report or discharge summary, change
 * its short summary, and delete it. Files are checked for type and size
 * before they are stored, and only the elder may delete a record.
 */
import { fail, field, succeed } from '@/app/actions/helpers';
import { checkUpload, parseDocumentKind } from '@/domain/documentForm';
import { can, isOwner } from '@/domain/permissions';
import type { CareProfile, Member } from '@/domain/types';
import { optionalText, requireName } from '@/domain/validation';
import { recordAudit } from '@/services/audit';
import { newId } from '@/services/ids';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/records';

/**
 * Purpose: true when the member may add records and change summaries.
 * The elder always may; others need both permissions.
 */
function mayUpload(member: Member, profile: CareProfile): boolean {
   return (
      can(member, 'viewDocuments', profile) &&
      can(member, 'manageTasks', profile)
   );
}

/**
 * Purpose: store a new record with its file. Side effect: writes one
 * document and one audit entry.
 */
export async function uploadDocumentAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!mayUpload(member, profile)) {
      fail(PAGE, 'You are not allowed to add records.');
   }
   const title = requireName(field(form, 'title'), 'Title');
   if (!title.ok) {
      fail(PAGE, title.error);
   }
   const summary = optionalText(field(form, 'summary'), 'Summary');
   if (!summary.ok) {
      fail(PAGE, summary.error);
   }
   const file = form.get('file');
   if (!(file instanceof File)) {
      fail(PAGE, 'Choose a file to upload.');
   }
   const checked = checkUpload({
      name: file.name,
      type: file.type,
      size: file.size,
   });
   if (!checked.ok) {
      fail(PAGE, checked.error);
   }
   const bytes = Buffer.from(await file.arrayBuffer());
   await getStore().put('documents', {
      id: newId(),
      profileId: profile.id,
      title: title.value,
      kind: parseDocumentKind(field(form, 'kind')),
      mime: file.type,
      data: bytes.toString('base64'),
      summary: summary.value,
      uploadedById: member.id,
      at: now,
   });
   await recordAudit(profile, member, 'Record uploaded', title.value);
   succeed(PAGE, 'Record saved.');
}

/**
 * Purpose: change the summary of a record and nothing else. Side effect:
 * writes the updated document and one audit entry.
 */
export async function saveSummaryAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!mayUpload(member, profile)) {
      fail(PAGE, 'You are not allowed to change records.');
   }
   const store = getStore();
   const document = await store.get(
      'documents',
      profile.id,
      field(form, 'documentId'),
   );
   if (!document) {
      fail(PAGE, 'That record was not found.');
   }
   const summary = optionalText(field(form, 'summary'), 'Summary');
   if (!summary.ok) {
      fail(PAGE, summary.error);
   }
   await store.put('documents', { ...document, summary: summary.value });
   await recordAudit(profile, member, 'Record summary saved', document.title);
   succeed(PAGE, 'Summary saved.');
}

/**
 * Purpose: delete a record. Only the elder may do this. Side effect:
 * removes the document and writes one audit entry.
 */
export async function deleteDocumentAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!isOwner(member, profile)) {
      fail(PAGE, 'Only the elder can delete a record.');
   }
   const store = getStore();
   const documentId = field(form, 'documentId');
   const document = await store.get('documents', profile.id, documentId);
   if (!document) {
      fail(PAGE, 'That record was not found.');
   }
   await store.remove('documents', profile.id, documentId);
   await recordAudit(profile, member, 'Record deleted', document.title);
   succeed(PAGE, 'Record deleted.');
}
