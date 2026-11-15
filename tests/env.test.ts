/**
 * Tests for the session secret, which must never be random in
 * production: a fresh secret signs everyone out on every restart.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionSecret } from '@/config/env';

const MIN_SECRET_LENGTH = 32;
const GOOD_SECRET = 'a'.repeat(MIN_SECRET_LENGTH);

/** Purpose: run one case in production with a chosen secret. */
function asProduction(secret: string): void {
   vi.stubEnv('NODE_ENV', 'production');
   vi.stubEnv('SESSION_SECRET', secret);
}

afterEach(() => {
   vi.unstubAllEnvs();
});

describe('sessionSecret', () => {
   it('fails in production when the secret is missing', () => {
      asProduction('');
      expect(() => sessionSecret()).toThrow(/at least 32 characters/);
   });

   it('fails in production when the secret is too short', () => {
      asProduction('a'.repeat(MIN_SECRET_LENGTH - 1));
      expect(() => sessionSecret()).toThrow(/at least 32 characters/);
   });

   it('fails in production when the secret is only spaces', () => {
      asProduction('   ');
      expect(() => sessionSecret()).toThrow(/at least 32 characters/);
   });

   it('uses the configured secret in production', () => {
      asProduction(GOOD_SECRET);
      expect(sessionSecret()).toBe(GOOD_SECRET);
   });

   it('keeps working in local work without a secret', () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('SESSION_SECRET', '');
      const first = sessionSecret();
      expect(first.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH);
      expect(sessionSecret()).toBe(first);
   });
});
