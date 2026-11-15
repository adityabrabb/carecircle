/**
 * Record file download.
 *
 * Purpose: send the original file of one medical record to a signed-in
 * member the elder allowed to see records. Each opening is logged for the
 * elder. Files are shown inline only for PDFs and pictures; everything
 * else is downloaded.
 */
import { isInlineType, safeFileName } from '@/domain/documentForm';
import { can } from '@/domain/permissions';
import { recordAudit } from '@/services/audit';
import { getContext } from '@/services/session';
import { getStore } from '@/store';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Purpose: a short JSON error with the given status code. */
function jsonError(status: number, message: string): Response {
   return new Response(JSON.stringify({ error: message }), {
      status,
      headers: JSON_HEADERS,
   });
}

/**
 * Purpose: the record's bytes with headers that keep the browser safe.
 * Side effect: writes one audit entry for the opening.
 */
export async function GET(
   _request: Request,
   { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
   const context = await getContext();
   if (!context) {
      return jsonError(401, 'Sign in to open this record.');
   }
   const { profile, member } = context;
   if (!can(member, 'viewDocuments', profile)) {
      return jsonError(403, 'You are not allowed to open records.');
   }
   const { id } = await params;
   const document = await getStore().get('documents', profile.id, id);
   if (!document) {
      return jsonError(404, 'That record was not found.');
   }
   await recordAudit(profile, member, 'Record opened', document.title);
   const bytes = Buffer.from(document.data, 'base64');
   const disposition = isInlineType(document.mime) ? 'inline' : 'attachment';
   const fileName = safeFileName(document.title, document.mime);
   return new Response(new Uint8Array(bytes), {
      headers: {
         'Content-Type': document.mime,
         'Content-Disposition': `${disposition}; filename="${fileName}"`,
         'X-Content-Type-Options': 'nosniff',
         'Cache-Control': 'private, no-store',
      },
   });
}
