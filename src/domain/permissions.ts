/**
 * Permissions and consent.
 *
 * Purpose: the rules that keep the elder at the centre. The elder owns
 * the profile and can always see and do everything. Everyone else sees
 * only what the elder has allowed, sees nothing while sharing is
 * paused, and can only propose changes to medicines. A proposal takes
 * effect when the elder approves it, or under the emergency plan the
 * elder wrote in advance.
 */
import type {
   CareProfile,
   Member,
   Permission,
} from '@/domain/types';

/**
 * Purpose: true when the member may use the permission right now.
 * Inactive members have no access at all.
 */
export function can(
   member: Member,
   permission: Permission,
   profile: CareProfile,
): boolean {
   if (!member.active || member.profileId !== profile.id) {
      return false;
   }
   if (member.role === 'elder') {
      return true;
   }
   if (profile.sharingPaused) {
      return false;
   }
   return member.permissions.includes(permission);
}

/** Purpose: true when the member is the elder who owns the profile. */
export function isOwner(member: Member, profile: CareProfile): boolean {
   return (
      member.active &&
      member.role === 'elder' &&
      member.profileId === profile.id
   );
}

export type ChangeRoute = 'apply' | 'propose' | 'emergency' | 'deny';

/**
 * Purpose: decide what happens when a member changes a medicine.
 *   apply     - the elder's own change takes effect at once.
 *   emergency - the trusted member acts under the emergency plan; the
 *               change takes effect and is logged for the elder.
 *   propose   - the change waits for the elder's approval.
 *   deny      - the member may not change medicines.
 * Silence from the elder is never treated as approval: a proposal stays
 * pending until the elder decides.
 */
export function routeChange(
   member: Member,
   profile: CareProfile,
   urgent: boolean,
): ChangeRoute {
   if (isOwner(member, profile)) {
      return 'apply';
   }
   if (!can(member, 'proposeChanges', profile)) {
      return 'deny';
   }
   const plan = profile.emergencyPlan;
   if (
      urgent &&
      plan.allowUrgentChanges &&
      plan.trustedMemberId === member.id
   ) {
      return 'emergency';
   }
   return 'propose';
}

/**
 * Purpose: the list of permissions the member effectively has, used by
 * the "what my family sees" preview.
 */
export function effectivePermissions(
   member: Member,
   profile: CareProfile,
   all: readonly Permission[],
): Permission[] {
   return all.filter((permission) => can(member, permission, profile));
}

/**
 * Purpose: keep only permissions that exist, without repeats, so a
 * tampered form cannot grant something unknown.
 */
export function sanitisePermissions(
   requested: readonly string[],
   all: readonly Permission[],
): Permission[] {
   return all.filter((permission) => requested.includes(permission));
}
