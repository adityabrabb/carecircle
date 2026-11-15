/**
 * Notice.
 *
 * Purpose: show the success or error message a server action attached
 * to the page address. Errors are announced at once to screen readers;
 * successes are announced politely.
 */

export interface NoticeParams {
   error?: string | string[];
   ok?: string | string[];
}

/** Purpose: the first value of a query parameter, as text. */
function first(value: string | string[] | undefined): string {
   if (Array.isArray(value)) {
      return value[0] ?? '';
   }
   return value ?? '';
}

export function Notice({ params }: { params: NoticeParams }) {
   const error = first(params.error);
   const ok = first(params.ok);
   if (error) {
      return (
         <p className="notice error" role="alert">
            {error}
         </p>
      );
   }
   if (ok) {
      return (
         <p className="notice ok" role="status">
            {ok}
         </p>
      );
   }
   return null;
}
