/**
 * Emergency plan form.
 *
 * Purpose: what should happen if the elder cannot respond: who may act
 * for them, their instructions, and the emergency card. The card
 * fields are listed once as data and drawn by one loop.
 */
import Link from 'next/link';
import { saveEmergencyAction } from '@/app/actions/settings';
import { MAX_TEXT_LENGTH } from '@/constants/care';
import type { CareProfile, EmergencyCard, Member } from '@/domain/types';

type CardTextField = Exclude<keyof EmergencyCard, 'shareByLink'>;

const CARD_FIELDS: readonly { name: CardTextField; label: string }[] = [
   { name: 'bloodGroup', label: 'Blood group' },
   { name: 'allergies', label: 'Allergies' },
   { name: 'conditions', label: 'Conditions' },
   { name: 'doctorName', label: 'Doctor' },
   { name: 'doctorPhone', label: 'Doctor phone' },
   { name: 'emergencyContact', label: 'Emergency contact' },
];

export function EmergencyPlanForm({
   profile,
   helpers,
   cardPath,
}: {
   profile: CareProfile;
   helpers: readonly Member[];
   cardPath: string;
}) {
   const card = profile.emergencyCard;
   const plan = profile.emergencyPlan;
   return (
      <section className="card" aria-labelledby="plan-title">
         <h2 id="plan-title">If I cannot respond</h2>
         <p>
            Decide now what should happen in an emergency. Your silence is
            never treated as agreement; only this plan lets someone act for
            you.
         </p>
         <form className="stack" action={saveEmergencyAction}>
            <div>
               <label htmlFor="trustedMemberId">
                  Person I trust to act for me
               </label>
               <select
                  id="trustedMemberId"
                  name="trustedMemberId"
                  defaultValue={plan.trustedMemberId ?? ''}
               >
                  <option value="">Nobody</option>
                  {helpers.map((person) => (
                     <option key={person.id} value={person.id}>
                        {person.name}
                     </option>
                  ))}
               </select>
            </div>
            <label className="check">
               <input
                  type="checkbox"
                  name="allowUrgentChanges"
                  defaultChecked={plan.allowUrgentChanges}
               />
               In an emergency this person may change my medicines without
               waiting for me. I will be told.
            </label>
            <div>
               <label htmlFor="instructions">My instructions</label>
               <textarea
                  id="instructions"
                  name="instructions"
                  maxLength={MAX_TEXT_LENGTH}
                  defaultValue={plan.instructions}
               />
            </div>
            <h3>Emergency card</h3>
            <div className="field-grid">
               {CARD_FIELDS.map((field) => (
                  <div key={field.name}>
                     <label htmlFor={field.name}>{field.label}</label>
                     <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        defaultValue={card[field.name]}
                     />
                  </div>
               ))}
            </div>
            <label className="check">
               <input
                  type="checkbox"
                  name="shareByLink"
                  defaultChecked={card.shareByLink}
               />
               Allow the emergency card to be opened by link
            </label>
            <button className="btn" type="submit">
               Save emergency plan
            </button>
         </form>
         {card.shareByLink ? (
            <p className="after-form">
               <Link href={cardPath}>Open my emergency card</Link> (print it
               or save the link on a family phone)
            </p>
         ) : null}
      </section>
   );
}
