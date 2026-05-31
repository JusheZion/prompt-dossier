# Prompt Library Cloudflare Deployment

## Deployment Target

- App: Prompt Library / Prompt Dossier
- Cloudflare worker name: `prompt-dossier`
- Production branch: `main`
- Project root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy --config ./wrangler.jsonc`
- Version command for Cloudflare Workers Builds previews: `npm run cf:versions-upload`
- Build output directory: `dist`
- Package manager: `npm` (`package-lock.json` is committed)
- Node version: `>=22.12.0`

## ARCS Comparison

| Area | ARCS | Prompt Library |
| --- | --- | --- |
| Package manager | `npm` with `package-lock.json` | `npm` with `package-lock.json` |
| Build command | `npm run build` | `npm run build` |
| Deploy command | `wrangler deploy --config ./wrangler.jsonc` | `wrangler deploy --config ./wrangler.jsonc` |
| Output folder | `dist` | `dist` |
| Wrangler config | `wrangler.jsonc` with static assets | `wrangler.jsonc` with static assets |
| Static asset routing | `assets.not_found_handling: single-page-application` | `assets.not_found_handling: single-page-application` |
| Redirects/headers | No `public/_redirects` or `public/_headers` found | No `_redirects` or `_headers`; SPA fallback is in `wrangler.jsonc` |
| Framework | Vite + React | Vite + React |
| Vite output config | `build.outDir: dist` | `build.outDir: dist` |
| Cloudflare Vite plugin | Present in ARCS | Not copied; Prompt Library is static-only and deploys through Wrangler static assets |
| Supabase env names | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Other `VITE_*` env | `VITE_GEMINI_API_KEY` for ARCS AI features | None required |
| Node version | Not pinned in repo; ARCS checklist suggests setting `NODE_VERSION` only if Cloudflare build fails | `package.json` requires Node `>=22.12.0`; set `NODE_VERSION=22.12.0` in Cloudflare Workers Builds |
| Deployment branch | `main` in the ARCS checklist/pushed repo flow | `main` |
| Project root | `/` | `/` |

## Cloudflare Environment Variables

Set these under the Cloudflare Workers Build environment before deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `NODE_VERSION=22.12.0`

Do not add Supabase service-role or secret keys to this frontend deployment.

## Supabase Auth Redirect URLs

After the Cloudflare URL is known, add these in Supabase Authentication URL configuration:

- Site URL: `https://<prompt-library-cloudflare-url>`
- Redirect URLs:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `https://<prompt-library-cloudflare-url>`
  - `https://<prompt-library-cloudflare-url>/**` if wildcard redirects are enabled for the project

The app currently uses email/password auth through `supabase.auth.signInWithPassword` and `supabase.auth.signUp`; no OAuth provider redirect is required unless a future sign-in provider is added.

## Deployment Commands

```bash
npm run build
npm run deploy
```

If Cloudflare is connected through Git-based Workers Builds, use:

- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy --config ./wrangler.jsonc`
- Version command: `npm run cf:versions-upload`
- Node version: `22.12.0`

## Live URL

- Cloudflare: pending deployment
- Existing fallback URL: `https://jushezion.github.io/prompt-dossier/`

## Last Deployment Attempt

- Date: 2026-05-31
- Command: `npm run deploy`
- Root directory: `/Users/apoaaron/Documents/New project 3`
- Build command run by script: `npm run build`
- Output directory: `dist`
- Result: local build succeeded; Wrangler deploy did not complete because no usable Cloudflare auth session was available.
- Exact deploy error after sandbox/network access was allowed: `Failed to fetch auth token: 400 Bad Request`
- Wrangler follow-up error: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.`
- OAuth retry command: `npm run login:cloudflare`
- OAuth retry result: `Timed out waiting for authorization code, please try again.`

This is an authentication/session blocker, not a Prompt Library build or config blocker. The simplest Cloudflare path remains either a completed local Wrangler OAuth session followed by `npm run deploy`, or a Git-connected Cloudflare Workers Build using the settings above.
