'use server';

/**
 * Sample-family actions.
 *
 * Purpose: let a visitor enter a fresh sample circle, switch between
 * its members, and move its clock forward to watch reminders and
 * escalation happen. These actions refuse to run on a real profile.
 */
import { redirect } from 'next/navigation';
import { fail, field } from '@/app/actions/helpers';
import { MINUTES_PER_DAY } from '@/constants/care';
import { createDemoCircle } from '@/services/demoSeed';
import { runTick } from '@/services/reminders';
import { requireContext, startSession } from '@/services/session';
import { getStore } from '@/store';
import { counted } from '@/domain/text';

/** Clock jumps a visitor may choose, in minutes. */
const ALLOWED_SKIPS: readonly number[] = [30, 60, 180, MINUTES_PER_DAY];

/** Purpose: create a sample circle and sign in as its elder. */
export async function enterDemo(): Promise<void> {
   const { profile, elder } = await createDemoCircle();
   await startSession(profile.id, elder.id);
   redirect('/home?ok=You+are+in+a+sample+family.+Nothing+here+is+real.');
}

/** Purpose: sign in as another member of the sample circle. */
export async function switchDemoMember(form: FormData): Promise<void> {
   const { profile } = await requireContext();
   if (!profile.isDemo) {
      fail('/home', 'Switching people is only for the sample family.');
   }
   const member = await getStore().get(
      'members',
      profile.id,
      field(form, 'memberId'),
   );
   if (!member || !member.active) {
      fail('/home', 'That person was not found.');
   }
   await startSession(profile.id, member.id);
   redirect(`/home?ok=${encodeURIComponent(`You are now ${member.name}.`)}`);
}

/**
 * Purpose: move the sample circle's clock forward and run the reminder
 * check, so missed doses escalate as they would in real time.
 */
export async function skipDemoTime(form: FormData): Promise<void> {
   const { profile } = await requireContext();
   if (!profile.isDemo) {
      fail('/home', 'Time skip is only for the sample family.');
   }
   const minutes = Number(field(form, 'minutes'));
   if (!ALLOWED_SKIPS.includes(minutes)) {
      fail('/home', 'Choose one of the time jumps shown.');
   }
   const moved = {
      ...profile,
      clockSkipMinutes: profile.clockSkipMinutes + minutes,
   };
   await getStore().putProfile(moved);
   const report = await runTick(moved);
   redirect(
      `/home?ok=${encodeURIComponent(
         `Clock moved forward. ${counted(report.emails, 'email', 'emails')} recorded.`,
      )}`,
   );
}
