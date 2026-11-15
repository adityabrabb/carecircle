/**
 * Care circle.
 *
 * Purpose: coordination for the family. Shows open care tasks, each with
 * one owner and a backup; what was finished recently; handover notes
 * between caretakers; and a log showing whether each reminder email was
 * delivered. Shows no scores or rankings of anyone.
 */
import type { Metadata } from 'next';
import { addHandoverAction } from '@/app/actions/circle';
import { AddTaskForm } from '@/components/circle/AddTaskForm';
import { DeliveryLog } from '@/components/circle/DeliveryLog';
import { TaskCard } from '@/components/circle/TaskCard';
import { Notice, type NoticeParams } from '@/components/Notice';
import { MAX_TEXT_LENGTH } from '@/constants/care';
import { can, isOwner } from '@/domain/permissions';
import { mayComplete, overviewTasks } from '@/domain/tasks';
import { formatLocal } from '@/domain/time';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Care circle' };

const NOTE_LIMIT = 10;
const LOG_LIMIT = 30;

/**
 * Purpose: the care circle page. Loads tasks, handovers, members and
 * reminder records, then shows what each signed-in member may see.
 */
export default async function CirclePage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const notice = <Notice params={await searchParams} />;
   const header = (
      <div className="page-head">
         <h1>Care circle</h1>
         <p>
            Who is looking after what, what was handed over, and whether
            reminder emails reached people.
         </p>
      </div>
   );
   if (profile.sharingPaused && !isOwner(member, profile)) {
      return (
         <>
            {header}
            <p className="card">
               {profile.elderName} has paused sharing, so the care circle is
               hidden for now.
            </p>
         </>
      );
   }

   const store = getStore();
   const [tasks, handovers, members, notifications] = await Promise.all([
      store.list('tasks', profile.id),
      store.list('handovers', profile.id),
      store.list('members', profile.id),
      store.list('notifications', profile.id),
   ]);
   const mayManage = can(member, 'manageTasks', profile);
   const elder = isOwner(member, profile);
   /** Purpose: the elder's local date and time for an instant. */
   const when = (at: number): string =>
      formatLocal(at, profile.utcOffsetMinutes);
   const names = new Map<string, string>(
      members.map((item): [string, string] => [item.id, item.name]),
   );
   /** Purpose: a member's display name, or a neutral word if unknown. */
   const nameOf = (memberId: string): string =>
      names.get(memberId) ?? 'Someone';
   const activeMembers = members.filter((item) => item.active);
   const overview = overviewTasks(tasks, now);
   const overdueIds = new Set(overview.overdue.map((task) => task.id));

   const recentNotes = [...handovers]
      .sort((first, second) => second.at - first.at)
      .slice(0, NOTE_LIMIT);
   const visibleLog = (
      elder
         ? notifications
         : notifications.filter((item) => item.toMemberId === member.id)
   )
      .sort((first, second) => second.at - first.at)
      .slice(0, LOG_LIMIT);

   return (
      <>
         {header}
         {notice}

         <section aria-labelledby="open-title">
            <h2 id="open-title">Open tasks</h2>
            {overview.open.length === 0 ? (
               <p className="card">No open tasks.</p>
            ) : null}
            <div className="grid">
               {overview.open.map((task) => (
                  <TaskCard
                     key={task.id}
                     task={task}
                     overdue={overdueIds.has(task.id)}
                     mayFinish={mayManage && mayComplete(task, member)}
                     mayReassign={
                        elder || (mayManage && task.createdById === member.id)
                     }
                     people={activeMembers}
                     nameOf={nameOf}
                     when={when}
                  />
               ))}
            </div>
         </section>

         <section className="card" aria-labelledby="recent-title">
            <h2 id="recent-title">Done in the last day</h2>
            {overview.doneRecently.length === 0 ? (
               <p>Nothing finished in the last day.</p>
            ) : (
               <ul className="list">
                  {overview.doneRecently.map((task) => (
                     <li key={task.id}>
                        <strong>{task.title}</strong>, done by{' '}
                        {nameOf(task.doneById)} at {when(task.doneAt)}
                     </li>
                  ))}
               </ul>
            )}
         </section>

         {mayManage ? <AddTaskForm people={activeMembers} /> : null}

         <section aria-labelledby="handover-title">
            <h2 id="handover-title">Handover notes</h2>
            {mayManage ? (
               <form className="stack card" action={addHandoverAction}>
                  <div>
                     <label htmlFor="handover-text">
                        Note for the next caretaker
                     </label>
                     <textarea
                        id="handover-text"
                        name="text"
                        required
                        maxLength={MAX_TEXT_LENGTH}
                        rows={3}
                     />
                  </div>
                  <button className="btn" type="submit">
                     Save note
                  </button>
               </form>
            ) : null}
            {recentNotes.length === 0 ? (
               <p className="muted">No handover notes yet.</p>
            ) : (
               <ul className="timeline">
                  {recentNotes.map((note) => (
                     <li key={note.id}>
                        <strong>{nameOf(note.byId)}</strong>,{' '}
                        {when(note.at)}
                        <p>{note.text}</p>
                     </li>
                  ))}
               </ul>
            )}
         </section>

         <DeliveryLog
            entries={visibleLog}
            viewerIsOwner={elder}
            nameOf={nameOf}
            when={when}
         />
      </>
   );
}
