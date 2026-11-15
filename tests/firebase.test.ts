/**
 * Tests for reading the Firestore service account from the environment.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { firebaseCredentials } from '@/config/env';

const ACCOUNT = {
   project_id: 'carecircle-test',
   client_email: 'app@carecircle-test.iam.gserviceaccount.com',
   private_key: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n',
};

/** Purpose: put a value into the environment for one test. */
function setCredentials(value: string | undefined): void {
   if (value === undefined) {
      delete process.env.FIREBASE_CREDENTIALS;
   } else {
      process.env.FIREBASE_CREDENTIALS = value;
   }
}

afterEach(() => {
   setCredentials(undefined);
});

describe('firebaseCredentials', () => {
   it('is null when nothing is set', () => {
      setCredentials(undefined);
      expect(firebaseCredentials()).toBeNull();
   });

   it('reads plain service-account JSON', () => {
      setCredentials(JSON.stringify(ACCOUNT));
      expect(firebaseCredentials()).toEqual({
         projectId: ACCOUNT.project_id,
         clientEmail: ACCOUNT.client_email,
         privateKey: ACCOUNT.private_key,
      });
   });

   it('reads the same JSON encoded as base64', () => {
      setCredentials(Buffer.from(JSON.stringify(ACCOUNT)).toString('base64'));
      expect(firebaseCredentials()).toEqual({
         projectId: ACCOUNT.project_id,
         clientEmail: ACCOUNT.client_email,
         privateKey: ACCOUNT.private_key,
      });
   });

   it('turns an escaped newline into a real one', () => {
      const broken = JSON.stringify(ACCOUNT).replace(/\n/g, '\\n');
      setCredentials(broken);
      expect(firebaseCredentials()?.privateKey).toBe(ACCOUNT.private_key);
   });

   it('ignores surrounding whitespace', () => {
      setCredentials(`  ${JSON.stringify(ACCOUNT)}\n`);
      expect(firebaseCredentials()?.projectId).toBe(ACCOUNT.project_id);
   });

   it('refuses text that is not JSON', () => {
      setCredentials('not-a-service-account');
      expect(() => firebaseCredentials()).toThrow(/JSON/);
   });

   it('refuses JSON that is missing a field', () => {
      setCredentials(JSON.stringify({ project_id: ACCOUNT.project_id }));
      expect(() => firebaseCredentials()).toThrow(/private_key/);
   });

   it('refuses a field of the wrong type', () => {
      setCredentials(
         JSON.stringify({ ...ACCOUNT, client_email: 42, project_id: '' }),
      );
      expect(() => firebaseCredentials()).toThrow(/client_email/);
   });
});
