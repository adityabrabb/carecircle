/**
 * Start a circle.
 *
 * Purpose: the form an elder (or someone sitting with them) fills in to
 * create a new care circle. The elder becomes its owner.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createCircleAction } from '@/app/actions/auth';
import { Notice, type NoticeParams } from '@/components/Notice';
import {
   PASSCODE_MAX_LENGTH,
   PASSCODE_MIN_LENGTH,
} from '@/constants/care';

export const metadata: Metadata = { title: 'Start a circle' };

export default async function StartPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   return (
      <>
         <div className="page-head">
            <h1>Start a circle</h1>
            <p>
               This creates a profile owned by the elder. You will get a
               circle code to share with family and caretakers.
            </p>
         </div>
         <Notice params={await searchParams} />
         <form className="card stack" action={createCircleAction}>
            <div>
               <label htmlFor="elderName">Elder&apos;s name</label>
               <input
                  id="elderName"
                  name="elderName"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={80}
               />
            </div>
            <div>
               <label htmlFor="email">
                  Email for reminders
                  <span className="hint">
                     Dose and appointment reminders are sent here.
                  </span>
               </label>
               <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
               />
            </div>
            <div>
               <label htmlFor="language">Language for the elder</label>
               <select id="language" name="language" defaultValue="en">
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
               </select>
            </div>
            <div className="field-grid">
               <div>
                  <label htmlFor="passcode">
                     Choose a passcode
                     <span className="hint">
                        {PASSCODE_MIN_LENGTH} to {PASSCODE_MAX_LENGTH}{' '}
                        letters or numbers.
                     </span>
                  </label>
                  <input
                     id="passcode"
                     name="passcode"
                     type="password"
                     autoComplete="new-password"
                     required
                     minLength={PASSCODE_MIN_LENGTH}
                     maxLength={PASSCODE_MAX_LENGTH}
                  />
               </div>
               <div>
                  <label htmlFor="passcodeAgain">
                     Type the passcode again
                     <span className="hint">To make sure it is right.</span>
                  </label>
                  <input
                     id="passcodeAgain"
                     name="passcodeAgain"
                     type="password"
                     autoComplete="new-password"
                     required
                     minLength={PASSCODE_MIN_LENGTH}
                     maxLength={PASSCODE_MAX_LENGTH}
                  />
               </div>
            </div>
            <button className="btn" type="submit">
               Create my circle
            </button>
         </form>
         <p>
            Already have a circle code? <Link href="/login">Sign in</Link>
         </p>
      </>
   );
}
