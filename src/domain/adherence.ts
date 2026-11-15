/**
 * Adherence summary.
 *
 * Purpose: turn dose records into an honest picture of what was taken.
 * The summary keeps "unconfirmed" separate from "skipped", and reports
 * how much of the record rests on the elder's own tap or a witnessed
 * dose rather than on someone's assumption.
 */
import type { DoseRecord } from '@/domain/types';

export interface AdherenceSummary {
   /** Doses whose due time has passed. */
   due: number;
   taken: number;
   /** Skipped by the elder's own choice. */
   skipped: number;
   unsure: number;
   /** Past due with no answer from anyone. */
   unconfirmed: number;
   /** Taken as a share of due doses, 0 to 100. */
   takenPercent: number;
   /** Taken doses confirmed by the elder or witnessed. */
   firmEvidence: number;
   /** Taken doses that a helper assumed were taken. */
   assumedEvidence: number;
}

/**
 * Purpose: summarise the doses that were due at or before "now".
 * Future doses are ignored so the percentage is never dragged down by
 * doses that could not have been taken yet.
 */
export function summariseAdherence(
   doses: readonly DoseRecord[],
   now: number,
): AdherenceSummary {
   const summary: AdherenceSummary = {
      due: 0,
      taken: 0,
      skipped: 0,
      unsure: 0,
      unconfirmed: 0,
      takenPercent: 0,
      firmEvidence: 0,
      assumedEvidence: 0,
   };
   for (const dose of doses) {
      if (dose.dueAt > now && dose.status === 'unconfirmed') {
         continue;
      }
      summary.due += 1;
      if (dose.status === 'taken') {
         summary.taken += 1;
         if (dose.confirmMethod === 'assumed') {
            summary.assumedEvidence += 1;
         } else {
            summary.firmEvidence += 1;
         }
      } else if (dose.status === 'skipped') {
         summary.skipped += 1;
      } else if (dose.status === 'unsure') {
         summary.unsure += 1;
      } else {
         summary.unconfirmed += 1;
      }
   } // ----- end for each dose
   summary.takenPercent =
      summary.due === 0 ? 0 : Math.round((summary.taken*100)/summary.due);
   return summary;
}

/** Purpose: adherence for each day, oldest first, for the chart. */
export function adherenceByDay(
   doses: readonly DoseRecord[],
   now: number,
): { dateKey: string; summary: AdherenceSummary }[] {
   const byDay = new Map<string, DoseRecord[]>();
   for (const dose of doses) {
      const list = byDay.get(dose.dateKey) ?? [];
      list.push(dose);
      byDay.set(dose.dateKey, list);
   }
   return [...byDay.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([dateKey, list]) => ({
         dateKey,
         summary: summariseAdherence(list, now),
      }));
}
