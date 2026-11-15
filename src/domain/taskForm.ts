/**
 * Care task forms.
 *
 * Purpose: turn a task form into a checked Task, and change who owns an
 * existing task. Pure functions with no I/O: the server actions read and
 * save. Every task has one owner and an optional backup. Both must be
 * active members of the same circle, and the backup must be a different
 * person from the owner.
 */
import type { Member, Result, Task, TaskKind } from '@/domain/types';
import { cleanText, requireName } from '@/domain/validation';

/** Fields every new task takes from the place that creates it. */
export interface TaskBase {
   id: string;
   profileId: string;
   createdById: string;
}

interface Assignees {
   ownerId: string;
   backupId: string;
}

const TASK_KINDS: readonly TaskKind[] = ['task', 'refill', 'test', 'followup'];
const DEFAULT_KIND: TaskKind = 'task';

/** Purpose: true when the id belongs to an active member of the circle. */
function isActiveMember(
   members: readonly Member[],
   memberId: string,
   profileId: string,
): boolean {
   return members.some(
      (member) =>
         member.id === memberId &&
         member.profileId === profileId &&
         member.active,
   );
}

/**
 * Purpose: check the owner and optional backup of a task. The owner is
 * required; the backup may be left empty, but when given it must be an
 * active member other than the owner.
 */
function checkAssignees(
   ownerRaw: unknown,
   backupRaw: unknown,
   members: readonly Member[],
   profileId: string,
): Result<Assignees> {
   const ownerId = cleanText(ownerRaw);
   const backupId = cleanText(backupRaw);
   if (ownerId === '') {
      return { ok: false, error: 'Choose an owner for this task.' };
   }
   if (!isActiveMember(members, ownerId, profileId)) {
      return {
         ok: false,
         error: 'The owner must be an active member of this circle.',
      };
   }
   if (backupId === '') {
      return { ok: true, value: { ownerId, backupId } };
   }
   // Checked before membership so the message names the real mistake.
   if (backupId === ownerId) {
      return {
         ok: false,
         error: 'The backup must be a different person from the owner.',
      };
   }
   if (!isActiveMember(members, backupId, profileId)) {
      return {
         ok: false,
         error: 'The backup must be an active member of this circle.',
      };
   }
   return { ok: true, value: { ownerId, backupId } };
}

/**
 * Purpose: one of the four task kinds. Anything unknown becomes a plain
 * task, so a tampered form cannot store an unexpected kind.
 */
export function parseTaskKind(raw: unknown): TaskKind {
   const text = cleanText(raw);
   return TASK_KINDS.find((kind) => kind === text) ?? DEFAULT_KIND;
}

/**
 * Purpose: check a task form and build the new open task. The due time
 * is already converted to an instant by the caller.
 */
export function parseTaskForm(
   values: Readonly<Record<string, unknown>>,
   dueAt: number,
   members: readonly Member[],
   base: TaskBase,
): Result<Task> {
   const title = requireName(values.title, 'Title');
   if (!title.ok) {
      return title;
   }
   if (!Number.isFinite(dueAt)) {
      return { ok: false, error: 'Choose a due date and time.' };
   }
   const assignees = checkAssignees(
      values.ownerId,
      values.backupId,
      members,
      base.profileId,
   );
   if (!assignees.ok) {
      return assignees;
   }
   return {
      ok: true,
      value: {
         id: base.id,
         profileId: base.profileId,
         createdById: base.createdById,
         title: title.value,
         kind: parseTaskKind(values.kind),
         ownerId: assignees.value.ownerId,
         backupId: assignees.value.backupId,
         dueAt,
         status: 'open',
         doneById: '',
         doneAt: 0,
         relatedId: '',
      },
   };
}

/** Purpose: the task marked done by a member at a time. */
export function completeTask(task: Task, memberId: string, now: number): Task {
   return { ...task, status: 'done', doneById: memberId, doneAt: now };
}

/**
 * Purpose: the task with a new owner and backup, after the same checks a
 * new task gets. The backup may be left empty.
 */
export function reassignTask(
   task: Task,
   ownerId: string,
   backupId: string,
   members: readonly Member[],
): Result<Task> {
   const assignees = checkAssignees(
      ownerId,
      backupId,
      members,
      task.profileId,
   );
   if (!assignees.ok) {
      return assignees;
   }
   return {
      ok: true,
      value: {
         ...task,
         ownerId: assignees.value.ownerId,
         backupId: assignees.value.backupId,
      },
   };
}
