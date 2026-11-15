/**
 * Tests for the medicine form and the wording of medicine changes.
 */
import { describe, expect, it } from 'vitest';
import {
   describeChange,
   describeSchedule,
   medicationAfterApproval,
   parseMedicationForm,
} from '@/domain/medicationForm';
import { makeMedication, NOON, PROFILE_ID } from './fixtures';

const base = { id: 'new-1', profileId: PROFILE_ID, now: NOON, existing: null };
const values = {
   name: ' Amlodipine ',
   strength: '5 mg tablet',
   purpose: 'Blood pressure',
   food: 'before',
   unitsPerDose: '1',
   stock: '30',
   colour: '#FDE68A',
   critical: 'on',
   startDate: '2026-11-15',
   endDate: '',
};

describe('parseMedicationForm', () => {
   it('builds a clean medicine from valid input', () => {
      const result = parseMedicationForm(
         { values, anchors: ['sleep', 'breakfast'], photo: '' },
         base,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
         expect(result.value.name).toBe('Amlodipine');
         expect(result.value.anchors).toEqual(['breakfast', 'sleep']);
         expect(result.value.food).toBe('before');
         expect(result.value.critical).toBe(true);
         expect(result.value.colour).toBe('#fde68a');
         expect(result.value.status).toBe('active');
         expect(result.value.profileId).toBe(PROFILE_ID);
      }
   });

   it('needs a name and at least one time of day', () => {
      const noName = parseMedicationForm(
         { values: { ...values, name: '' }, anchors: ['sleep'], photo: '' },
         base,
      );
      const noTime = parseMedicationForm(
         { values, anchors: [], photo: '' },
         base,
      );
      expect(noName.ok).toBe(false);
      expect(noTime.ok).toBe(false);
   });

   it('rejects impossible numbers and dates', () => {
      const cases = [
         { ...values, unitsPerDose: '0' },
         { ...values, unitsPerDose: '99' },
         { ...values, stock: '-1' },
         { ...values, stock: 'many' },
         { ...values, startDate: '2026-13-01' },
         { ...values, endDate: '2026-11-01' },
      ];
      for (const bad of cases) {
         const result = parseMedicationForm(
            { values: bad, anchors: ['sleep'], photo: '' },
            base,
         );
         expect(result.ok).toBe(false);
      }
   });

   it('falls back to safe defaults for unknown choices', () => {
      const result = parseMedicationForm(
         {
            values: { ...values, food: 'sometimes', critical: '' },
            anchors: ['lunch'],
            photo: '',
         },
         base,
      );
      expect(result.ok && result.value.food).toBe('any');
      expect(result.ok && result.value.critical).toBe(false);
   });

   it('keeps the existing photo unless a new one is given', () => {
      const existing = makeMedication({ photo: 'data:old' });
      const kept = parseMedicationForm(
         { values, anchors: ['lunch'], photo: '' },
         { ...base, id: existing.id, existing },
      );
      const replaced = parseMedicationForm(
         { values, anchors: ['lunch'], photo: 'data:new' },
         { ...base, id: existing.id, existing },
      );
      expect(kept.ok && kept.value.photo).toBe('data:old');
      expect(replaced.ok && replaced.value.photo).toBe('data:new');
   });
});

describe('describing medicines', () => {
   const medication = makeMedication({
      name: 'Metformin',
      strength: '500 mg',
      anchors: ['breakfast', 'dinner'],
      food: 'after',
      unitsPerDose: 1,
   });

   it('describes the schedule in plain words', () => {
      expect(describeSchedule(medication)).toBe(
         'at breakfast and at dinner, after food',
      );
      expect(
         describeSchedule(makeMedication({ anchors: ['sleep'], food: 'any' })),
      ).toBe('at bedtime');
   });

   it('describes each kind of change', () => {
      expect(describeChange('addMedication', medication)).toBe(
         'Add Metformin 500 mg: 1 at breakfast and at dinner, after food',
      );
      expect(describeChange('editMedication', medication)).toContain(
         'Change Metformin',
      );
      expect(describeChange('stopMedication', medication)).toBe(
         'Stop Metformin 500 mg',
      );
   });

   it('activates on approval and keeps stopped medicines on file', () => {
      const pending = makeMedication({ status: 'pendingApproval' });
      expect(
         medicationAfterApproval('addMedication', pending, NOON).status,
      ).toBe('active');
      expect(
         medicationAfterApproval('stopMedication', pending, NOON).status,
      ).toBe('stopped');
   });
});
