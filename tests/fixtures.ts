/**
 * Test fixtures.
 *
 * Purpose: small builders for the records the tests need, so each test
 * states only the fields it cares about.
 */
import {
   DEFAULT_PERMISSIONS,
   DEFAULT_ROUTINE,
   DEFAULT_UTC_OFFSET_MINUTES,
} from '@/constants/care';
import type {
   CareProfile,
   DoseRecord,
   HealthReading,
   Medication,
   Member,
   Role,
   Task,
} from '@/domain/types';

/** 15 Nov 2026, 12:00 in India (06:30 UTC). */
export const NOON = Date.parse('2026-11-15T06:30:00Z');
export const TODAY = '2026-11-15';
export const PROFILE_ID = 'profile-1';

export function makeProfile(
   overrides: Partial<CareProfile> = {},
): CareProfile {
   return {
      id: PROFILE_ID,
      circleCode: 'ABCD2345',
      elderName: 'Kamala',
      language: 'en',
      routine: { ...DEFAULT_ROUTINE },
      utcOffsetMinutes: DEFAULT_UTC_OFFSET_MINUTES,
      sharingPaused: false,
      emergencyPlan: {
         trustedMemberId: null,
         allowUrgentChanges: false,
         instructions: '',
      },
      emergencyCard: {
         bloodGroup: '',
         allergies: '',
         conditions: '',
         doctorName: '',
         doctorPhone: '',
         emergencyContact: '',
         shareByLink: false,
      },
      clockSkipMinutes: 0,
      isDemo: false,
      failedAttempts: 0,
      lockedUntil: 0,
      lastTickAt: 0,
      createdAt: NOON,
      ...overrides,
   };
}

export function makeMember(
   role: Role,
   overrides: Partial<Member> = {},
): Member {
   return {
      id: `${role}-1`,
      profileId: PROFILE_ID,
      name: role,
      role,
      email: `${role}@example.com`,
      passcodeHash: '',
      permissions: [...DEFAULT_PERMISSIONS[role]],
      escalationOrder: 0,
      active: true,
      ...overrides,
   };
}

export function makeMedication(
   overrides: Partial<Medication> = {},
): Medication {
   return {
      id: 'med-1',
      profileId: PROFILE_ID,
      name: 'Metformin',
      purpose: 'Blood sugar',
      strength: '500 mg',
      anchors: ['breakfast', 'dinner'],
      food: 'after',
      unitsPerDose: 1,
      stock: 30,
      colour: '#ffffff',
      photo: '',
      critical: false,
      status: 'active',
      startDate: '',
      endDate: '',
      updatedAt: NOON,
      ...overrides,
   };
}

export function makeDose(overrides: Partial<DoseRecord> = {}): DoseRecord {
   return {
      id: 'dose-1',
      profileId: PROFILE_ID,
      medicationId: 'med-1',
      anchor: 'breakfast',
      dateKey: TODAY,
      dueAt: NOON,
      status: 'unconfirmed',
      confirmedById: '',
      confirmMethod: '',
      reason: '',
      resolvedAt: 0,
      escalationLevel: 0,
      acknowledgedById: '',
      ...overrides,
   };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
   return {
      id: 'task-1',
      profileId: PROFILE_ID,
      title: 'Task',
      kind: 'task',
      ownerId: 'family-1',
      backupId: '',
      dueAt: NOON,
      status: 'open',
      createdById: 'elder-1',
      doneById: '',
      doneAt: 0,
      relatedId: '',
      ...overrides,
   };
}

export function makeReading(
   overrides: Partial<HealthReading> = {},
): HealthReading {
   return {
      id: 'reading-1',
      profileId: PROFILE_ID,
      kind: 'bloodPressure',
      value: 120,
      value2: 80,
      note: '',
      at: NOON,
      byId: 'elder-1',
      ...overrides,
   };
}
