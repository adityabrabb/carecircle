'use client';

/**
 * Prescription scan panel.
 *
 * Purpose: let a person upload a photo or PDF of a prescription, see what
 * the reader found, and check each medicine through the normal medicine
 * form. Nothing is saved until the person presses that form's button.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type ScanState, scanPrescriptionAction } from '@/app/actions/scan';
import { MedicineForm } from '@/components/MedicineForm';
import { MAX_DOCUMENT_BYTES } from '@/constants/care';
import type { ComparedDraft } from '@/domain/prescriptionParse';

export interface ScanPanelProps {
   isHelper: boolean;
   mayBeUrgent: boolean;
   available: boolean;
}

const EMPTY_STATE: ScanState = {
   error: '',
   compared: [],
   missing: [],
   scanned: false,
};
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const BYTES_PER_KB = 1_000;

const CHIP: Record<
   ComparedDraft['status'],
   { className: string; label: string }
> = {
   new: { className: 'chip info', label: '+ New medicine' },
   changed: { className: 'chip unsure', label: '! Different from your list' },
   same: { className: 'chip taken', label: '✓ Already on your list' },
};

/** Purpose: the line above the results, saying how many were found. */
function countText(total: number): string {
   if (total === 0) {
      return 'No medicines were found. Try a clearer photo, or type the ' +
         'medicine in.';
   }
   return `${total} medicine${total === 1 ? '' : 's'} found on the prescription.`;
}

/** Purpose: the upload button, showing progress while the file is read. */
function ReadButton({ available }: { available: boolean }) {
   const { pending } = useFormStatus();
   return (
      <button className="btn" type="submit" disabled={pending || !available}>
         {pending ? 'Reading...' : 'Read the prescription'}
      </button>
   );
}

/** Purpose: upload a prescription and list the medicines it names. */
export function ScanPanel({
   isHelper,
   mayBeUrgent,
   available,
}: ScanPanelProps) {
   const [state, formAction] = useActionState(
      scanPrescriptionAction,
      EMPTY_STATE,
   );
   const submitLabel = isHelper ? 'Send for approval' : 'Save after checking';
   return (
      <div className="stack">
         <form className="card stack" action={formAction}>
            <div>
               <label htmlFor="scan-file">
                  Photo or PDF of the prescription
                  <span className="hint">
                     Good light helps. Under{' '}
                     {Math.floor(MAX_DOCUMENT_BYTES / BYTES_PER_KB)} KB.
                  </span>
               </label>
               <input
                  id="scan-file"
                  name="file"
                  type="file"
                  required
                  accept={ACCEPT}
                  capture="environment"
               />
            </div>
            <ReadButton available={available} />
         </form>

         {state.error ? (
            <p className="notice error" role="alert">
               {state.error}
            </p>
         ) : null}

         {state.scanned ? (
            <section className="stack" aria-labelledby="scan-results-title">
               <h2 id="scan-results-title">What the prescription says</h2>
               <p className="notice">
                  Check every line against the paper prescription before
                  saving. The reader can make mistakes.
               </p>
               <p role="status">{countText(state.compared.length)}</p>

               {state.compared.map((item, index) => {
                  const chip = CHIP[item.status];
                  const titleId = `scan-item-${index}`;
                  return (
                     <article
                        className="card"
                        key={`${index}-${item.draft.name}`}
                        aria-labelledby={titleId}
                     >
                        <h3 id={titleId}>
                           {item.draft.name} {item.draft.strength}
                        </h3>
                        <p>
                           <span className={chip.className}>{chip.label}</span>
                        </p>
                        {item.draft.purpose ? <p>{item.draft.purpose}</p> : null}
                        {item.status === 'same' ? (
                           <p className="small muted">No change needed.</p>
                        ) : (
                           <MedicineForm
                              formId={`scan-${index}`}
                              initial={item.draft}
                              medicationId={item.matchId}
                              isHelper={isHelper}
                              mayBeUrgent={mayBeUrgent}
                              submitLabel={submitLabel}
                           />
                        )}
                     </article>
                  );
               })}

               {state.missing.length > 0 ? (
                  <section
                     className="card tint-marigold"
                     aria-labelledby="scan-missing-title"
                  >
                     <h3 id="scan-missing-title">Not on this prescription</h3>
                     <p>
                        On your list but not on this prescription. Ask the
                        doctor before stopping anything.
                     </p>
                     <ul className="list">
                        {state.missing.map((medicine) => (
                           <li key={medicine.id}>{medicine.name}</li>
                        ))}
                     </ul>
                  </section>
               ) : null}
            </section>
         ) : null}
      </div>
   );
}
