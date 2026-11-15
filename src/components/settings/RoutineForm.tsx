/**
 * Routine form.
 *
 * Purpose: the elder's daily routine and language. Medicines are tied
 * to these times, so changing one moves every dose tied to it.
 */
import { saveRoutineAction } from '@/app/actions/settings';
import { ROUTINE_ANCHORS } from '@/constants/care';
import type { CareProfile } from '@/domain/types';
import { anchorLabel } from '@/i18n/strings';

export function RoutineForm({ profile }: { profile: CareProfile }) {
   return (
      <section className="card" aria-labelledby="routine-title">
         <h2 id="routine-title">My daily routine</h2>
         <p>
            Medicines follow your routine. Change a time here and every dose
            tied to it moves with it.
         </p>
         <form className="stack" action={saveRoutineAction}>
            <div className="field-grid">
               {ROUTINE_ANCHORS.map((anchor) => (
                  <div key={anchor}>
                     <label htmlFor={`routine-${anchor}`}>
                        {anchorLabel('en', anchor)}
                     </label>
                     <input
                        id={`routine-${anchor}`}
                        name={anchor}
                        type="time"
                        required
                        defaultValue={profile.routine[anchor]}
                     />
                  </div>
               ))}
               <div>
                  <label htmlFor="language">My language</label>
                  <select
                     id="language"
                     name="language"
                     defaultValue={profile.language}
                  >
                     <option value="en">English</option>
                     <option value="hi">हिन्दी (Hindi)</option>
                  </select>
               </div>
            </div>
            <button className="btn" type="submit">
               Save routine
            </button>
         </form>
      </section>
   );
}
