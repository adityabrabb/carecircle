/**
 * Health.
 *
 * Purpose: the circle's health record for the elder. A one-tap daily
 * check-in, charts of blood pressure, blood sugar and weight over the
 * last 30 days (each with its numbers in a table), rule-based points
 * worth raising with the doctor, forms to record readings, and the
 * latest symptoms and notes.
 */
import type { Metadata } from 'next';
import { addReadingAction, deleteReadingAction } from '@/app/actions/health';
import { ReadingForms } from '@/components/health/ReadingForms';
import { nameOf, ReadingTable } from '@/components/health/ReadingTable';
import { LineChart } from '@/components/LineChart';
import { Notice, type NoticeParams } from '@/components/Notice';
import {
   BP_DIASTOLIC_HIGH,
   BP_SYSTOLIC_HIGH,
   GLUCOSE_HIGH,
   GLUCOSE_LOW,
   MOOD_MAX,
   MOOD_MIN,
   MS_PER_DAY,
   PATTERN_WINDOW_DAYS,
} from '@/constants/care';
import { MOOD_LABELS, READING_LABELS } from '@/constants/labels';
import { can, isOwner } from '@/domain/permissions';
import { detectPatterns } from '@/domain/patterns';
import {
   type ChartPoint,
   chartSeries,
} from '@/domain/readingForm';
import { formatLocal, localDateKey, shiftDateKey } from '@/domain/time';
import type {
   CareProfile,
   DoseRecord,
   HealthReading,
   Member,
   ReadingKind,
} from '@/domain/types';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Health' };

const CHART_DAYS = 30;
const RECENT_NOTES = 10;
const EMPTY_CHART = `No readings in the last ${CHART_DAYS} days.`;
const NOTE_KINDS: readonly ReadingKind[] = ['symptom', 'checkIn'];
const MOOD_VALUES = Array.from(
   { length: MOOD_MAX - MOOD_MIN + 1 },
   (_, index) => MOOD_MIN + index,
);

/** Purpose: the label for a mood number, or empty when out of range. */
function moodLabel(mood: number): string {
   return MOOD_LABELS[mood] ?? '';
}

/** Purpose: true when the signed-in member may delete this reading. */
function mayDelete(
   reading: HealthReading,
   member: Member,
   profile: CareProfile,
): boolean {
   return isOwner(member, profile) || reading.byId === member.id;
}

/** Purpose: readings of one kind in the chart window, oldest first. */
function windowReadings(
   readings: readonly HealthReading[],
   kind: ReadingKind,
   now: number,
): HealthReading[] {
   const from = now - CHART_DAYS*MS_PER_DAY;
   return readings
      .filter(
         (reading) =>
            reading.kind === kind && reading.at >= from && reading.at <= now,
      )
      .sort((first, second) => first.at - second.at);
}

/** Purpose: chart points from one field of the series. */
function pick(
   points: readonly ChartPoint[],
   field: 'value' | 'value2',
): { at: number; value: number }[] {
   return points.map((point) => ({ at: point.at, value: point[field] }));
}

/** Purpose: the text of a symptom or check-in entry. */
function describeNote(reading: HealthReading): string {
   if (reading.kind === 'checkIn') {
      const extra = reading.note ? ` ${reading.note}` : '';
      return `Mood: ${moodLabel(reading.value)}.${extra}`;
   }
   return reading.note;
}

export default async function HealthPage({
   searchParams,
}: {
   searchParams: Promise<NoticeParams>;
}) {
   const { profile, member, now } = await requireContext();
   const notice = <Notice params={await searchParams} />;
   if (!can(member, 'viewHealth', profile)) {
      return (
         <>
            {notice}
            <div className="page-head">
               <h1>Health</h1>
            </div>
            <p className="card">
               {profile.elderName} has not shared health readings with you.
            </p>
         </>
      );
   }
   const store = getStore();
   const offset = profile.utcOffsetMinutes;
   const today = localDateKey(now, offset);
   const lastWeek = Array.from({ length: PATTERN_WINDOW_DAYS }, (_, index) =>
      shiftDateKey(today, -index),
   );
   const seeMedicines = can(member, 'viewMedications', profile);
   const [readings, members, doses] = await Promise.all([
      store.list('readings', profile.id),
      store.list('members', profile.id),
      seeMedicines
         ? store.listIn('doses', profile.id, 'dateKey', lastWeek)
         : Promise.resolve<DoseRecord[]>([]),
   ]);

   const observations = detectPatterns(doses, readings, now);
   const bpSeries = chartSeries(readings, 'bloodPressure', now, CHART_DAYS);
   const glucoseSeries = chartSeries(readings, 'glucose', now, CHART_DAYS);
   const weightSeries = chartSeries(readings, 'weight', now, CHART_DAYS);
   const bpRows = windowReadings(readings, 'bloodPressure', now);
   const glucoseRows = windowReadings(readings, 'glucose', now);
   const weightRows = windowReadings(readings, 'weight', now);
   const noteRows = readings
      .filter((reading) => NOTE_KINDS.includes(reading.kind))
      .sort((first, second) => second.at - first.at)
      .slice(0, RECENT_NOTES);

   return (
      <>
         <div className="page-head">
            <h1>Health</h1>
            <p>
               Check in once a day, record readings as they are taken, and
               share the charts with the doctor.
            </p>
         </div>
         {notice}

         <section aria-labelledby="mood-title">
            <h2 id="mood-title">How do you feel today?</h2>
            <form className="row" action={addReadingAction}>
               <input type="hidden" name="kind" value="checkIn" />
               {MOOD_VALUES.map((mood) => (
                  <button
                     key={mood}
                     className="btn huge"
                     type="submit"
                     name="value"
                     value={mood}
                  >
                     {mood}. {moodLabel(mood)}
                  </button>
               ))}
            </form>
         </section>

         <section
            className="card tint-marigold"
            aria-labelledby="pattern-title"
         >
            <h2 id="pattern-title">Worth raising</h2>
            {observations.length === 0 ? (
               <p>Nothing stands out this week.</p>
            ) : (
               <ul className="list">
                  {observations.map((item) => (
                     <li key={item.title}>
                        <p>
                           <strong>{item.title}</strong>
                        </p>
                        <p>{item.advice}</p>
                     </li>
                  ))}
               </ul>
            )}
            <p className="small">
               These are facts from the record, not a diagnosis.
            </p>
         </section>

         <section aria-labelledby="charts-title">
            <h2 id="charts-title">Over the last {CHART_DAYS} days</h2>
            <div className="grid">
               <article className="card" aria-labelledby="chart-bp-title">
                  <h3 id="chart-bp-title">Blood pressure</h3>
                  <LineChart
                     title={`Blood pressure, last ${CHART_DAYS} days`}
                     unit="mmHg"
                     lines={[
                        {
                           label: 'Top number',
                           points: pick(bpSeries, 'value'),
                        },
                        {
                           label: 'Bottom number',
                           points: pick(bpSeries, 'value2'),
                           dashed: true,
                        },
                     ]}
                     reference={[
                        {
                           value: BP_SYSTOLIC_HIGH,
                           label: `Reference ${BP_SYSTOLIC_HIGH}`,
                        },
                        {
                           value: BP_DIASTOLIC_HIGH,
                           label: `Reference ${BP_DIASTOLIC_HIGH}`,
                        },
                     ]}
                  />
                  <ReadingTable
                     caption={`Blood pressure readings, last ${CHART_DAYS} days`}
                     rows={bpRows}
                     members={members}
                     utcOffsetMinutes={offset}
                     emptyText={EMPTY_CHART}
                     format={(reading) =>
                        `${reading.value}/${reading.value2} mmHg`
                     }
                  />
               </article>

               <article className="card" aria-labelledby="chart-sugar-title">
                  <h3 id="chart-sugar-title">Blood sugar</h3>
                  <LineChart
                     title={`Blood sugar, last ${CHART_DAYS} days`}
                     unit="mg/dL"
                     lines={[
                        {
                           label: 'Blood sugar',
                           points: pick(glucoseSeries, 'value'),
                        },
                     ]}
                     reference={[
                        {
                           value: GLUCOSE_HIGH,
                           label: `Reference ${GLUCOSE_HIGH}`,
                        },
                        {
                           value: GLUCOSE_LOW,
                           label: `Reference ${GLUCOSE_LOW}`,
                        },
                     ]}
                  />
                  <ReadingTable
                     caption={`Blood sugar readings, last ${CHART_DAYS} days`}
                     rows={glucoseRows}
                     members={members}
                     utcOffsetMinutes={offset}
                     emptyText={EMPTY_CHART}
                     format={(reading) => `${reading.value} mg/dL`}
                  />
               </article>

               <article className="card" aria-labelledby="chart-weight-title">
                  <h3 id="chart-weight-title">Weight</h3>
                  <LineChart
                     title={`Weight, last ${CHART_DAYS} days`}
                     unit="kg"
                     lines={[
                        {
                           label: 'Weight',
                           points: pick(weightSeries, 'value'),
                        },
                     ]}
                  />
                  <ReadingTable
                     caption={`Weight readings, last ${CHART_DAYS} days`}
                     rows={weightRows}
                     members={members}
                     utcOffsetMinutes={offset}
                     emptyText={EMPTY_CHART}
                     format={(reading) => `${reading.value} kg`}
                  />
               </article>
            </div>
         </section>

         <section aria-labelledby="record-title">
            <h2 id="record-title">Record a reading</h2>
            <ReadingForms />
         </section>

         <section className="card" aria-labelledby="notes-title">
            <h2 id="notes-title">Recent symptoms and notes</h2>
            {noteRows.length === 0 ? (
               <p>Nothing recorded yet.</p>
            ) : (
               <ul className="timeline">
                  {noteRows.map((reading) => (
                     <li key={reading.id}>
                        <strong>{READING_LABELS[reading.kind]}</strong>,{' '}
                        {formatLocal(reading.at, offset)}, recorded by{' '}
                        {nameOf(members, reading.byId)}.
                        <p>{describeNote(reading)}</p>
                        {mayDelete(reading, member, profile) ? (
                           <form action={deleteReadingAction}>
                              <input
                                 type="hidden"
                                 name="readingId"
                                 value={reading.id}
                              />
                              <button
                                 className="btn quiet small-btn"
                                 type="submit"
                              >
                                 Delete
                                 <span className="visually-hidden">
                                    {' '}entry from{' '}
                                    {formatLocal(reading.at, offset)}
                                 </span>
                              </button>
                           </form>
                        ) : null}
                     </li>
                  ))}
               </ul>
            )}
         </section>
      </>
   );
}
