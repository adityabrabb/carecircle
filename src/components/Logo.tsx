/**
 * Logo and landing artwork.
 *
 * Purpose: the CareCircle mark, three rings around a centre dot (the
 * elder in the middle, with caretaker and family around them), and the
 * dose packet drawn on the landing page: the chemist's envelope with a
 * sun, sun and moon box for morning, noon and night.
 */

const INK = '#1f3a8a';
const MARIGOLD = '#f5b72f';
const PAPER = '#fffaf0';

export function Logo({ size = 36 }: { size?: number }) {
   return (
      <svg
         width={size}
         height={size}
         viewBox="0 0 48 48"
         aria-hidden="true"
         focusable="false"
      >
         <circle cx="24" cy="24" r="21" fill={INK} stroke="#ffffff"
            strokeWidth="3" />
         <circle cx="24" cy="24" r="14" fill={PAPER} />
         <circle cx="24" cy="24" r="14" fill="none" stroke={INK}
            strokeWidth="2" strokeDasharray="3 4" />
         <circle cx="24" cy="24" r="6" fill={MARIGOLD} />
      </svg>
   );
}

/** Purpose: one dose box: a pictogram, its time and a tick or blank. */
function DoseBox({
   x,
   time,
   taken,
   moon,
   empty = false,
}: {
   x: number;
   time: string;
   taken: boolean;
   moon: boolean;
   empty?: boolean;
}) {
   return (
      <g transform={`translate(${x} 0)`} opacity={empty ? 0.4 : 1}>
         <rect x="0" y="0" width="92" height="118" rx="10" fill={PAPER}
            stroke={INK} strokeWidth="3" />
         {moon ? (
            <path d="M54 22a20 20 0 1 0 14 34a16 16 0 1 1-14-34z"
               fill={INK} />
         ) : (
            <g>
               <circle cx="46" cy="40" r="13" fill={MARIGOLD} stroke={INK}
                  strokeWidth="3" />
               <path d={'M46 15v6M46 59v6M21 40h6M65 40h6M28 22l4 4' +
                  'M60 54l4 4M28 58l4-4M60 26l4-4'} stroke={INK}
                  strokeWidth="3" strokeLinecap="round" />
            </g>
         )}
         <text x="46" y="88" textAnchor="middle" fontSize="15"
            fontWeight="700" fill={INK}>{time}</text>
         <text x="46" y="110" textAnchor="middle" fontSize="20"
            fontWeight="700" fill={taken ? '#1f7a4a' : '#9aa3b8'}>
            {taken ? '✓' : '—'}
         </text>
      </g>
   );
}

/** Purpose: the chemist's dose packet that heads the landing page. */
export function DosePacket() {
   return (
      <svg
         className="packet"
         viewBox="0 0 340 320"
         role="img"
         aria-label="A medicine packet marked 1-0-1: morning taken, no noon dose, night due"
      >
         <defs>
            <filter id="stamp-ink">
               <feTurbulence type="fractalNoise" baseFrequency="0.9"
                  numOctaves="2" seed="4" />
               <feDisplacementMap in="SourceGraphic" scale="3" />
            </filter>
         </defs>
         <rect x="6" y="14" width="328" height="300" rx="6"
            fill="#efe0bf" stroke={INK} strokeWidth="3" />
         <path d="M6 44h328" stroke={INK} strokeWidth="2"
            strokeDasharray="2 7" />
         <text x="24" y="36" fontSize="15" fontWeight="700"
            fill={INK} letterSpacing="2">KAMALA DEVI · METFORMIN 500</text>
         <text x="24" y="84" fontSize="34" fontWeight="700"
            fill={INK} fontFamily="var(--font-head), serif">1 — 0 — 1</text>
         <text x="200" y="84" fontSize="14" fill={INK}>after food</text>
         <g transform="translate(24 108)">
            <DoseBox x={0} time="Morning" taken moon={false} />
            <DoseBox x={102} time="Noon" taken={false} moon={false}
               empty />
            <DoseBox x={204} time="Night" taken={false} moon />
         </g>
         <g transform="rotate(-7 250 270)" filter="url(#stamp-ink)">
            <rect x="160" y="246" width="166" height="46" rx="6"
               fill="none" stroke="#c73b22" strokeWidth="4" />
            <text x="243" y="276" textAnchor="middle" fontSize="16"
               fontWeight="700" fill="#c73b22" letterSpacing="1.5">
               ELDER APPROVES
            </text>
         </g>
      </svg>
   );
}
