/**
 * Medical records.
 *
 * Purpose: the circle's shelf of prescriptions, lab reports and discharge
 * summaries. Members the elder allowed can search the records, open the
 * original file, and (when permitted) add a record or a short summary.
 * Only the elder can delete a record.
 */
import type { Metadata } from 'next';
import {
   deleteDocumentAction,
   saveSummaryAction,
   uploadDocumentAction,
} from '@/app/actions/records';
import {
   ALLOWED_DOCUMENT_TYPES,
   MAX_DOCUMENT_BYTES,
   MAX_TEXT_LENGTH,
} from '@/constants/care';
import { DOCUMENT_LABELS } from '@/constants/labels';
import { Notice, type NoticeParams } from '@/components/Notice';
import { filterDocuments } from '@/domain/documentForm';
import { can, isOwner } from '@/domain/permissions';
import { formatLocal } from '@/domain/time';
import { requireContext } from '@/services/session';
import { getStore } from '@/store';
import { counted } from '@/domain/text';

export const metadata: Metadata = { title: 'Medical records' };

const BYTES_PER_KILOBYTE = 1_000;
const DOCUMENT_KIND_OPTIONS = Object.entries(DOCUMENT_LABELS);

interface RecordsParams extends NoticeParams {
   q?: string;
   kind?: string;
}

export default async function RecordsPage({
   searchParams,
}: {
   searchParams: Promise<RecordsParams>;
}) {
   const { profile, member } = await requireContext();
   const params = await searchParams;
   const notice = <Notice params={params} />;
   if (!can(member, 'viewDocuments', profile)) {
      return (
         <>
            {notice}
            <div className="page-head">
               <h1>Medical records</h1>
            </div>
            <p className="card">
               {profile.elderName} has not shared medical records with you.
            </p>
         </>
      );
   }
   const store = getStore();
   const [documents, members] = await Promise.all([
      store.list('documents', profile.id),
      store.list('members', profile.id),
   ]);
   const query = typeof params.q === 'string' ? params.q : '';
   const kind = typeof params.kind === 'string' ? params.kind : '';
   const found = filterDocuments(documents, query, kind);
   const mayUpload = can(member, 'manageTasks', profile);
   const mayDelete = isOwner(member, profile);
   const when = (at: number): string =>
      formatLocal(at, profile.utcOffsetMinutes);
   const uploaderName = (id: string): string =>
      members.find((candidate) => candidate.id === id)?.name ??
      'a former member';
   const countText =
      counted(found.length, 'record', 'records');

   return (
      <>
         <div className="page-head">
            <h1>Medical records</h1>
            <p>
               Prescriptions, lab reports and discharge summaries. The
               summary is a short note; always check it against the
               original file.
            </p>
         </div>
         {notice}

         <section className="card" aria-labelledby="search-title">
            <h2 id="search-title">Find a record</h2>
            <form method="get" className="field-grid">
               <div>
                  <label htmlFor="q">Search words</label>
                  <input
                     id="q"
                     name="q"
                     type="search"
                     defaultValue={query}
                     maxLength={80}
                  />
               </div>
               <div>
                  <label htmlFor="kind">Kind</label>
                  <select id="kind" name="kind" defaultValue={kind}>
                     <option value="">All kinds</option>
                     {DOCUMENT_KIND_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                           {label}
                        </option>
                     ))}
                  </select>
               </div>
               <button className="btn" type="submit">
                  Search
               </button>
            </form>
         </section>

         <section aria-labelledby="list-title">
            <h2 id="list-title">Records</h2>
            <p className="muted" aria-live="polite">
               {countText}
            </p>
            {documents.length === 0 ? (
               <p className="card">No records yet.</p>
            ) : null}
            {documents.length > 0 && found.length === 0 ? (
               <p className="card">No records match your search.</p>
            ) : null}
            <div className="grid">
               {found.map((document) => (
                  <article className="card" key={document.id}>
                     <h3>{document.title}</h3>
                     <p>
                        <span className="chip info">
                           {DOCUMENT_LABELS[document.kind]}
                        </span>{' '}
                        {when(document.at)}
                     </p>
                     <p className="small">
                        Added by {uploaderName(document.uploadedById)}
                     </p>
                     {document.summary ? (
                        <p>{document.summary}</p>
                     ) : (
                        <p className="hint">No summary yet.</p>
                     )}
                     <div className="row">
                        <a
                           className="btn small-btn"
                           href={`/records/${document.id}/file`}
                        >
                           Open file
                           <span className="visually-hidden">
                              {` for ${document.title}`}
                           </span>
                        </a>
                        {mayDelete ? (
                           <form action={deleteDocumentAction}>
                              <input
                                 type="hidden"
                                 name="documentId"
                                 value={document.id}
                              />
                              <button
                                 className="btn danger small-btn"
                                 type="submit"
                              >
                                 Delete record
                                 <span className="visually-hidden">
                                    {` ${document.title}`}
                                 </span>
                              </button>
                           </form>
                        ) : null}
                     </div>
                     {mayUpload ? (
                        <details>
                           <summary>Edit summary</summary>
                           <form
                              className="stack"
                              action={saveSummaryAction}
                           >
                              <input
                                 type="hidden"
                                 name="documentId"
                                 value={document.id}
                              />
                              <div>
                                 <label htmlFor={`summary-${document.id}`}>
                                    Summary
                                 </label>
                                 <textarea
                                    id={`summary-${document.id}`}
                                    name="summary"
                                    maxLength={MAX_TEXT_LENGTH}
                                    defaultValue={document.summary}
                                 />
                              </div>
                              <button className="btn" type="submit">
                                 Save summary
                              </button>
                           </form>
                        </details>
                     ) : null}
                  </article>
               ))}
            </div>
         </section>

         {mayUpload ? (
            <section className="card" aria-labelledby="upload-title">
               <h2 id="upload-title">Add a record</h2>
               <form className="stack" action={uploadDocumentAction}>
                  <div className="field-grid">
                     <div>
                        <label htmlFor="record-title">Title</label>
                        <input
                           id="record-title"
                           name="title"
                           type="text"
                           required
                           maxLength={80}
                        />
                     </div>
                     <div>
                        <label htmlFor="record-kind">Kind</label>
                        <select id="record-kind" name="kind">
                           {DOCUMENT_KIND_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>
                                 {label}
                              </option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <div>
                     <label htmlFor="record-file">File</label>
                     <input
                        id="record-file"
                        name="file"
                        type="file"
                        required
                        accept={ALLOWED_DOCUMENT_TYPES.join(',')}
                        aria-describedby="record-file-hint"
                     />
                     <p className="hint" id="record-file-hint">
                        PDF, JPEG, PNG or WebP, up to{' '}
                        {MAX_DOCUMENT_BYTES / BYTES_PER_KILOBYTE} KB. Check
                        any summary against the original.
                     </p>
                  </div>
                  <div>
                     <label htmlFor="record-summary">Short summary</label>
                     <textarea
                        id="record-summary"
                        name="summary"
                        maxLength={MAX_TEXT_LENGTH}
                     />
                  </div>
                  <button className="btn" type="submit">
                     Save record
                  </button>
               </form>
            </section>
         ) : null}
      </>
   );
}
