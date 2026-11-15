/**
 * Pill badge.
 *
 * Purpose: the round picture that identifies a medicine: its photo when
 * one was added, otherwise a disc in the pill's colour. It is always
 * shown beside the medicine's name, never instead of it.
 */
import type { Medication } from '@/domain/types';

export function PillBadge({
   medication,
}: {
   medication: Pick<Medication, 'photo' | 'colour'> | undefined;
}) {
   if (medication?.photo) {
      return (
         <span className="pill-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={medication.photo} alt="" />
         </span>
      );
   }
   return (
      <span
         className="pill-badge"
         style={{ background: medication?.colour ?? '#ffffff' }}
         aria-hidden="true"
      />
   );
}
