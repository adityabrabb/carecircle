/**
 * Shared record types.
 *
 * Purpose: one place that defines every record CareCircle stores. All six
 * care systems (medication, appointments, health tracking, documents,
 * coordination and proactive alerts) are views over these records.
 */

// ----- People and access ------------------------------------------------

export type Role = 'elder' | 'caretaker' | 'family';

export type Permission =
   | 'viewMedications'
   | 'viewAppointments'
   | 'viewHealth'
   | 'viewDocuments'
   | 'confirmDoses'
   | 'proposeChanges'
   | 'manageTasks';

export type Language = 'en' | 'hi';

export type RoutineAnchor =
   | 'wake'
   | 'breakfast'
   | 'lunch'
   | 'evening'
   | 'dinner'
   | 'sleep';

export type Routine = Record<RoutineAnchor, string>;

/** What the elder has agreed in advance for when they cannot respond. */
export interface EmergencyPlan {
   /** Member who may act for the elder in an emergency. */
   trustedMemberId: string | null;
   /** May that member apply medicine changes without approval? */
   allowUrgentChanges: boolean;
   /** Free-text instructions written by the elder. */
   instructions: string;
}

/** Facts shown on the shareable emergency card. */
export interface EmergencyCard {
   bloodGroup: string;
   allergies: string;
   conditions: string;
   doctorName: string;
   doctorPhone: string;
   emergencyContact: string;
   /** The elder decides whether the card can be opened by link. */
   shareByLink: boolean;
}

export interface CareProfile {
   id: string;
   /** Short code the circle types to reach this profile. */
   circleCode: string;
   elderName: string;
   language: Language;
   routine: Routine;
   /** Minutes east of UTC for the elder's local time. */
   utcOffsetMinutes: number;
   /** When true only the elder can see the profile. */
   sharingPaused: boolean;
   emergencyPlan: EmergencyPlan;
   emergencyCard: EmergencyCard;
   /** Demo profiles may move their clock forward by this many minutes. */
   clockSkipMinutes: number;
   isDemo: boolean;
   /** Wrong passcode attempts since the last success. */
   failedAttempts: number;
   /** Instant until which sign-in to this circle is locked. */
   lockedUntil: number;
   /** Instant the reminder check last ran for this profile. */
   lastTickAt: number;
   createdAt: number;
}

export interface Member {
   id: string;
   profileId: string;
   name: string;
   role: Role;
   email: string;
   passcodeHash: string;
   permissions: Permission[];
   /** Position in the escalation ladder; lower is contacted first. */
   escalationOrder: number;
   active: boolean;
}

// ----- Medication -------------------------------------------------------

export type FoodRule = 'before' | 'after' | 'with' | 'any';

export type MedicationStatus = 'active' | 'pendingApproval' | 'stopped';

export interface Medication {
   id: string;
   profileId: string;
   name: string;
   /** Plain-language line: what this medicine is for. */
   purpose: string;
   /** Strength and form, for example "500 mg tablet". */
   strength: string;
   anchors: RoutineAnchor[];
   food: FoodRule;
   /** Units swallowed per dose. */
   unitsPerDose: number;
   /** Units currently in the house. */
   stock: number;
   /** Colour used to recognise the pill, as a CSS colour. */
   colour: string;
   /** Small photo of the pill or strip, as a data URL. */
   photo: string;
   /** A critical medicine escalates even during quiet hours. */
   critical: boolean;
   status: MedicationStatus;
   startDate: string;
   endDate: string;
   updatedAt: number;
}

export type DoseStatus = 'unconfirmed' | 'taken' | 'skipped' | 'unsure';

/** How strongly we know a dose was really taken. */
export type ConfirmMethod = 'self' | 'observed' | 'assumed';

export interface DoseRecord {
   id: string;
   profileId: string;
   medicationId: string;
   anchor: RoutineAnchor;
   dateKey: string;
   dueAt: number;
   status: DoseStatus;
   confirmedById: string;
   confirmMethod: ConfirmMethod | '';
   /** Reason the elder gave when choosing to skip. */
   reason: string;
   resolvedAt: number;
   /** 0 = none sent, 1 = elder reminded, 2 = caretaker, 3 = family. */
   escalationLevel: number;
   /** Member who said "I am handling this". */
   acknowledgedById: string;
}

// ----- Appointments -----------------------------------------------------

export type AppointmentStatus = 'upcoming' | 'done' | 'cancelled';

export interface Appointment {
   id: string;
   profileId: string;
   doctor: string;
   speciality: string;
   location: string;
   at: number;
   notes: string;
   status: AppointmentStatus;
   /** Written after the visit: what the doctor said. */
   outcome: string;
   /** Reminder kinds already emailed, such as "day" and "hour". */
   remindersSent: string[];
}

// ----- Coordination -----------------------------------------------------

export type TaskKind = 'task' | 'refill' | 'test' | 'followup';

export interface Task {
   id: string;
   profileId: string;
   title: string;
   kind: TaskKind;
   ownerId: string;
   backupId: string;
   dueAt: number;
   status: 'open' | 'done';
   createdById: string;
   doneById: string;
   doneAt: number;
   /** Record this task is about, such as a medicine to refill. */
   relatedId: string;
}

export interface HandoverNote {
   id: string;
   profileId: string;
   byId: string;
   text: string;
   at: number;
}

export interface DoctorQuestion {
   id: string;
   profileId: string;
   text: string;
   at: number;
   answered: boolean;
}

// ----- Health tracking --------------------------------------------------

export type ReadingKind =
   | 'bloodPressure'
   | 'glucose'
   | 'weight'
   | 'symptom'
   | 'checkIn';

export interface HealthReading {
   id: string;
   profileId: string;
   kind: ReadingKind;
   /** Systolic pressure, glucose in mg/dL, weight in kg, or mood 1-5. */
   value: number;
   /** Diastolic pressure; zero for other kinds. */
   value2: number;
   note: string;
   at: number;
   byId: string;
}

// ----- Documents --------------------------------------------------------

export type DocumentKind =
   | 'prescription'
   | 'labReport'
   | 'discharge'
   | 'other';

export interface DocumentRecord {
   id: string;
   profileId: string;
   title: string;
   kind: DocumentKind;
   mime: string;
   /** File content as base64. */
   data: string;
   /** Summary or extracted text, confirmed by a person. */
   summary: string;
   uploadedById: string;
   at: number;
}

// ----- Consent, notifications and audit ---------------------------------

export type ProposalKind =
   | 'addMedication'
   | 'editMedication'
   | 'stopMedication';

export type ProposalStatus =
   | 'pending'
   | 'approved'
   | 'rejected'
   | 'emergencyApplied';

export interface ChangeProposal {
   id: string;
   profileId: string;
   kind: ProposalKind;
   proposedById: string;
   /** The medicine as it would be after the change. */
   medication: Medication;
   /** Why the member is proposing this. */
   note: string;
   status: ProposalStatus;
   createdAt: number;
   decidedAt: number;
}

export type NotificationKind =
   | 'doseReminder'
   | 'doseEscalation'
   | 'unsureDose'
   | 'appointmentReminder'
   | 'refill'
   | 'proposal'
   | 'dailyPulse';

export type DeliveryStatus = 'sent' | 'failed' | 'recorded';

export interface NotificationRecord {
   id: string;
   profileId: string;
   toMemberId: string;
   toEmail: string;
   kind: NotificationKind;
   subject: string;
   body: string;
   status: DeliveryStatus;
   relatedId: string;
   at: number;
}

export interface AuditEntry {
   id: string;
   profileId: string;
   actorId: string;
   actorName: string;
   action: string;
   detail: string;
   at: number;
}

// ----- Generic helpers --------------------------------------------------

/** Outcome of a check that can fail with a message for the user. */
export type Result<T> =
   | { ok: true; value: T }
   | { ok: false; error: string };

/** Map from collection name to the record type it holds. */
export interface CollectionMap {
   members: Member;
   medications: Medication;
   doses: DoseRecord;
   appointments: Appointment;
   tasks: Task;
   handovers: HandoverNote;
   questions: DoctorQuestion;
   readings: HealthReading;
   documents: DocumentRecord;
   proposals: ChangeProposal;
   notifications: NotificationRecord;
   audit: AuditEntry;
}

export type CollectionName = keyof CollectionMap;
