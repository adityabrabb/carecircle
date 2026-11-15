/**
 * Member card.
 *
 * Purpose: one person in the circle on the settings page. The elder
 * sees a form to change what this person may do; everyone else sees
 * the list of what the person has been allowed.
 */
import Link from 'next/link';
import { updateAccessAction } from '@/app/actions/settings';
import { ALL_PERMISSIONS } from '@/constants/care';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/constants/labels';
import type { Member } from '@/domain/types';

/** Purpose: the elder's form for one helper's permissions. */
function AccessForm({ person }: { person: Member }) {
   return (
      <form className="stack" action={updateAccessAction}>
         <input type="hidden" name="memberId" value={person.id} />
         <fieldset>
            <legend>{person.name} may</legend>
            {ALL_PERMISSIONS.map((permission) => (
               <label className="check" key={permission}>
                  <input
                     type="checkbox"
                     name="permissions"
                     value={permission}
                     defaultChecked={person.permissions.includes(permission)}
                  />
                  {PERMISSION_LABELS[permission]}
               </label>
            ))}
         </fieldset>
         <label className="check">
            <input type="checkbox" name="active" defaultChecked={person.active} />
            Can sign in
         </label>
         <div className="row">
            <button className="btn small-btn" type="submit">
               Save access
            </button>
            <Link
               className="btn quiet small-btn"
               href={`/settings/preview/${person.id}`}
            >
               See what {person.name} sees
            </Link>
         </div>
      </form>
   );
}

/** Purpose: what this person may do, as a plain list. */
function PermissionList({ person }: { person: Member }) {
   return (
      <ul>
         {person.permissions.map((permission) => (
            <li key={permission}>{PERMISSION_LABELS[permission]}</li>
         ))}
      </ul>
   );
}

export function MemberCard({
   person,
   viewerIsOwner,
}: {
   person: Member;
   viewerIsOwner: boolean;
}) {
   let access = <PermissionList person={person} />;
   if (person.role === 'elder') {
      access = <p>Owner of this profile. Full access, always.</p>;
   } else if (viewerIsOwner) {
      access = <AccessForm person={person} />;
   }
   return (
      <article className="card">
         <h3>{person.name}</h3>
         <p className="row">
            <span className="chip info">{ROLE_LABELS[person.role]}</span>
            {person.active ? null : (
               <span className="chip skipped">Access removed</span>
            )}
         </p>
         <p className="small muted">{person.email || 'No email on file'}</p>
         {access}
      </article>
   );
}
