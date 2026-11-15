/**
 * Passcodes.
 *
 * Purpose: hash and check member passcodes, and decide when repeated
 * wrong attempts lock a member out. Passcodes are stored only as a
 * salted scrypt hash, never as plain text.
 */
import {
   randomBytes,
   scryptSync,
   timingSafeEqual,
} from 'node:crypto';
import {
   LOCKOUT_MINUTES,
   MAX_FAILED_ATTEMPTS,
   MS_PER_MINUTE,
   PASSCODE_MAX_LENGTH,
   PASSCODE_MIN_LENGTH,
} from '@/constants/care';
import type { Result } from '@/domain/types';

const SALT_BYTES = 16;
const KEY_BYTES = 32;
const HASH_PREFIX = 'scrypt';

/** Passcodes too easy to guess to be accepted. */
const WEAK_PASSCODES: readonly string[] = [
   '000000',
   '111111',
   '123456',
   '654321',
   '123123',
   'password',
];

/**
 * Purpose: check a new passcode is long enough and not a well-known
 * weak one. Digits or letters are both allowed so an elder can pick
 * something memorable.
 */
export function validatePasscode(passcode: string): Result<string> {
   if (
      passcode.length < PASSCODE_MIN_LENGTH ||
      passcode.length > PASSCODE_MAX_LENGTH
   ) {
      return {
         ok: false,
         error:
            `Passcode must be ${PASSCODE_MIN_LENGTH} to ` +
            `${PASSCODE_MAX_LENGTH} characters.`,
      };
   }
   if (!/^[A-Za-z0-9]+$/.test(passcode)) {
      return {
         ok: false,
         error: 'Passcode can use letters and numbers only.',
      };
   }
   if (WEAK_PASSCODES.includes(passcode.toLowerCase())) {
      return { ok: false, error: 'That passcode is too easy to guess.' };
   }
   return { ok: true, value: passcode };
}

/** Purpose: salted hash of a passcode, safe to store. */
export function hashPasscode(passcode: string): string {
   const salt = randomBytes(SALT_BYTES);
   const key = scryptSync(passcode, salt, KEY_BYTES);
   return `${HASH_PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
}

/**
 * Purpose: true when the passcode matches the stored hash. The compare
 * runs in constant time, and a malformed hash simply fails.
 */
export function verifyPasscode(passcode: string, stored: string): boolean {
   const parts = stored.split('$');
   const saltHex = parts[1];
   const keyHex = parts[2];
   if (parts[0] !== HASH_PREFIX || !saltHex || !keyHex) {
      return false;
   }
   const expected = Buffer.from(keyHex, 'hex');
   if (expected.length !== KEY_BYTES) {
      return false;
   }
   const actual = scryptSync(
      passcode,
      Buffer.from(saltHex, 'hex'),
      KEY_BYTES,
   );
   return timingSafeEqual(actual, expected);
}

export interface LockState {
   failedAttempts: number;
   lockedUntil: number;
}

/** Purpose: true while the member is locked out. */
export function isLocked(state: LockState, now: number): boolean {
   return state.lockedUntil > now;
}

/**
 * Purpose: the lock state after one more attempt. A correct passcode
 * clears the count; too many wrong ones lock the member for a while.
 */
export function afterAttempt(
   state: LockState,
   succeeded: boolean,
   now: number,
): LockState {
   if (succeeded) {
      return { failedAttempts: 0, lockedUntil: 0 };
   }
   const failedAttempts = state.failedAttempts + 1;
   if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return {
         failedAttempts: 0,
         lockedUntil: now + LOCKOUT_MINUTES*MS_PER_MINUTE,
      };
   }
   return { failedAttempts, lockedUntil: state.lockedUntil };
}
