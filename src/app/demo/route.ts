/**
 * Sample family link.
 *
 * Purpose: one link a judge or visitor can open to land straight in a
 * fresh sample circle, signed in as its elder. Nothing in it is real,
 * and the scheduled check deletes sample circles after one day. Real
 * circles still need their circle code and passcode.
 */
import { redirect } from 'next/navigation';
import { createDemoCircle } from '@/services/demoSeed';
import { startSession } from '@/services/session';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<never> {
   const { profile, elder } = await createDemoCircle();
   await startSession(profile.id, elder.id);
   redirect('/home?ok=You+are+in+a+sample+family.+Nothing+here+is+real.');
}
