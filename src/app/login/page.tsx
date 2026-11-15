/**
 * Sign in.
 *
 * Purpose: let the elder, a caretaker or a family member reach the
 * shared profile with the circle code and their own passcode.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { signInAction } from '@/app/actions/auth';
import { enterDemo } from '@/app/actions/demo';
import { Notice, type NoticeParams } from '@/components/Notice';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   return (
      <>
         <div className="page-head">
            <h1>Sign in</h1>
            <p>
               Enter the circle code you were given and your own passcode.
            </p>
         </div>
         <Notice params={await searchParams} />
         <section
            className="card tint-marigold"
            aria-labelledby="judge-title"
         >
            <h2 id="judge-title">Judging or just looking?</h2>
            <p>
               Skip sign-in and open a sample family with an elder, a
               caretaker and two children. Nothing in it is real.
            </p>
            <form action={enterDemo}>
               <button className="btn huge" type="submit">
                  Open the sample family, no sign-in
               </button>
            </form>
         </section>
         <h2>Sign in to your circle</h2>
         <form className="card stack" action={signInAction}>
            <div>
               <label htmlFor="circleCode">Circle code</label>
               <input
                  id="circleCode"
                  name="circleCode"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                  maxLength={16}
               />
            </div>
            <div>
               <label htmlFor="passcode">Your passcode</label>
               <input
                  id="passcode"
                  name="passcode"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={12}
               />
            </div>
            <button className="btn" type="submit">
               Sign in
            </button>
         </form>
         <p>
            New here? <Link href="/start">Start a circle</Link>
         </p>
      </>
   );
}
