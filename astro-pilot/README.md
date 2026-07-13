# Thomas’s Classroom

This is the active, fully native Astro 7 site for Thomas’s Classroom. The
landing page, curriculum, print curriculum, 54 lessons, seven assessments,
About, Languages, Blog, and Dictionary are all authored inside this project.
There is no static-HTML compatibility layer.

## Source map

- `src/pages/` — homepage, curriculum, supporting sections, and route entries
- `src/content/lessons/{level}/{slug}.astro` — 54 directly editable lessons
- `src/content/assessments/{slug}.astro` — seven directly editable assessments
- `src/components/lesson/` — lesson shell, navigation, exercise engine, and authoring components
- `src/components/assessment/` — assessment shells, scoring engines, audio, and progress components
- `src/styles/` — native shared tokens and page-family styles
- `src/scripts/` — native client-side lesson, assessment, homepage, and quick-check behavior
- `public/assets/` — lesson illustrations and flags
- `private/voice-scripts.json` — server-only approved ElevenLabs text
- `src/data/native-page-manifest.json` — migration inventory and preservation fingerprints

Clean routes use `/lessons/{level}/{slug}/` and `/assessments/{slug}/`.
Historical `.html` URLs remain redirects generated from the native route
inventory.

## Development

```bash
npm install
npm run dev
```

The site opens at [http://localhost:4321/](http://localhost:4321/).

For ElevenLabs audio during development, run the secure proxy separately:

```bash
node ../server.mjs
```

Astro proxies `/api/voice/*` to port 8090. The browser retains its local
speech-synthesis fallback when ElevenLabs is unavailable.

## Build and validation

```bash
npm run build
```

The build performs Astro diagnostics, static generation, sitemap creation,
route/link/asset validation, exact learner-text fingerprint checks,
interaction-count checks, audio-reference validation, direct-refresh output
checks, historical redirect checks, and a scan for forbidden compatibility
patterns.

To serve the production build with the audio proxy:

```bash
npm run serve
```
