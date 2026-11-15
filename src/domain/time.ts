/**
 * Local-time helpers.
 *
 * Purpose: convert between absolute time (milliseconds since the epoch)
 * and the elder's local calendar day and clock time. All functions are
 * pure; the caller supplies the UTC offset.
 */
import {
   MINUTES_PER_DAY,
   MS_PER_DAY,
   MS_PER_MINUTE,
} from '@/constants/care';

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Purpose: turn "HH:MM" into minutes after midnight.
 * Returns -1 when the text is not a valid 24-hour time.
 */
export function clockToMinutes(clock: string): number {
   const match = CLOCK_PATTERN.exec(clock);
   if (!match) {
      return -1;
   }
   return Number(match[1])*60 + Number(match[2]);
}

/** Purpose: turn minutes after midnight into "HH:MM". */
export function minutesToClock(minutes: number): string {
   const wrapped =
      ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
   const hours = Math.floor(wrapped/60);
   const mins = wrapped % 60;
   return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Purpose: the local calendar day ("YYYY-MM-DD") for an instant. */
export function localDateKey(at: number, utcOffsetMinutes: number): string {
   const shifted = new Date(at + utcOffsetMinutes*MS_PER_MINUTE);
   return shifted.toISOString().slice(0, 10);
}

/** Purpose: true when the text is a real "YYYY-MM-DD" calendar day. */
export function isDateKey(text: string): boolean {
   if (!DATE_KEY_PATTERN.test(text)) {
      return false;
   }
   const parsed = Date.parse(`${text}T00:00:00Z`);
   return (
      !Number.isNaN(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === text
   );
}

/**
 * Purpose: the instant of a local day and minute-of-day.
 * Returns NaN when the date key is not valid.
 */
export function localToInstant(
   dateKey: string,
   minutesAfterMidnight: number,
   utcOffsetMinutes: number,
): number {
   if (!isDateKey(dateKey)) {
      return Number.NaN;
   }
   const midnightUtc = Date.parse(`${dateKey}T00:00:00Z`);
   return (
      midnightUtc +
      (minutesAfterMidnight - utcOffsetMinutes)*MS_PER_MINUTE
   );
}

/** Purpose: the local hour (0-23) at an instant. */
export function localHour(at: number, utcOffsetMinutes: number): number {
   return new Date(at + utcOffsetMinutes*MS_PER_MINUTE).getUTCHours();
}

/** Purpose: the date key a number of days away from a date key. */
export function shiftDateKey(dateKey: string, days: number): string {
   const base = Date.parse(`${dateKey}T00:00:00Z`);
   return new Date(base + days*MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Purpose: readable local date and time for emails and pages, for
 * example "15 Nov, 8:30 PM". Formatting is done by hand so the result
 * is identical on every server.
 */
export function formatLocal(at: number, utcOffsetMinutes: number): string {
   const MONTHS = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
   ];
   const shifted = new Date(at + utcOffsetMinutes*MS_PER_MINUTE);
   const month = MONTHS[shifted.getUTCMonth()] ?? '';
   return `${shifted.getUTCDate()} ${month}, ${formatClock(
      shifted.getUTCHours()*60 + shifted.getUTCMinutes(),
   )}`;
}

/** Purpose: 12-hour clock text such as "8:30 PM". */
export function formatClock(minutesAfterMidnight: number): string {
   const hours24 = Math.floor(minutesAfterMidnight/60) % 24;
   const mins = minutesAfterMidnight % 60;
   const suffix = hours24 >= 12 ? 'PM' : 'AM';
   const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
   return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}
