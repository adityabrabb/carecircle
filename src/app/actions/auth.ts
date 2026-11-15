'use server';

/**
 * Sign-in actions.
 *
 * Purpose: create a circle, sign in, sign out and set the text size.
 * Side effects: writes profiles and members, sets and clears cookies.
 */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fail, field } from '@/app/actions/helpers';
import { isProduction } from '@/config/env';
import {
   parseEmail,
   parseLanguage,
   requireName,
} from '@/domain/validation';
import { createCircle, signIn } from '@/services/accounts';
import { endSession, startSession } from '@/services/session';

const TEXT_SIZE_COOKIE = 'cc_text';
const ONE_YEAR_SECONDS = 31_536_000;

/** Purpose: create a new circle and sign the elder in. */
export async function createCircleAction(form: FormData): Promise<void> {
   const name = requireName(field(form, 'elderName'), 'Name');
   if (!name.ok) {
      fail('/start', name.error);
   }
   const email = parseEmail(field(form, 'email'), true);
   if (!email.ok) {
      fail('/start', email.error);
   }
   if (field(form, 'passcode') !== field(form, 'passcodeAgain')) {
      fail('/start', 'The two passcodes do not match.');
   }
   const created = await createCircle({
      elderName: name.value,
      elderEmail: email.value,
      passcode: field(form, 'passcode'),
      language: parseLanguage(field(form, 'language')),
   });
   if (!created.ok) {
      fail('/start', created.error);
   }
   await startSession(created.value.profile.id, created.value.elder.id);
   redirect('/settings?ok=Your+circle+is+ready.+Share+the+code+below.');
}

/** Purpose: sign in with a circle code and passcode. */
export async function signInAction(form: FormData): Promise<void> {
   const result = await signIn(
      field(form, 'circleCode'),
      field(form, 'passcode'),
   );
   if (!result.ok) {
      fail('/login', result.error);
   }
   await startSession(result.value.profile.id, result.value.member.id);
   redirect('/home');
}

/** Purpose: sign out and return to the landing page. */
export async function signOut(): Promise<void> {
   await endSession();
   redirect('/');
}

/** Purpose: remember the visitor's text-size choice in a cookie. */
export async function setTextSize(form: FormData): Promise<void> {
   const jar = await cookies();
   const size = field(form, 'size') === 'large' ? 'large' : 'normal';
   jar.set(TEXT_SIZE_COOKIE, size, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
   });
   // ----- Return to the page the visitor was on, by path only.
   let back = '/';
   try {
      back = new URL((await headers()).get('referer') ?? '').pathname;
   } catch {
      back = '/';
   }
   redirect(back);
}
