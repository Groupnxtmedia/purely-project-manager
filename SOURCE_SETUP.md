# Purely Project Manager — developer setup

This repository contains the application, original brand/font assets, API routes, database schema and migrations, tests, build scripts, dependency lockfile, and Sites hosting manifest. It is a source-code snapshot, not a backup of live business records or uploaded briefs.

Excluded: API keys, session signing keys, runtime environment files, Git history, installed dependencies, generated builds, local databases, and tool caches. Production project data is stored separately in Cloudflare D1; uploaded briefs are in R2.

## Requirements and local setup

Use Node.js 22.13 or newer, npm, and a terminal in the cloned project directory.

1. Run `npm run install:ci` to install the locked dependencies.
2. Copy `.env.example` to `.dev.vars` and supply your local runtime values. Do not commit this file.
3. Set `TEAM_ACCESS_CODE` to the shared password you want. Set `SESSION_SECRET` to a long random value, for example one generated with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Configure `OPENAI_API_KEY` for David; the rest of the app can be tested without AI access. The current AI model identifier is `gpt-6-astra` in `lib/manager-ai.ts`, `lib/assigned-ai.ts`, and `lib/china-ai.ts`.
4. Run `npm run build` to generate the local Worker configuration.
5. On a new local database, apply each SQL file in `drizzle/` once, in journal order, using the command below. Do not replay already applied migrations.
6. Run `npm run dev` and open the printed local URL (normally `http://127.0.0.1:5173`). Select a team member and enter your configured password.

Migration command (replace the SQL filename for each of the six migrations):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sour_baron_zemo.sql
```

For a production-build preview, copy the local `.dev.vars` to `dist/server/.dev.vars` and run `npm start -- --port 8787`. Remove this copied file before packaging a deployment. Local previews use local D1/R2 state and do not contain live records.

## Application layout

- `app/`: pages, responsive UI, branding, and HTTP API routes.
- `lib/`: board rules, sessions, assignment permissions, reminders, David prompts, and database access.
- `db/` and `drizzle/`: schema definitions and the six versioned migrations.
- `public/`: icons, logos, fonts, manifest, and static assets.
- `worker/`, `scripts/`, and `vite.config.ts`: Worker entry point and build tooling.
- `tests/`: domain tests and local HTTP integration checks.
- `.openai/hosting.json`: existing Sites project ID and DB/BUCKET bindings; no secret values.

The four profiles share a team password; selecting a name is not individual identity verification. Password-free sessions from the prior release are invalidated by the current session version. Assigned Work preserves creator/recipient visibility rules. Both the creator and current assignee can complete or reopen a job; only the creator can edit its details or upload briefs. Matthew’s overview remains read-only for unrelated assignments. David proposes changes for confirmation before recording them.

China Gantt uses separate `china_tables`, `china_tasks`, and `china_messages` tables. All signed-in team members share this workspace. Each task has its own conversation; moving a task between tables preserves its conversation. Deleting a task soft-archives it and its conversation, which remains readable and can be restored. David replies only when requested and uses that task's details plus up to 40 recent thread messages (each excerpted to 2,000 characters). China chat does not change task fields automatically; edits are made in the table.

The six SQL files are listed in `drizzle/meta/_journal.json`, ending with `0005_closed_the_hood.sql`. Preserve existing SQL, snapshots, and journal entries; generate a new migration for future schema changes. Applying these migrations locally creates schema, not a copy of production records.

In-app assignment reminders are checked when the relevant endpoint is opened, two days before and on the deadline day (America/Toronto). An unattended background schedule or external phone notifications are not included in this source setup.

## Validation

Run `npx tsc --noEmit` and `npm run build`. Domain checks run with `node --test tests/*.test.mjs`.

For `node tests/session-api-check.mjs`, start the built local preview on port 8787 with `TEAM_ACCESS_CODE=test-team-password` and `SESSION_SECRET=local-session-test-key-not-for-production`. Alternatively supply matching `TEST_TEAM_ACCESS_CODE` and `TEST_SESSION_SECRET` to the test process. Other HTTP checks also use `TEST_TEAM_ACCESS_CODE` (defaulting to that local test value). Run integration checks only against disposable local data.

## Publishing

The manifest is linked to the existing Purely site. Use the Sites skill/source workflow to update that same site; do not publish an unrelated fork under its project ID. Production secrets are configured through Sites runtime environment variables and are not part of this repository.

Build from clean output, then run `node scripts/prepare-release.mjs` before the Sites packaging step. This regenerates deployment metadata from the original migrations and rejects local secret files. Preserve migration history; stale duplicate SQL copies must never enter a release. The deployment archive and this source repository serve different purposes. GitHub pushes do not automatically deploy the existing app.
