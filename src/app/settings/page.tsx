/**
 * Settings.
 *
 * Purpose: where the elder controls their own care: who is in the
 * circle, what each person sees, pausing sharing, the daily routine and
 * the emergency plan. Other members see what they have been allowed,
 * but cannot change anything here.
 */
import type { Metadata } from 'next';
import { toggleSharingAction } from '@/app/actions/settings';
import { Notice, type NoticeParams } from '@/components/Notice';
import { AddMemberForm } from '@/components/settings/AddMemberForm';
import { AuditTable } from '@/components/settings/AuditTable';
import { EmergencyPlanForm } from '@/components/settings/EmergencyPlanForm';
import { MemberCard } from '@/components/settings/MemberCard';
import { RoutineForm } from '@/components/settings/RoutineForm';
import { isOwner } from '@/domain/permissions';
import type { CareProfile } from '@/domain/types';
import { emergencyCardPath } from '@/services/links';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Settings' };

const AUDIT_ROWS = 25;

/** Purpose: the elder's switch to pause or resume all sharing. */
function SharingSwitch({ profile }: { profile: CareProfile }) {
   const paused = profile.sharingPaused;
   return (
      <section className="card" aria-labelledby="pause-title">
         <h2 id="pause-title">Sharing</h2>
         <p>
            {paused
               ? 'Sharing is paused. Nobody else can see your profile or ' +
                 'get alerts about it.'
               : 'Sharing is on. Each person sees only what you allow below.'}
         </p>
         <form action={toggleSharingAction}>
            <input type="hidden" name="paused" value={paused ? 'false' : 'true'} />
            <button className={`btn ${paused ? '' : 'warn'}`} type="submit">
               {paused ? 'Resume sharing' : 'Pause all sharing'}
            </button>
         </form>
      </section>
   );
}

export default async function SettingsPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const store = getStore();
   const owner = isOwner(member, profile);
   const members = (await store.list('members', profile.id)).sort(
      (first, second) => first.escalationOrder - second.escalationOrder,
   );
   const audit = owner
      ? (await store.list('audit', profile.id))
           .sort((first, second) => second.at - first.at)
           .slice(0, AUDIT_ROWS)
      : [];
   const helpers = members.filter((person) => person.role !== 'elder');

   return (
      <>
         <div className="page-head">
            <h1>Settings</h1>
            <p>
               {owner
                  ? 'This is your profile. You decide who sees it and ' +
                    'what they can do.'
                  : `This profile belongs to ${profile.elderName}. Only ` +
                    'they can change these settings.'}
            </p>
         </div>
         <Notice params={await searchParams} />

         <section className="card tint-marigold" aria-labelledby="code-title">
            <h2 id="code-title">Circle code</h2>
            <p>
               Share this code, and a passcode you set below, with each
               person you want in your circle.
            </p>
            <p>
               <span className="code">{profile.circleCode}</span>
            </p>
         </section>

         {owner ? <SharingSwitch profile={profile} /> : null}

         <section aria-labelledby="people-title">
            <h2 id="people-title">People in the circle</h2>
            <div className="grid">
               {members.map((person) => (
                  <MemberCard
                     key={person.id}
                     person={person}
                     viewerIsOwner={owner}
                  />
               ))}
            </div>
         </section>

         {owner ? (
            <>
               <AddMemberForm />
               <RoutineForm profile={profile} />
               <EmergencyPlanForm
                  profile={profile}
                  helpers={helpers}
                  cardPath={emergencyCardPath(profile)}
               />
               <AuditTable
                  entries={audit}
                  utcOffsetMinutes={profile.utcOffsetMinutes}
                  now={now}
               />
            </>
         ) : null}
      </>
   );
}
