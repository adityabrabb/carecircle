'use server';

/**
 * Appointment actions.
 *
 * Purpose: add doctor appointments, record what happened at a visit
 * (with an optional follow-up), cancel a visit, and keep the elder's
 * list of questions for the doctor.
 */
import { fail, field, succeed } from '@/app/actions/helpers';
import { can } from '@/domain/permissions';
import { localToInstant } from '@/domain/time';
import type { CareProfile, Member, Result } from '@/domain/types';
import {
   optionalText,
   parseLocalDateTime,
   requireName,
} from '@/domain/validation';
import { recordAudit } from '@/services/audit';
import { newId } from '@/services/ids';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/appointments';

/** Purpose: true when the member may add or change appointments. */
function mayManage(member: Member, profile: CareProfile): boolean {
   return (
      can(member, 'viewAppointments', profile) &&
      can(member, 'manageTasks', profile)
   );
}

/** Purpose: the instant of a date-time form value in local time. */
function parseWhen(
   raw: string,
   profile: CareProfile,
   label: string,
): Result<number> {
   const parsed = parseLocalDateTime(raw, label);
   if (!parsed.ok) {
      return parsed;
   }
   return {
      ok: true,
      value: localToInstant(
         parsed.value.dateKey,
         parsed.value.minutes,
         profile.utcOffsetMinutes,
      ),
   };
}

/** Purpose: add an upcoming appointment. */
export async function addAppointmentAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!mayManage(member, profile)) {
      fail(PAGE, 'You are not allowed to add appointments.');
   }
   const doctor = requireName(field(form, 'doctor'), 'Doctor');
   if (!doctor.ok) {
      fail(PAGE, doctor.error);
   }
   const when = parseWhen(field(form, 'at'), profile, 'Date and time');
   if (!when.ok) {
      fail(PAGE, when.error);
   }
   const speciality = optionalText(field(form, 'speciality'), 'Speciality');
   const location = optionalText(field(form, 'location'), 'Place');
   const notes = optionalText(field(form, 'notes'), 'Notes');
   if (!speciality.ok || !location.ok || !notes.ok) {
      fail(PAGE, 'One of the text fields is too long.');
   }
   await getStore().put('appointments', {
      id: newId(),
      profileId: profile.id,
      doctor: doctor.value,
      speciality: speciality.value,
      location: location.value,
      at: when.value,
      notes: notes.value,
      status: 'upcoming',
      outcome: '',
      remindersSent: [],
   });
   await recordAudit(profile, member, 'Appointment added', doctor.value);
   succeed(PAGE, 'Appointment added. Reminders will be emailed.');
}

/**
 * Purpose: record what the doctor said and close the visit. When a
 * follow-up date is given, the next appointment is created too.
 */
export async function completeAppointmentAction(
   form: FormData,
): Promise<void> {
   const { profile, member } = await requireContext();
   const id = field(form, 'appointmentId');
   const back = `${PAGE}/${id}`;
   if (!mayManage(member, profile)) {
      fail(back, 'You are not allowed to change appointments.');
   }
   const store = getStore();
   const appointment = await store.get('appointments', profile.id, id);
   if (!appointment) {
      fail(PAGE, 'That appointment was not found.');
   }
   const outcome = optionalText(field(form, 'outcome'), 'What the doctor said');
   if (!outcome.ok) {
      fail(back, outcome.error);
   }
   const followUpRaw = field(form, 'followUpAt');
   let followUpAt = 0;
   if (followUpRaw !== '') {
      const when = parseWhen(followUpRaw, profile, 'Follow-up date');
      if (!when.ok) {
         fail(back, when.error);
      }
      followUpAt = when.value;
   }
   await store.put('appointments', {
      ...appointment,
      status: 'done',
      outcome: outcome.value,
   });
   if (followUpAt > 0) {
      await store.put('appointments', {
         ...appointment,
         id: newId(),
         at: followUpAt,
         notes: 'Follow-up visit',
         status: 'upcoming',
         outcome: '',
         remindersSent: [],
      });
   }
   await recordAudit(profile, member, 'Visit recorded', appointment.doctor);
   succeed(
      PAGE,
      followUpAt > 0
         ? 'Visit recorded and follow-up added.'
         : 'Visit recorded.',
   );
}

/** Purpose: cancel an upcoming appointment. */
export async function cancelAppointmentAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!mayManage(member, profile)) {
      fail(PAGE, 'You are not allowed to change appointments.');
   }
   const store = getStore();
   const appointment = await store.get(
      'appointments',
      profile.id,
      field(form, 'appointmentId'),
   );
   if (!appointment || appointment.status !== 'upcoming') {
      fail(PAGE, 'That appointment cannot be cancelled.');
   }
   await store.put('appointments', { ...appointment, status: 'cancelled' });
   await recordAudit(profile, member, 'Appointment cancelled', appointment.doctor);
   succeed(PAGE, 'Appointment cancelled.');
}

/** Purpose: add a question to ask the doctor. */
export async function addQuestionAction(form: FormData): Promise<void> {
   const { profile, member, now } = await requireContext();
   if (!can(member, 'viewAppointments', profile)) {
      fail(PAGE, 'You are not allowed to add questions.');
   }
   const text = requireName(field(form, 'text'), 'Question');
   if (!text.ok) {
      fail(PAGE, text.error);
   }
   await getStore().put('questions', {
      id: newId(),
      profileId: profile.id,
      text:
         member.role === 'elder'
            ? text.value
            : `${text.value} (asked by ${member.name})`,
      at: now,
      answered: false,
   });
   succeed(PAGE, 'Question saved for the next visit.');
}

/** Purpose: mark a question as answered. */
export async function answerQuestionAction(form: FormData): Promise<void> {
   const { profile, member } = await requireContext();
   if (!can(member, 'viewAppointments', profile)) {
      fail(PAGE, 'You are not allowed to change questions.');
   }
   const store = getStore();
   const question = await store.get(
      'questions',
      profile.id,
      field(form, 'questionId'),
   );
   if (!question) {
      fail(PAGE, 'That question was not found.');
   }
   await store.put('questions', { ...question, answered: true });
   succeed(PAGE, 'Marked as answered.');
}
