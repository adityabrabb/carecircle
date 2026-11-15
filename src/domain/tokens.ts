/**
 * Signed tokens.
 *
 * Purpose: create and check tamper-proof, expiring tokens. They carry
 * the login session in a cookie and power the one-tap links in reminder
 * emails, so an elder can confirm a dose without signing in while the
 * link still cannot be forged or reused after it expires.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenClaims {
   /** What the token is for: "session" or "dose". */
   purpose: string;
   profileId: string;
   memberId: string;
   /** Extra subject, such as the dose the link acts on. */
   subject: string;
   /** Instant after which the token is refused. */
   expiresAt: number;
}

/** Purpose: URL-safe base64 of a string. */
function encode(text: string): string {
   return Buffer.from(text, 'utf8').toString('base64url');
}

/** Purpose: HMAC-SHA256 signature of a payload, URL-safe. */
function signature(payload: string, secret: string): string {
   return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Purpose: build a signed token from its claims. */
export function signToken(claims: TokenClaims, secret: string): string {
   const payload = encode(JSON.stringify(claims));
   return `${payload}.${signature(payload, secret)}`;
}

/** Purpose: true when a decoded value has the shape of token claims. */
function isClaims(value: unknown): value is TokenClaims {
   if (typeof value !== 'object' || value === null) {
      return false;
   }
   const record = value as Record<string, unknown>;
   return (
      typeof record.purpose === 'string' &&
      typeof record.profileId === 'string' &&
      typeof record.memberId === 'string' &&
      typeof record.subject === 'string' &&
      typeof record.expiresAt === 'number'
   );
}

/**
 * Purpose: return the claims of a token, or null when the token is
 * malformed, has a wrong signature, is for another purpose, or has
 * expired. Never throws.
 */
export function verifyToken(
   token: string,
   secret: string,
   purpose: string,
   now: number,
): TokenClaims | null {
   const parts = token.split('.');
   const payload = parts[0];
   const given = parts[1];
   if (parts.length !== 2 || !payload || !given) {
      return null;
   }
   const expected = Buffer.from(signature(payload, secret));
   const actual = Buffer.from(given);
   if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
   ) {
      return null;
   }
   let claims: unknown;
   try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
   } catch {
      return null;
   }
   if (!isClaims(claims)) {
      return null;
   }
   if (claims.purpose !== purpose || claims.expiresAt <= now) {
      return null;
   }
   return claims;
}
