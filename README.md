# LexVeritas Academy

A working legal-education application: React 19, TypeScript, Next.js-compatible Vinext, Tailwind, a Cloudflare Worker backend, Drizzle-managed D1/SQLite relational database, and private R2 storage. This uses the hosting environment's native database rather than PostgreSQL. Amounts are stored in integer paisa; examination marks are stored in hundredths. All business dates are shown in Asia/Dhaka.

## Open the hosted website

Use the deployed link supplied with this project. The initial Sites deployment is owner-private for review. After changing the temporary Admin password, use the Site's sharing/access controls to make the site public for students. Until then, the hosting platform itself requires the owner's ChatGPT sign-in. The application does not require student or buyer accounts.

## First-time setup

On the first visit, the server creates `lexveritas_admin` from the server-only `INITIAL_ADMIN_HASH` secret and seeds exactly 10,000 cryptographically random codes. Bootstrap is idempotent. The supplied temporary password is configured as a bcrypt hash in the hosted secret; it is not included in this source archive. Use the temporary password from your original requirements.

Visit `/admin/login`, sign in as `lexveritas_admin`, and change your password under Settings → Change Password. Management is blocked until this change. All existing sessions are revoked on password change. Sign in again with the new password.

Exams and books intentionally start empty. Add your own questions, covers, prices, and files; no invented student results or fake statistics are seeded.

## Administrator operating guide

| Task | Steps |
|---|---|
| Create an examination | Exams → Create exam. Enter instructions, start/closing time in Dhaka, duration, correct-answer marks, negative marks, and result visibility. Save. |
| Add MCQs | Open the exam → Manage questions → Add question. Enter four or five options, select the correct answer, and optionally add an explanation or PNG/JPEG image. |
| Edit/order questions | Use edit, duplicate, up/down, and delete controls. Preview exam shows the complete question set to Admin. |
| Publish/schedule | Save a future schedule and choose Publish. Start now changes the start time. Close now ends existing attempts at the new closing time. |
| Preserve history | Definitions and questions lock after the first attempt. Duplicate an exam to make a changed version. Exams with attempts cannot be deleted. |
| Generate codes | Unique Codes → select 100/500/1,000/5,000/10,000 → Generate codes. Each code can enter every distinct exam once. |
| Download/copy codes | Unique Codes → Download CSV, or use the Copy control on an individual code. CSV is Admin-only. |
| Review code history | Search a code → View usage. Activate/deactivate using its switch. |
| Results | Open exam → Participants & Rankings. Search, sort, filter, and inspect individual submissions. Results are automatic after closing or released manually using Publish results. |
| Position PDF | Results & Rankings → choose exam → Generate Position PDF. Downloads a searchable A4 landscape PDF with repeated headers, Bengali/English fonts, and timestamps. |
| Add books | Books → Add book. Select hardcopy/softcopy, enter price in BDT, upload cover and separate preview PDF, and publish. |
| Digital delivery | For softcopy books, upload the full PDF using the private digital-file field. The buyer's confirmation page unlocks download after verification. |
| Verify payment | Open the correct order section. Check the actual bKash/Nagad/Rocket payment independently, then toggle PAYMENT VERIFIED. Duplicate TrxIDs are flagged across both order types. |
| Hardcopy management | Hardcopy Orders has PAYMENT VERIFIED, PRODUCT DELIVERED (courier dispatch), and DELIVERY RECEIVED switches. Each records a timestamp; verification also records the admin. |
| Softcopy management | Softcopy Orders has a separate PAYMENT VERIFIED switch. Address and courier details are not collected. |
| Change business details | Settings → Academy settings. Edit payment phone, delivery charges, contact URLs, and Academy description. |

## Student and buyer flows

- Students enter name, university, and code. A database unique index enforces one attempt per code per exam, including concurrent requests.
- An HTTP-only attempt cookie permits recovery in the same browser without resetting the start time. After submitting, the code cannot start that exam again. It remains valid for other exams.
- Every answer is saved server-side. If saving fails, the page clearly reports it and asks the student to select the answer again; manual submission is disabled while an answer remains unsaved.
- The timer uses the difference between server time and browser time. The deadline is the earlier of start + duration and the official closing time. Answers arriving past the database deadline cannot be written.
- With an open page, expiry triggers automatic submission. If the page is closed/offline, saved answers remain final at the deadline; the server grades expired attempts when an attempt, result, or ranking is next requested. This deployment does not require an external scheduled job.
- Correct answers and results are unavailable until the official close and configured result release. Result lookup uses exam + access code without an account.
- Hardcopy carts contain book IDs and quantities locally; the backend obtains current database prices and computes totals. One delivery charge applies per order.
- COD is accepted only for home delivery. Delivery is paid first; the book subtotal remains due. Sundarban supports Full Pay only.
- An entered TrxID records an unverified order; it does not establish that money was received.
- Keep the order confirmation in the original browser. Download authorization uses a private HTTP-only cookie valid for 30 days; contact the Academy for assistance if that browser session is lost. No permanent raw softcopy URL is published.

## Install and run locally

Use Node.js 24 LTS and npm. Run commands in the project directory.

```bash
npm ci
```

Set a temporary password in an environment variable using a secure shell prompt (do not commit it):

```bash
read -rsp 'Temporary admin password: ' LVA_INITIAL_PASSWORD
export LVA_INITIAL_PASSWORD
node scripts/seed.mjs
unset LVA_INITIAL_PASSWORD
```

This creates an ignored `.env` containing only the bcrypt hash, and an ignored `.sites-runtime/seed/initial.sql` containing the initial hashed admin and 10,000 random codes. Restrict access to this directory. The hosted application also has an idempotent first-visit bootstrap, so importing this SQL is optional for normal Sites hosting.

```bash
npm run build
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_daily_penance.sql
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file .sites-runtime/seed/initial.sql
npm run dev
```

Use the local URL printed by the development server. Build output uses local dummy binding identifiers; production Sites replaces them with managed bindings. If new migrations are added, apply every SQL file in sequence. In ChatGPT Work, use the supervised Sites preview instead of starting a parallel development server.

## Validation

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/integration.mjs
node tests/pdf.mjs
npm run build
```

The integration suite runs the actual API handlers against a fresh SQLite database created from the migrations. It verifies the requested 17 business rules, authentication, cookies, answer privacy, concurrent attempts, immutable submissions, ranking, order totals, manual verification, private files, safe history, initial 10,000-code seed, and forced password change. Test data is isolated from hosted and preview databases.

The PDF test generates a 130-participant mixed Bengali/English ranking using the same document definition as the download feature. Output is in ignored `.sites-runtime/tests/`. The PDF uses real text and embedded fonts, not screenshots. Bengali glyphs are shaped by the PDF font engine; PDF readers can differ in how they copy complex-script text.

## Database and security

- Schema: `db/schema.ts`; migrations: `drizzle/`.
- Prepared statements bind every user-provided value. Relational foreign keys and the `one_code_one_exam` unique index preserve attempt integrity.
- Scoring happens in one atomic SQL statement. Answer writes conditionally check active status and the database clock, preventing changes after submission/deadline.
- Passwords use bcrypt; session tokens are random and stored hashed. Cookies use HTTP-only, SameSite=Strict, and Secure on HTTPS.
- Mutations validate same-origin requests. Admin authentication is checked on every Admin API endpoint. Admin pages have noindex metadata.
- Login, code entry, result lookup, and checkout are rate-limited in D1.
- PDF/image uploads validate purpose, size, signatures, and administrator authorization. Maximum upload: 25 MB; PNG/JPEG images and PDF documents only.
- Preview files are public; full digital files are private. Do not upload a full eBook in the preview field.
- Book titles/prices are snapshotted into orders. Payment and dispatch actions record audit details.

## Deploy with Sites

The project is already registered by `.openai/hosting.json`. Preserve its project ID. Run the Sites build/publish workflow, push the source, save the built version, and deploy it. D1 migrations and R2 bindings are managed by Sites. Configure `INITIAL_ADMIN_HASH` as a secret through the Site environment settings before first deployment. After a successful password change, this bootstrap secret can be removed and a new version deployed.

The initial deployment is owner-private. Change the temporary admin password before enabling public access, then use Site sharing to permit anonymous students and buyers. If attaching a custom domain, configure it through Site domain management.

## Deploy to your own Cloudflare account

Create a D1 database and R2 bucket in your account. Build the project, create a Wrangler configuration pointing to `dist/server/index.js` and `dist/client`, declare DB and BUCKET using your actual resource IDs, and set `INITIAL_ADMIN_HASH` with Wrangler secrets. Apply all `drizzle/*.sql` migrations to that D1 database, optionally import the private seed SQL once, then deploy the Worker. Never deploy the starter's dummy database ID. Configure HTTPS and your domain. Keep database backups and protect access to your Cloudflare account and R2 storage.

## Operational limits

This is a functional application, with local integration and layout checks. It has not undergone independent penetration testing or a large live load test. Admin tables page at 50 records; CSV/PDF exports cap at 100,000 rows. For high-stakes, high-concurrency examinations, conduct a realistic staging load test before admitting students. Payments remain fully manual; there is no bKash/Nagad payment-gateway integration.
