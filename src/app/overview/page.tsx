/**
 * Overview.
 *
 * Purpose: the one screen that answers "what is happening with this
 * person's care, and what needs attention next?". It shows the daily
 * pulse, the key numbers and one timeline across every care system.
 * Each kind of record is loaded only when the viewer may see it.
 */
import type { Metadata } from 'next';
import { DemoBar } from '@/components/DemoBar';
import {
   KeyNumbers,
   PulseSection,
   TimelineSection,
   type TileProps,
} from '@/components/overview/OverviewParts';
import { PATTERN_WINDOW_DAYS } from '@/constants/care';
import { summariseAdherence } from '@/domain/adherence';
import { can, isOwner } from '@/domain/permissions';
import { detectPatterns } from '@/domain/patterns';
import { buildPulse } from '@/domain/pulse';
import { formatLocal, localDateKey, shiftDateKey } from '@/domain/time';
import { latestReading } from '@/domain/readingForm';
import { buildTimeline } from '@/domain/timeline';
import type { HealthReading } from '@/domain/types';
import { type CurrentDoses, loadCurrentDoses } from '@/services/care';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

export const metadata: Metadata = { title: 'Overview' };

/** Purpose: how many entries the timeline shows. */
const TIMELINE_LIMIT = 25;

/** Purpose: shown in place of a figure the viewer may not see. */
const NOT_SHARED = 'Not shared';

const NO_DOSES: CurrentDoses = {
   dateKey: '',
   medications: [],
   today: [],
   carriedOver: [],
};

/** Purpose: the value and note shown on a tile for one latest reading. */
function readingSummary(
   allowed: boolean,
   reading: HealthReading | null,
   text: (reading: HealthReading) => string,
   when: (at: number) => string,
): { value: string; note: string } {
   if (!allowed) {
      return { value: NOT_SHARED, note: '' };
   }
   if (reading === null) {
      return { value: 'None yet', note: 'No reading recorded' };
   }
   return { value: text(reading), note: `Recorded ${when(reading.at)}` };
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

   const tiles: TileProps[] = [
      {
         href: '/home',
         label: 'Doses recorded today',
         value: mayMedicines
            ? `${recorded}/${current.today.length}`
            : NOT_SHARED,
         note: "Today's medicines",
      },
      {
         href: '/medicines',
         label: 'Taken this week',
         value: mayMedicines ? `${adherence.takenPercent}%` : NOT_SHARED,
         note: `Over the last ${PATTERN_WINDOW_DAYS} days`,
      },
      { href: '/health', label: 'Blood pressure', ...pressure },
      { href: '/health', label: 'Blood sugar', ...sugar },
      { href: '/health', label: 'Weight', ...weight },
      {
         href: '/circle',
         label: 'Open tasks',
         value: String(openTasks),
         note: 'Care tasks not yet done',
      },
      {
         href: '/appointments',
         label: 'Next appointment',
         value: mayAppointments
            ? nextVisit?.doctor ?? 'None planned'
            : NOT_SHARED,
         note: mayAppointments && nextVisit ? when(nextVisit.at) : '',
      },
      {
         href: '/records',
         label: 'Medical records',
         value: mayRecords ? String(documents.length) : NOT_SHARED,
         note: 'Files on record',
      },
   ];

   return (
      <>
         {demoBar}
         <div className="page-head">
            <h1>Overview</h1>
            <p>
               Care at a glance for {profile.elderName}, as of {when(now)}.
            </p>
         </div>

         <PulseSection pulse={pulse} />
         <KeyNumbers tiles={tiles} />
         <TimelineSection entries={timeline} when={when} />
      </>
   );
}
