/**
 * Overview.
 *
 * Purpose: the one screen that answers "what is happening with this
 * person's care, and what needs attention next?". It shows the daily
 * pulse, the key numbers and one timeline across every care system.
 * Each kind of record is loaded only when the viewer may see it.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoBar } from '@/components/DemoBar';
import { PATTERN_WINDOW_DAYS } from '@/constants/care';
import { summariseAdherence } from '@/domain/adherence';
import { can, isOwner } from '@/domain/permissions';
import { detectPatterns } from '@/domain/patterns';
import { buildPulse } from '@/domain/pulse';
import { formatLocal, localDateKey, shiftDateKey } from '@/domain/time';
import { buildTimeline, type TimelineKind } from '@/domain/timeline';
import type { HealthReading } from '@/domain/types';
import { type CurrentDoses, loadCurrentDoses } from '@/services/care';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Overview' };

/** Purpose: how many entries the timeline shows. */
const TIMELINE_LIMIT = 25;

/** Purpose: the word shown beside each timeline entry. */
const KIND_LABELS: Record<TimelineKind, string> = {
   dose: 'Medicine',
   reading: 'Health',
   appointment: 'Visit',
   handover: 'Note',
   document: 'Record',
   task: 'Task',
   change: 'Medicine change',
};

/** Purpose: shown in place of a figure the viewer may not see. */
const NOT_SHARED = 'Not shared';

const NO_DOSES: CurrentDoses = {
   dateKey: '',
   medications: [],
   today: [],
   carriedOver: [],
};

/** Purpose: the newest reading of one kind, if there is one. */
function latestReading(
   readings: readonly HealthReading[],
   kind: HealthReading['kind'],
): HealthReading | undefined {
   let latest: HealthReading | undefined;
   for (const reading of readings) {
      if (reading.kind !== kind) {
         continue;
      }
      if (latest === undefined || reading.at > latest.at) {
         latest = reading;
      }
   } // ----- end for each reading
   return latest;
}

/** Purpose: the value and note shown on a tile for one latest reading. */
function readingSummary(
   allowed: boolean,
   reading: HealthReading | undefined,
   text: (reading: HealthReading) => string,
   when: (at: number) => string,
): { value: string; note: string } {
   if (!allowed) {
      return { value: NOT_SHARED, note: '' };
   }
   if (reading === undefined) {
      return { value: 'None yet', note: 'No reading recorded' };
   }
   return { value: text(reading), note: `Recorded ${when(reading.at)}` };
}

interface TileProps {
   href: string;
   label: string;
   value: string;
   note: string;
}

/** Purpose: one summary tile that links to the section it summarises. */
function Tile({ href, label, value, note }: TileProps) {
   return (
      <Link className="card tile" href={href}>
         <span className="small">{label}</span>
         <span className="big-number">{value}</span>
         <span className="small muted">{note}</span>
      </Link>
   );
}

interface PulseCardProps {
   id: string;
   title: string;
   symbol: string;
   tint: string;
   items: readonly string[];
   empty: string;
}

/**
 * Purpose: one column of the pulse. The symbol and the title both say
 * what the column means, so colour is never the only signal.
 */
function PulseCard({
   id,
   title,
   symbol,
   tint,
   items,
   empty,
}: PulseCardProps) {
   return (
      <section className={`card ${tint}`} aria-labelledby={id}>
         <h3 id={id}>
            <span aria-hidden="true">{symbol}</span> {title}
         </h3>
         {items.length === 0 ? (
            <p className="small">{empty}</p>
         ) : (
            <ul className="list">
               {items.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
               ))}
            </ul>
         )}
      </section>
   );
}

export default async function OverviewPage() {
   const { profile, member, now } = await requireContext();
   const store = getStore();
   const offset = profile.utcOffsetMinutes;
   const members = await store.list('members', profile.id);
   const demoBar = (
      <DemoBar
         profile={profile}
         members={members}
         currentMemberId={member.id}
         now={now}
      />
   );
   if (profile.sharingPaused && !isOwner(member, profile)) {
      return (
         <>
            {demoBar}
            <div className="page-head">
               <h1>Overview</h1>
            </div>
            <p className="card tint-marigold">
               {profile.elderName} has paused sharing for now.
            </p>
         </>
      );
   }

   const mayMedicines = can(member, 'viewMedications', profile);
   const mayHealth = can(member, 'viewHealth', profile);
   const mayAppointments = can(member, 'viewAppointments', profile);
   const mayRecords = can(member, 'viewDocuments', profile);
   const today = localDateKey(now, offset);
   const week = Array.from({ length: PATTERN_WINDOW_DAYS }, (_, index) =>
      shiftDateKey(today, -index),
   );

   // ----- Load each kind only when the viewer may see it
   const [
      current,
      weekDoses,
      proposals,
      readings,
      appointments,
      documents,
      tasks,
      handovers,
   ] = await Promise.all([
      mayMedicines ? loadCurrentDoses(profile, now) : NO_DOSES,
      mayMedicines
         ? store.listIn('doses', profile.id, 'dateKey', week)
         : [],
      mayMedicines ? store.list('proposals', profile.id) : [],
      mayHealth ? store.list('readings', profile.id) : [],
      mayAppointments ? store.list('appointments', profile.id) : [],
      mayRecords ? store.list('documents', profile.id) : [],
      store.list('tasks', profile.id),
      store.list('handovers', profile.id),
   ]);

   const names = new Map(members.map((person) => [person.id, person.name]));
   const when = (at: number): string => formatLocal(at, offset);

   // ----- Pulse
   const pulse = buildPulse({
      now,
      doses: [...current.carriedOver, ...current.today],
      medications: current.medications,
      tasks,
      appointments,
      pendingProposals: proposals.filter(
         (proposal) => proposal.status === 'pending',
      ).length,
      observations: detectPatterns(weekDoses, readings, now),
      whenText: when,
   });

   // ----- Key numbers
   const adherence = summariseAdherence(weekDoses, now);
   const recorded = current.today.filter(
      (dose) => dose.status !== 'unconfirmed',
   ).length;
   const openTasks = tasks.filter((task) => task.status === 'open').length;
   const nextVisit = appointments
      .filter(
         (appointment) =>
            appointment.status === 'upcoming' && appointment.at >= now,
      )
      .sort((first, second) => first.at - second.at)[0];
   const pressure = readingSummary(
      mayHealth,
      latestReading(readings, 'bloodPressure'),
      (reading) => `${reading.value}/${reading.value2}`,
      when,
   );
   const sugar = readingSummary(
      mayHealth,
      latestReading(readings, 'glucose'),
      (reading) => `${reading.value} mg/dL`,
      when,
   );
   const weight = readingSummary(
      mayHealth,
      latestReading(readings, 'weight'),
      (reading) => `${reading.value.toFixed(1)} kg`,
      when,
   );

   // ----- Timeline
   const timeline = buildTimeline(
      {
         doses: weekDoses,
         medications: current.medications,
         readings,
         appointments,
         handovers,
         documents: documents.map((record) => ({
            id: record.id,
            title: record.title,
            at: record.at,
            uploadedById: record.uploadedById,
         })),
         tasks,
         proposals: mayMedicines ? proposals : [],
         memberNames: names,
      },
      now,
      TIMELINE_LIMIT,
   );

   return (
      <>
         {demoBar}
         <div className="page-head">
            <h1>Overview</h1>
            <p>
               Care at a glance for {profile.elderName}, as of {when(now)}.
            </p>
         </div>

         <section aria-labelledby="pulse-title">
            <h2 id="pulse-title">Pulse for today</h2>
            <div className="grid">
               <PulseCard
                  id="pulse-on-track"
                  title="On track"
                  symbol="✓"
                  tint="tint-green"
                  items={pulse.onTrack}
                  empty="Nothing to report yet."
               />
               <PulseCard
                  id="pulse-attention"
                  title="Needs attention"
                  symbol="!"
                  tint="tint-terracotta"
                  items={pulse.needsAttention}
                  empty="Nothing needs attention right now."
               />
               <PulseCard
                  id="pulse-coming"
                  title="Coming up"
                  symbol="→"
                  tint="tint-indigo"
                  items={pulse.upcoming}
                  empty="Nothing else due soon."
               />
            </div>
         </section>

         <section aria-labelledby="numbers-title">
            <h2 id="numbers-title">Key numbers</h2>
            <div className="grid">
               <Tile
                  href="/home"
                  label="Doses recorded today"
                  value={
                     mayMedicines
                        ? `${recorded}/${current.today.length}`
                        : NOT_SHARED
                  }
                  note="Today's medicines"
               />
               <Tile
                  href="/medicines"
                  label="Taken this week"
                  value={
                     mayMedicines ? `${adherence.takenPercent}%` : NOT_SHARED
                  }
                  note={`Over the last ${PATTERN_WINDOW_DAYS} days`}
               />
               <Tile
                  href="/health"
                  label="Blood pressure"
                  value={pressure.value}
                  note={pressure.note}
               />
               <Tile
                  href="/health"
                  label="Blood sugar"
                  value={sugar.value}
                  note={sugar.note}
               />
               <Tile
                  href="/health"
                  label="Weight"
                  value={weight.value}
                  note={weight.note}
               />
               <Tile
                  href="/circle"
                  label="Open tasks"
                  value={String(openTasks)}
                  note="Care tasks not yet done"
               />
               <Tile
                  href="/appointments"
                  label="Next appointment"
                  value={
                     mayAppointments
                        ? nextVisit?.doctor ?? 'None planned'
                        : NOT_SHARED
                  }
                  note={
                     mayAppointments && nextVisit
                        ? when(nextVisit.at)
                        : ''
                  }
               />
               <Tile
                  href="/records"
                  label="Medical records"
                  value={mayRecords ? String(documents.length) : NOT_SHARED}
                  note="Files on record"
               />
            </div>
         </section>

         <section aria-labelledby="timeline-title">
            <h2 id="timeline-title">Timeline</h2>
            {timeline.length === 0 ? (
               <p className="card">Nothing recorded yet.</p>
            ) : (
               <ul className="timeline">
                  {timeline.map((entry, index) => (
                     <li key={`${entry.at}-${index}`}>
                        <p className="small">
                           <span>{when(entry.at)}</span>{' '}
                           <span className="chip info">
                              {KIND_LABELS[entry.kind]}
                           </span>
                        </p>
                        <p>{entry.text}</p>
                     </li>
                  ))}
               </ul>
            )}
         </section>
      </>
   );
}
