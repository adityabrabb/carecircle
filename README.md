# CareCircle

CareCircle is a care app where an older person owns their medicines, appointments and health record. Family and caretakers can see what the elder allows, propose changes and get reminders, without taking over the decisions.

Live app: (see the deployment link in the submission)

## Try it

1. **Try the sample family.** On the landing page, select "Try the sample family". The app builds a new sample circle with an elder, a caretaker and a family member, then signs you in as the elder. Nothing in it is real. Emails for a sample circle are recorded in the delivery log but never sent. The scheduled check deletes sample circles after one day.
2. **View as.** On a sample circle, the sample family bar shows a "View as:" control. Use it to sign in as the caretaker or the family member and see what they see.
3. **Clock skip.** The "Move clock" buttons (+30 min, +1 hour, +3 hours, +1 day) move the sample circle's clock forward and run the reminder check. Follow one medicine to watch a missed dose escalate:
   - Skip forward past a dose's due time. The elder gets the reminder email.
   - Skip further. If the dose is still unconfirmed 30 minutes late, the caretaker is emailed. At 60 minutes late, the family is emailed.
   - Skips that land in quiet hours (22:00 to 07:00) wait, unless the medicine is marked critical.
   - Confirm the dose, or mark that you are handling it, and the ladder stops.

## How it meets the problem statement

> "Develop a smart, interconnected healthcare management platform designed to help elderly individuals manage their daily medications, medical appointments, and healthcare routines while keeping their family members and caretakers informed. The platform should provide a shared ecosystem where elderly individuals, caretakers, and family members can access and manage an elderly person's healthcare profile through secure, passcode-based access. Authorized members should be able to view, add, edit, and manage medication schedules, track adherence, and monitor upcoming doctor appointments. The system should proactively send email reminders for missed medications, upcoming doses, and medical appointments. The challenge is to go beyond a basic reminder application: make elderly care smarter, more accessible, reliable, and collaborative, while ensuring that elderly individuals remain at the centre of their own healthcare decisions."

| Requirement | How CareCircle does it | Where in the code |
|---|---|---|
| Passcode-based shared access | Each circle has a short code. Each member signs in with the code and their own passcode. Passcodes are stored as salted scrypt hashes. Five wrong tries lock the member out for 15 minutes. | `src/services/accounts.ts`, `src/domain/passcode.ts` |
| View, add and edit medication schedules | Members with the permission can view medicines. The elder adds and edits them directly. Other members propose changes. Doses follow the elder's daily routine. | `src/app/medicines/page.tsx`, `src/app/actions/medicines.ts`, `src/domain/medicationForm.ts`, `src/domain/schedule.ts` |
| Track adherence | Each dose has one of four answers: taken, skipped by choice, not sure, or unconfirmed. Silence is never recorded as missed. The summary keeps unconfirmed apart from skipped. A weekly chart can be printed. | `src/domain/doses.ts`, `src/domain/adherence.ts`, `src/app/medicines/chart/page.tsx` |
| Monitor doctor appointments | Appointments have a date, location and questions for the doctor. Reminders go out the day before and two hours before. A visit brief lists what changed since the last visit. | `src/app/actions/appointments.ts`, `src/services/reminders.ts`, `src/domain/visitBrief.ts` |
| Email reminders for upcoming doses, missed doses and appointments | The reminder check emails the elder when a dose is due. It escalates unconfirmed doses to caretakers, then family. It sends appointment reminders. Each email is sent once and tracked on its record. Emails go over SMTP. | `src/services/reminders.ts`, `src/domain/escalation.ts`, `src/services/email.ts`, `src/domain/emails.ts` |
| Elder at the centre | The elder owns the profile and can do everything. Others see only what the elder allows. Pausing sharing hides everything and stops escalation emails. Changes proposed by others wait for the elder's approval, unless the elder's emergency plan allows an urgent change. A preview shows the elder what each member sees. | `src/domain/permissions.ts`, `src/app/actions/settings.ts`, `src/app/settings/preview/[memberId]/page.tsx`, `src/services/medicines.ts` |

## Beyond a reminder app

### Smarter

- **Four dose answers.** Taken, skipped by choice, "not sure if I took it", or unconfirmed. Each confirmed dose records how it was known: by the elder (`self`), seen by someone (`observed`), or assumed. `src/domain/doses.ts`, `src/domain/types.ts`
- **Routine-based timing.** Doses are tied to the elder's routine (wake, breakfast, lunch, evening, dinner, sleep) and to food rules. Changing the routine moves every dose. `src/domain/schedule.ts`, `src/constants/care.ts`
- **Pattern detection.** Flags a time of day missed three times in seven days, a run of three rising readings, and two or more "not sure" answers. Each point is a plain fact with a suggestion to raise with the doctor. `src/domain/patterns.ts`
- **Refill forecast.** Estimates when each medicine runs out. Stock falls only when a dose is confirmed as taken, so a missed dose never makes the forecast too pessimistic. Warns within seven days. `src/domain/refill.ts`
- **Prescription reading with human confirmation.** Gemini reads a prescription photo or PDF into draft medicines. The domain code checks the reply. Nothing is saved until a person confirms each draft in the normal medicine form. `src/services/gemini.ts`, `src/domain/prescriptionParse.ts`, `src/app/actions/scan.ts`
- **Ask the record, with sources.** A question box answers from stored records only, and links each fact to where it lives. When no rule understands a question, the answer says so instead of guessing. When the rules fail and a Gemini key is set, Gemini answers from numbered facts only. `src/domain/assistant.ts`, `src/app/ask/page.tsx`, `src/services/assistantAi.ts`
- **Visit brief.** Builds the summary for a doctor visit from adherence, medicine changes, readings, symptoms, patterns and the elder's own questions. `src/domain/visitBrief.ts`
- **Daily pulse.** Three short lists: on track, needs attention, and coming up. `src/domain/pulse.ts`

### More accessible

- **Read aloud in Hindi or English.** The browser's speech feature reads a dose or a page aloud. The page language follows the elder's setting. `src/components/SpeakButton.tsx`, `src/domain/validation.ts`, `src/app/layout.tsx`
- **Printable weekly chart.** A large-print grid of the week's doses with a box to tick, built from the same schedule as the reminders. Made for the fridge. `src/app/medicines/chart/page.tsx`, `src/components/PrintButton.tsx`
- **One tap from the email.** The reminder email links to a page that needs no sign-in. The signed link names the person. Opening the page records nothing. A dose is recorded only when a button is pressed. `src/app/dose/[token]/page.tsx`, `src/services/links.ts`
- **Text-size switch.** A larger text setting, saved in a cookie. `src/app/actions/auth.ts`, `src/app/layout.tsx`
- **Emergency card.** A page for anyone holding the link. It shows only what the elder chose to print, plus current medicines. It works only while link sharing is on. `src/app/emergency/[token]/page.tsx`, `src/app/actions/settings.ts`

### More reliable

- **Escalation ladder with quiet hours.** The elder is reminded when a dose is due. The caretaker hears 30 minutes late. The family hears 60 minutes late. Each step is one email. Escalation waits during quiet hours unless the medicine is critical. `src/domain/escalation.ts`
- **Safe to run often.** The reminder check sends each email once and stops when a dose is taken, skipped, or acknowledged. The home page also runs the check when it has not run recently, so reminders still go out if the scheduler is late. `src/services/reminders.ts`
- **Delivery log.** Every email records whether it was sent, recorded only, or failed. A failed send never crashes the check. `src/services/email.ts`, `src/app/circle/page.tsx`
- **No double confirmation.** A dose can be confirmed once, which guards against doubling up. `src/domain/doses.ts`
- **Automatic refill tasks.** A low medicine raises a care task with a named owner. `src/services/reminders.ts`, `src/domain/tasks.ts`
- **Audit log.** Changes and every opening of a medical record are written to a log the elder can read. `src/services/audit.ts`, `src/app/settings/page.tsx`

### More collaborative

- **Care tasks with a named owner and backup.** Each task has one owner and an optional backup. Both must be active members of the circle, and the backup must be a different person. Finished tasks and open tasks sit in one place. The summary does not score or rank anyone. `src/domain/taskForm.ts`, `src/domain/tasks.ts`, `src/app/actions/circle.ts`
- **Handover notes.** Notes passed between caretakers. `src/app/actions/circle.ts`, `src/app/circle/page.tsx`
- **"I am handling it".** A member can say they are handling an unconfirmed dose. That stops the escalation for it. `src/app/actions/doses.ts`, `src/domain/escalation.ts`
- **Shared records.** A medical record (PDF or picture) is opened by members the elder allows. Each opening is logged. `src/app/records/page.tsx`, `src/app/records/[id]/file/route.ts`
- **One timeline.** Doses, readings, visits, handovers, records, tasks and medicine changes in one list, newest first. Unconfirmed doses and future events are left out. `src/domain/timeline.ts`

### Elder at the centre

- **Proposals the elder approves.** A caretaker or family member proposes a medicine change. It takes effect only when the elder approves it. `src/services/medicines.ts`, `src/app/actions/medicines.ts`, `src/domain/permissions.ts`
- **Emergency plan.** The elder names who may make an urgent medicine change in an emergency. The change takes effect at once and the elder is told. `src/app/actions/settings.ts`, `src/services/medicines.ts`
- **"What my family sees" preview.** The elder picks any member and sees exactly what that member can view and do right now. `src/app/settings/preview/[memberId]/page.tsx`
- **Pause sharing.** One switch hides the circle from everyone and stops escalation emails. `src/app/actions/settings.ts`, `src/domain/escalation.ts`
- **Per-member access.** The elder turns each of seven permissions on or off per member. `src/constants/care.ts`, `src/app/actions/settings.ts`
- **Routine and language.** The elder sets the daily routine times and the language (English or Hindi). `src/app/actions/settings.ts`

## Google services

| Service | What it does in CareCircle | Where in the code |
|---|---|---|
| Cloud Run | Runs the Next.js app as a container. The Dockerfile builds a standalone server that runs as a non-root user on port 8080. | `Dockerfile`, `next.config.ts` |
| Firestore | Stores profiles as top-level documents. Every other record is in a sub-collection of its profile, so each read stays inside one circle. Enabled with `STORE_BACKEND=firestore`. | `src/store/firestoreStore.ts`, `src/store/index.ts` |
| Gemini API | Reads prescription photos and PDFs into draft medicines (JSON, temperature 0). Answers "ask the record" questions the rules cannot answer, from numbered facts only. Model set by `GEMINI_MODEL`. | `src/services/gemini.ts`, `src/services/assistantAi.ts` |
| Cloud Scheduler | Calls `POST /api/cron/tick` every five minutes with the `x-cron-secret` header. The route checks the secret in constant time, runs the reminder check for every profile, and deletes sample circles older than one day. | `src/app/api/cron/tick/route.ts` |

## Architecture

The code has four layers.

| Layer | Folder | Role |
|---|---|---|
| Domain | `src/domain/` | Pure rules and types. No I/O and no clock. The rules are unit tested. Functions that can fail return a `Result`. |
| Services | `src/services/` | I/O: sessions, email, Gemini, reminders, and the reads and writes behind each action. |
| Store | `src/store/` | One `Store` interface. Memory for local work and tests. Firestore on Cloud Run. Every call takes a profile ID. |
| App | `src/app/` | Pages (server components), server actions, and two route handlers (the scheduler and record downloads). |

```
src/
  app/          pages, server actions, API and file routes
  components/   small shared UI pieces (chart, dose card, print and speak buttons)
  config/       reads environment variables in one place
  constants/    named numbers and fixed lists used by the rules
  domain/       pure rules and types (tested)
  services/     I/O: sessions, email, Gemini, reminders, audit
  store/        Store interface, memory and Firestore backends
tests/          Vitest unit tests
.github/        CI workflow
```

## Security

- Passcodes are hashed with scrypt and a random salt. Plain text is never stored. `src/domain/passcode.ts`
- Five wrong passcodes lock a member out for 15 minutes. `src/constants/care.ts`
- The session is a signed cookie: HMAC-SHA256, HTTP-only, `SameSite=Lax`, `Secure` in production, and it expires after 12 hours. `src/services/session.ts`, `src/domain/tokens.ts`
- Email links are signed and expire after 12 hours. A dose link can only record a dose when its button is pressed. The dose and emergency pages are marked `noindex`. `src/services/links.ts`, `src/app/dose/[token]/page.tsx`
- Each store call is scoped to one profile. Records from another circle cannot be read. `src/store/store.ts`
- Server actions check permission on the server before they write. Hiding a control on the page is never the only check. `src/domain/permissions.ts`
- All input is checked and cleaned before it is stored: names, text, numbers, clock times, emails and dates. `src/domain/validation.ts`
- Email text that comes from a person is HTML-escaped. `src/domain/emails.ts`
- Uploads are checked for type and size. Medical records accept PDF, JPEG, PNG and WebP up to 700 KB. Medicine photos are images up to 150 KB. Server action bodies are limited to 2 MB. `src/domain/documentForm.ts`, `src/app/actions/medicines.ts`, `next.config.ts`
- Record downloads are sent with `Content-Disposition`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. Only PDFs and pictures open inline. `src/app/records/[id]/file/route.ts`
- Every response carries security headers: a Content Security Policy, `X-Frame-Options: DENY`, HSTS, a referrer policy and a permissions policy. The production policy allows scripts from the same origin and inline scripts only, which Next.js needs. No third-party scripts are loaded. `next.config.ts`
- The audit log records who changed what and when. `src/services/audit.ts`
- Secrets come from environment variables only. In production with Firestore, the app will not start sessions unless `SESSION_SECRET` is at least 32 characters. Local work uses a random secret made for each process. `src/services/session.ts`, `src/config/env.ts`
- The scheduler endpoint refuses every request when `CRON_SECRET` is not set. `src/app/api/cron/tick/route.ts`

## Accessibility

- One `h1` per page, then `h2` and `h3` in order. Sections are labelled by their headings. `src/app/layout.tsx`
- A skip link goes to the main content as the first keyboard stop. `src/app/layout.tsx`, `src/app/globals.css`
- Every input has a label. Tables have captions and header scopes.
- A visible focus outline on interactive elements. `src/app/globals.css`
- Large touch targets for the main actions (`btn huge`). `src/app/globals.css`
- Text-size switch for larger text. `src/app/actions/auth.ts`
- Status is shown by word and symbol, not colour alone. A taken dose shows a check mark with its word, and a "not sure" dose shows a question mark with its word. `src/components/DoseCard.tsx`
- Notices use `role="status"` so screen readers announce them. `src/components/Notice.tsx`
- Charts have a data table beside them, with a visually hidden caption. `src/app/health/page.tsx`, `src/app/medicines/chart/page.tsx`
- Forms are server actions with redirects, so most work without client JavaScript. Read aloud, print and the prescription scan panel use small client components.
- Reduced motion is respected: animations and transitions are removed when the user asks for it. `src/app/globals.css`
- Print styles: the weekly chart prints without the navigation, and controls marked `no-print` are hidden. `src/app/globals.css`
- The page language matches the elder's language setting (English or Hindi). `src/app/layout.tsx`

No automated accessibility audit runs in CI.

## Testing

Run the unit tests:

```bash
npm test
```

The suite runs with Vitest in Node. It has **249 tests in 12 files**, all under `tests/`. The suites cover:

| Suite | What it covers |
|---|---|
| `access.test.ts` | Passcode hashing and checks, signed tokens, permissions and consent |
| `doses.test.ts` | Dose confirmation, adherence, refill forecast, escalation |
| `schedule.test.ts` | Local time and the routine-based medicine schedule |
| `patterns.test.ts` | Pattern detection and the visit brief |
| `overview.test.ts` | Daily pulse and the care timeline |
| `assistant.test.ts` | Ask-the-records answers and the fact list for Gemini |
| `prescriptionParse.test.ts` | Checking Gemini output and comparing it with the current list |
| `medicationForm.test.ts` | Medicine form checks and the wording of medicine changes |
| `readingForm.test.ts` | Health reading form and chart series |
| `documentForm.test.ts` | Record upload checks, search and safe download names |
| `taskForm.test.ts` | Creating, completing and reassigning care tasks |
| `support.test.ts` | Input validation, care tasks, email content and the in-memory store |

The tests cover normal cases, edge cases, and failures such as bad input and missing permission. They use the builders in `tests/fixtures.ts`.

## Run locally

Prerequisites: Node.js 22 (or 20 or later) and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Local work uses the in-memory store (`STORE_BACKEND=memory`), so no database is needed. Data resets when the server restarts.

To try Firestore locally, set `STORE_BACKEND=firestore` and paste a Firebase service-account JSON into `FIREBASE_CREDENTIALS`.

To run every check the CI runs, except the production build:

```bash
npm run check
```

`npm run check` runs lint, the type check and the unit tests. To run the production build the way a host does:

```bash
npm run build
npm start
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. Only `SESSION_SECRET` and `CRON_SECRET` are needed for production. The others are optional.

| Variable | Needed for | Notes |
|---|---|---|
| `SESSION_SECRET` | Signing sessions and email links | Required in production. At least 32 random characters. |
| `APP_BASE_URL` | Links in reminder emails | Public address of the app. Defaults to `http://localhost:3000`. |
| `STORE_BACKEND` | Storage choice | `memory` (default) or `firestore`. |
| `GOOGLE_CLOUD_PROJECT` | Firestore on Cloud Run | Your Google Cloud project ID. Not needed when `FIREBASE_CREDENTIALS` is set. |
| `FIREBASE_CREDENTIALS` | Firestore on any other host | The service-account JSON, or that JSON encoded as base64. On Cloud Run leave it empty. |
| `GEMINI_API_KEY` | Prescription reading and "ask the record" fallback | Optional. Without it, prescriptions are typed in by hand and answers are rule based only. |
| `GEMINI_MODEL` | Gemini model name | Defaults to `gemini-2.5-flash`. |
| `GEMINI_USE_VERTEX` | Gemini through Vertex AI on Google Cloud | Set to `true` only on Cloud Run. It needs billing. |
| `GEMINI_LOCATION` | Vertex AI location | Defaults to `global`. |
| `SMTP_HOST` | Sending email | Optional. Without SMTP, emails are recorded in the delivery log and not sent. |
| `SMTP_PORT` | Sending email | Defaults to 465. |
| `SMTP_USER` | Sending email | SMTP login. |
| `SMTP_PASS` | Sending email | SMTP password. Keep it out of source control. |
| `SMTP_FROM` | Sending email | Sender address. Defaults to `SMTP_USER`. |
| `CRON_SECRET` | Scheduler calls to `/api/cron/tick` | Required for the scheduler. The endpoint refuses all requests without it. |

## Deploy without Google Cloud

Render runs the existing `Dockerfile` on its free plan, a free key from
Google AI Studio turns on the AI features, and a free cron job keeps the
reminder check running. No card and no Google Cloud project are needed.
`render.yaml` holds all of the host settings.

### 1. Render

1. Sign up at [render.com](https://render.com) with GitHub.
2. Choose *New*, then *Blueprint*, and pick this repository. Render reads
   `render.yaml`, builds the `Dockerfile` and asks for the values that are
   not generated.
3. Set `APP_BASE_URL` to the address Render shows, starting with `https://`.
   The free service sleeps when no one visits; the first load after that
   takes about half a minute, and the cron job below keeps it awake.

### 2. Environment variables

Render generates `SESSION_SECRET` and `CRON_SECRET` at the first deploy.
Copy `CRON_SECRET` from the service's *Environment* tab once the deploy
finishes.

| Name | What it does |
|---|---|
| `STORE_BACKEND` | Storage. `memory` keeps everything in the process and needs no database. |
| `SESSION_SECRET` | Signs session cookies and email links. Generated by Render. |
| `CRON_SECRET` | The secret the scheduler must send to `/api/cron/tick`. Generated by Render. |
| `APP_BASE_URL` | The public address, used inside reminder emails. |
| `GEMINI_API_KEY` | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Turns on prescription reading and the AI answer fallback. |
| `GEMINI_MODEL` | Gemini model name. Defaults to `gemini-2.5-flash`. |
| `SMTP_HOST` | Mail server. `smtp.gmail.com` for Gmail. Leave empty to record emails in the delivery log instead of sending. |
| `SMTP_PORT` | Mail server port. `465` for Gmail. |
| `SMTP_USER` | Mail login, which is the Gmail address. |
| `SMTP_PASS` | Mail password. For Gmail, a 16 character app password. |
| `SMTP_FROM` | Sender address. Defaults to `SMTP_USER`. |

For Gmail, turn on two-step verification, create an app password, and use
that password for `SMTP_PASS`.

### 3. Reminder check

Create a free job at [cron-job.org](https://cron-job.org) so reminders,
escalations and appointment emails go out even when nobody has the app
open. It also keeps the free service awake.

| Setting | Value |
|---|---|
| URL | `https://YOUR_HOST/api/cron/tick` |
| Method | `POST` |
| Schedule | every 5 minutes |
| Request header | `x-cron-secret` |

Set the header value to `CRON_SECRET`. A successful run answers
`{"checked":0,"emails":0,"removed":0,"failed":0}`. A `403` means the
header does not match the secret.

### 4. Storage on the free plan

`STORE_BACKEND=memory` keeps every circle in the running process. Nothing
to set up, but data resets whenever the free host restarts or sleeps, so
treat a deployed circle as a demonstration. Say so wherever the link is
shared.

## Deploy to Cloud Run

Replace `YOUR_PROJECT_ID`, `YOUR_SERVICE_URL` and the secret values with your own. The commands use the region `asia-south1` (Mumbai).

1. Set the project and enable the APIs:

   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
     artifactregistry.googleapis.com firestore.googleapis.com \
     cloudscheduler.googleapis.com generativelanguage.googleapis.com
   ```

2. Create the Firestore database:

   ```bash
   gcloud firestore databases create --location=asia-south1
   ```

   The Cloud Run service account needs read and write access to Firestore (the `roles/datastore.user` role).

3. Deploy from source. Cloud Run builds the `Dockerfile`:

   ```bash
   gcloud run deploy carecircle --source . --region asia-south1 \
     --allow-unauthenticated \
     --set-env-vars "STORE_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,APP_BASE_URL=YOUR_SERVICE_URL,SESSION_SECRET=YOUR_SESSION_SECRET,CRON_SECRET=YOUR_CRON_SECRET,GEMINI_API_KEY=YOUR_GEMINI_API_KEY"
   ```

   Use the service URL that Cloud Run prints as `YOUR_SERVICE_URL`. If you do not know it yet, deploy first and then run the command again with the URL set. For production, store the secrets in Secret Manager and pass them with `--set-secrets` instead of `--set-env-vars`.

4. Create the scheduler job. It calls the reminder check every five minutes:

   ```bash
   gcloud scheduler jobs create http carecircle-tick \
     --location=asia-south1 \
     --schedule="*/5 * * * *" \
     --uri="YOUR_SERVICE_URL/api/cron/tick" \
     --http-method=POST \
     --headers="x-cron-secret=YOUR_CRON_SECRET"
   ```

   Test it once with `gcloud scheduler jobs run carecircle-tick --location=asia-south1`. A successful run returns counts for checked, emails, removed and failed profiles.

## Limits and next steps

- **Email only.** Reminders go by email. Many Indian families read WhatsApp or SMS more often than email. Sending by WhatsApp or SMS is the next step to try.
- **Prescription reading needs a Gemini key.** Without one, medicines are typed in by hand. Every reading needs a person to check it before it is saved. Gemini can misread a photo.
- **Not a medical device.** CareCircle gives no medical advice and does not diagnose. It never suggests changing a medicine or its timing. The pattern notes are for raising with the doctor.
- **Local data is temporary.** The memory store is for local work and tests. Use Firestore for real use. On a free host, a memory store also loses every circle when the service sleeps.
- **Not yet covered by tests.** The browser flows (sign-in, forms and print) are not covered by end-to-end tests. The unit tests cover the rules, not the pages.
- **Accessibility not audited.** No automated or external accessibility audit has been run yet.
