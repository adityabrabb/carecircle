/**
 * Read a prescription.
 *
 * Purpose: the page where a prescription photo or PDF is read and its
 * medicines are checked one by one before they are saved. When reading
 * is not set up, the page explains that and links to the typed form.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ScanPanel } from '@/components/ScanPanel';
import { can, isOwner, routeChange } from '@/domain/permissions';
import { geminiAvailable } from '@/services/gemini';
import { requireContext } from '@/services/session';

export const metadata: Metadata = { title: 'Read a prescription' };

export default async function ScanPage() {
   const { profile, member } = await requireContext();
   if (
      !can(member, 'viewMedications', profile) ||
      routeChange(member, profile, false) === 'deny'
   ) {
      return (
         <>
            <div className="page-head">
               <h1>Read a prescription</h1>
            </div>
            <p className="card">
               You are not allowed to add medicines from a prescription.
            </p>
         </>
      );
   }
   const isHelper = !isOwner(member, profile);
   const mayBeUrgent = routeChange(member, profile, true) === 'emergency';
   const available = geminiAvailable();

   return (
      <>
         <div className="page-head">
            <h1>Read a prescription</h1>
            <p>
               Upload a photo or PDF. Each medicine is shown for you to check.
               Nothing is saved until you press the button on that medicine.
            </p>
         </div>
         <p className="no-print">
            <Link className="btn quiet" href="/medicines">
               Back to medicines
            </Link>
         </p>
         {available ? (
            <ScanPanel
               isHelper={isHelper}
               mayBeUrgent={mayBeUrgent}
               available={available}
            />
         ) : (
            <section
               className="card tint-marigold"
               aria-labelledby="not-set-up-title"
            >
               <h2 id="not-set-up-title">Reading prescriptions is not set up</h2>
               <p>You can still type the medicine in yourself.</p>
               <p>
                  <Link className="btn" href="/medicines">
                     Type the medicine in
                  </Link>
               </p>
            </section>
         )}
      </>
   );
}
