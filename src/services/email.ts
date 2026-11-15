/**
 * Email delivery.
 *
 * Purpose: send an email over SMTP and record what happened to it, so
 * every reminder has a delivery status the circle can check. Emails for
 * sample profiles, or when SMTP is not configured, are recorded but not
 * sent. A failed send is recorded as failed and never crashes the
 * caller. Side effects: network send, one notification record.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { smtpSettings } from '@/config/env';
import type { EmailContent } from '@/domain/emails';
import type {
   CareProfile,
   DeliveryStatus,
   Member,
   NotificationKind,
   NotificationRecord,
} from '@/domain/types';
import { nowFor } from '@/services/clock';
import { newId } from '@/services/ids';
import { getStore } from '@/store';

const SMTP_SECURE_PORT = 465;
const SEND_TIMEOUT_MS = 10_000;

interface TransportHolder {
   careCircleTransport?: Transporter;
}

/** Purpose: the shared SMTP transport, or null when not configured. */
function transport(): Transporter | null {
   const settings = smtpSettings();
   if (!settings) {
      return null;
   }
   const holder = globalThis as TransportHolder;
   if (!holder.careCircleTransport) {
      holder.careCircleTransport = nodemailer.createTransport({
         host: settings.host,
         port: settings.port,
         secure: settings.port === SMTP_SECURE_PORT,
         auth: { user: settings.user, pass: settings.pass },
         connectionTimeout: SEND_TIMEOUT_MS,
         socketTimeout: SEND_TIMEOUT_MS,
      });
   }
   return holder.careCircleTransport;
}

/** Purpose: try to deliver one email and report the outcome. */
async function deliver(
   to: string,
   content: EmailContent,
   isDemo: boolean,
): Promise<DeliveryStatus> {
   const mailer = isDemo ? null : transport();
   const settings = smtpSettings();
   if (!mailer || !settings) {
      return 'recorded';
   }
   try {
      await mailer.sendMail({
         from: `CareCircle <${settings.from}>`,
         to,
         subject: content.subject,
         text: content.text,
         html: content.html,
      });
      return 'sent';
   } catch (error) {
      console.error('Email send failed:', error);
      return 'failed';
   }
}

/**
 * Purpose: send an email to a member and store its delivery record.
 * Returns the record so the caller can count what was sent.
 */
export async function sendToMember(
   profile: CareProfile,
   member: Pick<Member, 'id' | 'email'>,
   kind: NotificationKind,
   content: EmailContent,
   relatedId: string,
): Promise<NotificationRecord> {
   const status = member.email
      ? await deliver(member.email, content, profile.isDemo)
      : 'failed';
   const record: NotificationRecord = {
      id: newId(),
      profileId: profile.id,
      toMemberId: member.id,
      toEmail: member.email,
      kind,
      subject: content.subject,
      body: content.text,
      status,
      relatedId,
      at: nowFor(profile),
   };
   await getStore().put('notifications', record);
   return record;
}
