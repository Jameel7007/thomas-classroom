# Thomas’s Classroom — Astro site

This directory is the active Astro migration of Thomas’s Classroom. The
original landing page and the established curriculum/lesson design are
preserved while routes, metadata, assets, and new content move under Astro.

## Current route coverage

- Original main landing page at `/`
- Crawlable curriculum map at `/curriculum/`
- 54 substantive lessons under `/lessons/{level}/{slug}/`
- Placement, quick check, and five level-exit routes under `/assessments/`
- About, Languages, Blog, and Dictionary sections
- Legacy `.html` redirects
- Generated sitemap and canonical metadata

Converted MDX lessons take priority over matching legacy lessons. This allows
the existing corpus to remain usable while each page is progressively moved to
the schema-validated authoring format.

## Development

Install once, then start the Astro authoring server:

```bash
npm install
npm run dev
```

For ElevenLabs audio during development, run the existing secure proxy in a
second terminal:

```bash
node ../server.mjs
```

Astro proxies `/api/voice/*` to that process on port 8090.

## Production verification and local serving

```bash
npm run build
npm run serve
```

The production command serves `astro-pilot/dist/` and retains the existing
server-side ElevenLabs cache and rate limiting. Set `SITE_URL` to the public
origin before the production build.

The build command runs Astro’s type/content check, creates the static site and
sitemap, then validates every generated HTML page, canonical lesson and
assessment count, and local link or asset reference.
