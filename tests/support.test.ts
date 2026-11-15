/**
 * Tests for input validation, care tasks, email content and the
 * in-memory store.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE, MS_PER_DAY } from '@/constants/care';
import {
   doseReminderEmail,
   escalationEmail,
   escapeHtml,
   layoutEmail,
   proposalEmail,
   refillEmail,
} from '@/domain/emails';
import { forecastRefill } from '@/domain/refill';
import {
   mayComplete,
   needsRefillTask,
   overviewTasks,
   pickOwners,
} from '@/domain/tasks';
import {
   cleanText,
   optionalText,
   parseAnchors,
   parseClock,
   parseColour,
   parseDateKey,
   parseEmail,
   parseInteger,
   parseLanguage,
   parseNumber,
   parseRole,
   parseRoutine,
   requireName,
} from '@/domain/validation';
import { MemoryStore } from '@/store/memoryStore';
import {
   makeDose,
   makeMedication,
   makeMember,
   makeProfile,
   makeTask,
   NOON,
   PROFILE_ID,
} from './fixtures';

describe('validation', () => {
   it('cleans control characters and trims', () => {
      expect(cleanText('  hi\u0007 there ')).toBe('hi there');
      expect(cleanText(42)).toBe('');
   });

   it('requires names and limits their length', () => {
      expect(requireName('', 'Name').ok).toBe(false);
      expect(requireName('a'.repeat(81), 'Name').ok).toBe(false);
      expect(requireName(' Kamala ', 'Name')).toEqual({
         ok: true,
         value: 'Kamala',
      });
   });

   it('limits long text', () => {
      expect(optionalText('a'.repeat(1001), 'Note').ok).toBe(false);
      expect(optionalText('', 'Note').ok).toBe(true);
   });

   it('parses emails', () => {
      expect(parseEmail(' A@B.Co ', true)).toEqual({
         ok: true,
         value: 'a@b.co',
      });
      expect(parseEmail('not-an-email', true).ok).toBe(false);
      expect(parseEmail('', true).ok).toBe(false);
      expect(parseEmail('', false).ok).toBe(true);
   });

   it('parses numbers inside a range', () => {
      expect(parseInteger('12', 'Stock', 0, 100)).toEqual({
         ok: true,
         value: 12,
      });
      expect(parseInteger('1.5', 'Stock', 0, 100).ok).toBe(false);
      expect(parseInteger('101', 'Stock', 0, 100).ok).toBe(false);
      expect(parseNumber('61.5', 'Weight', 20, 300).ok).toBe(true);
      expect(parseNumber('abc', 'Weight', 20, 300).ok).toBe(false);
      expect(parseNumber('5', 'Weight', 20, 300).ok).toBe(false);
   });

   it('parses times and dates', () => {
      expect(parseClock('08:30', 'Time').ok).toBe(true);
      expect(parseClock('8.30', 'Time').ok).toBe(false);
      expect(parseDateKey('2026-11-15', 'Date', true).ok).toBe(true);
      expect(parseDateKey('', 'Date', true).ok).toBe(false);
      expect(parseDateKey('', 'Date', false).ok).toBe(true);
   });

   it('parses roles, languages, anchors and colours', () => {
      expect(parseRole('family').ok).toBe(true);
      expect(parseRole('admin').ok).toBe(false);
      expect(parseLanguage('hi')).toBe('hi');
      expect(parseLanguage('fr')).toBe('en');
      expect(parseAnchors(['sleep', 'x', 'breakfast'])).toEqual({
         ok: true,
         value: ['breakfast', 'sleep'],
      });
      expect(parseAnchors([]).ok).toBe(false);
      expect(parseColour('#AABBCC')).toBe('#aabbcc');
      expect(parseColour('red')).toBe('#c2410c');
   });

   it('requires a routine that runs in order', () => {
      expect(parseRoutine(DEFAULT_ROUTINE).ok).toBe(true);
      expect(
         parseRoutine({ ...DEFAULT_ROUTINE, lunch: '07:00' }).ok,
      ).toBe(false);
      expect(parseRoutine({ ...DEFAULT_ROUTINE, sleep: '' }).ok).toBe(false);
   });
});

describe('care tasks', () => {
   const members = [
      makeMember('elder'),
      makeMember('caretaker'),
      makeMember('family', { id: 'family-2', escalationOrder: 2 }),
      makeMember('family', { id: 'family-1', escalationOrder: 1 }),
   ];
   const low = forecastRefill(makeMedication({ stock: 4 }), NOON);

   it('asks family first to own an automatic task', () => {
      expect(pickOwners(members)).toEqual({
         ownerId: 'family-1',
         backupId: 'family-2',
      });
      expect(pickOwners([])).toEqual({ ownerId: '', backupId: '' });
   });

   it('raises a refill task when stock is low and none is open', () => {
      expect(needsRefillTask(low, [], NOON)).toBe(true);
   });

   it('does not repeat an open or just-finished refill task', () => {
      const open = makeTask({ kind: 'refill', relatedId: 'med-1' });
      const done = makeTask({
         kind: 'refill',
         relatedId: 'med-1',
         status: 'done',
         doneAt: NOON - MS_PER_DAY,
      });
      const old = { ...done, doneAt: NOON - 5*MS_PER_DAY };
      expect(needsRefillTask(low, [open], NOON)).toBe(false);
      expect(needsRefillTask(low, [done], NOON)).toBe(false);
      expect(needsRefillTask(low, [old], NOON)).toBe(true);
   });

   it('raises nothing when stock is fine', () => {
      const fine = forecastRefill(makeMedication({ stock: 60 }), NOON);
      expect(needsRefillTask(fine, [], NOON)).toBe(false);
   });

   it('lists open, overdue and recently done tasks', () => {
      const overview = overviewTasks(
         [
            makeTask({ id: 'late', dueAt: NOON - 1 }),
            makeTask({ id: 'soon', dueAt: NOON + 1 }),
            makeTask({ id: 'done', status: 'done', doneAt: NOON - 10 }),
         ],
         NOON,
      );
      expect(overview.open.map((task) => task.id)).toEqual(['late', 'soon']);
      expect(overview.overdue.map((task) => task.id)).toEqual(['late']);
      expect(overview.doneRecently.map((task) => task.id)).toEqual(['done']);
   });

   it('lets the owner, backup or elder complete a task', () => {
      const task = makeTask({ ownerId: 'a', backupId: 'b' });
      expect(mayComplete(task, makeMember('family', { id: 'a' }))).toBe(true);
      expect(mayComplete(task, makeMember('family', { id: 'b' }))).toBe(true);
      expect(mayComplete(task, makeMember('family', { id: 'c' }))).toBe(false);
      expect(mayComplete(task, makeMember('elder'))).toBe(true);
   });
});

describe('email content', () => {
   it('escapes text placed in HTML', () => {
      expect(escapeHtml('<b>"A&B"</b>')).toBe(
         '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;',
      );
   });

   it('never lets a name inject markup', () => {
      const email = layoutEmail('s', '<script>x</script>', ['line'], []);
      expect(email.html).not.toContain('<script>');
      expect(email.text).toContain('<script>x</script>');
   });

   it('builds a dose reminder with the confirm link', () => {
      const email = doseReminderEmail(
         'Kamala',
         'breakfast',
         [{ name: 'Metformin', strength: '500 mg', foodNote: 'after food' }],
         'https://example.test/dose/abc',
      );
      expect(email.subject).toContain('breakfast');
      expect(email.text).toContain('Metformin 500 mg, after food');
      expect(email.html).toContain('https://example.test/dose/abc');
      expect(email.text).toContain('never asks for your passcode');
   });

   it('says unconfirmed does not mean missed', () => {
      const email = escalationEmail('Arjun', 'Kamala', '9:00 AM', [], 'u');
      expect(email.text).toContain('does not mean it was missed');
   });

   it('words refill and proposal emails clearly', () => {
      expect(refillEmail('A', 'K', 'Calcium', 1, 'u').text).toContain(
         'About 1 day',
      );
      expect(proposalEmail('K', 'A', 'add B12', 'u').text).toContain(
         'Nothing changes until you approve',
      );
   });
});

describe('MemoryStore', () => {
   it('stores and finds profiles by id and code', async () => {
      const store = new MemoryStore();
      await store.putProfile(makeProfile());
      expect((await store.getProfile(PROFILE_ID))?.elderName).toBe('Kamala');
      expect((await store.getProfileByCode('ABCD2345'))?.id).toBe(PROFILE_ID);
      expect(await store.getProfileByCode('NOPE')).toBeNull();
      expect(await store.listProfiles()).toHaveLength(1);
   });

   it('keeps each profile’s records apart', async () => {
      const store = new MemoryStore();
      await store.put('doses', makeDose({ id: 'd' }));
      await store.put('doses', makeDose({ id: 'd', profileId: 'other' }));
      expect(await store.list('doses', PROFILE_ID)).toHaveLength(1);
      expect(await store.get('doses', 'other', 'd')).not.toBeNull();
      expect(await store.get('doses', 'missing', 'd')).toBeNull();
   });

   it('returns copies so callers cannot change stored data', async () => {
      const store = new MemoryStore();
      await store.put('doses', makeDose({ id: 'd' }));
      const read = await store.get('doses', PROFILE_ID, 'd');
      if (read) {
         read.status = 'taken';
      }
      expect((await store.get('doses', PROFILE_ID, 'd'))?.status).toBe(
         'unconfirmed',
      );
   });

   it('filters by a field and removes records', async () => {
      const store = new MemoryStore();
      await store.putMany('doses', [
         makeDose({ id: 'a', dateKey: '2026-11-14' }),
         makeDose({ id: 'b', dateKey: '2026-11-15' }),
      ]);
      const found = await store.listIn('doses', PROFILE_ID, 'dateKey', [
         '2026-11-15',
      ]);
      expect(found.map((dose) => dose.id)).toEqual(['b']);
      await store.remove('doses', PROFILE_ID, 'b');
      expect(await store.list('doses', PROFILE_ID)).toHaveLength(1);
   });

   it('deletes a profile with everything under it', async () => {
      const store = new MemoryStore();
      await store.putProfile(makeProfile());
      await store.put('doses', makeDose());
      await store.deleteProfile(PROFILE_ID);
      expect(await store.getProfile(PROFILE_ID)).toBeNull();
      expect(await store.list('doses', PROFILE_ID)).toEqual([]);
   });
});
