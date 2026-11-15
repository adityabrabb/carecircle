'use server';

/**
 * Dose actions.
 *
 * Purpose: record what happened to a dose, from the Today screen or
 * from a one-tap link in a reminder email, and let a helper say they
 * are handling an unconfirmed dose.
 */
import { fail, field, succeed } from '@/app/actions/helpers';
import { UNSURE_ADVICE } from '@/domain/doses';
import type { ConfirmMethod, DoseStatus } from '@/domain/types';
import { optionalText } from '@/domain/validation';
import { recordAcknowledge, recordDose } from '@/services/care';
import { nowFor } from '@/services/clock';
import { readDoseToken } from '@/services/links';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

type Answer = Exclude<DoseStatus, 'unconfirmed'>;

const ANSWERS: readonly Answer[] = ['taken', 'skipped', 'unsure'];

const SUCCESS_TEXT: Record<Answer, string> = {
   taken: 'Recorded as taken.',
   skipped: 'Recorded as skipped by your choice.',
   unsure: UNSURE_ADVICE,
};

/** Purpose: read the answer from a form, or null when not valid. */
function parseAnswer(form: FormData): Answer | null {
   const raw = field(form, 'status');
   return ANSWERS.find((answer) => answer === raw) ?? null;
}

/** Purpose: read how a helper knows the dose was taken. */
function parseMethod(form: FormData): ConfirmMethod {
   return field(form, 'method') === 'observed' ? 'observed' : 'assumed';
}

/** Purpose: record a dose for the signed-in member. */
export async function confirmDoseAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   const answer = parseAnswer(form);
   const reason = optionalText(field(form, 'reason'), 'Reason');
   if (!answer || !reason.ok) {
      fail('/home', 'Please choose one of the buttons.');
   }
   const result = await recordDose(
      profile,
      member,
      field(form, 'doseId'),
      answer,
      parseMethod(form),
      reason.value,
      now,
   );
   if (!result.ok) {
      fail('/home', result.error);
   }
   succeed('/home', SUCCESS_TEXT[answer]);
}

/** Purpose: mark that the signed-in member is handling a dose. */
export async function acknowledgeDoseAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   const result = await recordAcknowledge(
      profile,
      member,
      field(form, 'doseId'),
   );
   if (!result.ok) {
      fail('/home', result.error);
   }
   succeed('/home', 'Thank you. The circle can see you are handling it.');
}

/**
 * Purpose: record a dose from a signed email link, with no sign-in.
 * The link names the dose and the member, cannot be forged, and stops
 * working after it expires.
 */
export async function confirmFromLinkAction(form: FormData): Promise<void> {
   const token = field(form, 'token');
   const back = `/dose/${token}`;
   const claims = readDoseToken(token);
   if (!claims) {
      fail('/login', 'That link has expired. Please sign in.');
   }
   const store = getStore();
   const profile = await store.getProfile(claims.profileId);
   const member = profile
      ? await store.get('members', profile.id, claims.memberId)
      : null;
   if (!profile || !member || !member.active) {
      fail('/login', 'That link is no longer valid. Please sign in.');
   }
   const answer = parseAnswer(form);
   const reason = optionalText(field(form, 'reason'), 'Reason');
   if (!answer || !reason.ok) {
      fail(back, 'Please choose one of the buttons.');
   }
   const result = await recordDose(
      profile,
      member,
      field(form, 'doseId'),
      answer,
      'assumed',
      reason.value,
      nowFor(profile),
   );
   if (!result.ok) {
      fail(back, result.error);
   }
   succeed(back, SUCCESS_TEXT[answer]);
}
