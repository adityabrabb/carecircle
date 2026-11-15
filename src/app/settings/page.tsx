/**
 * Settings.
 *
 * Purpose: where the elder controls their own care: who is in the
 * circle, what each person sees, pausing sharing, the daily routine and
 * the emergency plan. Other members see what they have been allowed,
 * but cannot change anything here.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
   addMemberAction,
   saveEmergencyAction,
   saveRoutineAction,
   toggleSharingAction,
   updateAccessAction,
} from '@/app/actions/settings';
import { Notice, type NoticeParams } from '@/components/Notice';
import {
   ALL_PERMISSIONS,
   PASSCODE_MAX_LENGTH,
   PASSCODE_MIN_LENGTH,
   ROUTINE_ANCHORS,
} from '@/constants/care';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/constants/labels';
import { isOwner } from '@/domain/permissions';
import { formatLocal } from '@/domain/time';
import { anchorLabel } from '@/i18n/strings';
import { emergencyCardPath } from '@/services/links';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Settings' };

const AUDIT_ROWS = 25;

export default async function SettingsPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const store = getStore();
   const owner = isOwner(member, profile);
   const members = (await store.list('members', profile.id)).sort(
      (first, second) => first.escalationOrder - second.escalationOrder,
   );
   const audit = owner
      ? (await store.list('audit', profile.id))
           .sort((first, second) => second.at - first.at)
           .slice(0, AUDIT_ROWS)
      : [];
   const helpers = members.filter((person) => person.role !== 'elder');
   const card = profile.emergencyCard;
   const plan = profile.emergencyPlan;
   const cardPath = emergencyCardPath(profile);

   return (
      <>
         <div className="page-head">
            <h1>Settings</h1>
            <p>
               {owner
                  ? 'This is your profile. You decide who sees it and ' +
                    'what they can do.'
                  : `This profile belongs to ${profile.elderName}. Only ` +
                    'they can change these settings.'}
            </p>
         </div>
         <Notice params={await searchParams} />

         <section className="card tint-marigold" aria-labelledby="code-title">
            <h2 id="code-title">Circle code</h2>
            <p>
               Share this code, and a passcode you set below, with each
               person you want in your circle.
            </p>
            <p>
               <span className="code">{profile.circleCode}</span>
            </p>
         </section>

         {owner ? (
            <section className="card" aria-labelledby="pause-title">
               <h2 id="pause-title">Sharing</h2>
               <p>
                  {profile.sharingPaused
                     ? 'Sharing is paused. Nobody else can see your ' +
                       'profile or get alerts about it.'
                     : 'Sharing is on. Each person sees only what you ' +
                       'allow below.'}
               </p>
               <form action={toggleSharingAction}>
                  <input
                     type="hidden"
                     name="paused"
                     value={profile.sharingPaused ? 'false' : 'true'}
                  />
                  <button
                     className={`btn ${profile.sharingPaused ? '' : 'warn'}`}
                     type="submit"
                  >
                     {profile.sharingPaused
                        ? 'Resume sharing'
                        : 'Pause all sharing'}
                  </button>
               </form>
            </section>
         ) : null}

         <section aria-labelledby="people-title">
            <h2 id="people-title">People in the circle</h2>
            <div className="grid">
               {members.map((person) => (
                  <article className="card" key={person.id}>
                     <h3>{person.name}</h3>
                     <p className="row">
                        <span className="chip info">
                           {ROLE_LABELS[person.role]}
                        </span>
                        {person.active ? null : (
                           <span className="chip skipped">Access removed</span>
                        )}
                     </p>
                     <p className="small muted">
                        {person.email || 'No email on file'}
                     </p>
                     {person.role === 'elder' ? (
                        <p>Owner of this profile. Full access, always.</p>
                     ) : owner ? (
                        <form className="stack" action={updateAccessAction}>
                           <input
                              type="hidden"
                              name="memberId"
                              value={person.id}
                           />
                           <fieldset>
                              <legend>{person.name} may</legend>
                              {ALL_PERMISSIONS.map((permission) => (
                                 <label className="check" key={permission}>
                                    <input
                                       type="checkbox"
                                       name="permissions"
                                       value={permission}
                                       defaultChecked={person.permissions.includes(
                                          permission,
                                       )}
                                    />
                                    {PERMISSION_LABELS[permission]}
                                 </label>
                              ))}
                           </fieldset>
                           <label className="check">
                              <input
                                 type="checkbox"
                                 name="active"
                                 defaultChecked={person.active}
                              />
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
                     ) : (
                        <ul>
                           {person.permissions.map((permission) => (
                              <li key={permission}>
                                 {PERMISSION_LABELS[permission]}
                              </li>
                           ))}
                        </ul>
                     )}
                  </article>
               ))}
            </div>
         </section>

         {owner ? (
            <>
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
                              maxLength={80}
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
                                 {PASSCODE_MIN_LENGTH} to {PASSCODE_MAX_LENGTH}{' '}
                                 letters or numbers, different for each
                                 person.
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

               <section className="card" aria-labelledby="routine-title">
                  <h2 id="routine-title">My daily routine</h2>
                  <p>
                     Medicines follow your routine. Change a time here and
                     every dose tied to it moves with it.
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

               <section className="card" aria-labelledby="plan-title">
                  <h2 id="plan-title">If I cannot respond</h2>
                  <p>
                     Decide now what should happen in an emergency. Your
                     silence is never treated as agreement; only this plan
                     lets someone act for you.
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
                        In an emergency this person may change my medicines
                        without waiting for me. I will be told.
                     </label>
                     <div>
                        <label htmlFor="instructions">My instructions</label>
                        <textarea
                           id="instructions"
                           name="instructions"
                           maxLength={1000}
                           defaultValue={plan.instructions}
                        />
                     </div>
                     <h3>Emergency card</h3>
                     <div className="field-grid">
                        <div>
                           <label htmlFor="bloodGroup">Blood group</label>
                           <input
                              id="bloodGroup"
                              name="bloodGroup"
                              type="text"
                              defaultValue={card.bloodGroup}
                           />
                        </div>
                        <div>
                           <label htmlFor="allergies">Allergies</label>
                           <input
                              id="allergies"
                              name="allergies"
                              type="text"
                              defaultValue={card.allergies}
                           />
                        </div>
                        <div>
                           <label htmlFor="conditions">Conditions</label>
                           <input
                              id="conditions"
                              name="conditions"
                              type="text"
                              defaultValue={card.conditions}
                           />
                        </div>
                        <div>
                           <label htmlFor="doctorName">Doctor</label>
                           <input
                              id="doctorName"
                              name="doctorName"
                              type="text"
                              defaultValue={card.doctorName}
                           />
                        </div>
                        <div>
                           <label htmlFor="doctorPhone">Doctor phone</label>
                           <input
                              id="doctorPhone"
                              name="doctorPhone"
                              type="text"
                              defaultValue={card.doctorPhone}
                           />
                        </div>
                        <div>
                           <label htmlFor="emergencyContact">
                              Emergency contact
                           </label>
                           <input
                              id="emergencyContact"
                              name="emergencyContact"
                              type="text"
                              defaultValue={card.emergencyContact}
                           />
                        </div>
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
                     <p style={{ marginTop: 12 }}>
                        <Link href={cardPath}>
                           Open my emergency card
                        </Link>{' '}
                        (print it or save the link on a family phone)
                     </p>
                  ) : null}
               </section>

               <section className="card" aria-labelledby="audit-title">
                  <h2 id="audit-title">Who did what</h2>
                  <div className="table-wrap">
                     <table>
                        <caption className="visually-hidden">
                           Recent activity on this profile
                        </caption>
                        <thead>
                           <tr>
                              <th scope="col">When</th>
                              <th scope="col">Who</th>
                              <th scope="col">What</th>
                           </tr>
                        </thead>
                        <tbody>
                           {audit.map((entry) => (
                              <tr key={entry.id}>
                                 <td>
                                    {formatLocal(
                                       entry.at,
                                       profile.utcOffsetMinutes,
                                    )}
                                 </td>
                                 <td>{entry.actorName}</td>
                                 <td>
                                    {entry.action}
                                    {entry.detail ? `: ${entry.detail}` : ''}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <p className="small muted">
                     App time now: {formatLocal(now, profile.utcOffsetMinutes)}
                  </p>
               </section>
            </>
         ) : null}
      </>
   );
}
