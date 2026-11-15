/**
 * Tests for the shared wording helpers.
 */
import { describe, expect, it } from 'vitest';
import { agree, counted, memberLabel } from '@/domain/text';

describe('counted', () => {
   it('uses the singular for exactly one', () => {
      expect(counted(1, 'dose', 'doses')).toBe('1 dose');
   });

   it('uses the plural for zero and many', () => {
      expect(counted(0, 'email', 'emails')).toBe('0 emails');
      expect(counted(3, 'day', 'days')).toBe('3 days');
   });
});

describe('agree', () => {
   it('picks the verb that agrees with the count', () => {
      expect(agree(1, 'needs', 'need')).toBe('needs');
      expect(agree(2, 'needs', 'need')).toBe('need');
   });
});

describe('memberLabel', () => {
   it('adds the role after the name', () => {
      expect(memberLabel({ name: 'Arjun', role: 'family' })).toBe(
         'Arjun (family)',
      );
   });

   it('does not repeat a role the name already carries', () => {
      expect(
         memberLabel({ name: 'Sunita (caretaker)', role: 'caretaker' }),
      ).toBe('Sunita (caretaker)');
   });
});
