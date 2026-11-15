/**
 * Refill prediction.
 *
 * Purpose: estimate when a medicine will run out. The estimate uses the
 * stock on hand, which only falls when a dose is confirmed as taken, so
 * a missed dose never makes the forecast too pessimistic.
 */
import { MS_PER_DAY, REFILL_WARNING_DAYS } from '@/constants/care';
import { dosesPerDay } from '@/domain/schedule';
import type { Medication } from '@/domain/types';

export interface RefillForecast {
   medicationId: string;
   name: string;
   stock: number;
   /** Whole days of medicine left; -1 when it cannot be estimated. */
   daysLeft: number;
   /** Instant the stock is expected to run out; 0 when unknown. */
   runsOutAt: number;
   needsRefill: boolean;
}

/**
 * Purpose: forecast one medicine. A stopped medicine, or one with no
 * daily doses, has no forecast and never asks for a refill.
 */
export function forecastRefill(
   medication: Medication,
   now: number,
): RefillForecast {
   const perDay = dosesPerDay(medication)*medication.unitsPerDose;
   const base = {
      medicationId: medication.id,
      name: medication.name,
      stock: medication.stock,
   };
   if (medication.status !== 'active' || perDay <= 0) {
      return { ...base, daysLeft: -1, runsOutAt: 0, needsRefill: false };
   }
   const daysLeft = Math.floor(Math.max(0, medication.stock)/perDay);
   return {
      ...base,
      daysLeft,
      runsOutAt: now + daysLeft*MS_PER_DAY,
      needsRefill: daysLeft <= REFILL_WARNING_DAYS,
   };
}

/** Purpose: forecasts for every medicine, most urgent first. */
export function forecastAll(
   medications: readonly Medication[],
   now: number,
): RefillForecast[] {
   return medications
      .map((medication) => forecastRefill(medication, now))
      .filter((forecast) => forecast.daysLeft >= 0)
      .sort((first, second) => first.daysLeft - second.daysLeft);
}
