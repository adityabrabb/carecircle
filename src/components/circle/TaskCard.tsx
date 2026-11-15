/**
 * Task card.
 *
 * Purpose: one open care task in the circle: its kind, due time, owner
 * and backup, a "Done" button for whoever may finish it, and a form to
 * change the owner or backup for whoever may reassign it.
 */
import { completeTaskAction, reassignTaskAction } from '@/app/actions/circle';
import { TASK_LABELS } from '@/constants/labels';
import type { Member, Task } from '@/domain/types';

/** Purpose: the value a task stores when it has no backup. */
export const NO_BACKUP = '';

/** Purpose: one select option per person, labelled with their name. */
export function PersonOptions({ people }: { people: readonly Member[] }) {
   return people.map((person) => (
      <option key={person.id} value={person.id}>
         {person.name}
      </option>
   ));
}

/** Purpose: the form that moves a task to another owner or backup. */
function ReassignForm({
   task,
   people,
}: {
   task: Task;
   people: readonly Member[];
}) {
   return (
      <details>
         <summary>Change owner or backup</summary>
         <form className="stack" action={reassignTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <div>
               <label htmlFor={`owner-${task.id}`}>Owner</label>
               <select
                  id={`owner-${task.id}`}
                  name="ownerId"
                  defaultValue={task.ownerId}
                  required
               >
                  <PersonOptions people={people} />
               </select>
            </div>
            <div>
               <label htmlFor={`backup-${task.id}`}>Backup</label>
               <select
                  id={`backup-${task.id}`}
                  name="backupId"
                  defaultValue={task.backupId}
               >
                  <option value={NO_BACKUP}>No backup</option>
                  <PersonOptions people={people} />
               </select>
            </div>
            <button className="btn quiet small-btn" type="submit">
               Save owner and backup
            </button>
         </form>
      </details>
   );
}

export interface TaskCardProps {
   task: Task;
   overdue: boolean;
   mayFinish: boolean;
   mayReassign: boolean;
   people: readonly Member[];
   nameOf: (memberId: string) => string;
   when: (at: number) => string;
}

export function TaskCard({
   task,
   overdue,
   mayFinish,
   mayReassign,
   people,
   nameOf,
   when,
}: TaskCardProps) {
   const backupName =
      task.backupId === NO_BACKUP ? 'none' : nameOf(task.backupId);
   return (
      <article className="card">
         <h3>{task.title}</h3>
         <p>
            <span className="chip info">{TASK_LABELS[task.kind]}</span> Due{' '}
            {when(task.dueAt)}{' '}
            {overdue ? <span className="chip unsure">⚠ Overdue</span> : null}
         </p>
         <p>
            Owner: {nameOf(task.ownerId)}, backup: {backupName}
         </p>
         {mayFinish ? (
            <form action={completeTaskAction}>
               <input type="hidden" name="taskId" value={task.id} />
               <button className="btn small-btn" type="submit">
                  Done
                  <span className="visually-hidden">: {task.title}</span>
               </button>
            </form>
         ) : null}
         {mayReassign ? <ReassignForm task={task} people={people} /> : null}
      </article>
   );
}
