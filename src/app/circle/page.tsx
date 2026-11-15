/**
 * Care circle.
 *
 * Purpose: coordination for the family. Shows open care tasks, each with
 * one owner and a backup; what was finished recently; handover notes
 * between caretakers; and a log showing whether each reminder email was
 * delivered. Shows no scores or rankings of anyone.
 */
import type { Metadata } from 'next';
import {
   addHandoverAction,
   addTaskAction,
   completeTaskAction,
   reassignTaskAction,
} from '@/app/actions/circle';
import { Notice, type NoticeParams } from '@/components/Notice';
import { TASK_LABELS } from '@/constants/labels';
import { MAX_TEXT_LENGTH } from '@/constants/care';
import { can, isOwner } from '@/domain/permissions';
import { mayComplete, overviewTasks } from '@/domain/tasks';
import { formatLocal } from '@/domain/time';
import type {
   DeliveryStatus,
   Member,
   TaskKind,
} from '@/domain/types';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Care circle' };

const TASK_KINDS: readonly TaskKind[] = ['task', 'refill', 'test', 'followup'];
const NOTE_LIMIT = 10;
const LOG_LIMIT = 30;
const NO_BACKUP = '';
const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
   sent: '✓ Sent',
   recorded: '○ Recorded, not sent',
   failed: '✕ Failed',
};

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

   /** Purpose: one select option per person, labelled with their name. */
   const optionsFor = (people: readonly Member[]) =>
      people.map((item) => (
         <option key={item.id} value={item.id}>
            {item.name}
         </option>
      ));

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
               {overview.open.map((task) => {
                  const backupName =
                     task.backupId === NO_BACKUP
                        ? 'none'
                        : nameOf(task.backupId);
                  const mayReassign =
                     elder ||
                     (mayManage && task.createdById === member.id);
                  return (
                     <article className="card" key={task.id}>
                        <h3>{task.title}</h3>
                        <p>
                           <span className="chip info">
                              {TASK_LABELS[task.kind]}
                           </span>{' '}
                           Due {when(task.dueAt)}{' '}
                           {overdueIds.has(task.id) ? (
                              <span className="chip unsure">
                                 ⚠ Overdue
                              </span>
                           ) : null}
                        </p>
                        <p>
                           Owner: {nameOf(task.ownerId)}, backup:{' '}
                           {backupName}
                        </p>
                        {mayManage && mayComplete(task, member) ? (
                           <form action={completeTaskAction}>
                              <input
                                 type="hidden"
                                 name="taskId"
                                 value={task.id}
                              />
                              <button
                                 className="btn small-btn"
                                 type="submit"
                              >
                                 Done
                                 <span className="visually-hidden">
                                    : {task.title}
                                 </span>
                              </button>
                           </form>
                        ) : null}
                        {mayReassign ? (
                           <details>
                              <summary>Change owner or backup</summary>
                              <form
                                 className="stack"
                                 action={reassignTaskAction}
                              >
                                 <input
                                    type="hidden"
                                    name="taskId"
                                    value={task.id}
                                 />
                                 <div>
                                    <label
                                       htmlFor={`owner-${task.id}`}
                                    >
                                       Owner
                                    </label>
                                    <select
                                       id={`owner-${task.id}`}
                                       name="ownerId"
                                       defaultValue={task.ownerId}
                                       required
                                    >
                                       {optionsFor(activeMembers)}
                                    </select>
                                 </div>
                                 <div>
                                    <label
                                       htmlFor={`backup-${task.id}`}
                                    >
                                       Backup
                                    </label>
                                    <select
                                       id={`backup-${task.id}`}
                                       name="backupId"
                                       defaultValue={task.backupId}
                                    >
                                       <option value={NO_BACKUP}>
                                          No backup
                                       </option>
                                       {optionsFor(activeMembers)}
                                    </select>
                                 </div>
                                 <button
                                    className="btn quiet small-btn"
                                    type="submit"
                                 >
                                    Save owner and backup
                                 </button>
                              </form>
                           </details>
                        ) : null}
                     </article>
                  );
               })}
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

         {mayManage ? (
            <section className="card" aria-labelledby="add-task-title">
               <h2 id="add-task-title">Add a task</h2>
               <form className="stack" action={addTaskAction}>
                  <div className="field-grid">
                     <div>
                        <label htmlFor="task-title">Title</label>
                        <input
                           id="task-title"
                           name="title"
                           type="text"
                           required
                           maxLength={80}
                        />
                     </div>
                     <div>
                        <label htmlFor="task-kind">Kind</label>
                        <select id="task-kind" name="kind" defaultValue="task">
                           {TASK_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                 {TASK_LABELS[kind]}
                              </option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label htmlFor="task-owner">Owner</label>
                        <select id="task-owner" name="ownerId" required>
                           <option value="">Choose a person</option>
                           {optionsFor(activeMembers)}
                        </select>
                     </div>
                     <div>
                        <label htmlFor="task-backup">Backup</label>
                        <select id="task-backup" name="backupId">
                           <option value={NO_BACKUP}>No backup</option>
                           {optionsFor(activeMembers)}
                        </select>
                     </div>
                     <div>
                        <label htmlFor="task-due">Due date and time</label>
                        <input
                           id="task-due"
                           name="dueAt"
                           type="datetime-local"
                           required
                        />
                     </div>
                  </div>
                  <button className="btn" type="submit">
                     Add task
                  </button>
               </form>
            </section>
         ) : null}

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

         <section className="card" aria-labelledby="delivery-title">
            <h2 id="delivery-title">Reminder delivery</h2>
            <p>
               {elder
                  ? 'Every reminder email the circle was sent, newest first.'
                  : 'The reminder emails sent to you, newest first.'}
            </p>
            {visibleLog.length === 0 ? (
               <p className="muted">No reminder emails yet.</p>
            ) : (
               <div className="table-wrap">
                  <table>
                     <caption className="visually-hidden">
                        Reminder emails and whether each was delivered
                     </caption>
                     <thead>
                        <tr>
                           <th scope="col">Time</th>
                           <th scope="col">To</th>
                           <th scope="col">What</th>
                           <th scope="col">Status</th>
                        </tr>
                     </thead>
                     <tbody>
                        {visibleLog.map((item) => (
                           <tr key={item.id}>
                              <td>{when(item.at)}</td>
                              <td>{nameOf(item.toMemberId)}</td>
                              <td>{item.subject}</td>
                              <td>
                                 <span className="chip">
                                    {DELIVERY_LABELS[item.status]}
                                 </span>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </section>
      </>
   );
}
