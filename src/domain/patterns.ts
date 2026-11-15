/**
 * Care patterns.
 *
 * Purpose: look across a week of doses and readings and point out what
 * is worth raising with the doctor. Every observation is a plain fact
 * from the record with a suggestion to discuss it; the app never
 * diagnoses, and never suggests changing a medicine or its timing.
 * Missing data is reported as missing, not as a health problem.
 */
import {
   BP_DIASTOLIC_HIGH,
   BP_SYSTOLIC_HIGH,
   GLUCOSE_HIGH,
   GLUCOSE_LOW,
   MOOD_LOW,
   MS_PER_DAY,
   PATTERN_MISSED_THRESHOLD,
   PATTERN_WINDOW_DAYS,
   ROUTINE_ANCHORS,
   TREND_RUN_LENGTH,
   UNSURE_THRESHOLD,
} from '@/constants/care';
import type {
   DoseRecord,
   HealthReading,
   RoutineAnchor,
} from '@/domain/types';

export type ObservationKind =
   | 'missedTime'
   | 'unsureDoses'
   | 'pressureRising'
   | 'pressureHigh'
   | 'glucoseHigh'
   | 'glucoseLow'
   | 'repeatedSymptom'
   | 'lowMood'
   | 'weightChange';

export interface Observation {
   kind: ObservationKind;
   /** What the record shows, as one sentence. */
   title: string;
   /** What to do about it; always a conversation, never a change. */
   advice: string;
}

const ANCHOR_WORDS: Record<RoutineAnchor, string> = {
   wake: 'Waking',
   breakfast: 'Breakfast',
   lunch: 'Lunch',
   evening: 'Evening',
   dinner: 'Dinner',
   sleep: 'Bedtime',
};

const ASK_DOCTOR = 'Share this with the doctor at the next visit.';

/** Weight change over the window, in kg, that is worth mentioning. */
const WEIGHT_CHANGE_KG = 2;

/** Symptom notes are matched on their first words. */
const SYMPTOM_KEY_WORDS = 2;

/** Purpose: readings of one kind inside the window, oldest first. */
function recent(
   readings: readonly HealthReading[],
   kind: HealthReading['kind'],
   now: number,
): HealthReading[] {
   const from = now - PATTERN_WINDOW_DAYS*MS_PER_DAY;
   return readings
      .filter(
         (reading) =>
            reading.kind === kind && reading.at >= from && reading.at <= now,
      )
      .sort((first, second) => first.at - second.at);
}

/**
 * Purpose: times of day where doses often went unconfirmed. A dose
 * counts only once its due time has passed and nobody answered.
 */
function missedTimes(
   doses: readonly DoseRecord[],
   now: number,
): Observation[] {
   const from = now - PATTERN_WINDOW_DAYS*MS_PER_DAY;
   const found: Observation[] = [];
   for (const anchor of ROUTINE_ANCHORS) {
      const days = new Set(
         doses
            .filter(
               (dose) =>
                  dose.anchor === anchor &&
                  dose.status === 'unconfirmed' &&
                  dose.dueAt < now &&
                  dose.dueAt >= from,
            )
            .map((dose) => dose.dateKey),
      );
      if (days.size >= PATTERN_MISSED_THRESHOLD) {
         found.push({
            kind: 'missedTime',
            title:
               `${ANCHOR_WORDS[anchor]} doses were not confirmed on ` +
               `${days.size} of the last ${PATTERN_WINDOW_DAYS} days.`,
            advice:
               'Ask the doctor whether this dose can be made easier to ' +
               'remember. Do not change the timing on your own.',
         });
      }
   }
   return found;
}

/** Purpose: repeated "not sure if I took it" answers. */
function unsureDoses(
   doses: readonly DoseRecord[],
   now: number,
): Observation[] {
   const from = now - PATTERN_WINDOW_DAYS*MS_PER_DAY;
   const count = doses.filter(
      (dose) =>
         dose.status === 'unsure' && dose.dueAt >= from && dose.dueAt <= now,
   ).length;
   if (count < UNSURE_THRESHOLD) {
      return [];
   }
   return [
      {
         kind: 'unsureDoses',
         title: `Not sure whether a dose was taken ${count} times this week.`,
         advice:
            'A pill box with a compartment for each day can help. Never ' +
            'take a second dose to make up.',
      },
   ];
}

/** Purpose: blood pressure that is rising or above the reference. */
function pressure(
   readings: readonly HealthReading[],
   now: number,
): Observation[] {
   const series = recent(readings, 'bloodPressure', now);
   const latest = series[series.length - 1];
   if (!latest) {
      return [];
   }
   const found: Observation[] = [];
   const run = series.slice(-TREND_RUN_LENGTH);
   const rising =
      run.length === TREND_RUN_LENGTH &&
      run.every(
         (reading, index) =>
            index === 0 || reading.value > (run[index - 1]?.value ?? 0),
      );
   if (rising) {
      found.push({
         kind: 'pressureRising',
         title:
            `Blood pressure has risen over the last ${TREND_RUN_LENGTH} ` +
            `readings (${run.map((reading) => reading.value).join(', ')}).`,
         advice: ASK_DOCTOR,
      });
   }
   if (
      latest.value >= BP_SYSTOLIC_HIGH ||
      latest.value2 >= BP_DIASTOLIC_HIGH
   ) {
      found.push({
         kind: 'pressureHigh',
         title:
            `The latest blood pressure, ${latest.value}/${latest.value2}, ` +
            `is at or above the general reference of ` +
            `${BP_SYSTOLIC_HIGH}/${BP_DIASTOLIC_HIGH}.`,
         advice:
            'Your doctor may have set a different target. ' + ASK_DOCTOR,
      });
   }
   return found;
}

/** Purpose: a latest blood sugar reading outside the reference. */
function glucose(
   readings: readonly HealthReading[],
   now: number,
): Observation[] {
   const series = recent(readings, 'glucose', now);
   const latest = series[series.length - 1];
   if (!latest) {
      return [];
   }
   if (latest.value >= GLUCOSE_HIGH) {
      return [
         {
            kind: 'glucoseHigh',
            title:
               `The latest blood sugar, ${latest.value} mg/dL, is at or ` +
               `above the general reference of ${GLUCOSE_HIGH}.`,
            advice: ASK_DOCTOR,
         },
      ];
   }
   if (latest.value <= GLUCOSE_LOW) {
      return [
         {
            kind: 'glucoseLow',
            title:
               `The latest blood sugar, ${latest.value} mg/dL, is at or ` +
               `below the general reference of ${GLUCOSE_LOW}.`,
            advice:
               'Low sugar can need quick attention. If unwell, follow ' +
               'the doctor’s advice for low sugar or call them.',
         },
      ];
   }
   return [];
}

/** Purpose: the first words of a symptom note, used to group them. */
function symptomKey(note: string): string {
   return note
      .toLowerCase()
      .replace(/[^a-zऀ-ॿ\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, SYMPTOM_KEY_WORDS)
      .join(' ');
}

/** Purpose: symptoms noted more than once in the window. */
function symptoms(
   readings: readonly HealthReading[],
   now: number,
): Observation[] {
   const groups = new Map<string, HealthReading[]>();
   for (const reading of recent(readings, 'symptom', now)) {
      const key = symptomKey(reading.note);
      if (key === '') {
         continue;
      }
      groups.set(key, [...(groups.get(key) ?? []), reading]);
   }
   const found: Observation[] = [];
   for (const group of groups.values()) {
      const first = group[0];
      if (first && group.length >= 2) {
         found.push({
            kind: 'repeatedSymptom',
            title: `"${first.note}" was noted ${group.length} times this week.`,
            advice: ASK_DOCTOR,
         });
      }
   }
   return found;
}

/** Purpose: a low mood at the latest check-in. */
function mood(readings: readonly HealthReading[], now: number): Observation[] {
   const series = recent(readings, 'checkIn', now);
   const latest = series[series.length - 1];
   if (!latest || latest.value > MOOD_LOW) {
      return [];
   }
   return [
      {
         kind: 'lowMood',
         title: 'The latest daily check-in was low.',
         advice:
            'A call or a visit may help. Mention it to the doctor if it ' +
            'continues.',
      },
   ];
}

/** Purpose: a notable change in weight across the window. */
function weight(
   readings: readonly HealthReading[],
   now: number,
): Observation[] {
   const series = recent(readings, 'weight', now);
   const first = series[0];
   const last = series[series.length - 1];
   if (!first || !last || first === last) {
      return [];
   }
   const change = last.value - first.value;
   if (Math.abs(change) < WEIGHT_CHANGE_KG) {
      return [];
   }
   return [
      {
         kind: 'weightChange',
         title:
            `Weight ${change > 0 ? 'rose' : 'fell'} by ` +
            `${Math.abs(change).toFixed(1)} kg this week.`,
         advice: ASK_DOCTOR,
      },
   ];
}

/**
 * Purpose: every observation for the last week, medicines first, then
 * readings.
 */
export function detectPatterns(
   doses: readonly DoseRecord[],
   readings: readonly HealthReading[],
   now: number,
): Observation[] {
   return [
      ...missedTimes(doses, now),
      ...unsureDoses(doses, now),
      ...pressure(readings, now),
      ...glucose(readings, now),
      ...symptoms(readings, now),
      ...mood(readings, now),
      ...weight(readings, now),
   ];
}
