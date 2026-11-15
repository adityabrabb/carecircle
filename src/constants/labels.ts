/**
 * Display labels.
 *
 * Purpose: the plain-language names shown for permissions, roles and
 * other fixed values, kept apart from the logic that uses them.
 */
import type {
   DocumentKind,
   Permission,
   ReadingKind,
   Role,
   TaskKind,
} from '@/domain/types';

export const PERMISSION_LABELS: Record<Permission, string> = {
   viewMedications: 'See medicines and doses',
   viewAppointments: 'See doctor appointments',
   viewHealth: 'See health readings and symptoms',
   viewDocuments: 'See medical records',
   confirmDoses: 'Record a dose on the elder’s behalf',
   proposeChanges: 'Propose changes to medicines',
   manageTasks: 'Create and complete care tasks',
};

export const ROLE_LABELS: Record<Role, string> = {
   elder: 'Elder (owner)',
   caretaker: 'Caretaker',
   family: 'Family',
};

export const READING_LABELS: Record<ReadingKind, string> = {
   bloodPressure: 'Blood pressure',
   glucose: 'Blood sugar',
   weight: 'Weight',
   symptom: 'Symptom',
   checkIn: 'Daily check-in',
};

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
   prescription: 'Prescription',
   labReport: 'Lab report',
   discharge: 'Discharge summary',
   other: 'Other',
};

export const TASK_LABELS: Record<TaskKind, string> = {
   task: 'Task',
   refill: 'Refill',
   test: 'Test',
   followup: 'Follow-up',
};

export const MOOD_LABELS: readonly string[] = [
   '',
   'Very low',
   'Low',
   'Okay',
   'Good',
   'Very good',
];
