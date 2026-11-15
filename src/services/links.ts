/**
 * Signed links.
 *
 * Purpose: build and check the signed addresses the app hands out: the
 * emergency card link and the one-tap dose links in reminder emails.
 */
import { sessionSecret } from '@/config/env';
import { MS_PER_DAY } from '@/constants/care';
import {
   signToken,
   verifyToken,
   type TokenClaims,
} from '@/domain/tokens';
import type { CareProfile } from '@/domain/types';

const CARD_LINK_DAYS = 365;

/** Purpose: the path of the elder's emergency card. */
export function emergencyCardPath(profile: CareProfile): string {
   const token = signToken(
      {
         purpose: 'emergency',
         profileId: profile.id,
         memberId: '',
         subject: '',
         expiresAt: Date.now() + CARD_LINK_DAYS*MS_PER_DAY,
      },
      sessionSecret(),
   );
   return `/emergency/${token}`;
}

/** Purpose: the claims of an emergency card token, or null. */
export function readEmergencyToken(token: string): TokenClaims | null {
   return verifyToken(token, sessionSecret(), 'emergency', Date.now());
}

/** Purpose: the claims of an email dose link token, or null. */
export function readDoseToken(token: string): TokenClaims | null {
   return verifyToken(token, sessionSecret(), 'dose', Date.now());
}
