/**
 * One-tap dose page.
 *
 * Purpose: the page a reminder email opens. It shows the doses due at
 * that time with the same large buttons as the Today screen, and needs
 * no sign-in: the signed link says who it is for. Opening the page
 * changes nothing; a dose is only recorded when a button is pressed, so
 * an email scanner that follows the link cannot confirm a dose.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmFromLinkAction } from '@/app/actions/doses';
import { DoseCard } from '@/components/DoseCard';
import { Notice, type NoticeParams } from '@/components/Notice';
import { dueMinutes } from '@/domain/schedule';
import { foodNote } from '@/services/care';
import { nowFor } from '@/services/clock';
import { readDoseToken } from '@/services/links';
import { getStore } from '@/store';

export const metadata: Metadata = {
   title: 'Confirm your medicine',
   robots: { index: false, follow: false },
};

export default async function DoseLinkPage({
   params,
   searchParams,
}: {
   params: Promise<{ token: string }>;
   searchParams: Promise<NoticeParams>;
}) {
   const { token } = await params;
   const claims = readDoseToken(token);
   const store = getStore();
   const profile = claims ? await store.getProfile(claims.profileId) : null;
   const member =
      claims && profile
         ? await store.get('members', profile.id, claims.memberId)
         : null;
   const first =
      claims && profile
         ? await store.get('doses', profile.id, claims.subject)
         : null;

   if (!claims || !profile || !member || !member.active || !first) {
      return (
         <>
            <div className="page-head">
               <h1>This link has expired</h1>
               <p>
                  Reminder links work for a few hours. Please sign in to
                  record your medicines.
               </p>
            </div>
            <Link className="btn" href="/login">
               Sign in
            </Link>
         </>
      );
   }

   // ----- Show every dose due at the same time as the linked one.
   const [sameDay, medications] = await Promise.all([
      store.listIn('doses', profile.id, 'dateKey', [first.dateKey]),
      store.list('medications', profile.id),
   ]);
   const doses = sameDay.filter((dose) => dose.dueAt === first.dueAt);
   const byId = new Map(
      medications.map((medication) => [medication.id, medication]),
   );
   const now = nowFor(profile);

   return (
      <>
         <Notice params={await searchParams} />
         <div className="page-head">
            <h1>{member.name}, your medicines</h1>
         </div>
         <ul className="cards">
            {doses.map((dose) => {
               const medication = byId.get(dose.medicationId);
               return (
                  <DoseCard
                     key={dose.id}
                     dose={dose}
                     medication={medication}
                     language={profile.language}
                     dueMinutes={Math.max(
                        0,
                        dueMinutes(
                           profile.routine,
                           dose.anchor,
                           medication?.food ?? 'any',
                        ),
                     )}
                     foodNote={
                        medication
                           ? foodNote(medication, profile.language)
                           : ''
                     }
                     viewerRole="elder"
                     canConfirm={member.role === 'elder'}
                     handlerName=""
                     isDue={dose.dueAt <= now}
                     action={confirmFromLinkAction}
                     hidden={<input type="hidden" name="token" value={token} />}
                  />
               );
            })}
         </ul>
         <p>
            <Link href="/login">Sign in to see your whole day</Link>
         </p>
      </>
   );
}
