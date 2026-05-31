# ARCS Handoff: Link to Prompt Library

## Goal

Add a simple ARCS navigation entry that opens the deployed Prompt Library app in a new tab. Do not merge the Prompt Library app into ARCS yet.

## Current Integration Shape

- Source app remains separate: `/Users/apoaaron/Documents/New project 3`
- ARCS remains separate: `/Users/apoaaron/.gemini/antigravity/Nano Banana Expanded`
- Connection model: ARCS -> external link -> Prompt Library live URL
- Recommended browser behavior: open in a new tab with `target="_blank"` and `rel="noreferrer"`

## URL

- Cloudflare URL: pending deployment
- Temporary fallback URL: `https://jushezion.github.io/prompt-dossier/`

Cloudflare deployment config is ready in the Prompt Library repo, but the live Cloudflare URL is still pending because local Wrangler OAuth timed out before authorization completed.

## Suggested ARCS Change

Add the link wherever ARCS keeps its user-facing navigation/actions for external tools. Label options:

- `Prompt Library`
- `Open Prompt Library`
- `Prompt Dossier`

Use the Cloudflare URL once deployment is complete. Keep the GitHub Pages URL only as a temporary fallback while Cloudflare is being finalized.

## Do Not Do Yet

- Do not add Prompt Library routes inside ARCS.
- Do not import Prompt Library React components into ARCS.
- Do not share runtime state between the apps.
- Do not add a same-tab embedded iframe unless there is a clear product reason later.
