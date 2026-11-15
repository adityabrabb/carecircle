'use server';

/**
 * Settings actions.
 *
 * Purpose: the controls only the elder may use: who is in the circle,
 * what each person can see and do, pausing all sharing, the daily
 * routine, and the emergency plan and card. Every action checks that
 * the caller is the elder before changing anything.
 */
import { fail, field, fields, succeed } from '@/app/actions/helpers';
import { isOwner } from '@/domain/permissions';
import type { CareProfile, Member } from '@/domain/types';
import {
   optionalText,
   parseEmail,
   parseLanguage,
   parseRole,
   parseRoutine,
   requireName,
} from '@/domain/validation';
import { addMember, updateMemberAccess } from '@/services/accounts';
import { recordAudit } from '@/services/audit';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';

const PAGE = '/settings';

/** Purpose: the signed-in elder, or go back with an error. */
async function requireElder(): Promise<{
   profile: CareProfile;
   member: Member;
}> {
   const { profile, member } = await requireContext();
   if (!isOwner(member, profile)) {
      fail(PAGE, `Only ${profile.elderName} can change this.`);
   }
   return { profile, member };
}

/** Purpose: add a caretaker or family member to the circle. */
export async function addMemberAction(form: FormData): Promise<void> {
   const { profile, member } = await requireElder();
   const name = requireName(field(form, 'name'), 'Name');
   if (!name.ok) {
      fail(PAGE, name.error);
   }
   const role = parseRole(field(form, 'role'));
   if (!role.ok) {
      fail(PAGE, role.error);
   }
   const email = parseEmail(field(form, 'email'), false);
   if (!email.ok) {
      fail(PAGE, email.error);
   }
   const added = await addMember(
      profile,
      member,
      name.value,
      role.value,
      email.value,
      field(form, 'passcode'),
   );
   if (!added.ok) {
      fail(PAGE, added.error);
   }
   succeed(
      PAGE,
      `${name.value} added. Give them the circle code and their passcode.`,
   );
}

/** Purpose: change or remove one member's access. */
export async function updateAccessAction(form: FormData): Promise<void> {
   const { profile, member } = await requireElder();
   const updated = await updateMemberAccess(
      profile,
      member,
      field(form, 'memberId'),
      fields(form, 'permissions'),
      field(form, 'active') === 'on',
   );
   if (!updated.ok) {
      fail(PAGE, updated.error);
   }
   succeed(PAGE, `Access saved for ${updated.value.name}.`);
}

/** Purpose: pause or resume sharing with everyone in the circle. */
export async function toggleSharingAction(form: FormData): Promise<void> {
   const { profile, member } = await requireElder();
   const paused = field(form, 'paused') === 'true';
   await getStore().putProfile({ ...profile, sharingPaused: paused });
   await recordAudit(
      profile,
      member,
      paused ? 'Sharing paused' : 'Sharing resumed',
      '',
   );
   succeed(
      PAGE,
      paused
         ? 'Sharing is paused. Only you can see your profile.'
         : 'Sharing is on again.',
   );
}

/** Purpose: save the daily routine times and the elder's language. */
export async function saveRoutineAction(form: FormData): Promise<void> {
   const { profile, member } = await requireElder();
   const routine = parseRoutine(Object.fromEntries(form.entries()));
   if (!routine.ok) {
      fail(PAGE, routine.error);
   }
   await getStore().putProfile({
      ...profile,
      routine: routine.value,
      language: parseLanguage(field(form, 'language')),
   });
   await recordAudit(profile, member, 'Routine changed', '');
   succeed(PAGE, 'Routine saved. Dose times follow your routine.');
}

/** Purpose: save the emergency plan and emergency card. */
export async function saveEmergencyAction(form: FormData): Promise<void> {
   const { profile, member } = await requireElder();
   const texts = {
      instructions: optionalText(field(form, 'instructions'), 'Instructions'),
      bloodGroup: optionalText(field(form, 'bloodGroup'), 'Blood group'),
      allergies: optionalText(field(form, 'allergies'), 'Allergies'),
      conditions: optionalText(field(form, 'conditions'), 'Conditions'),
      doctorName: optionalText(field(form, 'doctorName'), 'Doctor'),
      doctorPhone: optionalText(field(form, 'doctorPhone'), 'Doctor phone'),
      emergencyContact: optionalText(
         field(form, 'emergencyContact'),
         'Emergency contact',
      ),
   };
   for (const result of Object.values(texts)) {
      if (!result.ok) {
         fail(PAGE, result.error);
      }
   }
   const store = getStore();
   const trustedId = field(form, 'trustedMemberId');
   const trusted = trustedId
      ? await store.get('members', profile.id, trustedId)
      : null;
   /** Purpose: the cleaned value of a checked text field. */
   const value = (key: keyof typeof texts): string => {
      const result = texts[key];
      return result.ok ? result.value : '';
   };
   await store.putProfile({
      ...profile,
      emergencyPlan: {
         trustedMemberId:
            trusted && trusted.role !== 'elder' ? trusted.id : null,
         allowUrgentChanges: field(form, 'allowUrgentChanges') === 'on',
         instructions: value('instructions'),
      },
      emergencyCard: {
         bloodGroup: value('bloodGroup'),
         allergies: value('allergies'),
         conditions: value('conditions'),
         doctorName: value('doctorName'),
         doctorPhone: value('doctorPhone'),
         emergencyContact: value('emergencyContact'),
         shareByLink: field(form, 'shareByLink') === 'on',
      },
   });
   await recordAudit(profile, member, 'Emergency plan changed', '');
   succeed(PAGE, 'Emergency plan saved.');
}
