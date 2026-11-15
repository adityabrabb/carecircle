/**
 * Landing page.
 *
 * Purpose: explain CareCircle in a few lines and offer the three ways
 * in: start a circle, sign in, or try the sample family.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { enterDemo } from '@/app/actions/demo';
import { Rings } from '@/components/Logo';
import { Notice, type NoticeParams } from '@/components/Notice';
import { getContext } from '@/services/session';

const PILLARS = [
   {
      title: 'The elder decides',
      text:
         'Family and caretakers propose changes. The elder approves ' +
         'them, chooses who sees what, and can pause sharing.',
   },
   {
      title: 'No dose falls through',
      text:
         'Every dose is taken, skipped by choice, or not sure. If nobody ' +
         'answers, the caretaker hears, then the family.',
   },
   {
      title: 'One shared picture',
      text:
         'Medicines, appointments, readings, records and tasks sit on ' +
         'one timeline the whole circle can trust.',
   },
   {
      title: 'Built for older eyes',
      text:
         'Big buttons, read-aloud in Hindi or English, a printable ' +
         'chart for the fridge, and one tap from the reminder email.',
   },
];

export default async function LandingPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   if (await getContext()) {
      redirect('/home');
   }
   return (
      <>
         <Notice params={await searchParams} />
         <section className="hero" aria-labelledby="hero-title">
            <Rings />
            <h1 id="hero-title">Care that keeps the elder in charge.</h1>
            <p>
               CareCircle helps an older person manage medicines,
               appointments and health with their family and caretaker,
               without handing over control.
            </p>
            <div className="row">
               <Link className="btn" href="/start">
                  Start a circle
               </Link>
               <Link className="btn quiet" href="/login">
                  Sign in
               </Link>
               <form action={enterDemo}>
                  <button className="btn quiet" type="submit">
                     Try the sample family
                  </button>
               </form>
            </div>
         </section>
         <section className="grid" aria-label="What CareCircle does">
            {PILLARS.map((pillar) => (
               <article className="card" key={pillar.title}>
                  <h2>{pillar.title}</h2>
                  <p>{pillar.text}</p>
               </article>
            ))}
         </section>
      </>
   );
}
