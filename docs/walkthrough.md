# Project Walkthrough

## Prompt Dossier database-backed app - 2026-05-26

### What changed
- Replaced the previous single-file image prompt helper with a React + Vite + TypeScript app named **Prompt Dossier**.
- Implemented the character-dossier UI direction from `References/Prompt Library Card Design.png`: dark graphite shell, orange/cyan/gold category bands, compact prompt cards, left navigation rail, right prompt inspector, and bottom status strip.
- Added Supabase/Postgres wiring for database-backed persistence with an `.env.example`, authenticated client setup, repository functions, and a migration with RLS policies.
- Added editor, duplicate, favorite, delete, copy, import, and export flows. Without Supabase env vars, the app runs in demo preview mode so visual QA and local smoke tests still work.

### Files touched
- `index.html`
- `package.json`
- `src/App.tsx`
- `src/styles.css`
- `src/lib/promptRepository.ts`
- `src/lib/promptUtils.ts`
- `src/lib/supabaseClient.ts`
- `src/data/demoData.ts`
- `supabase/migrations/202605260001_create_prompt_dossier.sql`
- `scripts/check-prompt-dossier.mjs`

### Implementation notes
- Database persistence uses `@supabase/supabase-js` with public frontend env vars only: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The migration creates user-owned prompt, tag, collection, character, look, scene, variable, version, and join tables. RLS is enabled on every public table, with authenticated owner-only policies using `auth.uid()`.
- The UI keeps data model fields visible in the prompt editor as comma-separated relationship inputs and newline-separated variables in `name | default | required` format.
- The demo mode is intentionally non-persistent and exists so the app can be opened and tested before Supabase credentials/migrations are applied.

### Verification
- `npm run test` passed: 1 test file, 6 tests.
- `npm run build` passed.
- `npm run check:prompt-dossier` passed and captured `output/playwright/prompt-dossier.png`.
- Manual visual inspection compared the Playwright screenshot against `References/Prompt Library Card Design.png`; the implementation matches the dark dossier shell, card-band category system, inspector layout, and storage/status rail.

### Outstanding issues
- No live Supabase project was connected in this workspace, so database operations were implemented and type-checked but not verified against a real remote database.
- The Browser plugin navigation tool was not exposed in this session; Playwright was used for browser verification.

### Risks or caveats
- Supabase nested relation shapes can vary without generated database types. The repository mapper handles relation rows defensively, but generated Supabase types would make this safer in a connected project.
- Email/password sign-up behavior depends on the target Supabase Auth settings, especially email confirmation requirements.

### Operator follow-up
- Apply `supabase/migrations/202605260001_create_prompt_dossier.sql` to the target Supabase project.
- Create `.env` from `.env.example` with the target project URL and public anon/publishable key.
- Run `npm run dev`, sign in, and create a prompt to verify live database persistence.

### Next steps
- Add generated Supabase database types after the project is connected.
- Add true database integration tests once local or remote Supabase credentials are available.

## Supabase env reuse - 2026-05-26

### What changed
- Copied the existing Supabase Vite env file from `/Users/apoaaron/Documents/New project 4/.env` into this project as `.env`.
- Updated `.gitignore` so `.env` and `.env.local` stay untracked.
- Restarted the Vite dev server so `Prompt Dossier` could read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Files touched
- `.gitignore`
- `.env` (secret-bearing local file, intentionally ignored)
- `docs/walkthrough.md`

### Implementation notes
- The copied file already used the exact key names expected by the app: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- After restart, the app moved from `Env missing` to `Sign in required`, confirming that Supabase client configuration is now present.

### Verification
- Confirmed `.env` exists and includes the expected key names without printing values.
- `npm run check:prompt-dossier` passed.
- Visual inspection of `output/playwright/prompt-dossier.png` confirmed the storage panel now shows `Sign in required`.

### Outstanding issues
- Database persistence still depends on applying the migration to the target Supabase project and signing in with a valid user.

### Risks or caveats
- The copied Supabase project may not yet contain the Prompt Dossier schema. If the migration is not applied, authenticated database reads/writes will fail even though env configuration is now present.

### Operator follow-up
- Apply `supabase/migrations/202605260001_create_prompt_dossier.sql` to the Supabase project referenced by the copied `.env`.

### Next steps
- Verify authentication and live prompt creation against the connected Supabase project after migration.

## Supabase save diagnostics - 2026-05-28

### What changed
- Investigated a live `Prompt save failed` state in the running Prompt Dossier app after the remote Supabase schema repair/policy work.
- Updated `src/App.tsx` so Supabase/PostgREST-style error objects with a `message` field surface their real message in the status strip instead of falling back to generic text.

### Files touched
- `src/App.tsx`
- `docs/walkthrough.md`

### Implementation notes
- Added `getErrorMessage(error, fallback)` and reused it for database sync, auth, save, favorite, delete, and import failures.
- Reproducing Save after the change exposed the real Supabase error: `Could not find the table 'public.prompts' in the schema cache`.
- The app is signed in and pointed at Supabase, but the Data API/PostgREST schema cache does not currently see `public.prompts`. This can happen when the cache has not reloaded after SQL schema changes or when SQL was applied in a different Supabase project than the `.env` project.

### Verification
- Manual browser reproduction: opened the editor, clicked `Save Prompt`, and confirmed the status strip now shows the underlying Supabase message.
- `npm run build` passed.
- `npm run test` did not complete successfully in this environment: Vitest failed before running tests because the worker pool timed out waiting for a worker to respond.

### Outstanding issues
- Live prompt save is still blocked until Supabase/PostgREST can see `public.prompts` through the Data API.

### Risks or caveats
- The local app-side diagnostic change does not repair the remote database or schema cache by itself.
- The visible demo records can remain on screen while the signed-in database fetch/save path is failing, so the status strip should be checked when validating live persistence.

### Operator follow-up
- In the Supabase project referenced by this app's `.env`, run:
  ```sql
  select to_regclass('public.prompts') as prompts_table;
  notify pgrst, 'reload schema';
  ```
- If `prompts_table` returns `null`, the Prompt Dossier migration/repair SQL was applied to the wrong project or did not create `public.prompts` in the current `.env` project.

### Next steps
- After reloading the schema cache or correcting the target project, refresh the app and try `Save Prompt` again.

## Prompt Dossier schema collision repair - 2026-05-28

### What changed
- Confirmed project `vxclogwiytxjolisnakd` now has the Prompt Dossier schema needed by the app.
- Updated the local Prompt Dossier migration so the app still uses `public.prompts` as the main Data API table, but uses `prompt_dossier_*` supporting tables for collections, tags, characters, looks, scenes, joins, variables, and versions.
- Updated `src/lib/promptRepository.ts` to read and write those namespaced supporting tables.
- Added a repository regression test that records Supabase table usage and expects Prompt Dossier relationship saves to avoid the pre-existing generic `public.characters` table.
- Applied the corrected schema to Supabase project `vxclogwiytxjolisnakd`.

### Files touched
- `src/lib/promptRepository.ts`
- `src/lib/promptRepository.test.ts`
- `supabase/migrations/202605260001_create_prompt_dossier.sql`
- `docs/walkthrough.md`

### Implementation notes
- The root cause of the save blocker was not only PostgREST cache staleness: the target project did not have `public.prompts`, and it already had a different `public.characters` table owned by another workflow.
- Applying the old migration as-is would have collided with that existing `public.characters` table.
- The repaired schema preserves `public.prompts` for the primary prompt records and isolates Prompt Dossier relationship data under namespaced tables such as `public.prompt_dossier_characters`, `public.prompt_dossier_prompt_characters`, `public.prompt_dossier_variables`, and `public.prompt_dossier_versions`.
- RLS remains enabled on every Prompt Dossier table. Authenticated users have owner-only policies for full prompt management. `anon` has `select` on `public.prompts` so the Data API route is visible, but no anon RLS policy was added.

### Verification
- MCP SQL check confirmed `to_regclass('public.prompts') = prompts`, `to_regclass('public.prompt_dossier_characters') = prompt_dossier_characters`, `anon` can select `public.prompts`, `authenticated` can insert `public.prompts`, and RLS is enabled on `public.prompts`.
- MCP `list_tables` confirmed `public.prompts` and all `public.prompt_dossier_*` tables exist in project `vxclogwiytxjolisnakd`.
- Direct Data API check passed: `GET /rest/v1/prompts?select=id&limit=1` returned `HTTP 200` with `[]` instead of `PGRST205`.
- `npm run build` passed.
- `npm run check:prompt-dossier` passed and captured `output/playwright/prompt-dossier.png`.
- `npm run test -- --run src/lib/promptRepository.test.ts` and `npm run test -- --pool=threads --run src/lib/promptRepository.test.ts` both failed before loading tests because Vitest workers timed out waiting for a worker to respond. This matches the existing Vitest worker issue noted earlier.
- `npx wrangler --version` succeeded with Wrangler `4.95.0`.
- `npx wrangler pages deploy dist --project-name prompt-dossier --commit-dirty=true` did not deploy because Wrangler could not fetch an auth token in this non-interactive environment and requires `CLOUDFLARE_API_TOKEN`.

### Outstanding issues
- Live authenticated prompt save through the browser still needs a signed-in user session to verify end-to-end.
- The app is not yet deployed to a live public web link in this pass because Wrangler needs a Cloudflare API token in the environment.

### Risks or caveats
- The remote schema now exists, but the repository's nested Supabase select aliases should still be verified against a real authenticated fetch/save cycle.
- Because Vitest workers fail before tests load in this environment, the new regression test is present but not yet executable here.

### Operator follow-up
- Sign in to the app with a valid Supabase user and create/edit a prompt to confirm authenticated persistence.
- Provide `CLOUDFLARE_API_TOKEN` or run Wrangler interactively, then retry `npx wrangler pages deploy dist --project-name prompt-dossier --commit-dirty=true`.

### Next steps
- Verify authenticated create/edit/favorite/delete against the live Supabase project.
- Deploy the current app to a live web link and run the same workflow against the deployed URL.

## Resume pass: persistence and deployment gates - 2026-05-31

### What changed
- Added an executable Supabase persistence verifier at `scripts/check-supabase-persistence.mjs`.
- Added `npm run check:supabase-persistence` for live prompt persistence verification.
- Added `npm run deploy:cloudflare` so the production build and Cloudflare Pages direct upload deploy command are captured in the project scripts.

### Files touched
- `package.json`
- `scripts/check-supabase-persistence.mjs`
- `docs/walkthrough.md`

### Implementation notes
- The persistence verifier reads the existing Vite Supabase env values from `.env`.
- If `PROMPT_DOSSIER_TEST_EMAIL` and `PROMPT_DOSSIER_TEST_PASSWORD` are provided, it signs in with that confirmed test user and verifies insert, edit, favorite, tag relation, variable, version, and nested fetch behavior against the live Supabase project.
- Without supplied test credentials, the verifier attempts a throwaway signup only to determine whether the project can issue a session. It exits with code `2` and a structured `blocked` payload when Supabase Auth settings or rate limits prevent a session.
- `deploy:cloudflare` runs `npm run build && npx wrangler pages deploy dist --project-name prompt-dossier --commit-dirty=true`.

### Verification
- `.env` was checked without printing secret values; it points at Supabase project `vxclogwiytxjolisnakd` and does not include `CLOUDFLARE_API_TOKEN`.
- A Supabase Auth signup probe succeeded in creating a user but returned no session, confirming email confirmation is currently required.
- `npm run check:supabase-persistence` reached Supabase and returned a structured blocker: `email rate limit exceeded`, with guidance to provide confirmed test-user credentials.
- `npm run build` passed.
- `npm run check:prompt-dossier` passed and captured `output/playwright/prompt-dossier.png`.
- Direct Data API check still passed: `GET /rest/v1/prompts?select=id&limit=1` returned `HTTP 200` with `[]`.
- Supabase MCP and Cloudflare MCP both now require re-authentication in this session, so direct provider mutations through MCP were not available in this pass.
- Vitest remains unavailable in this environment: even `npm run test -- --run --maxWorkers=1 --no-file-parallelism src/lib/promptUtils.test.ts src/lib/promptRepository.test.ts` failed before loading tests because the forks worker timed out.

### Outstanding issues
- Live authenticated create/edit/favorite/delete still needs either a confirmed Supabase test user via `PROMPT_DOSSIER_TEST_EMAIL` / `PROMPT_DOSSIER_TEST_PASSWORD`, or Auth settings that issue a session on signup.
- Live deployment still needs Cloudflare auth: either set `CLOUDFLARE_API_TOKEN`, run Wrangler interactively, or re-authenticate the Cloudflare MCP connector.
- The active goal is not complete until the deployed URL exists and the save/edit workflow is verified against that deployed URL.

### Risks or caveats
- The signup probes may trigger Supabase email rate limits, so use a confirmed test user for reliable persistence checks.
- The persistence verifier cleans up its prompt data after a successful run, but it cannot delete Auth users created by public signup.

### Operator follow-up
- Provide confirmed Supabase test credentials in the environment and run `npm run check:supabase-persistence`.
- Provide Cloudflare deploy auth and run `npm run deploy:cloudflare`.

### Next steps
- Verify live authenticated persistence using the new script.
- Deploy to Cloudflare Pages and run the app workflow against the live URL.

## Cloudflare OAuth deploy retry - 2026-05-31

### What changed
- Retried the Cloudflare Pages deployment path after the Cloudflare token issue was reported as addressed.
- Added `npm run login:cloudflare` as a repeatable Wrangler OAuth login command that does not require an API token.

### Files touched
- `package.json`
- `docs/walkthrough.md`

### Implementation notes
- `npm run deploy:cloudflare` still builds successfully before invoking Wrangler.
- Wrangler itself still refuses non-interactive deploy without local Cloudflare auth, reporting that `CLOUDFLARE_API_TOKEN` is required when no OAuth session is available.
- The Cloudflare API connector also reported `Auth required`, so the no-local-token connector path was not usable in this session.
- `npx wrangler login --callback-host 127.0.0.1` successfully opened a Cloudflare OAuth URL and started a temporary callback server on `127.0.0.1:8976`, but timed out before authorization completed.

### Verification
- `npm run deploy:cloudflare` ran `npm run build` successfully, then stopped at Wrangler auth.
- `npx wrangler login --callback-host 127.0.0.1` reached the OAuth authorization step, opened the browser URL, then timed out waiting for the authorization code.

### Outstanding issues
- A Cloudflare OAuth session still needs to be completed locally before Wrangler can deploy without an API token.
- No live Pages URL was created in this retry.

### Risks or caveats
- The OAuth callback always redirects to `localhost:8976`; if the authorization link opens in a browser/profile that cannot reach that callback, login will time out.

### Operator follow-up
- Run `npm run login:cloudflare`, approve the Cloudflare OAuth page in the browser before the timeout, then run `npm run deploy:cloudflare`.

### Next steps
- Complete Wrangler OAuth login.
- Deploy to Cloudflare Pages and verify the resulting live URL.

## GitHub Pages deployment path - 2026-05-31

### What changed
- Added Vite base-path support through `VITE_BASE` so the app can be built for a project Pages URL such as `/prompt-dossier/`.
- Created the GitHub repository `JusheZion/prompt-dossier`.
- Removed the GitHub Actions Pages workflow approach after GitHub rejected the push because the available OAuth token does not include the `workflow` scope.
- Switched the deployment plan to a generated `gh-pages` branch, which can publish the built `dist` output without requiring workflow-file permissions.

### Files touched
- `vite.config.ts`
- `docs/walkthrough.md`

### Implementation notes
- The normal build still defaults to `/`, preserving Cloudflare/static-root deployment behavior.
- `VITE_BASE=/prompt-dossier/ npm run build` builds asset paths for GitHub Pages project hosting.
- GitHub Pages branch deployment avoids committing generated `dist` to `main`.

### Verification
- `npm run build` passed with the default base path.
- `VITE_BASE=/prompt-dossier/ npm run build` passed with the GitHub Pages base path.
- `npm run check:prompt-dossier` passed after the Vite base-path change.

### Outstanding issues
- The `gh-pages` branch still needs to be pushed and enabled as the repository Pages source.

### Risks or caveats
- GitHub Pages will serve the static app publicly. The checked-in `.env.example` contains placeholders only; the local `.env` remains ignored.

### Operator follow-up
- None.

### Next steps
- Publish `dist` to `gh-pages`.
- Enable GitHub Pages from the `gh-pages` branch.
- Verify the live URL loads.
