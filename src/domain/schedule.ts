/**
 * Medication schedule.
 *
 * Purpose: work out which doses are due on a given day. Doses are tied
 * to the elder's own routine ("after breakfast", "before sleep") rather
 * than fixed clock times, so changing the routine moves every dose.
 */
import {
   AFTER_FOOD_MINUTES,
   BEFORE_FOOD_MINUTES,
   ROUTINE_ANCHORS,
} from '@/constants/care';
import { clockToMinutes, localToInstant } from '@/domain/time';
import type {
   DoseRecord,
   FoodRule,
   Medication,
   Routine,
   RoutineAnchor,
} from '@/domain/types';

/** Anchors that are meals; the food rule only shifts these. */
const MEAL_ANCHORS: readonly RoutineAnchor[] = [
   'breakfast',
   'lunch',
   'dinner',
];

/**
 * Purpose: minutes after midnight when a dose is due, given the routine
 * time for its anchor and the medicine's food rule.
 * Returns -1 when the routine has no valid time for the anchor.
 */
export function dueMinutes(
   routine: Routine,
   anchor: RoutineAnchor,
   food: FoodRule,
): number {
   const base = clockToMinutes(routine[anchor]);
   if (base < 0) {
      return -1;
   }
   if (!MEAL_ANCHORS.includes(anchor)) {
      return base;
   }
   if (food === 'before') {
      return Math.max(0, base - BEFORE_FOOD_MINUTES);
   }
   if (food === 'after') {
      return base + AFTER_FOOD_MINUTES;
   }
   return base;
}

/** Purpose: the fixed identifier of one dose of one medicine. */
export function doseId(
   medicationId: string,
   dateKey: string,
   anchor: RoutineAnchor,
): string {
   return `${medicationId}_${dateKey}_${anchor}`;
}

/**
 * Purpose: true when the medicine should be taken on the given day.
 * Only active medicines inside their start and end dates count; a
 * medicine still waiting for the elder's approval is never scheduled.
 */
export function isScheduledOn(
   medication: Medication,
   dateKey: string,
): boolean {
   if (medication.status !== 'active') {
      return false;
   }
   if (medication.startDate && dateKey < medication.startDate) {
      return false;
   }
   if (medication.endDate && dateKey > medication.endDate) {
      return false;
   }
   return true;
}

/**
 * Purpose: the dose records one medicine needs for one day, in routine
 * order, all starting as "unconfirmed". Anchors with no valid routine
 * time are left out rather than guessed.
 */
export function plannedDoses(
   medication: Medication,
   routine: Routine,
   dateKey: string,
   utcOffsetMinutes: number,
): DoseRecord[] {
   if (!isScheduledOn(medication, dateKey)) {
      return [];
   }
   const planned: DoseRecord[] = [];
   for (const anchor of ROUTINE_ANCHORS) {
      if (!medication.anchors.includes(anchor)) {
         continue;
      }
      const minutes = dueMinutes(routine, anchor, medication.food);
      if (minutes < 0) {
         continue;
      }
      planned.push({
         id: doseId(medication.id, dateKey, anchor),
         profileId: medication.profileId,
         medicationId: medication.id,
         anchor,
         dateKey,
         dueAt: localToInstant(dateKey, minutes, utcOffsetMinutes),
         status: 'unconfirmed',
         confirmedById: '',
         confirmMethod: '',
         reason: '',
         resolvedAt: 0,
         escalationLevel: 0,
         acknowledgedById: '',
      });
   } // ----- end for each anchor
   return planned;
}

/**
 * Purpose: merge the day's planned doses with what is already stored.
 * A stored record always wins, so a confirmed dose is never reset when
 * the plan is rebuilt. Returns the full day plus the new records that
 * still need saving.
 */
export function mergeDay(
   planned: readonly DoseRecord[],
   stored: readonly DoseRecord[],
): { day: DoseRecord[]; toCreate: DoseRecord[] } {
   const storedById = new Map(stored.map((dose) => [dose.id, dose]));
   const day: DoseRecord[] = [];
   const toCreate: DoseRecord[] = [];
   for (const dose of planned) {
      const existing = storedById.get(dose.id);
      if (existing) {
         day.push(existing);
      } else {
         day.push(dose);
         toCreate.push(dose);
      }
   }
   day.sort((first, second) => first.dueAt - second.dueAt);
   return { day, toCreate };
}

/** Purpose: how many doses of the medicine are taken per day. */
export function dosesPerDay(medication: Medication): number {
   return new Set(medication.anchors).size;
}
