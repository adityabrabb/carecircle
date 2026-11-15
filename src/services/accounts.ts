/**
 * Circles and members.
 *
 * Purpose: create a care circle, sign members in with the circle code
 * and their passcode, and let the elder manage who belongs. Side
 * effects: reads and writes profiles, members and audit records.
 */
import {
   ALL_PERMISSIONS,
   DEFAULT_PERMISSIONS,
   DEFAULT_ROUTINE,
   DEFAULT_UTC_OFFSET_MINUTES,
} from '@/constants/care';
import {
   afterAttempt,
   hashPasscode,
   isLocked,
   validatePasscode,
   verifyPasscode,
} from '@/domain/passcode';
import { sanitisePermissions } from '@/domain/permissions';
import type {
   CareProfile,
   Language,
   Member,
   Result,
   Role,
} from '@/domain/types';
import { recordAudit } from '@/services/audit';
import { newCircleCode, newId, normaliseCircleCode } from '@/services/ids';
import { getStore } from '@/store';

const GENERIC_SIGN_IN_ERROR = 'Circle code or passcode is not right.';
const LOCKED_ERROR =
   'Too many wrong attempts. Please wait 15 minutes and try again.';

/** Position of each role on the escalation ladder. */
const ESCALATION_BASE: Record<Role, number> = {
   elder: 0,
   caretaker: 100,
   family: 200,
};

export interface NewCircle {
   elderName: string;
   elderEmail: string;
   passcode: string;
   language: Language;
}

/** Purpose: a blank profile for a new elder, with default routine. */
export function blankProfile(
   elderName: string,
   language: Language,
   now: number,
): CareProfile {
   return {
      id: newId(),
      circleCode: newCircleCode(),
      elderName,
      language,
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
      createdAt: now,
   };
}

/** Purpose: a member record with a hashed passcode. */
export function buildMember(
   profileId: string,
   name: string,
   role: Role,
   email: string,
   passcode: string,
   position: number,
): Member {
   return {
      id: newId(),
      profileId,
      name,
      role,
      email,
      passcodeHash: hashPasscode(passcode),
      permissions: [...DEFAULT_PERMISSIONS[role]],
      escalationOrder: ESCALATION_BASE[role] + position,
      active: true,
   };
}

/**
 * Purpose: create a circle with the elder as its owner.
 * Returns the new profile and the elder's member record.
 */
export async function createCircle(
   input: NewCircle,
): Promise<Result<{ profile: CareProfile; elder: Member }>> {
   const passcode = validatePasscode(input.passcode);
   if (!passcode.ok) {
      return passcode;
   }
   const store = getStore();
   const profile = blankProfile(input.elderName, input.language, Date.now());
   const elder = buildMember(
      profile.id,
      input.elderName,
      'elder',
      input.elderEmail,
      passcode.value,
      0,
   );
   await store.putProfile(profile);
   await store.put('members', elder);
   await recordAudit(profile, elder, 'Circle created', profile.elderName);
   return { ok: true, value: { profile, elder } };
}

/**
 * Purpose: sign in with a circle code and passcode. The same message is
 * returned for an unknown code and a wrong passcode, and repeated wrong
 * attempts lock the circle for a while.
 */
export async function signIn(
   rawCode: string,
   passcode: string,
): Promise<Result<{ profile: CareProfile; member: Member }>> {
   const store = getStore();
   const profile = await store.getProfileByCode(normaliseCircleCode(rawCode));
   if (!profile) {
      return { ok: false, error: GENERIC_SIGN_IN_ERROR };
   }
   const now = Date.now();
   if (isLocked(profile, now)) {
      return { ok: false, error: LOCKED_ERROR };
   }
   const members = await store.list('members', profile.id);
   const member = members.find(
      (candidate) =>
         candidate.active && verifyPasscode(passcode, candidate.passcodeHash),
   );
   const lock = afterAttempt(profile, member !== undefined, now);
   if (
      lock.failedAttempts !== profile.failedAttempts ||
      lock.lockedUntil !== profile.lockedUntil
   ) {
      await store.putProfile({ ...profile, ...lock });
   }
   if (!member) {
      return { ok: false, error: GENERIC_SIGN_IN_ERROR };
   }
   return { ok: true, value: { profile, member } };
}

/**
 * Purpose: add a caretaker or family member. Only called for the elder.
 * Each member needs their own passcode, because the passcode is what
 * tells the app who is signing in.
 */
export async function addMember(
   profile: CareProfile,
   actor: Member,
   name: string,
   role: Role,
   email: string,
   rawPasscode: string,
): Promise<Result<Member>> {
   if (role === 'elder') {
      return { ok: false, error: 'A circle has one elder.' };
   }
   const passcode = validatePasscode(rawPasscode);
   if (!passcode.ok) {
      return passcode;
   }
   const store = getStore();
   const members = await store.list('members', profile.id);
   const taken = members.some((existing) =>
      verifyPasscode(passcode.value, existing.passcodeHash),
   );
   if (taken) {
      return {
         ok: false,
         error: 'Someone in this circle already uses that passcode.',
      };
   }
   const sameRole = members.filter((existing) => existing.role === role);
   const member = buildMember(
      profile.id,
      name,
      role,
      email,
      passcode.value,
      sameRole.length,
   );
   await store.put('members', member);
   await recordAudit(profile, actor, 'Member added', `${name} (${role})`);
   return { ok: true, value: member };
}

/**
 * Purpose: change what a member may see and do, or remove their access.
 * The elder's own record cannot be restricted or removed.
 */
export async function updateMemberAccess(
   profile: CareProfile,
   actor: Member,
   memberId: string,
   requestedPermissions: readonly string[],
   active: boolean,
): Promise<Result<Member>> {
   const store = getStore();
   const member = await store.get('members', profile.id, memberId);
   if (!member) {
      return { ok: false, error: 'That member was not found.' };
   }
   if (member.role === 'elder') {
      return { ok: false, error: 'The elder always has full access.' };
   }
   const updated: Member = {
      ...member,
      permissions: sanitisePermissions(requestedPermissions, ALL_PERMISSIONS),
      active,
   };
   await store.put('members', updated);
   await recordAudit(
      profile,
      actor,
      active ? 'Access changed' : 'Access removed',
      `${member.name}: ${updated.permissions.join(', ') || 'nothing'}`,
   );
   return { ok: true, value: updated };
}
