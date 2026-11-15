/**
 * Logo.
 *
 * Purpose: the CareCircle mark, three rings around a centre dot: the
 * elder in the middle, with caretaker and family around them.
 */

export function Logo({ size = 36 }: { size?: number }) {
   return (
      <svg
         width={size}
         height={size}
         viewBox="0 0 48 48"
         aria-hidden="true"
         focusable="false"
      >
         <circle cx="24" cy="24" r="21" fill="#f59e0b" stroke="#1f1711"
            strokeWidth="3" />
         <circle cx="24" cy="24" r="13" fill="#fdf6e9" stroke="#1f1711"
            strokeWidth="3" />
         <circle cx="24" cy="24" r="5" fill="#a3301a" stroke="#1f1711"
            strokeWidth="3" />
      </svg>
   );
}

/** Purpose: large decorative rings for the landing page. */
export function Rings() {
   return (
      <svg
         className="rings"
         width="320"
         height="320"
         viewBox="0 0 320 320"
         aria-hidden="true"
         focusable="false"
      >
         <circle cx="160" cy="160" r="150" fill="none" stroke="#f59e0b"
            strokeWidth="18" />
         <circle cx="160" cy="160" r="104" fill="none" stroke="#fdf6e9"
            strokeWidth="14" strokeDasharray="6 16" strokeLinecap="round" />
         <circle cx="160" cy="160" r="62" fill="#f59e0b" stroke="#1f1711"
            strokeWidth="5" />
         <circle cx="160" cy="160" r="24" fill="#a3301a" stroke="#1f1711"
            strokeWidth="5" />
      </svg>
   );
}
