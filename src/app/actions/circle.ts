'use server';

/**
 * Care circle actions.
 *
 * Purpose: add care tasks, mark them done, change who owns them, and
 * add handover notes between caretakers. Every change is checked on the
 * server and written to the audit log.
 */
import { fail, field, succeed } from '@/app/actions/helpers';
import { can, isOwner } from '@/domain/permissions';
import {
   completeTask,
   parseTaskForm,
   reassignTask,
} from '@/domain/taskForm';
import { mayComplete } from '@/domain/tasks';
import { localToInstant } from '@/domain/time';
import { optionalText, parseLocalDateTime } from '@/domain/validation';
import { recordAudit } from '@/services/audit';
import { newId } from '@/services/ids';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/circle';

/**
 * Purpose: add a care task with one owner and an optional backup.
 * Side effect: stores the task and an audit entry.
 */
export async function addTaskAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!can(member, 'manageTasks', profile)) {
      fail(PAGE, 'You are not allowed to add tasks.');
   }
   const due = parseLocalDateTime(field(form, 'dueAt'), 'Due date and time');
   if (!due.ok) {
      fail(PAGE, due.error);
   }
   const dueAt = localToInstant(
      due.value.dateKey,
      due.value.minutes,
      profile.utcOffsetMinutes,
   );
   const store = getStore();
   const members = await store.list('members', profile.id);
   const created = parseTaskForm(
      {
         title: field(form, 'title'),
         kind: field(form, 'kind'),
         ownerId: field(form, 'ownerId'),
         backupId: field(form, 'backupId'),
      },
      dueAt,
      members,
      { id: newId(), profileId: profile.id, createdById: member.id },
   );
   if (!created.ok) {
      fail(PAGE, created.error);
   }
   await store.put('tasks', created.value);
   await recordAudit(profile, member, 'Task added', created.value.title);
   succeed(PAGE, 'Task added.');
}

/**
 * Purpose: mark an open task done by the member who is doing it.
 * Side effect: updates the task and writes an audit entry.
 */
export async function completeTaskAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'manageTasks', profile)) {
      fail(PAGE, 'You are not allowed to complete tasks.');
   }
   const store = getStore();
   const task = await store.get('tasks', profile.id, field(form, 'taskId'));
   if (!task || task.status !== 'open') {
      fail(PAGE, 'That task is not open.');
   }
   if (!mayComplete(task, member)) {
      fail(PAGE, 'Only the owner, the backup or the elder can complete this.');
   }
   await store.put('tasks', completeTask(task, member.id, now));
   await recordAudit(profile, member, 'Task done', task.title);
   succeed(PAGE, 'Task marked done.');
}

/**
 * Purpose: change the owner and backup of a task. Allowed for the elder,
 * and for the member who created the task while they may manage tasks.
 * Side effect: updates the task and writes an audit entry.
 */
export async function reassignTaskAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   const store = getStore();
   const task = await store.get('tasks', profile.id, field(form, 'taskId'));
   if (!task) {
      fail(PAGE, 'That task was not found.');
   }
   const mayReassign =
      isOwner(member, profile) ||
      (task.createdById === member.id &&
         can(member, 'manageTasks', profile));
   if (!mayReassign) {
      fail(PAGE, 'Only the elder or the person who added this can change it.');
   }
   const members = await store.list('members', profile.id);
   const changed = reassignTask(
      task,
      field(form, 'ownerId'),
      field(form, 'backupId'),
      members,
   );
   if (!changed.ok) {
      fail(PAGE, changed.error);
   }
   await store.put('tasks', changed.value);
   await recordAudit(profile, member, 'Task reassigned', task.title);
   succeed(PAGE, 'Owner and backup updated.');
}

/**
 * Purpose: add a handover note for the next caretaker to read.
 * Side effect: stores the note and an audit entry.
 */
export async function addHandoverAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'manageTasks', profile)) {
      fail(PAGE, 'You are not allowed to add handover notes.');
   }
   const text = optionalText(field(form, 'text'), 'Handover note');
   if (!text.ok) {
      fail(PAGE, text.error);
   }
   if (text.value === '') {
      fail(PAGE, 'Write a note before saving.');
   }
   await getStore().put('handovers', {
      id: newId(),
      profileId: profile.id,
      byId: member.id,
      text: text.value,
      at: now,
   });
   await recordAudit(profile, member, 'Handover note added', text.value);
   succeed(PAGE, 'Handover note saved.');
}
