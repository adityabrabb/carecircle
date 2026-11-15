/**
 * Clock.
 *
 * Purpose: the current time as one profile sees it. Real profiles use
 * the real clock. A demo profile can move its own clock forward so a
 * visitor can watch reminders and escalation happen without waiting.
 */
import { MS_PER_MINUTE } from '@/constants/care';
import type { CareProfile } from '@/domain/types';

/** Purpose: "now" for the profile, in milliseconds since the epoch. */
export function nowFor(profile: CareProfile): number {
   const skip = profile.isDemo ? profile.clockSkipMinutes : 0;
   return Date.now() + skip*MS_PER_MINUTE;
}
