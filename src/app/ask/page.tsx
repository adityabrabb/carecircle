/**
 * Ask.
 *
 * Purpose: a question box that answers only from what is recorded, with
 * a link to where each fact lives. When the rules do not understand a
 * question and the records allow it, an AI answer built only from numbered
 * facts is shown below, with those facts for checking.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { PATTERN_WINDOW_DAYS } from '@/constants/care';
import {
   answerQuestion,
   type CareFacts,
   factLines,
   SUGGESTED_QUESTIONS,
} from '@/domain/assistant';
import { can, isOwner } from '@/domain/permissions';
import { formatLocal, localDateKey, shiftDateKey } from '@/domain/time';
import { answerFromFacts } from '@/services/assistantAi';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Ask' };

const MAX_QUESTION_CHARS = 300;

export default async function AskPage({
   searchParams,
}: {
   searchParams: Promise<{ q?: string | string[] }>;
}) {
   const { profile, member, now } = await requireContext();
   const params = await searchParams;
   const raw = Array.isArray(params.q) ? params.q[0] : params.q;
   const question = (raw ?? '').trim().slice(0, MAX_QUESTION_CHARS);

   if (profile.sharingPaused && !isOwner(member, profile)) {
      return (
         <>
            <div className="page-head">
               <h1>Ask</h1>
            </div>
            <p className="card">
               Sharing is paused for {profile.elderName}&rsquo;s circle, so
               nothing can be asked here right now.
            </p>
         </>
      );
   }

   const store = getStore();
   const today = localDateKey(now, profile.utcOffsetMinutes);
   const week = Array.from({ length: PATTERN_WINDOW_DAYS }, (_, index) =>
      shiftDateKey(today, -index),
   );
   const canMedicines = can(member, 'viewMedications', profile);
   const canHealth = can(member, 'viewHealth', profile);
   const canVisits = can(member, 'viewAppointments', profile);
   const canDocuments = can(member, 'viewDocuments', profile);
   const [medications, doses, readings, appointments, questions, tasks] =
      await Promise.all([
         canMedicines ? store.list('medications', profile.id) : [],
         canMedicines
            ? store.listIn('doses', profile.id, 'dateKey', week)
            : [],
         canHealth ? store.list('readings', profile.id) : [],
         canVisits ? store.list('appointments', profile.id) : [],
         canVisits ? store.list('questions', profile.id) : [],
         store.list('tasks', profile.id),
      ]);
   const documents = canDocuments
      ? (await store.list('documents', profile.id)).map((document) => ({
           id: document.id,
           title: document.title,
           kind: document.kind,
           at: document.at,
        }))
      : [];
   const members = await store.list('members', profile.id);

   const facts: CareFacts = {
      now,
      elderName: profile.elderName,
      whenText: (at) => formatLocal(at, profile.utcOffsetMinutes),
      medications,
      doses,
      readings,
      appointments,
      tasks,
      questions,
      documents,
      memberNames: new Map(members.map((person) => [person.id, person.name])),
   };
   const answer = question ? answerQuestion(question, facts) : null;
   const numbered = factLines(facts);
   const aiText =
      question && answer && !answer.understood
         ? await answerFromFacts(question, numbered)
         : null;

   return (
      <>
         <div className="page-head">
            <h1>Ask</h1>
            <p>Ask a question about what is recorded for {profile.elderName}.</p>
         </div>

         <section className="card" aria-labelledby="ask-title">
            <h2 id="ask-title">Ask a question</h2>
            <form method="get" action="/ask" className="stack">
               <div>
                  <label htmlFor="q">Your question</label>
                  <input
                     id="q"
                     name="q"
                     type="text"
                     maxLength={MAX_QUESTION_CHARS}
                     defaultValue={question}
                     required
                  />
               </div>
               <button className="btn" type="submit">
                  Find the answer
               </button>
            </form>
            <h3>Questions people often ask</h3>
            <ul className="list">
               {SUGGESTED_QUESTIONS.map((suggested) => (
                  <li key={suggested}>
                     <Link href={`/ask?q=${encodeURIComponent(suggested)}`}>
                        {suggested}
                     </Link>
                  </li>
               ))}
            </ul>
         </section>

         {answer ? (
            <section className="card" aria-labelledby="answer-title">
               <h2 id="answer-title">Answer</h2>
               <p>
                  You asked: <em>{question}</em>
               </p>
               <ul className="list">
                  {answer.lines.map((line, index) => (
                     <li key={index}>{line}</li>
                  ))}
               </ul>
               {answer.sources.length > 0 ? (
                  <>
                     <h3>Where this comes from</h3>
                     <ul className="list">
                        {answer.sources.map((source) => (
                           <li key={source.href}>
                              <Link href={source.href}>{source.label}</Link>
                           </li>
                        ))}
                     </ul>
                  </>
               ) : null}
            </section>
         ) : null}

         {aiText ? (
            <section
               className="card tint-indigo"
               aria-labelledby="ai-title"
            >
               <h2 id="ai-title">Answer written by AI from the records</h2>
               <p>{aiText}</p>
               <p className="small">Check the records before acting on this.</p>
               <details>
                  <summary>The numbered facts it was given</summary>
                  <ul className="list">
                     {numbered.map((line) => (
                        <li key={line}>{line}</li>
                     ))}
                  </ul>
               </details>
            </section>
         ) : null}

         <p className="small muted">
            Answers come only from what is recorded in CareCircle. This is not
            medical advice.
         </p>
      </>
   );
}
