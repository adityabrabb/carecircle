/**
 * Sample family.
 *
 * Purpose: build a complete, realistic circle so a visitor can try
 * every part of the app without signing up. Each visitor gets a fresh
 * copy. Sample profiles are marked isDemo: their emails are recorded
 * but never sent, and they may move their own clock forward.
 * Side effect: writes one profile and its records.
 */
import {
   DEFAULT_PERMISSIONS,
   MS_PER_DAY,
   MS_PER_HOUR,
} from '@/constants/care';
import { plannedDoses } from '@/domain/schedule';
import { localDateKey, shiftDateKey } from '@/domain/time';
import type {
   CareProfile,
   DoseRecord,
   HealthReading,
   Medication,
   Member,
   Role,
} from '@/domain/types';
import { blankProfile, buildMember } from '@/services/accounts';
import { newId } from '@/services/ids';
import { getStore } from '@/store';

const HISTORY_DAYS = 7;

/** Sample medicines were last changed this many days ago. */
const SEED_AGE_DAYS = 30;

/** Today's doses older than this are seeded as already taken. */
const SETTLED_AFTER_HOURS = 2;

/** Morning blood pressure for the last week; the last three rise. */
const BP_HISTORY: readonly (readonly [number, number])[] = [
   [128, 82],
   [130, 84],
   [126, 80],
   [132, 84],
   [138, 86],
   [142, 88],
   [146, 90],
];

const GLUCOSE_HISTORY: readonly number[] = [132, 141, 128, 150, 138, 162, 144];

/** Days ago on which the bedtime dose went unanswered. */
const MISSED_BEDTIME_DAYS: readonly number[] = [1, 2, 4, 6];

/** Purpose: one sample medicine with sensible defaults. */
function medicine(
   profileId: string,
   fields: Pick<
      Medication,
      | 'name'
      | 'purpose'
      | 'strength'
      | 'anchors'
      | 'food'
      | 'stock'
      | 'colour'
      | 'critical'
   >,
   startDate: string,
   now: number,
): Medication {
   return {
      id: newId(),
      profileId,
      unitsPerDose: 1,
      photo: '',
      status: 'active',
      startDate,
      endDate: '',
      updatedAt: now - SEED_AGE_DAYS*MS_PER_DAY,
      ...fields,
   };
}

/** Purpose: a sample member with a random passcode nobody knows. */
function sampleMember(
   profileId: string,
   name: string,
   role: Role,
   email: string,
   position: number,
): Member {
   const member = buildMember(
      profileId,
      name,
      role,
      email,
      `${newId().replace(/-/g, '').slice(0, 10)}Aa`,
      position,
   );
   return { ...member, permissions: [...DEFAULT_PERMISSIONS[role]] };
}

/**
 * Purpose: decide what happened to one past dose, so the history shows
 * a believable week: mostly taken, bedtime doses often unanswered, one
 * skipped by choice and one "not sure".
 */
function settlePastDose(
   dose: DoseRecord,
   daysAgo: number,
   elder: Member,
   caretaker: Member,
): DoseRecord {
   if (dose.anchor === 'sleep' && MISSED_BEDTIME_DAYS.includes(daysAgo)) {
      return { ...dose, escalationLevel: 3 };
   }
   if (dose.anchor === 'lunch' && daysAgo === 3) {
      return {
         ...dose,
         status: 'skipped',
         confirmedById: elder.id,
         reason: 'Stomach was upset, will ask the doctor.',
         resolvedAt: dose.dueAt,
         escalationLevel: 1,
      };
   }
   if (dose.anchor === 'dinner' && daysAgo === 5) {
      return {
         ...dose,
         status: 'unsure',
         confirmedById: elder.id,
         resolvedAt: dose.dueAt,
         escalationLevel: 2,
      };
   }
   const byCaretaker = dose.anchor === 'breakfast' && daysAgo % 2 === 0;
   return {
      ...dose,
      status: 'taken',
      confirmedById: byCaretaker ? caretaker.id : elder.id,
      confirmMethod: byCaretaker ? 'observed' : 'self',
      resolvedAt: dose.dueAt + 10*60_000,
      escalationLevel: 1,
   };
}

/** Purpose: one reading record. */
function reading(
   profileId: string,
   kind: HealthReading['kind'],
   value: number,
   value2: number,
   note: string,
   at: number,
   byId: string,
): HealthReading {
   return { id: newId(), profileId, kind, value, value2, note, at, byId };
}

/**
 * Purpose: create a fresh sample circle and return it with its elder.
 */
export async function createDemoCircle(): Promise<{
   profile: CareProfile;
   elder: Member;
}> {
   const store = getStore();
   const now = Date.now();
   const base = blankProfile('Kamala Devi', 'en', now);
   const profileId = base.id;

   const elder = sampleMember(
      profileId, 'Kamala Devi', 'elder', 'kamala@example.com', 0,
   );
   const caretaker = sampleMember(
      profileId, 'Sunita (caretaker)', 'caretaker', 'sunita@example.com', 0,
   );
   const son = sampleMember(
      profileId, 'Arjun (son)', 'family', 'arjun@example.com', 0,
   );
   const daughter = sampleMember(
      profileId, 'Meera (daughter)', 'family', 'meera@example.com', 1,
   );

   const profile: CareProfile = {
      ...base,
      isDemo: true,
      emergencyPlan: {
         trustedMemberId: daughter.id,
         allowUrgentChanges: true,
         instructions:
            'If I cannot answer, call Meera first. Take me to City ' +
            'Hospital. I do not want to be admitted without Meera there.',
      },
      emergencyCard: {
         bloodGroup: 'B+',
         allergies: 'Penicillin',
         conditions: 'Type 2 diabetes, high blood pressure',
         doctorName: 'Dr. S. Iyer (physician)',
         doctorPhone: '080-5550-0142',
         emergencyContact: 'Meera (daughter) 98-5550-0117',
         shareByLink: true,
      },
   };

   const today = localDateKey(now, profile.utcOffsetMinutes);
   const startDate = shiftDateKey(today, -30);
   const medications: Medication[] = [
      medicine(profileId, {
         name: 'Metformin',
         purpose: 'Keeps blood sugar steady',
         strength: '500 mg tablet',
         anchors: ['breakfast', 'dinner'],
         food: 'after',
         stock: 46,
         colour: '#f8fafc',
         critical: false,
      }, startDate, now),
      medicine(profileId, {
         name: 'Amlodipine',
         purpose: 'Keeps blood pressure down',
         strength: '5 mg tablet',
         anchors: ['breakfast'],
         food: 'any',
         stock: 21,
         colour: '#fde68a',
         critical: true,
      }, startDate, now),
      medicine(profileId, {
         name: 'Calcium + Vitamin D3',
         purpose: 'Keeps bones strong',
         strength: '500 mg tablet',
         anchors: ['lunch'],
         food: 'with',
         stock: 5,
         colour: '#fecaca',
         critical: false,
      }, startDate, now),
      medicine(profileId, {
         name: 'Atorvastatin',
         purpose: 'Lowers cholesterol',
         strength: '10 mg tablet',
         anchors: ['sleep'],
         food: 'any',
         stock: 18,
         colour: '#bfdbfe',
         critical: false,
      }, startDate, now),
   ];

   // ----- A week of dose history.
   const doses: DoseRecord[] = [];
   for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
      const dateKey = shiftDateKey(today, -daysAgo);
      for (const medication of medications) {
         const planned = plannedDoses(
            medication, profile.routine, dateKey, profile.utcOffsetMinutes,
         );
         for (const dose of planned) {
            doses.push(settlePastDose(dose, daysAgo, elder, caretaker));
         }
      }
   } // ----- end for each past day

   // ----- Today's doses that were due a while ago are already taken,
   // so the visitor starts with a tidy day and one or two doses due.
   for (const medication of medications) {
      const planned = plannedDoses(
         medication, profile.routine, today, profile.utcOffsetMinutes,
      );
      for (const dose of planned) {
         if (dose.dueAt < now - SETTLED_AFTER_HOURS*MS_PER_HOUR) {
            doses.push(settlePastDose(dose, 0, elder, caretaker));
         }
      }
   }

   // ----- A week of readings.
   const readings: HealthReading[] = [];
   BP_HISTORY.forEach(([systolic, diastolic], index) => {
      const at = now - (HISTORY_DAYS - 1 - index)*MS_PER_DAY - 3*MS_PER_HOUR;
      readings.push(
         reading(
            profileId, 'bloodPressure', systolic, diastolic, '', at,
            caretaker.id,
         ),
      );
      readings.push(
         reading(
            profileId, 'glucose', GLUCOSE_HISTORY[index] ?? 130, 0,
            'Fasting', at, caretaker.id,
         ),
      );
   });
   readings.push(
      reading(profileId, 'weight', 61.5, 0, '', now - 6*MS_PER_DAY, son.id),
      reading(profileId, 'weight', 61.2, 0, '', now - MS_PER_DAY, son.id),
      reading(
         profileId, 'symptom', 0, 0, 'Dizzy after lunch',
         now - 2*MS_PER_DAY, elder.id,
      ),
      reading(
         profileId, 'symptom', 0, 0, 'Dizzy after lunch again',
         now - MS_PER_DAY, elder.id,
      ),
      reading(
         profileId, 'checkIn', 4, 0, '', now - 2*MS_PER_DAY, elder.id,
      ),
      reading(profileId, 'checkIn', 2, 0, 'Tired', now - MS_PER_DAY, elder.id),
   );

   await store.putProfile(profile);
   await store.putMany('members', [elder, caretaker, son, daughter]);
   await store.putMany('medications', medications);
   await store.putMany('doses', doses);
   await store.putMany('readings', readings);

   await store.putMany('appointments', [
      {
         id: newId(),
         profileId,
         doctor: 'Dr. S. Iyer',
         speciality: 'Physician',
         location: 'City Hospital, Room 12',
         at: now - 20*MS_PER_DAY,
         notes: 'Routine review',
         status: 'done',
         outcome:
            'Sugar control fair. Continue Metformin. Check blood ' +
            'pressure every morning and bring the readings next time.',
         remindersSent: ['day', 'hour'],
      },
      {
         id: newId(),
         profileId,
         doctor: 'Dr. A. Rao',
         speciality: 'Cardiologist',
         location: 'Heart Care Clinic, 2nd floor',
         at: now + 2*MS_PER_DAY,
         notes: 'Bring the blood pressure chart and all medicine strips.',
         status: 'upcoming',
         outcome: '',
         remindersSent: [],
      },
   ]);

   await store.putMany('tasks', [
      {
         id: newId(),
         profileId,
         title: 'Buy Calcium + Vitamin D3 refill',
         kind: 'refill',
         ownerId: son.id,
         backupId: daughter.id,
         dueAt: now + MS_PER_DAY,
         status: 'open',
         createdById: caretaker.id,
         doneById: '',
         doneAt: 0,
         relatedId: '',
      },
      {
         id: newId(),
         profileId,
         title: 'Book fasting blood test before the cardiologist visit',
         kind: 'test',
         ownerId: daughter.id,
         backupId: son.id,
         dueAt: now + MS_PER_DAY,
         status: 'open',
         createdById: daughter.id,
         doneById: '',
         doneAt: 0,
         relatedId: '',
      },
      {
         id: newId(),
         profileId,
         title: 'Check blood pressure every morning',
         kind: 'task',
         ownerId: caretaker.id,
         backupId: son.id,
         dueAt: now + 12*MS_PER_HOUR,
         status: 'open',
         createdById: elder.id,
         doneById: '',
         doneAt: 0,
         relatedId: '',
      },
   ]);

   await store.put('handovers', {
      id: newId(),
      profileId,
      byId: caretaker.id,
      text:
         'Kamala ji ate well today. Felt dizzy after lunch, rested for ' +
         'an hour. Bedtime tablet was left on the side table.',
      at: now - 14*MS_PER_HOUR,
   });

   await store.put('questions', {
      id: newId(),
      profileId,
      text: 'Why do I feel dizzy after lunch these days?',
      at: now - MS_PER_DAY,
      answered: false,
   });

   const proposed = medicine(profileId, {
      name: 'Vitamin B12',
      purpose: 'For tiredness and nerve health',
      strength: '500 mcg tablet',
      anchors: ['breakfast'],
      food: 'after',
      stock: 30,
      colour: '#fbcfe8',
      critical: false,
   }, today, now);
   await store.put('proposals', {
      id: newId(),
      profileId,
      kind: 'addMedication',
      proposedById: son.id,
      medication: { ...proposed, status: 'pendingApproval' },
      note: 'Dr. Iyer suggested this on the phone for the tiredness.',
      status: 'pending',
      createdAt: now - 5*MS_PER_HOUR,
      decidedAt: 0,
   });

   const summary =
      'Dr. S. Iyer, Physician. Metformin 500 mg twice daily after food. ' +
      'Amlodipine 5 mg every morning. Atorvastatin 10 mg at bedtime. ' +
      'Calcium + Vitamin D3 with lunch. Review in one month.';
   await store.put('documents', {
      id: newId(),
      profileId,
      title: 'Prescription from Dr. Iyer',
      kind: 'prescription',
      mime: 'text/plain',
      data: Buffer.from(summary, 'utf8').toString('base64'),
      summary,
      uploadedById: daughter.id,
      at: now - 20*MS_PER_DAY,
   });

   await store.put('audit', {
      id: newId(),
      profileId,
      actorId: elder.id,
      actorName: elder.name,
      action: 'Circle created',
      detail: 'Sample family',
      at: now - 30*MS_PER_DAY,
   });

   return { profile, elder };
}
