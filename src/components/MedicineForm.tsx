/**
 * Medicine form.
 *
 * Purpose: the form used to add or change a medicine. Times are chosen
 * as moments in the elder's routine, not clock times. A helper adds a
 * note for the elder, and the trusted person can mark a change urgent
 * under the emergency plan.
 */
import { saveMedicationAction } from '@/app/actions/medicines';
import {
   MAX_STOCK,
   MAX_UNITS_PER_DOSE,
   ROUTINE_ANCHORS,
} from '@/constants/care';
import type { Medication } from '@/domain/types';
import { anchorLabel } from '@/i18n/strings';

export interface MedicineFormProps {
   /** Unique prefix so several forms can share a page. */
   formId: string;
   /** Starting values: the medicine being edited, or a scanned draft. */
   initial: Partial<Medication>;
   /** Set when editing an existing medicine. */
   medicationId: string;
   /** True when the person filling the form is not the elder. */
   isHelper: boolean;
   /** True when this person may act under the emergency plan. */
   mayBeUrgent: boolean;
   submitLabel: string;
}

export function MedicineForm({
   formId,
   initial,
   medicationId,
   isHelper,
   mayBeUrgent,
   submitLabel,
}: MedicineFormProps) {
   const id = (name: string): string => `${formId}-${name}`;
   const anchors = initial.anchors ?? [];
   return (
      <form className="stack" action={saveMedicationAction}>
         <input type="hidden" name="medicationId" value={medicationId} />
         <div className="field-grid">
            <div>
               <label htmlFor={id('name')}>Medicine name</label>
               <input
                  id={id('name')}
                  name="name"
                  type="text"
                  required
                  maxLength={80}
                  defaultValue={initial.name ?? ''}
               />
            </div>
            <div>
               <label htmlFor={id('strength')}>
                  Strength and form
                  <span className="hint">For example: 500 mg tablet</span>
               </label>
               <input
                  id={id('strength')}
                  name="strength"
                  type="text"
                  maxLength={80}
                  defaultValue={initial.strength ?? ''}
               />
            </div>
            <div>
               <label htmlFor={id('purpose')}>
                  What it is for
                  <span className="hint">In plain words, for the elder</span>
               </label>
               <input
                  id={id('purpose')}
                  name="purpose"
                  type="text"
                  maxLength={120}
                  defaultValue={initial.purpose ?? ''}
               />
            </div>
         </div>
         <fieldset>
            <legend>When to take it</legend>
            <div className="field-grid">
               {ROUTINE_ANCHORS.map((anchor) => (
                  <label className="check" key={anchor}>
                     <input
                        type="checkbox"
                        name="anchors"
                        value={anchor}
                        defaultChecked={anchors.includes(anchor)}
                     />
                     {anchorLabel('en', anchor)}
                  </label>
               ))}
            </div>
         </fieldset>
         <div className="field-grid">
            <div>
               <label htmlFor={id('food')}>Food</label>
               <select
                  id={id('food')}
                  name="food"
                  defaultValue={initial.food ?? 'any'}
               >
                  <option value="any">Does not matter</option>
                  <option value="before">Before food</option>
                  <option value="with">With food</option>
                  <option value="after">After food</option>
               </select>
            </div>
            <div>
               <label htmlFor={id('unitsPerDose')}>Tablets per dose</label>
               <input
                  id={id('unitsPerDose')}
                  name="unitsPerDose"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_UNITS_PER_DOSE}
                  required
                  defaultValue={initial.unitsPerDose ?? 1}
               />
            </div>
            <div>
               <label htmlFor={id('stock')}>Tablets in the house</label>
               <input
                  id={id('stock')}
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_STOCK}
                  required
                  defaultValue={initial.stock ?? 30}
               />
            </div>
            <div>
               <label htmlFor={id('colour')}>Pill colour</label>
               <input
                  id={id('colour')}
                  name="colour"
                  type="color"
                  defaultValue={initial.colour ?? '#fde68a'}
                  style={{ minHeight: 56, width: '100%' }}
               />
            </div>
            <div>
               <label htmlFor={id('photo')}>
                  Photo of the pill or strip
                  <span className="hint">Optional, under 150 KB</span>
               </label>
               <input
                  id={id('photo')}
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
               />
            </div>
            <div>
               <label htmlFor={id('startDate')}>Start date</label>
               <input
                  id={id('startDate')}
                  name="startDate"
                  type="date"
                  defaultValue={initial.startDate ?? ''}
               />
            </div>
            <div>
               <label htmlFor={id('endDate')}>
                  End date
                  <span className="hint">Leave empty if ongoing</span>
               </label>
               <input
                  id={id('endDate')}
                  name="endDate"
                  type="date"
                  defaultValue={initial.endDate ?? ''}
               />
            </div>
         </div>
         <label className="check">
            <input
               type="checkbox"
               name="critical"
               defaultChecked={initial.critical ?? false}
            />
            Must not be missed: alert the circle even at night
         </label>
         {isHelper ? (
            <div>
               <label htmlFor={id('note')}>
                  Note for the elder
                  <span className="hint">
                     Why you are proposing this, for example what the doctor
                     said
                  </span>
               </label>
               <input
                  id={id('note')}
                  name="note"
                  type="text"
                  maxLength={300}
               />
            </div>
         ) : null}
         {mayBeUrgent ? (
            <label className="check">
               <input type="checkbox" name="urgent" />
               This is urgent and the elder cannot respond: apply it now
               under the emergency plan
            </label>
         ) : null}
         <button className="btn" type="submit">
            {submitLabel}
         </button>
      </form>
   );
}
