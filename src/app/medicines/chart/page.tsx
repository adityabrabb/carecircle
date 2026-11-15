/**
 * Weekly chart.
 *
 * Purpose: a large-print chart of the week's medicines with a box to
 * tick for each dose, made to be printed and put on the fridge. It is
 * for elders who do not use a phone at all, and it is built from the
 * same schedule as the reminders so the two never disagree.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintButton } from '@/components/PrintButton';
import { ROUTINE_ANCHORS } from '@/constants/care';
import { can } from '@/domain/permissions';
import { dueMinutes, isScheduledOn } from '@/domain/schedule';
import { formatClock, localDateKey, shiftDateKey } from '@/domain/time';
import { anchorLabel } from '@/i18n/strings';
import { foodNote } from '@/services/care';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Weekly chart' };

const DAYS_ON_CHART = 7;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Purpose: short heading for a day, such as "Mon 16". */
function dayHeading(dateKey: string): string {
   const date = new Date(`${dateKey}T00:00:00Z`);
   return `${WEEKDAYS[date.getUTCDay()] ?? ''} ${date.getUTCDate()}`;
}

export default async function ChartPage() {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'viewMedications', profile)) {
      return <p className="card">Medicines are not shared with you.</p>;
   }
   const language = profile.language;
   const medications = (await getStore().list('medications', profile.id))
      .filter((medication) => medication.status === 'active')
      .sort((first, second) => first.name.localeCompare(second.name));
   const today = localDateKey(now, profile.utcOffsetMinutes);
   const days = Array.from({ length: DAYS_ON_CHART }, (_, index) =>
      shiftDateKey(today, index),
   );

   // ----- One row for each time of day that has at least one medicine.
   const rows = ROUTINE_ANCHORS.flatMap((anchor) =>
      medications
         .filter((medication) => medication.anchors.includes(anchor))
         .map((medication) => ({ anchor, medication })),
   );

   return (
      <>
         <div className="page-head">
            <h1>
               {profile.elderName}: medicines for the week
            </h1>
            <p className="no-print">
               Print this and keep it where the medicines are. Tick each
               box when the dose is taken.
            </p>
         </div>
         <p className="row no-print">
            <PrintButton label="Print this chart" />
            <Link className="btn quiet" href="/medicines">
               Back to medicines
            </Link>
         </p>
         <div className="card table-wrap">
            <table>
               <caption className="visually-hidden">
                  Weekly medicine chart with a tick box for every dose
               </caption>
               <thead>
                  <tr>
                     <th scope="col">When</th>
                     <th scope="col">Medicine</th>
                     {days.map((day) => (
                        <th scope="col" key={day}>
                           {dayHeading(day)}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody>
                  {rows.map(({ anchor, medication }) => (
                     <tr key={`${anchor}-${medication.id}`}>
                        <th scope="row">
                           {anchorLabel(language, anchor)}
                           <br />
                           <span className="small">
                              {formatClock(
                                 Math.max(
                                    0,
                                    dueMinutes(
                                       profile.routine,
                                       anchor,
                                       medication.food,
                                    ),
                                 ),
                              )}
                           </span>
                        </th>
                        <td>
                           <strong>{medication.name}</strong>{' '}
                           {medication.strength}
                           <br />
                           <span className="small">
                              {medication.unitsPerDose} ×{' '}
                              {foodNote(medication, language) ||
                                 medication.purpose}
                           </span>
                        </td>
                        {days.map((day) => (
                           <td key={day}>
                              {isScheduledOn(medication, day) ? (
                                 <span
                                    className="tick-box"
                                    role="img"
                                    aria-label="Empty tick box"
                                 />
                              ) : (
                                 <span className="muted">–</span>
                              )}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <p className="small">
            If you are not sure whether you took a dose, do not take
            another one. Tell your caretaker or family.
         </p>
      </>
   );
}
