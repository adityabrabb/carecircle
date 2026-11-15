/**
 * Tests for passcodes, signed tokens, permissions and consent.
 */
import { describe, expect, it } from 'vitest';
import {
   ALL_PERMISSIONS,
   LOCKOUT_MINUTES,
   MAX_FAILED_ATTEMPTS,
   MS_PER_MINUTE,
} from '@/constants/care';
import {
   afterAttempt,
   hashPasscode,
   isLocked,
   validatePasscode,
   verifyPasscode,
} from '@/domain/passcode';
import {
   can,
   effectivePermissions,
   isOwner,
   routeChange,
   sanitisePermissions,
} from '@/domain/permissions';
import { signToken, verifyToken } from '@/domain/tokens';
import { makeMember, makeProfile, NOON } from './fixtures';

const SECRET = 'test-secret-that-is-long-enough-123456';

describe('passcodes', () => {
   it('accepts a reasonable passcode', () => {
      expect(validatePasscode('lotus742').ok).toBe(true);
   });

   it('rejects short, weak or odd passcodes', () => {
      expect(validatePasscode('12345').ok).toBe(false);
      expect(validatePasscode('123456').ok).toBe(false);
      expect(validatePasscode('has space1').ok).toBe(false);
      expect(validatePasscode('a'.repeat(13)).ok).toBe(false);
   });

   it('stores a salted hash, never the passcode', () => {
      const first = hashPasscode('lotus742');
      const second = hashPasscode('lotus742');
      expect(first).not.toContain('lotus742');
      expect(first).not.toBe(second);
   });

   it('verifies the right passcode only', () => {
      const stored = hashPasscode('lotus742');
      expect(verifyPasscode('lotus742', stored)).toBe(true);
      expect(verifyPasscode('lotus743', stored)).toBe(false);
   });

   it('fails safely on a malformed hash', () => {
      expect(verifyPasscode('lotus742', '')).toBe(false);
      expect(verifyPasscode('lotus742', 'scrypt$zz$zz')).toBe(false);
      expect(verifyPasscode('lotus742', 'plain$aa$bb')).toBe(false);
   });

   it('locks after too many wrong attempts and clears on success', () => {
      let state = { failedAttempts: 0, lockedUntil: 0 };
      for (let attempt = 0; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
         state = afterAttempt(state, false, NOON);
      }
      expect(isLocked(state, NOON)).toBe(true);
      expect(isLocked(state, NOON + LOCKOUT_MINUTES*MS_PER_MINUTE)).toBe(
         false,
      );
      expect(afterAttempt(state, true, NOON)).toEqual({
         failedAttempts: 0,
         lockedUntil: 0,
      });
   });
});

describe('signed tokens', () => {
   const claims = {
      purpose: 'dose',
      profileId: 'p',
      memberId: 'm',
      subject: 'dose-1',
      expiresAt: NOON + 1000,
   };

   it('round-trips valid claims', () => {
      const token = signToken(claims, SECRET);
      expect(verifyToken(token, SECRET, 'dose', NOON)).toEqual(claims);
   });

   it('rejects an expired token', () => {
      const token = signToken(claims, SECRET);
      expect(verifyToken(token, SECRET, 'dose', NOON + 1000)).toBeNull();
   });

   it('rejects a token used for another purpose', () => {
      const token = signToken(claims, SECRET);
      expect(verifyToken(token, SECRET, 'session', NOON)).toBeNull();
   });

   it('rejects a tampered payload or a wrong secret', () => {
      const token = signToken(claims, SECRET);
      const forged = signToken({ ...claims, memberId: 'other' }, SECRET);
      const mixed = `${forged.split('.')[0]}.${token.split('.')[1]}`;
      expect(verifyToken(mixed, SECRET, 'dose', NOON)).toBeNull();
      expect(verifyToken(token, `${SECRET}x`, 'dose', NOON)).toBeNull();
   });

   it('rejects malformed input without throwing', () => {
      for (const bad of ['', 'abc', 'a.b.c', '.', 'e30.']) {
         expect(verifyToken(bad, SECRET, 'dose', NOON)).toBeNull();
      }
   });
});

describe('permissions', () => {
   const profile = makeProfile();
   const elder = makeMember('elder');
   const family = makeMember('family');

   it('gives the elder everything, always', () => {
      const paused = makeProfile({ sharingPaused: true });
      for (const permission of ALL_PERMISSIONS) {
         expect(can(elder, permission, paused)).toBe(true);
      }
      expect(isOwner(elder, profile)).toBe(true);
   });

   it('gives others only what the elder allowed', () => {
      expect(can(family, 'viewMedications', profile)).toBe(true);
      expect(can(family, 'viewDocuments', profile)).toBe(false);
      expect(isOwner(family, profile)).toBe(false);
   });

   it('hides everything from others while sharing is paused', () => {
      const paused = makeProfile({ sharingPaused: true });
      expect(effectivePermissions(family, paused, ALL_PERMISSIONS)).toEqual(
         [],
      );
   });

   it('gives nothing to an inactive member or another circle', () => {
      const removed = makeMember('family', { active: false });
      const stranger = makeMember('family', { profileId: 'other' });
      expect(can(removed, 'viewMedications', profile)).toBe(false);
      expect(can(stranger, 'viewMedications', profile)).toBe(false);
   });

   it('drops unknown permissions from a form', () => {
      expect(
         sanitisePermissions(
            ['viewHealth', 'becomeOwner', 'viewHealth'],
            ALL_PERMISSIONS,
         ),
      ).toEqual(['viewHealth']);
   });
});

describe('routeChange (consent for medicine changes)', () => {
   const elder = makeMember('elder');
   const daughter = makeMember('family', { id: 'daughter' });
   const son = makeMember('family', { id: 'son' });

   it('applies the elder’s own change at once', () => {
      expect(routeChange(elder, makeProfile(), false)).toBe('apply');
   });

   it('makes a helper’s change a proposal', () => {
      expect(routeChange(daughter, makeProfile(), false)).toBe('propose');
      expect(routeChange(daughter, makeProfile(), true)).toBe('propose');
   });

   it('denies a helper without the permission', () => {
      const viewer = makeMember('family', { permissions: [] });
      expect(routeChange(viewer, makeProfile(), false)).toBe('deny');
   });

   it('lets only the trusted person use the emergency plan', () => {
      const profile = makeProfile({
         emergencyPlan: {
            trustedMemberId: 'daughter',
            allowUrgentChanges: true,
            instructions: '',
         },
      });
      expect(routeChange(daughter, profile, true)).toBe('emergency');
      expect(routeChange(daughter, profile, false)).toBe('propose');
      expect(routeChange(son, profile, true)).toBe('propose');
   });

   it('ignores the emergency plan when the elder did not allow it', () => {
      const profile = makeProfile({
         emergencyPlan: {
            trustedMemberId: 'daughter',
            allowUrgentChanges: false,
            instructions: '',
         },
      });
      expect(routeChange(daughter, profile, true)).toBe('propose');
   });
});
