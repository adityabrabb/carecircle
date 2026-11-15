/**
 * Environment settings.
 *
 * Purpose: read every environment variable in one place, with safe
 * defaults for local work. Secrets are never given a fixed fallback in
 * production: the app refuses to start signing with a known value.
 */
import { randomBytes } from 'node:crypto';

const MIN_SECRET_LENGTH = 32;
const DEFAULT_SMTP_PORT = 465;

interface DevSecretHolder {
   careCircleDevSecret?: string;
}

/** Purpose: read a variable as trimmed text, empty when unset. */
function read(name: string): string {
   return (process.env[name] ?? '').trim();
}

/** Purpose: true when running the production build. */
export function isProduction(): boolean {
   return process.env.NODE_ENV === 'production';
}

/**
 * Purpose: the secret that signs sessions and email links. In
 * production it must be set and long, whatever the storage backend: a
 * random per-process secret would sign everyone out on every restart.
 * In local work a random secret is made once per process, so nothing
 * guessable is ever used.
 */
export function sessionSecret(): string {
   const configured = read('SESSION_SECRET');
   if (configured.length >= MIN_SECRET_LENGTH) {
      return configured;
   }
   if (isProduction()) {
      throw new Error(
         'SESSION_SECRET must be set to at least 32 characters.',
      );
   }
   const holder = globalThis as DevSecretHolder;
   if (!holder.careCircleDevSecret) {
      holder.careCircleDevSecret = randomBytes(MIN_SECRET_LENGTH).toString(
         'hex',
      );
   }
   return holder.careCircleDevSecret;
}

/** Purpose: public address of the app, without a trailing slash. */
export function appBaseUrl(): string {
   const configured = read('APP_BASE_URL');
   return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Purpose: which storage backend to use. */
export function storeBackend(): 'memory' | 'firestore' {
   return read('STORE_BACKEND') === 'firestore' ? 'firestore' : 'memory';
}

export interface FirebaseCredentials {
   projectId: string;
   clientEmail: string;
   privateKey: string;
}

/**
 * Purpose: service account for Firestore, or null when the host hands
 * out credentials itself (Cloud Run does). FIREBASE_CREDENTIALS holds
 * the downloaded service-account JSON, or the same JSON encoded as
 * base64 for hosts that dislike multi-line secrets.
 */
export function firebaseCredentials(): FirebaseCredentials | null {
   const raw = read('FIREBASE_CREDENTIALS');
   if (!raw) {
      return null;
   }
   const text = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
   let parsed: Record<string, unknown>;
   try {
      parsed = JSON.parse(text) as Record<string, unknown>;
   } catch {
      throw new Error(
         'FIREBASE_CREDENTIALS must be service-account JSON, or that JSON encoded as base64.',
      );
   }
   const projectId = textField(parsed, 'project_id');
   const clientEmail = textField(parsed, 'client_email');
   const privateKey = textField(parsed, 'private_key', false);
   if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
         'FIREBASE_CREDENTIALS needs project_id, client_email and private_key.',
      );
   }
   // ----- A JSON paste keeps the escapes; a shell paste may not.
   return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
   };
}

/**
 * Purpose: read one field of the parsed service account as text. Names
 * and addresses are trimmed; the private key is left exactly as given,
 * because a lost trailing newline breaks the PEM block.
 */
function textField(
   source: Record<string, unknown>,
   name: string,
   trim = true,
): string {
   const value = source[name];
   if (typeof value !== 'string') {
      return '';
   }
   return trim ? value.trim() : value;
}

export interface SmtpSettings {
   host: string;
   port: number;
   user: string;
   pass: string;
   from: string;
}

/** Purpose: SMTP settings, or null when email is not configured. */
export function smtpSettings(): SmtpSettings | null {
   const host = read('SMTP_HOST');
   const user = read('SMTP_USER');
   const pass = read('SMTP_PASS');
   if (!host || !user || !pass) {
      return null;
   }
   const port = Number(read('SMTP_PORT')) || DEFAULT_SMTP_PORT;
   return { host, port, user, pass, from: read('SMTP_FROM') || user };
}

/** Purpose: Gemini API key, empty when AI features are off. */
export function geminiApiKey(): string {
   return read('GEMINI_API_KEY');
}

export interface VertexSettings {
   project: string;
   location: string;
}

/**
 * Purpose: Vertex AI settings, or null when Vertex is not switched on.
 * With Vertex the app uses its service account instead of an API key.
 */
export function vertexSettings(): VertexSettings | null {
   const project = read('GOOGLE_CLOUD_PROJECT');
   if (read('GEMINI_USE_VERTEX') !== 'true' || !project) {
      return null;
   }
   return { project, location: read('GEMINI_LOCATION') || 'global' };
}

/** Purpose: Gemini model name. */
export function geminiModel(): string {
   return read('GEMINI_MODEL') || 'gemini-2.5-flash';
}

/** Purpose: secret expected from the scheduler, empty when unset. */
export function cronSecret(): string {
   return read('CRON_SECRET');
}
