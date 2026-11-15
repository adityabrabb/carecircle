'use server';

/**
 * Prescription scan action.
 *
 * Purpose: read an uploaded prescription with Gemini, check the reply,
 * and compare the medicines with the current list. This action only
 * returns what it found; nothing is saved here. A person checks each
 * medicine and saves it through the normal medicine form.
 */
import {
   ALLOWED_DOCUMENT_TYPES,
   MAX_DOCUMENT_BYTES,
} from '@/constants/care';
import { can, routeChange } from '@/domain/permissions';
import {
   compareWithCurrent,
   type ComparedDraft,
   notOnPrescription,
   parseExtraction,
} from '@/domain/prescriptionParse';
import { recordAudit } from '@/services/audit';
import { extractPrescription } from '@/services/gemini';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export interface ScanState {
   error: string;
   compared: ComparedDraft[];
   missing: { id: string; name: string }[];
   scanned: boolean;
}

/** Purpose: a state that shows only an error message. */
function failed(error: string): ScanState {
   return { error, compared: [], missing: [], scanned: false };
}

/**
 * Purpose: read the uploaded prescription and list what it says against
 * the current medicines. Side effect: sends the file to Gemini and writes
 * one audit entry. Returns state; does not redirect.
 */
export async function scanPrescriptionAction(
   previous: ScanState,
   form: FormData,
): Promise<ScanState> {
   const { profile, member } = await requireContext();
   if (
      !can(member, 'viewMedications', profile) ||
      routeChange(member, profile, false) === 'deny'
   ) {
      return failed('You are not allowed to add medicines from a prescription.');
   }
   const file = form.get('file');
   if (!(file instanceof File) || file.size === 0) {
      return failed('Choose a photo or PDF of the prescription first.');
   }
   if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return failed('The file must be a PDF, JPEG, PNG or WebP.');
   }
   if (file.size > MAX_DOCUMENT_BYTES) {
      return failed('The file is too large. Use a smaller photo or PDF.');
   }
   const bytes = Buffer.from(await file.arrayBuffer());
   const extracted = await extractPrescription(bytes, file.type);
   if (!extracted.ok) {
      return failed(extracted.error);
   }
   const drafts = parseExtraction(extracted.value);
   const medications = await getStore().list('medications', profile.id);
   const missing = notOnPrescription(drafts, medications).map((medication) => ({
      id: medication.id,
      name: medication.name,
   }));
   await recordAudit(
      profile,
      member,
      'Prescription scanned',
      `${drafts.length} medicine(s) found`,
   );
   return {
      error: '',
      compared: compareWithCurrent(drafts, medications),
      missing,
      scanned: true,
   };
}
