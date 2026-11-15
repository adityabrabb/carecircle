/**
 * Audit table.
 *
 * Purpose: "Who did what": the latest actions on the profile, so the
 * elder can see every change anyone in the circle made.
 */
import { formatLocal } from '@/domain/time';
import type { AuditEntry } from '@/domain/types';

export function AuditTable({
   entries,
   utcOffsetMinutes,
   now,
}: {
   entries: readonly AuditEntry[];
   utcOffsetMinutes: number;
   now: number;
}) {
   return (
      <section className="card" aria-labelledby="audit-title">
         <h2 id="audit-title">Who did what</h2>
         <div className="table-wrap">
            <table>
               <caption className="visually-hidden">
                  Recent activity on this profile
               </caption>
               <thead>
                  <tr>
                     <th scope="col">When</th>
                     <th scope="col">Who</th>
                     <th scope="col">What</th>
                  </tr>
               </thead>
               <tbody>
                  {entries.map((entry) => (
                     <tr key={entry.id}>
                        <td>{formatLocal(entry.at, utcOffsetMinutes)}</td>
                        <td>{entry.actorName}</td>
                        <td>
                           {entry.action}
                           {entry.detail ? `: ${entry.detail}` : ''}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <p className="small muted">
            App time now: {formatLocal(now, utcOffsetMinutes)}
         </p>
      </section>
   );
}
