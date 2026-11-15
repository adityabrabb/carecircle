/**
 * Tests for reading prescriptions: checking model output and comparing it
 * with the current medicine list.
 */
import { describe, expect, it } from 'vitest';
import {
   compareWithCurrent,
   type DraftMedicine,
   notOnPrescription,
   parseExtraction,
} from '@/domain/prescriptionParse';
import { makeMedication } from './fixtures';

/** Purpose: the only item of a list; fails the test when it is empty. */
function only<T>(list: readonly T[]): T {
   const [item] = list;
   if (item === undefined) {
      throw new Error('expected one item');
   }
   return item;
}

/** Purpose: a valid draft, with any field overridden. */
function draft(overrides: Partial<DraftMedicine> = {}): DraftMedicine {
   return {
      name: 'Amlodipine',
      strength: '5 mg tablet',
      purpose: 'Blood pressure',
      anchors: ['breakfast'],
      food: 'any',
      unitsPerDose: 1,
      ...overrides,
   };
}

/** Purpose: a model reply with one medicine, for the given fields. */
function reply(item: Record<string, unknown>): unknown {
   return { medicines: [item] };
}

describe('parseExtraction: shape', () => {
   it('accepts a wrapped object and a bare array alike', () => {
      const item = { name: 'Metformin', strength: '500 mg' };
      const wrapped = parseExtraction({ medicines: [item] });
      const bare = parseExtraction([item]);
      expect(wrapped.map((found) => found.name)).toEqual(['Metformin']);
      expect(bare).toEqual(wrapped);
   });

   it('gives no drafts for junk input of any type', () => {
      const junk: unknown[] = [
         null,
         undefined,
         'medicines',
         42,
         {},
         { medicines: 'Metformin' },
         [null, 3, 'Metformin', ['Metformin']],
      ];
      for (const raw of junk) {
         expect(parseExtraction(raw)).toEqual([]);
      }
   });

   it('drops items without a usable name', () => {
      const found = parseExtraction([
         { strength: '500 mg' },
         { name: '   ' },
         { name: 500 },
         { name: '!!! ###' },
         { name: 'Metformin' },
      ]);
      expect(found.map((item) => item.name)).toEqual(['Metformin']);
   });
});

describe('parseExtraction: cleaning and limits', () => {
   it('clips name, strength and purpose to their limits', () => {
      const found = only(
         parseExtraction(
            reply({
               name: 'A'.repeat(200),
               strength: 'S'.repeat(200),
               purpose: 'P'.repeat(200),
            }),
         ),
      );
      expect(found.name).toHaveLength(80);
      expect(found.strength).toHaveLength(80);
      expect(found.purpose).toHaveLength(120);
   });

   it('strips control characters from text', () => {
      const found = only(
         parseExtraction(
            reply({ name: 'Amlo\u0007dipine', strength: '5\u0000 mg' }),
         ),
      );
      expect(found.name).toBe('Amlodipine');
      expect(found.strength).toBe('5 mg');
   });

   it('keeps only valid routine times, in day order, without repeats', () => {
      const found = only(
         parseExtraction(
            reply({
               name: 'Metformin',
               anchors: ['dinner', 'Wake', 'bogus', 'dinner', 42],
            }),
         ),
      );
      expect(found.anchors).toEqual(['wake', 'dinner']);
   });

   it('defaults the time to breakfast when no time is valid', () => {
      const none = only(parseExtraction(reply({ name: 'A', anchors: ['noon'] })));
      const missing = only(parseExtraction(reply({ name: 'A' })));
      expect(none.anchors).toEqual(['breakfast']);
      expect(missing.anchors).toEqual(['breakfast']);
   });

   it('reads the food rule and defaults to "any"', () => {
      const before = only(parseExtraction(reply({ name: 'A', food: 'Before' })));
      const sometimes = only(
         parseExtraction(reply({ name: 'A', food: 'sometimes' })),
      );
      const missing = only(parseExtraction(reply({ name: 'A' })));
      expect(before.food).toBe('before');
      expect(sometimes.food).toBe('any');
      expect(missing.food).toBe('any');
   });

   it('accepts whole units from 1 to the maximum, else defaults to 1', () => {
      const units = (raw: unknown) =>
         only(parseExtraction(reply({ name: 'A', unitsPerDose: raw })))
            .unitsPerDose;
      expect(units('2')).toBe(2);
      expect(units(20)).toBe(20);
      expect(units(0)).toBe(1);
      expect(units(99)).toBe(1);
      expect(units(2.5)).toBe(1);
      expect(units('two')).toBe(1);
      expect(units(undefined)).toBe(1);
   });

   it('keeps at most twelve medicines, in the order given', () => {
      const items = Array.from({ length: 15 }, (_, index) => ({
         name: `Medicine ${String.fromCharCode(65 + index)}`,
      }));
      const found = parseExtraction({ medicines: items });
      expect(found).toHaveLength(12);
      expect(found[0]?.name).toBe('Medicine A');
      expect(found[11]?.name).toBe('Medicine L');
   });

   it('drops repeated names, ignoring case and punctuation', () => {
      const found = parseExtraction([
         { name: 'Metformin' },
         { name: 'metformin ' },
         { name: 'Met-formin', strength: '850 mg' },
      ]);
      expect(found.map((item) => item.name)).toEqual(['Metformin']);
   });

   it('does not count repeated names toward the twelve', () => {
      const names = Array.from({ length: 12 }, (_, index) => `Drug ${index}`);
      const found = parseExtraction({
         medicines: [{ name: 'Drug 0' }, ...names.map((name) => ({ name }))],
      });
      expect(found).toHaveLength(12);
      expect(found[11]?.name).toBe('Drug 11');
   });
});

describe('compareWithCurrent', () => {
   it('marks a medicine not on the list as new', () => {
      const result = only(compareWithCurrent([draft()], []));
      expect(result.status).toBe('new');
      expect(result.matchId).toBe('');
   });

   it('marks an identical medicine as same, whatever the order of times', () => {
      const current = makeMedication({
         id: 'amlo-1',
         name: 'Amlodipine',
         strength: '5 mg tablet',
         anchors: ['dinner', 'breakfast'],
         food: 'any',
         unitsPerDose: 1,
      });
      const result = only(
         compareWithCurrent(
            [draft({ anchors: ['breakfast', 'dinner'] })],
            [current],
         ),
      );
      expect(result.status).toBe('same');
      expect(result.matchId).toBe('amlo-1');
   });

   it('marks a medicine as changed when any field differs', () => {
      const current = makeMedication({
         id: 'amlo-1',
         name: 'Amlodipine',
         strength: '5 mg tablet',
         anchors: ['breakfast'],
         food: 'any',
         unitsPerDose: 1,
      });
      const differences: Partial<DraftMedicine>[] = [
         { strength: '10 mg tablet' },
         { anchors: ['breakfast', 'sleep'] },
         { food: 'after' },
         { unitsPerDose: 2 },
      ];
      for (const change of differences) {
         const result = only(compareWithCurrent([draft(change)], [current]));
         expect(result.status).toBe('changed');
         expect(result.matchId).toBe('amlo-1');
      }
   });

   it('matches names ignoring case and punctuation', () => {
      const current = makeMedication({ id: 'm-1', name: 'Co-Amoxiclav' });
      const result = only(
         compareWithCurrent([draft({ name: 'co amoxiclav' })], [current]),
      );
      expect(result.matchId).toBe('m-1');
   });

   it('ignores stopped and pending medicines when matching', () => {
      const stopped = makeMedication({
         id: 'old',
         name: 'Amlodipine',
         status: 'stopped',
      });
      const pending = makeMedication({
         id: 'waiting',
         name: 'Amlodipine',
         status: 'pendingApproval',
      });
      const result = only(
         compareWithCurrent([draft()], [stopped, pending]),
      );
      expect(result.status).toBe('new');
      expect(result.matchId).toBe('');
   });
});

describe('notOnPrescription', () => {
   it('lists active medicines the prescription does not mention', () => {
      const amlodipine = makeMedication({ id: 'a', name: 'Amlodipine' });
      const metformin = makeMedication({ id: 'm', name: 'Metformin' });
      const stopped = makeMedication({
         id: 's',
         name: 'Aspirin',
         status: 'stopped',
      });
      const missing = notOnPrescription(
         [draft({ name: 'amlodipine' })],
         [amlodipine, metformin, stopped],
      );
      expect(missing.map((medication) => medication.id)).toEqual(['m']);
   });
});
