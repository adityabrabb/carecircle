/**
 * Audit log.
 *
 * Purpose: write down who did what and when, so the elder can always
 * see how their profile was used. Side effect: stores one audit record.
 */
import type { CareProfile, Member } from '@/domain/types';
import { nowFor } from '@/services/clock';
import { newId } from '@/services/ids';
import { getStore } from '@/store';

const MAX_DETAIL_LENGTH = 300;

/** Purpose: store one audit entry for an action by a member. */
export async function recordAudit(
   profile: CareProfile,
   actor: Pick<Member, 'id' | 'name'>,
   action: string,
   detail: string,
): Promise<void> {
   await getStore().put('audit', {
      id: newId(),
      profileId: profile.id,
      actorId: actor.id,
      actorName: actor.name,
      action,
      detail: detail.slice(0, MAX_DETAIL_LENGTH),
      at: nowFor(profile),
   });
}

/** The actor used for things the system does on its own. */
export const SYSTEM_ACTOR = { id: 'system', name: 'CareCircle' } as const;
