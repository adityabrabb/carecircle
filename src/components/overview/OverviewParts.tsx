/**
 * Overview parts.
 *
 * Purpose: the building blocks of the overview page: the three pulse
 * columns, the key-number tiles and the shared timeline.
 */
import Link from 'next/link';
import type { Pulse } from '@/domain/pulse';
import type { TimelineEntry, TimelineKind } from '@/domain/timeline';

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

export interface TileProps {
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

/** Purpose: the "Key numbers" section, one tile per figure. */
export function KeyNumbers({ tiles }: { tiles: readonly TileProps[] }) {
   return (
      <section aria-labelledby="numbers-title">
         <h2 id="numbers-title">Key numbers</h2>
         <div className="grid">
            {tiles.map((tile) => (
               <Tile key={tile.label} {...tile} />
            ))}
         </div>
      </section>
   );
}

interface PulseColumn {
   id: string;
   title: string;
   symbol: string;
   tint: string;
   field: keyof Pulse;
   empty: string;
}

/**
 * Purpose: the three pulse columns. The symbol and the title both say
 * what a column means, so colour is never the only signal.
 */
const PULSE_COLUMNS: readonly PulseColumn[] = [
   {
      id: 'pulse-on-track',
      title: 'On track',
      symbol: '✓',
      tint: 'tint-green',
      field: 'onTrack',
      empty: 'Nothing to report yet.',
   },
   {
      id: 'pulse-attention',
      title: 'Needs attention',
      symbol: '!',
      tint: 'tint-terracotta',
      field: 'needsAttention',
      empty: 'Nothing needs attention right now.',
   },
   {
      id: 'pulse-coming',
      title: 'Coming up',
      symbol: '→',
      tint: 'tint-indigo',
      field: 'upcoming',
      empty: 'Nothing else due soon.',
   },
];

/** Purpose: the "Pulse for today" section. */
export function PulseSection({ pulse }: { pulse: Pulse }) {
   return (
      <section aria-labelledby="pulse-title">
         <h2 id="pulse-title">Pulse for today</h2>
         <div className="grid">
            {PULSE_COLUMNS.map((column) => {
               const items = pulse[column.field];
               return (
                  <section
                     key={column.id}
                     className={`card ${column.tint}`}
                     aria-labelledby={column.id}
                  >
                     <h3 id={column.id}>
                        <span aria-hidden="true">{column.symbol}</span>{' '}
                        {column.title}
                     </h3>
                     {items.length === 0 ? (
                        <p className="small">{column.empty}</p>
                     ) : (
                        <ul className="list">
                           {items.map((item, index) => (
                              <li key={`${index}-${item}`}>{item}</li>
                           ))}
                        </ul>
                     )}
                  </section>
               );
            })}
         </div>
      </section>
   );
}

/** Purpose: the "Timeline" section across every care system. */
export function TimelineSection({
   entries,
   when,
}: {
   entries: readonly TimelineEntry[];
   when: (at: number) => string;
}) {
   return (
      <section aria-labelledby="timeline-title">
         <h2 id="timeline-title">Timeline</h2>
         {entries.length === 0 ? (
            <p className="card">Nothing recorded yet.</p>
         ) : (
            <ul className="timeline">
               {entries.map((entry, index) => (
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
   );
}
