/**
 * "What my family sees" preview.
 *
 * Purpose: show the elder exactly what one member can and cannot see
 * and do right now, so consent is something they can check, not just
 * tick. Only the elder can open this page.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ALL_PERMISSIONS } from '@/constants/care';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/constants/labels';
import { can, isOwner, routeChange } from '@/domain/permissions';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'What they see' };

const CHANGE_TEXT = {
   apply: 'Their changes to medicines take effect at once.',
   propose:
      'They can propose medicine changes. Nothing changes until you ' +
      'approve.',
   emergency:
      'In an emergency they may change medicines under your emergency ' +
      'plan. You are told every time.',
   deny: 'They cannot change or propose changes to medicines.',
} as const;

export default async function PreviewPage({
   params,
}: {
   params: Promise<{ memberId: string }>;
}) {
   const { profile, member } = await requireContext();
   if (!isOwner(member, profile)) {
      redirect('/settings');
   }
   const { memberId } = await params;
   const person = await getStore().get('members', profile.id, memberId);
   if (!person) {
      notFound();
   }
   const normal = routeChange(person, profile, false);
   const urgent = routeChange(person, profile, true);

   return (
      <>
         <div className="page-head">
            <h1>What {person.name} sees</h1>
            <p>
               {ROLE_LABELS[person.role]}.{' '}
               {person.active
                  ? 'They can sign in.'
                  : 'They cannot sign in at all.'}{' '}
               {profile.sharingPaused
                  ? 'Sharing is paused, so they see nothing right now.'
                  : ''}
            </p>
         </div>
         <section className="card" aria-labelledby="see-title">
            <h2 id="see-title">Right now</h2>
            <ul className="list">
               {ALL_PERMISSIONS.map((permission) => {
                  const allowed = can(person, permission, profile);
                  return (
                     <li key={permission} className="row spread">
                        <span>{PERMISSION_LABELS[permission]}</span>
                        <span
                           className={`chip ${allowed ? 'taken' : 'skipped'}`}
                        >
                           <span aria-hidden="true">{allowed ? '✓' : '✕'}</span>
                           {allowed ? 'Yes' : 'No'}
                        </span>
                     </li>
                  );
               })}
            </ul>
         </section>
         <section className="card" aria-labelledby="change-title">
            <h2 id="change-title">Changing your medicines</h2>
            <p>{CHANGE_TEXT[normal]}</p>
            {urgent === 'emergency' ? <p>{CHANGE_TEXT.emergency}</p> : null}
         </section>
         <p>
            <Link className="btn quiet" href="/settings">
               Back to settings
            </Link>
         </p>
      </>
   );
}
