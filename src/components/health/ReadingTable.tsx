/**
 * Reading table.
 *
 * Purpose: the numbers behind a health chart, in a table that screen
 * readers can move through. Collapsed by default to keep the page short.
 */
import { formatLocal } from '@/domain/time';
import type { HealthReading, Member } from '@/domain/types';

const FORGOTTEN_MEMBER = 'Former member';
const NO_NOTE = 'None';

/** Purpose: the name of a member, or a neutral label if they were removed. */
export function nameOf(members: readonly Member[], id: string): string {
   return members.find((member) => member.id === id)?.name ?? FORGOTTEN_MEMBER;
}

export interface ReadingTableProps {
   caption: string;
   rows: readonly HealthReading[];
   members: readonly Member[];
   utcOffsetMinutes: number;
   emptyText: string;
   format: (reading: HealthReading) => string;
}

export function ReadingTable({
   caption,
   rows,
   members,
   utcOffsetMinutes,
   emptyText,
   format,
}: ReadingTableProps) {
   return (
      <details>
         <summary>Show the numbers</summary>
         {rows.length === 0 ? (
            <p>{emptyText}</p>
         ) : (
            <div className="table-wrap">
               <table>
                  <caption className="visually-hidden">{caption}</caption>
                  <thead>
                     <tr>
                        <th scope="col">Date and time</th>
                        <th scope="col">Reading</th>
                        <th scope="col">Note</th>
                        <th scope="col">Recorded by</th>
                     </tr>
                  </thead>
                  <tbody>
                     {rows.map((reading) => (
                        <tr key={reading.id}>
                           <td>{formatLocal(reading.at, utcOffsetMinutes)}</td>
                           <td>{format(reading)}</td>
                           <td>{reading.note || NO_NOTE}</td>
                           <td>{nameOf(members, reading.byId)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </details>
   );
}
