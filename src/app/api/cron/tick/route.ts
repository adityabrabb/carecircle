/**
 * Scheduler endpoint.
 *
 * Purpose: called every few minutes by Cloud Scheduler. Runs the
 * reminder check for every profile and removes sample circles that are
 * more than a day old. The caller must send the shared secret; without
 * a configured secret the endpoint refuses every request.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cronSecret } from '@/config/env';
import { MS_PER_DAY } from '@/constants/care';
import { runTick } from '@/services/reminders';
import { getStore } from '@/store';

export const dynamic = 'force-dynamic';

/** Purpose: constant-time check of the secret the caller sent. */
function authorised(request: Request): boolean {
   const expected = cronSecret();
   const given = request.headers.get('x-cron-secret') ?? '';
   if (!expected || given.length !== expected.length) {
      return false;
   }
   return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: Request): Promise<NextResponse> {
   if (!authorised(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   const store = getStore();
   const profiles = await store.listProfiles();
   const now = Date.now();
   let checked = 0;
   let emails = 0;
   let removed = 0;
   let failed = 0;
   for (const profile of profiles) {
      try {
         if (profile.isDemo && now - profile.createdAt > MS_PER_DAY) {
            await store.deleteProfile(profile.id);
            removed += 1;
            continue;
         }
         const report = await runTick(profile);
         checked += 1;
         emails += report.emails;
      } catch (error) {
         // ----- One broken profile must not stop the others.
         failed += 1;
         console.error('Tick failed for a profile:', error);
      }
   }
   return NextResponse.json({ checked, emails, removed, failed });
}
