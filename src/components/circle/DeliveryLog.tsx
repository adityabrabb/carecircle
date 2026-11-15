/**
 * Delivery log.
 *
 * Purpose: whether each reminder email reached its person. The elder
 * sees every email; others see only the ones sent to them.
 */
import type { DeliveryStatus, NotificationRecord } from '@/domain/types';

const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
   sent: '✓ Sent',
   recorded: '○ Recorded, not sent',
   failed: '✕ Failed',
};

export function DeliveryLog({
   entries,
   viewerIsOwner,
   nameOf,
   when,
}: {
   entries: readonly NotificationRecord[];
   viewerIsOwner: boolean;
   nameOf: (memberId: string) => string;
   when: (at: number) => string;
}) {
   return (
      <section className="card" aria-labelledby="delivery-title">
         <h2 id="delivery-title">Reminder delivery</h2>
         <p>
            {viewerIsOwner
               ? 'Every reminder email the circle was sent, newest first.'
               : 'The reminder emails sent to you, newest first.'}
         </p>
         {entries.length === 0 ? (
            <p className="muted">No reminder emails yet.</p>
         ) : (
            <div className="table-wrap">
               <table>
                  <caption className="visually-hidden">
                     Reminder emails and whether each was delivered
                  </caption>
                  <thead>
                     <tr>
                        <th scope="col">Time</th>
                        <th scope="col">To</th>
                        <th scope="col">What</th>
                        <th scope="col">Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {entries.map((item) => (
                        <tr key={item.id}>
                           <td>{when(item.at)}</td>
                           <td>{nameOf(item.toMemberId)}</td>
                           <td>{item.subject}</td>
                           <td>
                              <span className="chip">
                                 {DELIVERY_LABELS[item.status]}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </section>
   );
}
