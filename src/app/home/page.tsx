/**
 * Today.
 *
 * Purpose: the screen the elder uses every day. It shows what is due
 * now, what is coming up and what is done, with large buttons and a
 * read-aloud option. Helpers see the same doses with the buttons their
 * permissions allow.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
   acknowledgeDoseAction,
   confirmDoseAction,
} from '@/app/actions/doses';
import { DemoBar } from '@/components/DemoBar';
import { DoseCard } from '@/components/DoseCard';
import { Notice, type NoticeParams } from '@/components/Notice';
import { SpeakButton } from '@/components/SpeakButton';
import { EARLY_CONFIRM_MINUTES, MS_PER_MINUTE } from '@/constants/care';
import { isOpen } from '@/domain/doses';
import { can } from '@/domain/permissions';
import { dueMinutes } from '@/domain/schedule';
import { formatClock } from '@/domain/time';
import type { DoseRecord, Medication } from '@/domain/types';
import { anchorLabel, speechTag, t } from '@/i18n/strings';
import { foodNote, loadCurrentDoses } from '@/services/care';
import { tickIfStale } from '@/services/reminders';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Today' };

export default async function HomePage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const store = getStore();
   const language = profile.language;

   await tickIfStale(profile);

   const members = await store.list('members', profile.id);
   const mayView = can(member, 'viewMedications', profile);
   const mayConfirm = can(member, 'confirmDoses', profile);
   const current = mayView
      ? await loadCurrentDoses(profile, now)
      : { dateKey: '', medications: [], today: [], carriedOver: [] };
   const pendingProposals =
      member.role === 'elder'
         ? (await store.listIn('proposals', profile.id, 'status', ['pending']))
              .length
         : 0;

   const medications = new Map<string, Medication>(
      current.medications.map((medication) => [medication.id, medication]),
   );
   const names = new Map(members.map((person) => [person.id, person.name]));
   const today = current.today;
   const dueNow = today.filter((dose) => isOpen(dose) && dose.dueAt <= now);
   const comingUp = today.filter((dose) => isOpen(dose) && dose.dueAt > now);
   const done = today.filter((dose) => !isOpen(dose));
   const earlyWindow = EARLY_CONFIRM_MINUTES*MS_PER_MINUTE;

   /** Purpose: local minutes after midnight when a dose is due. */
   function minutesFor(dose: DoseRecord): number {
      const medication = medications.get(dose.medicationId);
      return Math.max(
         0,
         dueMinutes(profile.routine, dose.anchor, medication?.food ?? 'any'),
      );
   }

   /** Purpose: the sentence read aloud for a dose. */
   function spoken(dose: DoseRecord): string {
      const medication = medications.get(dose.medicationId);
      if (!medication) {
         return '';
      }
      return [
         medication.name,
         medication.purpose,
         anchorLabel(language, dose.anchor),
         formatClock(minutesFor(dose)),
         foodNote(medication, language),
      ]
         .filter(Boolean)
         .join(', ');
   }

   const speech =
      dueNow.length + comingUp.length === 0
         ? t(language, 'nothingDue')
         : [...dueNow, ...comingUp].map(spoken).join('. ');

   /** Purpose: render a list of dose cards. */
   function cards(doses: readonly DoseRecord[], due: boolean) {
      return (
         <ul className="cards">
            {doses.map((dose) => {
               const medication = medications.get(dose.medicationId);
               return (
                  <DoseCard
                     key={dose.id}
                     dose={dose}
                     medication={medication}
                     language={language}
                     dueMinutes={minutesFor(dose)}
                     foodNote={
                        medication ? foodNote(medication, language) : ''
                     }
                     viewerRole={member.role}
                     canConfirm={
                        mayConfirm && dose.dueAt - now <= earlyWindow
                     }
                     handlerName={names.get(dose.acknowledgedById) ?? ''}
                     isDue={due}
                     action={confirmDoseAction}
                     acknowledgeAction={acknowledgeDoseAction}
                  />
               );
            })}
         </ul>
      );
   }

   return (
      <>
         <Notice params={await searchParams} />
         <DemoBar
            profile={profile}
            members={members}
            currentMemberId={member.id}
            now={now}
         />
         <div className="page-head row spread">
            <div>
               <h1>
                  {t(language, 'greeting')}, {member.name}
               </h1>
               <p>
                  {t(language, 'todayTitle')}: {profile.elderName}
               </p>
            </div>
            {mayView ? (
               <SpeakButton
                  text={speech}
                  lang={speechTag(language)}
                  startLabel={t(language, 'readAloud')}
                  stopLabel={t(language, 'stopReading')}
               />
            ) : null}
         </div>

         {pendingProposals > 0 ? (
            <p className="notice ok">
               {pendingProposals} proposed change
               {pendingProposals === 1 ? '' : 's'} to your medicines{' '}
               {pendingProposals === 1 ? 'needs' : 'need'} your decision. <Link href="/medicines">Review now</Link>
            </p>
         ) : null}

         {!mayView ? (
            <p className="card">
               {profile.sharingPaused
                  ? `${profile.elderName} has paused sharing for now.`
                  : `${profile.elderName} has not shared medicines with you.`}
            </p>
         ) : (
            <>
               <section aria-labelledby="due-title">
                  <h2 id="due-title">{t(language, 'dueNow')}</h2>
                  {dueNow.length === 0 ? (
                     <p className="card tint-green">
                        {t(language, 'nothingDue')}
                     </p>
                  ) : (
                     cards(dueNow, true)
                  )}
               </section>
               {current.carriedOver.length > 0 ? (
                  <section aria-labelledby="carried-title">
                     <h2 id="carried-title">Not answered from yesterday</h2>
                     <p>
                        Do not take these now. Just tell us what happened,
                        so the record is right.
                     </p>
                     {cards(current.carriedOver, false)}
                  </section>
               ) : null}
               {comingUp.length > 0 ? (
                  <section aria-labelledby="next-title">
                     <h2 id="next-title">{t(language, 'comingUp')}</h2>
                     {cards(comingUp, false)}
                  </section>
               ) : null}
               {done.length > 0 ? (
                  <section aria-labelledby="done-title">
                     <h2 id="done-title">{t(language, 'done')}</h2>
                     {cards(done, false)}
                  </section>
               ) : null}
            </>
         )}
      </>
   );
}
