/**
 * Add member form.
 *
 * Purpose: the elder adds a family member or caretaker to the circle,
 * with their own passcode and an optional email for alerts.
 */
import { addMemberAction } from '@/app/actions/settings';
import {
   MAX_NAME_LENGTH,
   PASSCODE_MAX_LENGTH,
   PASSCODE_MIN_LENGTH,
} from '@/constants/care';

export function AddMemberForm() {
   return (
      <section className="card" aria-labelledby="add-title">
         <h2 id="add-title">Add someone</h2>
         <form className="stack" action={addMemberAction}>
            <div className="field-grid">
               <div>
                  <label htmlFor="name">Name</label>
                  <input
                     id="name"
                     name="name"
                     type="text"
                     required
                     maxLength={MAX_NAME_LENGTH}
                  />
               </div>
               <div>
                  <label htmlFor="role">Role</label>
                  <select id="role" name="role" defaultValue="family">
                     <option value="family">Family</option>
                     <option value="caretaker">Caretaker</option>
                  </select>
               </div>
               <div>
                  <label htmlFor="email">Email (for alerts)</label>
                  <input id="email" name="email" type="email" />
               </div>
               <div>
                  <label htmlFor="passcode">
                     Their passcode
                     <span className="hint">
                        {PASSCODE_MIN_LENGTH} to {PASSCODE_MAX_LENGTH} letters
                        or numbers, different for each person.
                     </span>
                  </label>
                  <input
                     id="passcode"
                     name="passcode"
                     type="password"
                     autoComplete="new-password"
                     required
                     minLength={PASSCODE_MIN_LENGTH}
                     maxLength={PASSCODE_MAX_LENGTH}
                  />
               </div>
            </div>
            <button className="btn" type="submit">
               Add to my circle
            </button>
         </form>
      </section>
   );
}
