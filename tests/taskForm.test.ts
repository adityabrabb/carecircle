/**
 * Tests for care task forms: creating, completing and reassigning tasks.
 */
import { describe, expect, it } from 'vitest';
import {
   completeTask,
   parseTaskForm,
   parseTaskKind,
   reassignTask,
} from '@/domain/taskForm';
import type { Member } from '@/domain/types';
import { makeMember, makeTask, NOON, PROFILE_ID } from './fixtures';

const MAX_TITLE = 80;

const elder = makeMember('elder');
const family = makeMember('family');
const caretaker = makeMember('caretaker', { id: 'caretaker-1', name: 'Asha' });
const idle = makeMember('caretaker', {
   id: 'caretaker-2',
   name: 'Ravi',
   active: false,
});
const stranger = makeMember('family', {
   id: 'family-9',
   profileId: 'profile-2',
});
const MEMBERS: readonly Member[] = [elder, family, caretaker, idle, stranger];

const BASE = {
   id: 'task-new',
   profileId: PROFILE_ID,
   createdById: elder.id,
};

/** Purpose: a valid form, with some fields replaced by the test. */
function formWith(overrides: Record<string, unknown> = {}) {
   return {
      title: 'Collect refill',
      kind: 'refill',
      ownerId: family.id,
      backupId: caretaker.id,
      ...overrides,
   };
}

describe('parseTaskForm', () => {
   it('builds an open task from a valid form', () => {
      const result = parseTaskForm(formWith(), NOON, MEMBERS, BASE);
      expect(result).toEqual({
         ok: true,
         value: {
            id: 'task-new',
            profileId: PROFILE_ID,
            createdById: elder.id,
            title: 'Collect refill',
            kind: 'refill',
            ownerId: family.id,
            backupId: caretaker.id,
            dueAt: NOON,
            status: 'open',
            doneById: '',
            doneAt: 0,
            relatedId: '',
         },
      });
   });

   it('cleans control characters and spaces from the title', () => {
      const result = parseTaskForm(
         formWith({ title: '  Call the chemist \u0007 ' }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok && result.value.title).toBe('Call the chemist');
   });

   it('rejects a missing title', () => {
      const result = parseTaskForm(formWith({ title: '   ' }), NOON, MEMBERS, BASE);
      expect(result).toEqual({ ok: false, error: 'Title is required.' });
   });

   it('rejects a title longer than the limit', () => {
      const result = parseTaskForm(
         formWith({ title: 'x'.repeat(MAX_TITLE + 1) }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok).toBe(false);
   });

   it('rejects a missing owner', () => {
      const result = parseTaskForm(
         formWith({ ownerId: '' }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result).toEqual({
         ok: false,
         error: 'Choose an owner for this task.',
      });
   });

   it('rejects an owner who is not in the circle', () => {
      const result = parseTaskForm(
         formWith({ ownerId: 'nobody' }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok).toBe(false);
   });

   it('rejects an inactive owner', () => {
      const result = parseTaskForm(
         formWith({ ownerId: idle.id }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok).toBe(false);
   });

   it('rejects an owner from another circle', () => {
      const result = parseTaskForm(
         formWith({ ownerId: stranger.id }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok).toBe(false);
   });

   it('rejects a backup the same as the owner', () => {
      const result = parseTaskForm(
         formWith({ backupId: family.id }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result).toEqual({
         ok: false,
         error: 'The backup must be a different person from the owner.',
      });
   });

   it('rejects an inactive backup', () => {
      const result = parseTaskForm(
         formWith({ backupId: idle.id }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok).toBe(false);
   });

   it('accepts a task with no backup', () => {
      const result = parseTaskForm(
         formWith({ backupId: '' }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok && result.value.backupId).toBe('');
   });

   it('rejects a due time that is not a valid instant', () => {
      const result = parseTaskForm(formWith(), Number.NaN, MEMBERS, BASE);
      expect(result).toEqual({
         ok: false,
         error: 'Choose a due date and time.',
      });
   });

   it('falls back to a plain task for an unknown kind', () => {
      const result = parseTaskForm(
         formWith({ kind: 'bogus' }),
         NOON,
         MEMBERS,
         BASE,
      );
      expect(result.ok && result.value.kind).toBe('task');
   });
});

describe('parseTaskKind', () => {
   it('keeps each of the four known kinds', () => {
      for (const kind of ['task', 'refill', 'test', 'followup'] as const) {
         expect(parseTaskKind(kind)).toBe(kind);
      }
   });

   it('maps unknown or non-text input to a plain task', () => {
      expect(parseTaskKind('nonsense')).toBe('task');
      expect(parseTaskKind(null)).toBe('task');
      expect(parseTaskKind(42)).toBe('task');
   });
});

describe('completeTask', () => {
   it('marks the task done by the member at the given time', () => {
      const task = makeTask({ ownerId: family.id });
      const done = completeTask(task, family.id, NOON);
      expect(done.status).toBe('done');
      expect(done.doneById).toBe(family.id);
      expect(done.doneAt).toBe(NOON);
   });

   it('does not change the task it was given', () => {
      const task = makeTask();
      completeTask(task, elder.id, NOON);
      expect(task.status).toBe('open');
      expect(task.doneAt).toBe(0);
   });
});

describe('reassignTask', () => {
   it('sets a new owner and backup and keeps the rest', () => {
      const task = makeTask({ title: 'Lab test', kind: 'test' });
      const result = reassignTask(task, caretaker.id, family.id, MEMBERS);
      expect(result).toEqual({
         ok: true,
         value: { ...task, ownerId: caretaker.id, backupId: family.id },
      });
   });

   it('allows the backup to be cleared', () => {
      const task = makeTask({ backupId: caretaker.id });
      const result = reassignTask(task, family.id, '', MEMBERS);
      expect(result.ok && result.value.backupId).toBe('');
   });

   it('rejects a new owner who is inactive', () => {
      const result = reassignTask(makeTask(), idle.id, '', MEMBERS);
      expect(result.ok).toBe(false);
   });

   it('rejects a backup the same as the new owner', () => {
      const result = reassignTask(
         makeTask(),
         caretaker.id,
         caretaker.id,
         MEMBERS,
      );
      expect(result.ok).toBe(false);
   });
});
