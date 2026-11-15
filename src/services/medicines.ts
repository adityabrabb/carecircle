/**
 * Medicines.
 *
 * Purpose: apply changes to the medicine list under the consent rules.
 * The elder's own change takes effect at once. A helper's change is
 * held as a proposal until the elder approves it, unless the helper is
 * the person the elder trusted under the emergency plan and marks the
 * change urgent; that change takes effect and the elder is told. Side
 * effects: writes medicines, proposals and audit records; sends emails.
 */
import { appBaseUrl } from '@/config/env';
import { proposalEmail } from '@/domain/emails';
import {
   describeChange,
   medicationAfterApproval,
} from '@/domain/medicationForm';
import { can, isOwner, routeChange } from '@/domain/permissions';
import type {
   CareProfile,
   ChangeProposal,
   Medication,
   Member,
   ProposalKind,
   Result,
} from '@/domain/types';
import { recordAudit } from '@/services/audit';
import { sendToMember } from '@/services/email';
import { newId } from '@/services/ids';
import { getStore } from '@/store';

export type ChangeOutcome = 'applied' | 'proposed' | 'emergencyApplied';

/** Purpose: email the elder about a proposal or an emergency change. */
async function tellElder(
   profile: CareProfile,
   proposer: Member,
   changeText: string,
): Promise<void> {
   const members = await getStore().list('members', profile.id);
   const elder = members.find(
      (member) => member.role === 'elder' && member.active,
   );
   if (!elder || elder.email === '') {
      return;
   }
   await sendToMember(
      profile,
      elder,
      'proposal',
      proposalEmail(
         profile.elderName,
         proposer.name,
         changeText,
         `${appBaseUrl()}/medicines`,
      ),
      '',
   );
}

/**
 * Purpose: submit a medicine change on behalf of a member and report
 * whether it was applied, proposed, or applied under the emergency
 * plan.
 */
export async function submitChange(
   profile: CareProfile,
   member: Member,
   kind: ProposalKind,
   medication: Medication,
   note: string,
   urgent: boolean,
   now: number,
): Promise<Result<ChangeOutcome>> {
   const store = getStore();
   const route = routeChange(member, profile, urgent);
   const changeText = describeChange(kind, medication);
   if (route === 'deny') {
      return {
         ok: false,
         error: 'You are not allowed to change medicines.',
      };
   }
   if (route === 'apply') {
      await store.put(
         'medications',
         medicationAfterApproval(kind, medication, now),
      );
      await recordAudit(profile, member, 'Medicine changed', changeText);
      return { ok: true, value: 'applied' };
   }
   const proposal: ChangeProposal = {
      id: newId(),
      profileId: profile.id,
      kind,
      proposedById: member.id,
      medication: { ...medication, status: 'pendingApproval' },
      note,
      status: route === 'emergency' ? 'emergencyApplied' : 'pending',
      createdAt: now,
      decidedAt: route === 'emergency' ? now : 0,
   };
   await store.put('proposals', proposal);
   if (route === 'emergency') {
      await store.put(
         'medications',
         medicationAfterApproval(kind, medication, now),
      );
      await recordAudit(
         profile,
         member,
         'Emergency medicine change',
         changeText,
      );
      await tellElder(profile, member, `${changeText} (applied as urgent)`);
      return { ok: true, value: 'emergencyApplied' };
   }
   await recordAudit(profile, member, 'Change proposed', changeText);
   await tellElder(profile, member, changeText);
   return { ok: true, value: 'proposed' };
}

/**
 * Purpose: record the elder's decision on a pending proposal. Only the
 * elder can decide, and a proposal can be decided once.
 */
export async function decideProposal(
   profile: CareProfile,
   member: Member,
   proposalId: string,
   approve: boolean,
   now: number,
): Promise<Result<ChangeProposal>> {
   if (!isOwner(member, profile)) {
      return {
         ok: false,
         error: `Only ${profile.elderName} can decide this.`,
      };
   }
   const store = getStore();
   const proposal = await store.get('proposals', profile.id, proposalId);
   if (!proposal || proposal.status !== 'pending') {
      return { ok: false, error: 'That proposal is no longer waiting.' };
   }
   if (approve) {
      await store.put(
         'medications',
         medicationAfterApproval(proposal.kind, proposal.medication, now),
      );
   }
   const decided: ChangeProposal = {
      ...proposal,
      status: approve ? 'approved' : 'rejected',
      decidedAt: now,
   };
   await store.put('proposals', decided);
   await recordAudit(
      profile,
      member,
      approve ? 'Proposal approved' : 'Proposal rejected',
      describeChange(proposal.kind, proposal.medication),
   );
   return { ok: true, value: decided };
}

/**
 * Purpose: correct the stock count after a refill or a recount. This is
 * bookkeeping, not a change to treatment, so anyone who manages tasks
 * may do it.
 */
export async function setStock(
   profile: CareProfile,
   member: Member,
   medicationId: string,
   stock: number,
   now: number,
): Promise<Result<Medication>> {
   if (!can(member, 'manageTasks', profile)) {
      return { ok: false, error: 'You are not allowed to update stock.' };
   }
   const store = getStore();
   const medication = await store.get('medications', profile.id, medicationId);
   if (!medication) {
      return { ok: false, error: 'That medicine was not found.' };
   }
   const updated = { ...medication, stock, updatedAt: now };
   await store.put('medications', updated);
   await recordAudit(
      profile,
      member,
      'Stock updated',
      `${medication.name}: ${stock}`,
   );
   return { ok: true, value: updated };
}
