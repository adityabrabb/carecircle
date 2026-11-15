/**
 * Appointments.
 *
 * Purpose: upcoming and past doctor visits, a form to add one, and the
 * elder's own list of questions to ask the doctor. Each upcoming visit
 * links to a brief of what changed since the last one.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
   addAppointmentAction,
   addQuestionAction,
   answerQuestionAction,
   cancelAppointmentAction,
} from '@/app/actions/appointments';
import { Notice, type NoticeParams } from '@/components/Notice';
import { can } from '@/domain/permissions';
import { formatLocal } from '@/domain/time';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Appointments' };

export default async function AppointmentsPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member } = await requireContext();
   const notice = <Notice params={await searchParams} />;
   if (!can(member, 'viewAppointments', profile)) {
      return (
         <>
            {notice}
            <div className="page-head">
               <h1>Appointments</h1>
            </div>
            <p className="card">
               {profile.elderName} has not shared appointments with you.
            </p>
         </>
      );
   }
   const store = getStore();
   const [appointments, questions] = await Promise.all([
      store.list('appointments', profile.id),
      store.list('questions', profile.id),
   ]);
   const mayManage = can(member, 'manageTasks', profile);
   const upcoming = appointments
      .filter((appointment) => appointment.status === 'upcoming')
      .sort((first, second) => first.at - second.at);
   const past = appointments
      .filter((appointment) => appointment.status !== 'upcoming')
      .sort((first, second) => second.at - first.at);
   const open = questions
      .filter((question) => !question.answered)
      .sort((first, second) => first.at - second.at);
   const when = (at: number): string =>
      formatLocal(at, profile.utcOffsetMinutes);

   return (
      <>
         <div className="page-head">
            <h1>Appointments</h1>
            <p>
               Reminders are emailed the day before and two hours before
               each visit.
            </p>
         </div>
         {notice}

         <section aria-labelledby="upcoming-title">
            <h2 id="upcoming-title">Coming up</h2>
            {upcoming.length === 0 ? (
               <p className="card">No visits planned.</p>
            ) : null}
            <div className="grid">
               {upcoming.map((appointment) => (
                  <article className="card tint-green" key={appointment.id}>
                     <h3>{appointment.doctor}</h3>
                     <p>
                        <span className="chip info">
                           {when(appointment.at)}
                        </span>{' '}
                        {appointment.speciality}
                     </p>
                     {appointment.location ? (
                        <p>Where: {appointment.location}</p>
                     ) : null}
                     {appointment.notes ? (
                        <p>Remember: {appointment.notes}</p>
                     ) : null}
                     <div className="row">
                        <Link
                           className="btn small-btn"
                           href={`/appointments/${appointment.id}`}
                        >
                           Open visit brief
                        </Link>
                        {mayManage ? (
                           <form action={cancelAppointmentAction}>
                              <input
                                 type="hidden"
                                 name="appointmentId"
                                 value={appointment.id}
                              />
                              <button
                                 className="btn quiet small-btn"
                                 type="submit"
                              >
                                 Cancel visit
                              </button>
                           </form>
                        ) : null}
                     </div>
                  </article>
               ))}
            </div>
         </section>

         <section className="card" aria-labelledby="questions-title">
            <h2 id="questions-title">Questions for the doctor</h2>
            <p>
               Write down anything you want to ask, in your own words. The
               list is added to the visit brief.
            </p>
            {open.length > 0 ? (
               <ul className="list">
                  {open.map((question) => (
                     <li key={question.id} className="row spread">
                        <span>{question.text}</span>
                        <form action={answerQuestionAction}>
                           <input
                              type="hidden"
                              name="questionId"
                              value={question.id}
                           />
                           <button
                              className="btn quiet small-btn"
                              type="submit"
                           >
                              Answered
                           </button>
                        </form>
                     </li>
                  ))}
               </ul>
            ) : null}
            <form className="stack" action={addQuestionAction}>
               <div>
                  <label htmlFor="question">New question</label>
                  <input
                     id="question"
                     name="text"
                     type="text"
                     required
                     maxLength={80}
                  />
               </div>
               <button className="btn" type="submit">
                  Save question
               </button>
            </form>
         </section>

         {mayManage ? (
            <section className="card" aria-labelledby="add-title">
               <h2 id="add-title">Add an appointment</h2>
               <form className="stack" action={addAppointmentAction}>
                  <div className="field-grid">
                     <div>
                        <label htmlFor="doctor">Doctor</label>
                        <input
                           id="doctor"
                           name="doctor"
                           type="text"
                           required
                           maxLength={80}
                        />
                     </div>
                     <div>
                        <label htmlFor="speciality">Speciality</label>
                        <input
                           id="speciality"
                           name="speciality"
                           type="text"
                           maxLength={80}
                        />
                     </div>
                     <div>
                        <label htmlFor="at">Date and time</label>
                        <input
                           id="at"
                           name="at"
                           type="datetime-local"
                           required
                        />
                     </div>
                     <div>
                        <label htmlFor="location">Place</label>
                        <input
                           id="location"
                           name="location"
                           type="text"
                           maxLength={120}
                        />
                     </div>
                  </div>
                  <div>
                     <label htmlFor="notes">
                        What to bring or remember
                     </label>
                     <input
                        id="notes"
                        name="notes"
                        type="text"
                        maxLength={200}
                     />
                  </div>
                  <button className="btn" type="submit">
                     Add appointment
                  </button>
               </form>
            </section>
         ) : null}

         {past.length > 0 ? (
            <section className="card" aria-labelledby="past-title">
               <h2 id="past-title">Past visits</h2>
               <ul className="timeline">
                  {past.map((appointment) => (
                     <li key={appointment.id}>
                        <strong>{appointment.doctor}</strong>,{' '}
                        {when(appointment.at)}{' '}
                        <span className="chip">
                           {appointment.status === 'done'
                              ? 'Visited'
                              : 'Cancelled'}
                        </span>
                        {appointment.outcome ? (
                           <p>{appointment.outcome}</p>
                        ) : null}
                     </li>
                  ))}
               </ul>
            </section>
         ) : null}
      </>
   );
}
