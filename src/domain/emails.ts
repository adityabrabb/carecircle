/**
 * Email content.
 *
 * Purpose: build the subject, plain text and HTML of every email the
 * app sends. Pure functions: nothing is sent here. All text that came
 * from a person is escaped before it goes into HTML.
 */
import { counted } from '@/domain/text';

export interface EmailContent {
   subject: string;
   text: string;
   html: string;
}

export interface EmailAction {
   label: string;
   url: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
   '&': '&amp;',
   '<': '&lt;',
   '>': '&gt;',
   '"': '&quot;',
   "'": '&#39;',
};

/** Purpose: make text safe to place inside HTML. */
export function escapeHtml(text: string): string {
   return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Purpose: wrap a message in the shared email layout: large text, one
 * heading, a list of lines and big buttons for the actions.
 */
export function layoutEmail(
   subject: string,
   heading: string,
   lines: readonly string[],
   actions: readonly EmailAction[],
): EmailContent {
   const textActions = actions
      .map((action) => `${action.label}: ${action.url}`)
      .join('\n');
   const text = [heading, '', ...lines, '', textActions, '', FOOTER]
      .join('\n')
      .trim();
   const htmlLines = lines
      .map(
         (line) =>
            `<p style="margin:0 0 12px;font-size:18px;">${escapeHtml(
               line,
            )}</p>`,
      )
      .join('');
   const htmlActions = actions
      .map(
         (action) =>
            `<p style="margin:16px 0;"><a href="${escapeHtml(action.url)}" ` +
            'style="display:inline-block;background:#1f6f6b;color:#ffffff;' +
            'font-size:20px;font-weight:bold;padding:16px 28px;' +
            'border-radius:12px;text-decoration:none;">' +
            `${escapeHtml(action.label)}</a></p>`,
      )
      .join('');
   const html =
      '<div style="font-family:Arial,sans-serif;color:#1e2a2e;' +
      'max-width:560px;margin:0 auto;padding:16px;">' +
      `<h1 style="font-size:24px;margin:0 0 16px;">${escapeHtml(
         heading,
      )}</h1>${htmlLines}${htmlActions}` +
      `<p style="font-size:14px;color:#4a3f36;margin-top:24px;">${escapeHtml(
         FOOTER,
      )}</p></div>`;
   return { subject, text, html };
}

const FOOTER =
   'CareCircle helps you keep track. It does not give medical advice. ' +
   'This email never asks for your passcode.';

export interface DoseLine {
   name: string;
   strength: string;
   foodNote: string;
}

/** Purpose: one line describing a dose, such as "Metformin 500 mg". */
function describeDose(dose: DoseLine): string {
   const food = dose.foodNote ? `, ${dose.foodNote}` : '';
   return `${dose.name} ${dose.strength}${food}`.trim();
}

/** Purpose: reminder to the elder that doses are due. */
export function doseReminderEmail(
   elderName: string,
   when: string,
   doses: readonly DoseLine[],
   confirmUrl: string,
): EmailContent {
   return layoutEmail(
      `Time for your ${when} medicines`,
      `${elderName}, it is time for your ${when} medicines`,
      doses.map(describeDose),
      [{ label: 'Open and confirm', url: confirmUrl }],
   );
}

/** Purpose: tell a caretaker or family member nobody has confirmed. */
export function escalationEmail(
   recipientName: string,
   elderName: string,
   dueText: string,
   doses: readonly DoseLine[],
   openUrl: string,
): EmailContent {
   return layoutEmail(
      `${elderName}: dose not confirmed yet`,
      `${recipientName}, a dose for ${elderName} is not confirmed`,
      [
         `Due at ${dueText}. Nobody has confirmed it yet.`,
         ...doses.map(describeDose),
         'This does not mean it was missed. Please check with them, then ' +
            'record what happened or tap "I am handling this".',
      ],
      [{ label: 'Open CareCircle', url: openUrl }],
   );
}

/** Purpose: tell caretakers the elder is not sure a dose was taken. */
export function unsureDoseEmail(
   recipientName: string,
   elderName: string,
   dose: DoseLine,
   openUrl: string,
): EmailContent {
   return layoutEmail(
      `${elderName} is not sure about a dose`,
      `${recipientName}, ${elderName} is not sure if a dose was taken`,
      [
         describeDose(dose),
         'They have been told not to take another dose to make up. ' +
            'Please check the strip or pill box with them.',
      ],
      [{ label: 'Open CareCircle', url: openUrl }],
   );
}

/** Purpose: reminder of a doctor appointment. */
export function appointmentEmail(
   recipientName: string,
   elderName: string,
   doctor: string,
   whenText: string,
   location: string,
   notes: string,
   openUrl: string,
): EmailContent {
   const lines = [`${doctor} on ${whenText}.`];
   if (location) {
      lines.push(`Where: ${location}`);
   }
   if (notes) {
      lines.push(`Remember: ${notes}`);
   }
   return layoutEmail(
      `Appointment for ${elderName}: ${doctor}, ${whenText}`,
      `${recipientName}, an appointment for ${elderName} is coming up`,
      lines,
      [{ label: 'See the visit brief', url: openUrl }],
   );
}

/** Purpose: tell the task owner a medicine is running low. */
export function refillEmail(
   recipientName: string,
   elderName: string,
   medicine: string,
   daysLeft: number,
   openUrl: string,
): EmailContent {
   const days = counted(daysLeft, 'day', 'days');
   return layoutEmail(
      `${medicine} is running low for ${elderName}`,
      `${recipientName}, ${medicine} will run out soon`,
      [
         `About ${days} of ${medicine} is left for ${elderName}.`,
         'A refill task has been added to the circle with your name on it.',
      ],
      [{ label: 'Open the task', url: openUrl }],
   );
}

/** Purpose: ask the elder to decide on a proposed medicine change. */
export function proposalEmail(
   elderName: string,
   proposerName: string,
   changeText: string,
   openUrl: string,
): EmailContent {
   return layoutEmail(
      `${proposerName} proposed a change to your medicines`,
      `${elderName}, a change needs your decision`,
      [
         `${proposerName} proposed: ${changeText}`,
         'Nothing changes until you approve it.',
      ],
      [{ label: 'Review and decide', url: openUrl }],
   );
}
