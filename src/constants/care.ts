/**
 * Care constants.
 *
 * Purpose: every number and fixed list the care logic depends on, named
 * once here so no rule is hidden as a bare number in the code.
 */
import type {
   Permission,
   Role,
   Routine,
   RoutineAnchor,
} from '@/domain/types';

// ----- Time -------------------------------------------------------------

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_DAY = 1_440;

/** India Standard Time, the default for new profiles. */
export const DEFAULT_UTC_OFFSET_MINUTES = 330;

// ----- Routine ----------------------------------------------------------

export const ROUTINE_ANCHORS: readonly RoutineAnchor[] = [
   'wake',
   'breakfast',
   'lunch',
   'evening',
   'dinner',
   'sleep',
];

export const DEFAULT_ROUTINE: Routine = {
   wake: '06:30',
   breakfast: '08:30',
   lunch: '13:00',
   evening: '17:00',
   dinner: '20:00',
   sleep: '22:00',
};

/** A "before food" dose is due this long before the meal. */
export const BEFORE_FOOD_MINUTES = 30;

/** An "after food" dose is due this long after the meal starts. */
export const AFTER_FOOD_MINUTES = 30;

// ----- Reminders and escalation -----------------------------------------

/** The elder is reminded once the dose is due (level 1). */
export const LEVEL_ELDER = 1;

/** Caretakers hear about an unconfirmed dose at level 2. */
export const LEVEL_CARETAKER = 2;

/** Family hears about an unconfirmed dose at level 3. */
export const LEVEL_FAMILY = 3;

export const CARETAKER_DELAY_MINUTES = 30;
export const FAMILY_DELAY_MINUTES = 60;

/** Escalations to other people wait during these local hours. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

/** A dose can be confirmed from this long before it is due. */
export const EARLY_CONFIRM_MINUTES = 90;

/** Email action links stop working after this long. */
export const ACTION_LINK_HOURS = 12;

/** Appointment reminders go out this long before the visit. */
export const APPOINTMENT_DAY_NOTICE_HOURS = 24;
export const APPOINTMENT_HOUR_NOTICE_HOURS = 2;

// ----- Refills ----------------------------------------------------------

/** Warn when a medicine will run out within this many days. */
export const REFILL_WARNING_DAYS = 7;

// ----- Patterns ---------------------------------------------------------

export const PATTERN_WINDOW_DAYS = 7;

/** A time of day is a pattern when missed this often in the window. */
export const PATTERN_MISSED_THRESHOLD = 3;

/** Readings in a row that count as a rising trend. */
export const TREND_RUN_LENGTH = 3;

/** Unsure answers in the window that are worth raising. */
export const UNSURE_THRESHOLD = 2;

/** General reference lines; a doctor may set different targets. */
export const BP_SYSTOLIC_HIGH = 140;
export const BP_DIASTOLIC_HIGH = 90;
export const GLUCOSE_HIGH = 180;
export const GLUCOSE_LOW = 70;

/** Check-in mood runs from 1 (poor) to 5 (very good). */
export const MOOD_MIN = 1;
export const MOOD_MAX = 5;
export const MOOD_LOW = 2;

// ----- Access -----------------------------------------------------------

export const PASSCODE_MIN_LENGTH = 6;
export const PASSCODE_MAX_LENGTH = 12;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const SESSION_HOURS = 12;
export const CIRCLE_CODE_LENGTH = 8;

export const ALL_PERMISSIONS: readonly Permission[] = [
   'viewMedications',
   'viewAppointments',
   'viewHealth',
   'viewDocuments',
   'confirmDoses',
   'proposeChanges',
   'manageTasks',
];

/** Permissions a new member starts with; the elder can change them. */
export const DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
   elder: ALL_PERMISSIONS,
   caretaker: [
      'viewMedications',
      'viewAppointments',
      'confirmDoses',
      'proposeChanges',
      'manageTasks',
   ],
   family: [
      'viewMedications',
      'viewAppointments',
      'viewHealth',
      'proposeChanges',
      'manageTasks',
   ],
};

// ----- Input limits -----------------------------------------------------

export const MAX_NAME_LENGTH = 80;
export const MAX_TEXT_LENGTH = 1_000;
export const MAX_DOCUMENT_BYTES = 700_000;
export const MAX_PHOTO_BYTES = 150_000;
export const MAX_STOCK = 10_000;
export const MAX_UNITS_PER_DOSE = 20;

export const ALLOWED_DOCUMENT_TYPES: readonly string[] = [
   'application/pdf',
   'image/jpeg',
   'image/png',
   'image/webp',
];
