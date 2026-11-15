/**
 * Add task form.
 *
 * Purpose: add a care task with one owner, an optional backup and a
 * due time, so nothing depends on one person remembering.
 */
import { addTaskAction } from '@/app/actions/circle';
import { MAX_NAME_LENGTH } from '@/constants/care';
import { TASK_LABELS } from '@/constants/labels';
import type { Member, TaskKind } from '@/domain/types';
import { NO_BACKUP, PersonOptions } from './TaskCard';

const TASK_KINDS: readonly TaskKind[] = ['task', 'refill', 'test', 'followup'];

export function AddTaskForm({ people }: { people: readonly Member[] }) {
   return (
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
                     maxLength={MAX_NAME_LENGTH}
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
                     <PersonOptions people={people} />
                  </select>
               </div>
               <div>
                  <label htmlFor="task-backup">Backup</label>
                  <select id="task-backup" name="backupId">
                     <option value={NO_BACKUP}>No backup</option>
                     <PersonOptions people={people} />
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
   );
}
