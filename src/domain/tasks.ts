/**
 * Care tasks.
 *
 * Purpose: rules for shared responsibilities. Every task has one named
 * owner and a backup, so nothing is left to "someone". Also decides
 * when a refill task should be raised, and summarises what is open
 * without scoring or ranking the people involved.
 */
import { MS_PER_DAY } from '@/constants/care';
import type { RefillForecast } from '@/domain/refill';
import type { Member, Role, Task } from '@/domain/types';

/** A finished refill task quiets new ones for this long. */
const REFILL_QUIET_DAYS = 2;

/** Roles in the order they are asked to own a refill. */
const REFILL_OWNER_ORDER: readonly Role[] = ['family', 'caretaker', 'elder'];

/**
 * Purpose: choose an owner and a backup for an automatic task. Family
 * is asked first, then caretakers, then the elder. Returns empty ids
 * when the circle has no active members.
 */
export function pickOwners(members: readonly Member[]): {
   ownerId: string;
   backupId: string;
} {
   const ordered = [...members]
      .filter((member) => member.active)
      .sort((first, second) => {
         const roleGap =
            REFILL_OWNER_ORDER.indexOf(first.role) -
            REFILL_OWNER_ORDER.indexOf(second.role);
         return roleGap !== 0
            ? roleGap
            : first.escalationOrder - second.escalationOrder;
      });
   return {
      ownerId: ordered[0]?.id ?? '',
      backupId: ordered[1]?.id ?? '',
   };
}

/**
 * Purpose: true when a refill task should be created for a forecast.
 * No task is raised while one is open for the same medicine, or just
 * after one was completed (the stock count may not be updated yet).
 */
export function needsRefillTask(
   forecast: RefillForecast,
   tasks: readonly Task[],
   now: number,
): boolean {
   if (!forecast.needsRefill) {
      return false;
   }
   const related = tasks.filter(
      (task) =>
         task.kind === 'refill' && task.relatedId === forecast.medicationId,
   );
   if (related.some((task) => task.status === 'open')) {
      return false;
   }
   return !related.some(
      (task) =>
         task.status === 'done' &&
         now - task.doneAt < REFILL_QUIET_DAYS*MS_PER_DAY,
   );
}

export interface TaskOverview {
   open: Task[];
   overdue: Task[];
   doneRecently: Task[];
}

/** Purpose: open, overdue and recently finished tasks, soonest first. */
export function overviewTasks(
   tasks: readonly Task[],
   now: number,
): TaskOverview {
   const open = tasks
      .filter((task) => task.status === 'open')
      .sort((first, second) => first.dueAt - second.dueAt);
   return {
      open,
      overdue: open.filter((task) => task.dueAt < now),
      doneRecently: tasks
         .filter(
            (task) => task.status === 'done' && now - task.doneAt < MS_PER_DAY,
         )
         .sort((first, second) => second.doneAt - first.doneAt),
   };
}

/**
 * Purpose: true when the member may complete the task: its owner, its
 * backup, or the elder.
 */
export function mayComplete(task: Task, member: Member): boolean {
   return (
      member.role === 'elder' ||
      task.ownerId === member.id ||
      task.backupId === member.id
   );
}
