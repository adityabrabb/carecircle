/**
 * Emergency card.
 *
 * Purpose: a page anyone holding the link can open in an emergency,
 * showing only what the elder chose to put on the card plus their
 * current medicines. It works only while the elder keeps link sharing
 * switched on, and the link cannot be guessed or forged.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { anchorLabel } from '@/i18n/strings';
import { readEmergencyToken } from '@/services/links';
import { getStore } from '@/store';

export const metadata: Metadata = {
   title: 'Emergency card',
   robots: { index: false, follow: false },
};

export default async function EmergencyCardPage({
   params,
}: {
   params: Promise<{ token: string }>;
}) {
   const { token } = await params;
   const claims = readEmergencyToken(token);
   if (!claims) {
      notFound();
   }
   const store = getStore();
   const profile = await store.getProfile(claims.profileId);
   if (!profile || !profile.emergencyCard.shareByLink) {
      notFound();
   }
   const medications = (await store.list('medications', profile.id)).filter(
      (medication) => medication.status === 'active',
   );
   const card = profile.emergencyCard;
   const rows: readonly (readonly [string, string])[] = [
      ['Blood group', card.bloodGroup],
      ['Allergies', card.allergies],
      ['Conditions', card.conditions],
      ['Doctor', card.doctorName],
      ['Doctor phone', card.doctorPhone],
      ['Emergency contact', card.emergencyContact],
   ];

   return (
      <>
         <div className="page-head">
            <h1>Emergency card: {profile.elderName}</h1>
         </div>
         <section className="card tint-terracotta" aria-label="Key facts">
            <table>
               <tbody>
                  {rows
                     .filter(([, value]) => value !== '')
                     .map(([label, value]) => (
                        <tr key={label}>
                           <th scope="row">{label}</th>
                           <td>{value}</td>
                        </tr>
                     ))}
               </tbody>
            </table>
         </section>
         <section className="card" aria-labelledby="meds-title">
            <h2 id="meds-title">Current medicines</h2>
            {medications.length === 0 ? (
               <p>No medicines recorded.</p>
            ) : (
               <ul>
                  {medications.map((medication) => (
                     <li key={medication.id}>
                        <strong>{medication.name}</strong>{' '}
                        {medication.strength} (
                        {medication.anchors
                           .map((anchor) => anchorLabel('en', anchor))
                           .join(', ')}
                        )
                     </li>
                  ))}
               </ul>
            )}
         </section>
         {profile.emergencyPlan.instructions ? (
            <section className="card" aria-labelledby="wish-title">
               <h2 id="wish-title">
                  {profile.elderName}&apos;s instructions
               </h2>
               <p>{profile.emergencyPlan.instructions}</p>
            </section>
         ) : null}
         <p className="no-print">
            <span className="muted">
               Print this page and keep it with the medicines.
            </span>
         </p>
      </>
   );
}
