/**
 * Helpers shared by server actions.
 *
 * Purpose: send the visitor back to a page with a short message. Pages
 * show the message in a notice, which works without any browser script.
 */
import { redirect } from 'next/navigation';

const MAX_MESSAGE_LENGTH = 200;

/** Purpose: a path with a message attached as a query value. */
export function withMessage(
   path: string,
   kind: 'error' | 'ok',
   message: string,
): string {
   const joiner = path.includes('?') ? '&' : '?';
   const text = encodeURIComponent(message.slice(0, MAX_MESSAGE_LENGTH));
   return `${path}${joiner}${kind}=${text}`;
}

/** Purpose: go back to a page showing an error. Never returns. */
export function fail(path: string, message: string): never {
   redirect(withMessage(path, 'error', message));
}

/** Purpose: go back to a page showing a success message. */
export function succeed(path: string, message: string): never {
   redirect(withMessage(path, 'ok', message));
}

/** Purpose: one form value as text, empty when missing or a file. */
export function field(form: FormData, name: string): string {
   const value = form.get(name);
   return typeof value === 'string' ? value : '';
}

/** Purpose: every value of a repeated form field, as text. */
export function fields(form: FormData, name: string): string[] {
   return form
      .getAll(name)
      .filter((value): value is string => typeof value === 'string');
}
