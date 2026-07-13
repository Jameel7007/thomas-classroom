# Thomas’s Classroom

This is the active, fully native Astro 7 site for Thomas’s Classroom. The
landing page, curriculum, print curriculum, 54 lessons, seven assessments,
About, Languages, Blog, and Dictionary are all authored inside this project.
There is no static-HTML compatibility layer.

## Source map

- `src/pages/` — homepage, curriculum, supporting sections, and generated route entries
- `src/content/lessons/{level}/{slug}.astro` — canonical metadata for all 92 topics; 54 files also contain ready lesson bodies
- `src/content/assessments/{slug}.astro` — seven directly editable assessments
- `src/components/lesson/` — lesson shell, navigation, exercise engine, and authoring components
- `src/components/assessment/` — assessment shells, scoring engines, audio, and progress components
- `src/styles/` — native shared tokens and page-family styles
- `src/scripts/` — native client-side lesson, assessment, homepage, and quick-check behavior
- `public/assets/` — lesson illustrations and flags
- `private/voice-scripts.json` — server-only approved ElevenLabs text
- `src/data/lesson-schema.mjs` — typed metadata contract and record validation
- `src/data/lesson-catalog.mjs` — automatic catalog, grouping, counts, URLs, status, references, and sequence navigation
- `src/data/migration-fingerprints.json` — preservation-only learner-content and interaction fingerprints

Clean routes use `/lessons/{level}/{slug}/` and `/assessments/{slug}/`.
Historical `.html` URLs remain redirects generated from ready lesson metadata.

## Single-source lesson authoring

Each file under `src/content/lessons/{level}/{slug}.astro` owns its metadata.
There is no lesson index to update, no route wrapper to create, and no previous
or next link to maintain. The catalog reads and validates the exported record,
then derives curriculum placement, finder data, counts, availability, URLs,
redirects, level grouping, and navigation.

Every record starts with JSON-compatible metadata inside `defineLesson`:

```astro
---
import { defineLesson } from "../../../data/lesson-schema.mjs";

export const page = defineLesson({
  "title": "Present perfect continuous · B1 Grammar · Curriculum Map",
  "slug": "present-perfect-continuous",
  "level": "B1",
  "topic": "Present perfect continuous",
  "category": "Grammar",
  "contentType": "grammar",
  "status": "planned",
  "description": "Planned B1 grammar lesson covering present perfect continuous.",
  "sequence": 1,
  "prerequisites": ["a2/present-perfect"],
  "related": ["b1/past-perfect"],
  "assessments": ["b1-exit"]
});
---
```

Metadata field rules:

- `slug` and `level` must match the file path exactly.
- `contentType` is `grammar` or `vocabulary`; `category` must be its matching learner-facing label.
- `status` is `planned` or `ready`.
- `sequence` is a unique positive integer inside the level and defines the course order.
- prerequisite and related lesson IDs use `{level}/{slug}` in lowercase.
- assessment IDs use the assessment slug, such as `a1-exit`.
- duplicate IDs, routes, topics, or level sequence values fail validation.

### Create a new lesson

1. Create `src/content/lessons/{level}/{slug}.astro`.
2. Add the `defineLesson` block with a unique sequence value and `status: "ready"`.
3. Import `LessonPage` and place the complete lesson body inside `<LessonPage page={page}>`.
4. Run `npm run check`, then `npm run build`.

That one file creates its clean route and historical `.html` redirect, adds the
topic to the curriculum and finder, updates counts, and joins the generated
previous/next sequence.

### Register a planned topic

Create the same file with its metadata block and `status: "planned"`, but do
not render `LessonPage` yet. It appears as **Soon** in the curriculum and in the
planned filter, but no learner route is generated. All 38 current B1/B2 topics
already use this format.

To publish that topic later, edit the existing file only: change `status` to
`ready`, import `LessonPage`, and add the lesson body. No other registration is
needed.

### Change lesson order

Change `sequence` in the affected level records so the values remain unique
and contiguous from 1. The catalog sorts by level and sequence; curriculum
order and previous/next links update together. Sequence never crosses levels.

### Link lessons and assessments

Add canonical lesson IDs to `prerequisites` or `related`. Add an assessment
slug to `assessments`. Unknown or self-referencing lesson IDs and unknown
assessment IDs fail the catalog validation. The final lesson in a ready level
uses its first assessment relationship as the generated completion link.

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

The build performs lesson-schema validation, Astro diagnostics, static generation, sitemap creation,
route/link/asset validation, exact learner-text fingerprint checks,
interaction-count checks, audio-reference validation, direct-refresh output
checks, historical redirect checks, and a scan for forbidden compatibility
patterns.

To serve the production build with the audio proxy:

```bash
npm run serve
```
