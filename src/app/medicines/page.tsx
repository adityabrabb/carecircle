/**
 * Medicines.
 *
 * Purpose: the full medicine list with schedule, stock and refill
 * forecast, the week's adherence record, and the proposals waiting for
 * the elder's decision. Changes made here follow the consent rules.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
   decideProposalAction,
   setStockAction,
   stopMedicationAction,
} from '@/app/actions/medicines';
import { MedicineForm } from '@/components/MedicineForm';
import { Notice, type NoticeParams } from '@/components/Notice';
import { PillBadge } from '@/components/PillBadge';
import { MAX_STOCK, PATTERN_WINDOW_DAYS } from '@/constants/care';
import { summariseAdherence } from '@/domain/adherence';
import { describeChange, describeSchedule } from '@/domain/medicationForm';
import { can, isOwner, routeChange } from '@/domain/permissions';
import { forecastRefill } from '@/domain/refill';
import { formatLocal, localDateKey, shiftDateKey } from '@/domain/time';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Medicines' };

export default async function MedicinesPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const notice = <Notice params={await searchParams} />;
   if (!can(member, 'viewMedications', profile)) {
      return (
         <>
            {notice}
            <div className="page-head">
               <h1>Medicines</h1>
            </div>
            <p className="card">
               {profile.elderName} has not shared medicines with you.
            </p>
         </>
      );
   }
   const store = getStore();
   const today = localDateKey(now, profile.utcOffsetMinutes);
   const week = Array.from({ length: PATTERN_WINDOW_DAYS }, (_, index) =>
      shiftDateKey(today, -index),
   );
   const [medications, proposals, members, doses] = await Promise.all([
      store.list('medications', profile.id),
      store.listIn('proposals', profile.id, 'status', ['pending']),
      store.list('members', profile.id),
      store.listIn('doses', profile.id, 'dateKey', week),
   ]);
   const owner = isOwner(member, profile);
   const route = routeChange(member, profile, false);
   const mayBeUrgent = routeChange(member, profile, true) === 'emergency';
   const names = new Map(members.map((person) => [person.id, person.name]));
   const active = medications
      .filter((medication) => medication.status === 'active')
      .sort((first, second) => first.name.localeCompare(second.name));
   const stopped = medications.filter(
      (medication) => medication.status === 'stopped',
   );
   const adherence = summariseAdherence(doses, now);
   const mayStock = can(member, 'manageTasks', profile);

   return (
      <>
         <div className="page-head">
            <h1>Medicines</h1>
            <p>
               {owner
                  ? 'Your medicines. Changes you make take effect at once.'
                  : route === 'deny'
                    ? `You can see ${profile.elderName}'s medicines.`
                    : `You can propose changes. ${profile.elderName} ` +
                      'decides.'}
            </p>
         </div>
         {notice}

         {proposals.length > 0 ? (
            <section
               className="card tint-marigold"
               aria-labelledby="proposals-title"
            >
               <h2 id="proposals-title">Waiting for a decision</h2>
               <ul className="list">
                  {proposals.map((proposal) => (
                     <li key={proposal.id}>
                        <p>
                           <strong>
                              {describeChange(
                                 proposal.kind,
                                 proposal.medication,
                              )}
                           </strong>
                        </p>
                        <p className="small">
                           Proposed by{' '}
                           {names.get(proposal.proposedById) ?? 'a member'} on{' '}
                           {formatLocal(
                              proposal.createdAt,
                              profile.utcOffsetMinutes,
                           )}
                           {proposal.note ? `. Note: ${proposal.note}` : ''}
                        </p>
                        {owner ? (
                           <form className="row" action={decideProposalAction}>
                              <input
                                 type="hidden"
                                 name="proposalId"
                                 value={proposal.id}
                              />
                              <button
                                 className="btn"
                                 type="submit"
                                 name="decision"
                                 value="approve"
                              >
                                 ✓ Approve
                              </button>
                              <button
                                 className="btn quiet"
                                 type="submit"
                                 name="decision"
                                 value="reject"
                              >
                                 ✕ Reject
                              </button>
                           </form>
                        ) : (
                           <p className="small muted">
                              Waiting for {profile.elderName}. Nothing has
                              changed yet.
                           </p>
                        )}
                     </li>
                  ))}
               </ul>
            </section>
         ) : null}

         <section className="card" aria-labelledby="week-title">
            <h2 id="week-title">This week</h2>
            <div className="row">
               <span className="big-number">{adherence.takenPercent}%</span>
               <span>
                  taken, of {adherence.due} doses due in the last{' '}
                  {PATTERN_WINDOW_DAYS} days
               </span>
            </div>
            <p className="row" style={{ marginTop: 10 }}>
               <span className="chip taken">✓ Taken {adherence.taken}</span>
               <span className="chip skipped">
                  – Skipped by choice {adherence.skipped}
               </span>
               <span className="chip unsure">? Not sure {adherence.unsure}</span>
               <span className="chip unconfirmed">
                  ○ Not confirmed {adherence.unconfirmed}
               </span>
            </p>
            <p className="small muted">
               How we know: {adherence.firmEvidence} confirmed by the elder
               or seen by a helper, {adherence.assumedEvidence} assumed by a
               helper. Not confirmed does not mean missed.
            </p>
            <p className="no-print">
               <Link className="btn quiet" href="/medicines/chart">
                  Print the weekly chart
               </Link>
            </p>
         </section>

         <section aria-labelledby="list-title">
            <h2 id="list-title">Current medicines</h2>
            {active.length === 0 ? (
               <p className="card">No medicines yet. Add the first one below.</p>
            ) : null}
            <div className="grid">
               {active.map((medication) => {
                  const forecast = forecastRefill(medication, now);
                  return (
                     <article className="card" key={medication.id}>
                        <div className="dose">
                           <PillBadge medication={medication} />
                           <div>
                              <h3>
                                 {medication.name}{' '}
                                 <span className="muted">
                                    {medication.strength}
                                 </span>
                              </h3>
                              <p>{medication.purpose}</p>
                           </div>
                        </div>
                        <p style={{ marginTop: 10 }}>
                           {medication.unitsPerDose}{' '}
                           {describeSchedule(medication)}
                        </p>
                        <p className="row">
                           <span
                              className={`chip ${
                                 forecast.needsRefill ? 'unconfirmed' : 'taken'
                              }`}
                           >
                              {medication.stock} left, about {forecast.daysLeft}{' '}
                              day{forecast.daysLeft === 1 ? '' : 's'}
                           </span>
                           {forecast.needsRefill ? (
                              <span className="chip unsure">Refill soon</span>
                           ) : null}
                           {medication.critical ? (
                              <span className="chip info">
                                 Must not be missed
                              </span>
                           ) : null}
                        </p>
                        {mayStock ? (
                           <form className="row" action={setStockAction}>
                              <input
                                 type="hidden"
                                 name="medicationId"
                                 value={medication.id}
                              />
                              <label
                                 className="small"
                                 htmlFor={`stock-${medication.id}`}
                              >
                                 Count in the house
                              </label>
                              <input
                                 id={`stock-${medication.id}`}
                                 name="stock"
                                 type="number"
                                 inputMode="numeric"
                                 min={0}
                                 max={MAX_STOCK}
                                 defaultValue={medication.stock}
                                 style={{ width: 110 }}
                              />
                              <button
                                 className="btn quiet small-btn"
                                 type="submit"
                              >
                                 Update
                              </button>
                           </form>
                        ) : null}
                        {route !== 'deny' ? (
                           <details>
                              <summary>
                                 {owner ? 'Change' : 'Propose a change'}
                              </summary>
                              <MedicineForm
                                 formId={`edit-${medication.id}`}
                                 initial={medication}
                                 medicationId={medication.id}
                                 isHelper={!owner}
                                 mayBeUrgent={mayBeUrgent}
                                 submitLabel={
                                    owner ? 'Save changes' : 'Send for approval'
                                 }
                              />
                              <form
                                 action={stopMedicationAction}
                                 style={{ marginTop: 12 }}
                              >
                                 <input
                                    type="hidden"
                                    name="medicationId"
                                    value={medication.id}
                                 />
                                 <button className="btn danger" type="submit">
                                    {owner
                                       ? 'Stop this medicine'
                                       : 'Propose stopping'}
                                 </button>
                              </form>
                           </details>
                        ) : null}
                     </article>
                  );
               })}
            </div>
         </section>

         {route !== 'deny' ? (
            <section className="card" aria-labelledby="add-title">
               <h2 id="add-title">
                  {owner ? 'Add a medicine' : 'Propose a new medicine'}
               </h2>
               <p className="no-print">
                  Have a prescription?{' '}
                  <Link href="/medicines/scan">
                     Read it from a photo instead of typing
                  </Link>
               </p>
               <MedicineForm
                  formId="add"
                  initial={{}}
                  medicationId=""
                  isHelper={!owner}
                  mayBeUrgent={mayBeUrgent}
                  submitLabel={owner ? 'Add medicine' : 'Send for approval'}
               />
            </section>
         ) : null}

         {stopped.length > 0 ? (
            <section className="card" aria-labelledby="stopped-title">
               <h2 id="stopped-title">Stopped medicines</h2>
               <ul>
                  {stopped.map((medication) => (
                     <li key={medication.id}>
                        {medication.name} {medication.strength}, stopped{' '}
                        {formatLocal(
                           medication.updatedAt,
                           profile.utcOffsetMinutes,
                        )}
                     </li>
                  ))}
               </ul>
            </section>
         ) : null}
      </>
   );
}
