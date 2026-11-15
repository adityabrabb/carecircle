/**
 * Sessions.
 *
 * Purpose: remember who is signed in, using a signed, HTTP-only cookie,
 * and load the profile and member for each request. Every page and
 * action starts by asking this file who is calling.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isProduction, sessionSecret } from '@/config/env';
import { MS_PER_HOUR, SESSION_HOURS } from '@/constants/care';
import { signToken, verifyToken } from '@/domain/tokens';
import type { CareProfile, Member } from '@/domain/types';
import { nowFor } from '@/services/clock';
import { getStore } from '@/store';

const COOKIE_NAME = 'cc_session';
const SESSION_PURPOSE = 'session';

export interface CareContext {
   profile: CareProfile;
   member: Member;
   /** The current time as this profile sees it. */
   now: number;
}

/** Purpose: sign the member in. Side effect: sets the session cookie. */
export async function startSession(
   profileId: string,
   memberId: string,
): Promise<void> {
   const token = signToken(
      {
         purpose: SESSION_PURPOSE,
         profileId,
         memberId,
         subject: '',
         expiresAt: Date.now() + SESSION_HOURS*MS_PER_HOUR,
      },
      sessionSecret(),
   );
   const jar = await cookies();
   jar.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/',
      maxAge: SESSION_HOURS*3600,
   });
}

/** Purpose: sign out. Side effect: removes the session cookie. */
export async function endSession(): Promise<void> {
   const jar = await cookies();
   jar.delete(COOKIE_NAME);
}

/**
 * Purpose: the signed-in member and their profile, or null when nobody
 * is signed in, the session expired, or the member was removed.
 */
export async function getContext(): Promise<CareContext | null> {
   const jar = await cookies();
   const token = jar.get(COOKIE_NAME)?.value;
   if (!token) {
      return null;
   }
   const claims = verifyToken(
      token,
      sessionSecret(),
      SESSION_PURPOSE,
      Date.now(),
   );
   if (!claims) {
      return null;
   }
   const store = getStore();
   const profile = await store.getProfile(claims.profileId);
   if (!profile) {
      return null;
   }
   const member = await store.get('members', profile.id, claims.memberId);
   if (!member || !member.active) {
      return null;
   }
   return { profile, member, now: nowFor(profile) };
}

/** Purpose: like getContext, but sends the visitor to sign in. */
export async function requireContext(): Promise<CareContext> {
   const context = await getContext();
   if (!context) {
      redirect('/login');
   }
   return context;
}
