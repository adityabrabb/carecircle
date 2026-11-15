/**
 * Dose card.
 *
 * Purpose: show one dose with the medicine's photo or colour, its name,
 * what it is for, when and how to take it, and the buttons this person
 * is allowed to use. The elder gets "I took it", "Not sure" and a
 * choice to skip; a helper says whether they saw the dose taken.
 */
import type { ReactNode } from 'react';
import { PillBadge } from '@/components/PillBadge';
import { UNSURE_ADVICE } from '@/domain/doses';
import { formatClock } from '@/domain/time';
import type {
   DoseRecord,
   Language,
   Medication,
   Role,
} from '@/domain/types';
import { anchorLabel, t, type StringKey } from '@/i18n/strings';

const STATUS_KEYS: Record<DoseRecord['status'], StringKey> = {
   taken: 'taken',
   skipped: 'skipped',
   unsure: 'unsureStatus',
   unconfirmed: 'unconfirmed',
};

/** A shape for each status, so colour is never the only signal. */
const STATUS_MARKS: Record<DoseRecord['status'], string> = {
   taken: '✓',
   skipped: '–',
   unsure: '?',
   unconfirmed: '○',
};

const EVIDENCE_TEXT: Record<string, string> = {
   self: 'confirmed by the elder',
   observed: 'seen by a helper',
   assumed: 'assumed by a helper',
};

export interface DoseCardProps {
   dose: DoseRecord;
   medication: Medication | undefined;
   language: Language;
   /** Local minutes after midnight when the dose is due. */
   dueMinutes: number;
   foodNote: string;
   viewerRole: Role;
   canConfirm: boolean;
   /** Name of the member handling the dose, when acknowledged. */
   handlerName: string;
   /** True when the dose is due now or overdue. */
   isDue: boolean;
   /** Server action that records the answer. */
   action: (form: FormData) => Promise<void>;
   /** Server action for "I am handling this"; omitted on email links. */
   acknowledgeAction?: (form: FormData) => Promise<void>;
   /** Extra hidden inputs, such as the email link token. */
   hidden?: ReactNode;
}

export function DoseCard(props: DoseCardProps) {
   const { dose, medication, language, viewerRole } = props;
   const open = dose.status === 'unconfirmed' || dose.status === 'unsure';
   const name = medication?.name ?? 'Medicine';
   const headingId = `dose-${dose.id}`;

   return (
      <li
         className={`card ${props.isDue && open ? 'tint-marigold' : ''}`}
         aria-labelledby={headingId}
      >
         <div className="dose">
            <PillBadge medication={medication} />
            <div>
               <h3 id={headingId}>
                  {name} <span className="muted">{medication?.strength}</span>
               </h3>
               {medication?.purpose ? (
                  <p>
                     {t(language, 'forWhat')}: {medication.purpose}
                  </p>
               ) : null}
               <p className="row">
                  <span className="chip info">
                     {anchorLabel(language, dose.anchor)}{' '}
                     {formatClock(props.dueMinutes)}
                  </span>
                  {props.foodNote ? (
                     <span className="chip">{props.foodNote}</span>
                  ) : null}
                  <span className={`chip ${dose.status}`}>
                     <span aria-hidden="true">
                        {STATUS_MARKS[dose.status]}
                     </span>
                     {t(language, STATUS_KEYS[dose.status])}
                  </span>
               </p>
               {dose.status === 'taken' && dose.confirmMethod ? (
                  <p className="small muted">
                     Evidence: {EVIDENCE_TEXT[dose.confirmMethod]}
                  </p>
               ) : null}
               {dose.status === 'skipped' && dose.reason ? (
                  <p className="small muted">Reason: {dose.reason}</p>
               ) : null}
               {dose.status === 'unsure' ? (
                  <p role="note">
                     <strong>{UNSURE_ADVICE}</strong>
                  </p>
               ) : null}
               {props.handlerName && open ? (
                  <p className="small">
                     {props.handlerName} is handling this.
                  </p>
               ) : null}
            </div>
         </div>

         {open && props.canConfirm && viewerRole === 'elder' ? (
            <>
               <div className="dose-actions">
                  <form action={props.action}>
                     {props.hidden}
                     <input type="hidden" name="doseId" value={dose.id} />
                     <input type="hidden" name="status" value="taken" />
                     <button className="btn huge" type="submit">
                        ✓ {t(language, 'took')}
                     </button>
                  </form>
                  {dose.status === 'unconfirmed' ? (
                     <form action={props.action}>
                        {props.hidden}
                        <input type="hidden" name="doseId" value={dose.id} />
                        <input type="hidden" name="status" value="unsure" />
                        <button className="btn warn huge" type="submit">
                           ? {t(language, 'unsure')}
                        </button>
                     </form>
                  ) : null}
               </div>
               <details style={{ marginTop: 12 }}>
                  <summary>{t(language, 'skip')}</summary>
                  <form className="stack" action={props.action}>
                     {props.hidden}
                     <input type="hidden" name="doseId" value={dose.id} />
                     <input type="hidden" name="status" value="skipped" />
                     <label htmlFor={`reason-${dose.id}`}>
                        {t(language, 'skipReason')}
                     </label>
                     <input
                        id={`reason-${dose.id}`}
                        name="reason"
                        type="text"
                        maxLength={200}
                     />
                     <button className="btn quiet" type="submit">
                        {t(language, 'skip')}
                     </button>
                  </form>
               </details>
            </>
         ) : null}

         {open && props.canConfirm && viewerRole !== 'elder' ? (
            <div className="dose-actions">
               <form action={props.action}>
                  <input type="hidden" name="doseId" value={dose.id} />
                  <input type="hidden" name="status" value="taken" />
                  <input type="hidden" name="method" value="observed" />
                  <button className="btn" type="submit">
                     ✓ {t(language, 'gaveIt')}
                  </button>
               </form>
               <form action={props.action}>
                  <input type="hidden" name="doseId" value={dose.id} />
                  <input type="hidden" name="status" value="taken" />
                  <input type="hidden" name="method" value="assumed" />
                  <button className="btn quiet" type="submit">
                     {t(language, 'assumeIt')}
                  </button>
               </form>
            </div>
         ) : null}

         {open &&
         props.isDue &&
         viewerRole !== 'elder' &&
         !props.handlerName &&
         props.acknowledgeAction ? (
            <form action={props.acknowledgeAction} style={{ marginTop: 10 }}>
               <input type="hidden" name="doseId" value={dose.id} />
               <button className="btn warn" type="submit">
                  {t(language, 'handling')}
               </button>
            </form>
         ) : null}
      </li>
   );
}
