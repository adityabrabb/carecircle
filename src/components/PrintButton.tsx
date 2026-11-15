'use client';

/**
 * Print button.
 *
 * Purpose: open the browser's print dialog for the current page.
 */

export function PrintButton({ label }: { label: string }) {
   return (
      <button className="btn" type="button" onClick={() => window.print()}>
         {label}
      </button>
   );
}
