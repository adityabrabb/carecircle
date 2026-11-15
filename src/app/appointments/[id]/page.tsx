/**
 * Visit brief.
 *
 * Purpose: one printable page to take to the doctor: what changed since
 * the last visit, built from the stored record. After the visit, the
 * same page records what the doctor said and any follow-up date.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { completeAppointmentAction } from '@/app/actions/appointments';
import { Notice, type NoticeParams } from '@/components/Notice';
import { PrintButton } from '@/components/PrintButton';
import { can } from '@/domain/permissions';
import { formatLocal } from '@/domain/time';
import { briefStart, buildVisitBrief } from '@/domain/visitBrief';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Visit brief' };

export default async function VisitBriefPage({
   params,
   searchParams,
}: {
   params: Promise<{ id: string }>;
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'viewAppointments', profile)) {
      notFound();
   }
   const { id } = await params;
   const store = getStore();
   const appointment = await store.get('appointments', profile.id, id);
   if (!appointment) {
      notFound();
   }
   const showMedicines = can(member, 'viewMedications', profile);
   const showHealth = can(member, 'viewHealth', profile);
   const [appointments, medications, doses, readings, questions] =
      await Promise.all([
         store.list('appointments', profile.id),
         showMedicines ? store.list('medications', profile.id) : [],
         showMedicines ? store.list('doses', profile.id) : [],
         showHealth ? store.list('readings', profile.id) : [],
         store.list('questions', profile.id),
      ]);
   const since = briefStart(appointment, appointments, now);
   const brief = buildVisitBrief(
      since,
      now,
      medications,
      doses,
      readings,
      questions,
   );
   const when = (at: number): string =>
      formatLocal(at, profile.utcOffsetMinutes);
   const mayManage = can(member, 'manageTasks', profile);

   return (
      <>
         <Notice params={await searchParams} />
         <div className="page-head">
            <h1>
               Visit brief: {appointment.doctor}
            </h1>
            <p>
               {profile.elderName}, {when(appointment.at)}
               {appointment.location ? `, ${appointment.location}` : ''}.
               Covers the period since {when(brief.since)}.
            </p>
         </div>
         <p className="row no-print">
            <PrintButton label="Print for the doctor" />
            <Link className="btn quiet" href="/appointments">
               Back to appointments
            </Link>
         </p>

         {brief.questions.length > 0 ? (
            <section className="card tint-marigold" aria-labelledby="q-title">
               <h2 id="q-title">Questions I want to ask</h2>
               <ol>
                  {brief.questions.map((question) => (
                     <li key={question}>{question}</li>
                  ))}
               </ol>
            </section>
         ) : null}

         {brief.observations.length > 0 ? (
            <section className="card" aria-labelledby="obs-title">
               <h2 id="obs-title">Worth raising</h2>
               <ul className="list">
                  {brief.observations.map((observation) => (
                     <li key={observation.title}>
                        <strong>{observation.title}</strong>
                        <br />
                        <span className="small">{observation.advice}</span>
                     </li>
                  ))}
               </ul>
               <p className="small muted">
                  These are facts from the record, not a diagnosis.
               </p>
            </section>
         ) : null}

         {showMedicines ? (
            <section className="card" aria-labelledby="adh-title">
               <h2 id="adh-title">Medicines taken</h2>
               <p>
                  <span className="big-number">
                     {brief.adherence.takenPercent}%
                  </span>{' '}
                  of {brief.adherence.due} doses due were taken.
               </p>
               <p className="row">
                  <span className="chip taken">
                     ✓ Taken {brief.adherence.taken}
                  </span>
                  <span className="chip skipped">
                     – Skipped by choice {brief.adherence.skipped}
                  </span>
                  <span className="chip unsure">
                     ? Not sure {brief.adherence.unsure}
                  </span>
                  <span className="chip unconfirmed">
                     ○ Not confirmed {brief.adherence.unconfirmed}
                  </span>
               </p>
               <p className="small muted">
                  {brief.adherence.firmEvidence} confirmed by the elder or
                  seen by a helper; {brief.adherence.assumedEvidence}{' '}
                  assumed by a helper.
               </p>
               {brief.skipReasons.length > 0 ? (
                  <>
                     <h3>Reasons given for skipping</h3>
                     <ul>
                        {brief.skipReasons.map((reason, index) => (
                           <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                     </ul>
                  </>
               ) : null}
               <h3>Current medicines</h3>
               <ul>
                  {brief.currentMedicines.map((line) => (
                     <li key={line}>{line}</li>
                  ))}
               </ul>
               {brief.medicineChanges.length > 0 ? (
                  <>
                     <h3>Changed since the last visit</h3>
                     <ul>
                        {brief.medicineChanges.map((line) => (
                           <li key={line}>{line}</li>
                        ))}
                     </ul>
                  </>
               ) : null}
            </section>
         ) : null}

         {showHealth ? (
            <section className="card" aria-labelledby="read-title">
               <h2 id="read-title">Readings and symptoms</h2>
               {brief.readingChanges.length === 0 ? (
                  <p>No readings were recorded in this period.</p>
               ) : (
                  <div className="table-wrap">
                     <table>
                        <caption className="visually-hidden">
                           First and latest readings in this period
                        </caption>
                        <thead>
                           <tr>
                              <th scope="col">Reading</th>
                              <th scope="col">First</th>
                              <th scope="col">Latest</th>
                              <th scope="col">Count</th>
                           </tr>
                        </thead>
                        <tbody>
                           {brief.readingChanges.map((change) => (
                              <tr key={change.label}>
                                 <th scope="row">{change.label}</th>
                                 <td>{change.first}</td>
                                 <td>{change.latest}</td>
                                 <td>{change.count}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
               {brief.symptoms.length > 0 ? (
                  <>
                     <h3>Symptoms noted</h3>
                     <ul>
                        {brief.symptoms.map((symptom, index) => (
                           <li key={`${symptom}-${index}`}>{symptom}</li>
                        ))}
                     </ul>
                  </>
               ) : null}
            </section>
         ) : null}

         {appointment.status === 'upcoming' && mayManage ? (
            <section className="card no-print" aria-labelledby="done-title">
               <h2 id="done-title">After the visit</h2>
               <form className="stack" action={completeAppointmentAction}>
                  <input
                     type="hidden"
                     name="appointmentId"
                     value={appointment.id}
                  />
                  <div>
                     <label htmlFor="outcome">What the doctor said</label>
                     <textarea id="outcome" name="outcome" maxLength={1000} />
                  </div>
                  <div>
                     <label htmlFor="followUpAt">
                        Follow-up visit
                        <span className="hint">
                           Leave empty if none was given
                        </span>
                     </label>
                     <input
                        id="followUpAt"
                        name="followUpAt"
                        type="datetime-local"
                     />
                  </div>
                  <button className="btn" type="submit">
                     Record the visit
                  </button>
               </form>
            </section>
         ) : null}

         {appointment.outcome ? (
            <section className="card" aria-labelledby="out-title">
               <h2 id="out-title">What the doctor said</h2>
               <p>{appointment.outcome}</p>
            </section>
         ) : null}
      </>
   );
}
