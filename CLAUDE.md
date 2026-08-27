# CLAUDE.md

@AGENTS.md

**Read [AGENTS.md](AGENTS.md) before making any changes.** It is the authoritative
working spec for this project — design direction, lesson method, drill rules,
assessment and placement rules, content standards, and the non-negotiables.
Follow it. If anything here and AGENTS.md ever conflict, AGENTS.md wins.

## Quick orientation

- **What this is:** a premium static web curriculum (CEFR A0 -> B2) for one-on-one
  English tutoring, shown live over screen share. The active site is the fully
  native Astro 7 project in [astro-pilot/](astro-pilot/). The deleted static-HTML
  and React/Babel compatibility implementation must not be recreated.
- **Run development:** `cd astro-pilot && npm install && npm run dev`, then open
  `http://localhost:4321/`.
- **Build and preview:** from `astro-pilot/`, run `npm run build`, then
  `npm run serve`. The local server serves `dist/`, applies the generated
  historical redirects, and uses the branded static 404.
- **Socket-free preview check:** `npm run preview:validate` verifies the local
  server contract without opening a port or launching a browser.
- **Audio authoring (optional):** copy `.env.example` to `.env`, add local ElevenLabs keys, and generate static MP3 files. See
  [ELEVENLABS.md](ELEVENLABS.md). Never put an API key in HTML or browser JS.

## Before you start

- Keep user-facing work in [astro-pilot/](astro-pilot/).
- Reuse the lesson and assessment components, styles, and interaction engines
  under `astro-pilot/src/`; do not hardcode one-off drill systems.
- Add lesson metadata and content in one native file under
  `astro-pilot/src/content/lessons/{level}/`. The canonical catalog derives
  routes, curriculum registration, redirects, and sequencing.
- Preserve the current native Astro/MDX architecture and never add legacy HTML
  passthrough, runtime document loaders, iframes, or client-side compilers.

## After frontend changes

- Verify the page loads and check the browser console for errors.
- Test any changed interactions and confirm new lesson links resolve from the map.
- Keep the design calm and readable at screen-share distance.
- Run `npm run check` and `npm run build` from `astro-pilot/`.
