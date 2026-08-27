# Thomas’s Classroom

This is the active, fully native Astro 7 site for Thomas’s Classroom. The
landing page, curriculum, print curriculum, 111 lesson records (95 published
and 16 planned), seven published assessments, one planned C1 exit relationship,
About, Languages, Blog, and Dictionary are all authored inside this project.
There is no static-HTML compatibility layer.

## Source map

- `src/pages/` — homepage, curriculum, supporting sections, and generated route entries
- `src/content/lessons/{level}/{slug}.astro` — canonical metadata and native lesson bodies or planned records for all 111 topics
- `src/content/assessments/{slug}.astro` — seven directly editable assessments
- `src/data/assessment-routes.mjs` — validated assessment roles, routes, level relationships, and entry/exit paths
- `src/content/blog/{slug}.mdx` — complete field notes registered by the validated Blog collection
- `src/content.config.ts` — schema for automatically registered Blog metadata and routes
- `src/components/lesson/` — lesson shell, navigation, exercise engine, and authoring components
- `src/components/assessment/` — assessment shells, scoring engines, audio, and progress components
- `src/lib/assessment-readiness.mjs` — shared cross-skill readiness calculations for exit and placement results
- `src/pages/tutor/` — searchable tutor index and printable plans generated from canonical lesson metadata
- `src/data/dictionary.mjs` — validated multi-sense word registry, origins, examples, chunks, and lesson relationships
- `src/components/dictionary/DictionaryExplorer.astro` — searchable, URL-aware, in-session word-clearing experience
- `src/data/language-transfer.mjs` — validated Spanish, Portuguese, and Turkish contrastive patterns with canonical lesson relationships
- `src/components/languages/LanguageTransferGuide.astro` — native disclosure guide with tutor moves and targeted practice links
- `src/styles/` — native shared tokens and page-family styles
- `src/scripts/` — native client-side lesson, assessment, homepage, and quick-check behavior
- `public/assets/` — lesson illustrations and flags
- `public/assets/social-card.svg` and `.png` — editable source and 1200×630 social sharing image
- `public/favicon.svg` — shared browser-tab identity emitted through the page metadata component
- `public/audio/` — generated static MP3 lesson and assessment audio
- `private/voice-scripts.json` — approved audio text, voice alias, and stable output paths
- `private/audio-settings.json` — non-secret authoring settings for static audio generation
- `src/data/lesson-schema.mjs` — typed metadata contract and record validation
- `src/data/lesson-catalog.mjs` — automatic catalog, grouping, counts, URLs, status, references, and sequence navigation
- `src/data/migration-fingerprints.json` — preservation-only learner-content and interaction fingerprints
- `tools/validate-interactions.mjs` — generated-answer integrity for assessment choices, lesson quizzes, gaps, builders, matching, repairs, and typed work

Clean routes use `/lessons/{level}/{slug}/` and `/assessments/{slug}/`.
Historical `.html` URLs remain redirects generated from ready lesson metadata.

Each curriculum level presents one explicit assessment path. A0–B2 use the
comprehensive placement diagnostic before study. C1 uses the ready B2 exit
diagnostic as its entry evidence because the placement exam does not claim a C1
result. Learner evidence continues throughout each lesson sequence, followed by
the level’s own end diagnostic. The C1 end diagnostic remains planned and is not
linked as available. These relationships come from `assessment-routes.mjs`;
curriculum cards and final-lesson navigation use the canonical records rather
than rebuilding assessment URLs independently.

An exit diagnostic does not award a next-level or secure outcome from its total
percentage alone. The learner must also demonstrate at least 60% of the
teacher-scored speaking criteria, 60% of the writing criteria, and 50% of the
listening evidence. A high aggregate score with insufficient live evidence is
reported as **More live evidence needed**. The placement diagnostic uses the
same calculation when confirming a B1 or B2 starting point, including its
recognition-based listening tasks rather than teacher checkboxes alone.

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
  "title": "Present perfect continuous · B1 Grammar",
  "slug": "present-perfect-continuous",
  "level": "B1",
  "topic": "Present perfect continuous",
  "category": "Grammar",
  "contentType": "grammar",
  "status": "planned",
  "description": "Explain ongoing or recently finished activities with present results using have or has been plus the -ing form.",
  "sequence": 1,
  "prerequisites": ["a2/present-perfect"],
  "related": ["b1/past-perfect"],
  "assessments": ["b1-exit"]
});
---
```

Metadata field rules:

- `title` is the concise, unbranded document-title base: start with an
  uppercase letter and end with ` · {level} Grammar` or
  ` · {level} Vocabulary`. The shared page-title formatter adds
  `Thomas’s Classroom` when the complete title remains within the search-result
  length budget; do not add `Curriculum Map` or the brand manually.
- `slug` and `level` must match the file path exactly.
- `contentType` is `grammar` or `vocabulary`; `category` must be its matching learner-facing label.
- `status` is `planned` or `ready`.
- `description` is one complete, natural sentence of 80–180 characters. It
  states the learner outcome, ends with punctuation, and contains no migration
  artifacts such as spaces before punctuation or cut-off words.
- `sequence` is a unique positive integer inside the level and defines the course order.
- prerequisite and related lesson IDs use `{level}/{slug}` in lowercase.
- A ready A1–C1 lesson identifies at least one real prerequisite. A0 is the
  foundation level and may begin without one.
- prerequisites must be ready lessons that occur earlier in the A0–C1 path;
  forward references, duplicates, and cycles fail validation. Related lessons
  may point forward because they describe useful connections rather than entry
  requirements.
- a ready lesson links exactly once to its own level exit diagnostic, such as
  `a1-exit`.
- duplicate IDs, routes, topics, or level sequence values fail validation.

### Record lesson quality evidence

Quality claims live with the canonical lesson metadata in the optional
`qualityReview` object. Lessons without that object are treated as
`unreviewed`; they do not inherit an optimistic default from a separate list.

```json
"tutorReviewRequired": true,
"qualityReview": {
  "status": "editorial-review",
  "generatedPedagogy": true,
  "learnerPilotCount": 0,
  "scoredItemCount": 43,
  "revisionSummary": "State what was checked and what evidence is still missing."
}
```

The review path is `editorial-review` → `learner-pilot` → `reviewed`. Use
`revision-due` when live evidence reveals a material problem. A lesson cannot
be marked `reviewed` until at least three tutor-led learner pilots are recorded,
`reviewedBy` names the tutor, `reviewedOn` supplies a `YYYY-MM-DD` date, and
`tutorReviewRequired` is no longer true. Generated work remains explicitly
provisional in the tutor plan while that evidence is incomplete.

The tutor guide now derives a human review queue from these same fields. Open
`/tutor/`, choose a queued lesson, and print its learner-pilot worksheet from
the lesson-specific plan. The worksheet records only anonymous evidence: an
approximate starting level, the first point of friction, response to the first
hint, actual core time, independent production, later retrieval, and the
smallest proposed revision. It contains no form controls, submits nothing, and
stores nothing in the learner browser. Never record a learner’s name, email,
contact details, employer, or other identifying information.

After each real completed pilot, update only the canonical metadata count and
status. Use [`PRESENT-SIMPLE-PILOT.md`](PRESENT-SIMPLE-PILOT.md) when its deeper
lesson-specific protocol is useful. Do not backfill evidence from memory or
record learner-identifying information in the repo. The foundations batch is tracked in
[`FOUNDATIONS-QA-REPORT.md`](FOUNDATIONS-QA-REPORT.md); its machine-enforced
evidence still comes from the canonical lesson records and
`tools/validate-quality-review.mjs`.

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
planned filter, but no learner route is generated.

To publish that topic later, edit the existing file only: change `status` to
`ready`, import `LessonPage`, and add the lesson body. No other registration is
needed. A0–B2 are fully published. C1 uses this workflow now: the first three
lessons are ready pilots and lessons 4–19 remain planned. See
[`C1-AUTHORING.md`](C1-AUTHORING.md) for the batch and tutor-review process.

### Change lesson order

Change `sequence` in the affected level records so the values remain unique
and contiguous from 1. The catalog sorts by level and sequence; curriculum
order and previous/next links update together. Sequence never crosses levels.
If reordering moves a lesson before one of its prerequisites, the graph
validator fails and identifies the relationship that must be reconsidered.

### Link lessons and assessments

Add canonical lesson IDs to `prerequisites` or `related`. Add an assessment
slug to `assessments`. Unknown, self-referencing, duplicate, forward-pointing,
planned, or circular prerequisite relationships fail the catalog validation.
The same prerequisite graph appears in tutor plans and in each lesson’s
LearningResource structured data. The final lesson in a fully ready level uses
its canonical ready assessment relationship as the generated completion link.
A planned diagnostic remains visible as a relationship without creating a
false public link.

## Development

```bash
npm install
npm run dev
```

The site opens at [http://localhost:4321/](http://localhost:4321/).

To preview the latest generated production build with one stable local address:

```bash
npm run build
npm run preview
```

The production preview opens at
[http://127.0.0.1:4179/](http://127.0.0.1:4179/). The preview command remains
attached to its terminal; stop it with `Ctrl+C` when finished.

For a public build, provide the canonical origin. The approved homepage lesson
count, rating, review count, and Preply booking destination live in
`src/data/site-settings.mjs`; every homepage proof point derives from that
record, and deployment configuration cannot silently replace the approved
booking link. Check the owner-supplied release inputs first, then build. The
preflight reports the final domain and all missing or invalid MP3 files together
before spending time on a full build:

```bash
SITE_URL=https://your-domain.example npm run release:status
SITE_URL=https://your-domain.example npm run build:production
```

Deployment is configured as a static Cloudflare Pages release: project root
`astro-pilot`, build command `npm run build:production`, and output directory
`dist`. The build runtime is pinned in `.node-version`. After deployment, verify
the real host—not only the local artifact—with:

```bash
npm run live:validate -- https://your-domain.example
```

Replace the `.example` origin in these commands with the final public domain;
the production preflight deliberately rejects placeholder domains.

The live gate checks every public route, direct refreshes, the custom 404,
security headers, cache behavior, sitemap and robots discovery, all static audio,
and all generated permanent historical redirects. See `DEPLOYMENT.md` for the
complete launch and rollback runbook.

The production website never calls ElevenLabs and requires no ElevenLabs
credentials. Generate missing MP3s during authoring, then commit them with the
lesson or assessment that uses them:

```bash
npm run audio:status
npm run audio:generate
npm run audio:generate -- --clip a1-routine-message --regenerate
npm run audio:workflow:validate
```

The generated page places every static MP3 directly on a native audio control,
so normal playback works without JavaScript. The shared script coordinates
playback and exposes browser speech only when the static file is missing. The
offline workflow validator simulates provider success and failure without
network access or credentials.

The generator skips existing files unless a selected clip is explicitly
regenerated. Browser speech synthesis appears only when a configured static MP3
cannot be loaded. See `../ELEVENLABS.md` for the complete authoring workflow.

The existing Fraunces, Albert Sans, Newsreader, IBM Plex Sans, and IBM Plex Mono
families are self-hosted under `public/fonts/`; visitors do not connect to Google
Fonts. Shared `@font-face` declarations live in `src/styles/fonts.css`.
`FontStyles.astro` emits and links that stylesheet once per document instead of
duplicating it inside every page-family CSS bundle, while the font files retain
their immutable cache policy. The
original copyright notices plus the SIL Open Font License are kept beside the
font files. Run `npm run fonts:validate` after changing any font asset or
declaration. The validator checks approved checksums, license files, generated
references, and the absence of Google Fonts runtime URLs.

## Tutor planning

`/tutor/` is a searchable planning index generated from the same lesson catalog
that powers routes, curriculum discovery, and navigation. Every ready lesson
automatically receives a printable plan at
`/tutor/plans/{level}/{lesson-slug}/`. Plans include course position,
prerequisites, related lessons, the linked level diagnostic, a 50–65 minute
teaching sequence, after-lesson evidence prompts, and previous/next planning
links. Each plan also derives a lesson-specific outcome, central language
decision, high-value repairs, practice route, final production task, success
evidence, and next-use prompt from the learner lesson itself. They deliberately
store no learner records in the browser.

This does not introduce a second lesson registry. A0–A2 plans read their
specific practice titles, error-repair attributes, production cards, duration,
and next-use prompt from the native `.astro` lesson source. B1–C1 plans consume
the same exported structured lesson object that renders `StructuredLesson`.
Adding or editing a lesson therefore updates its learner page and tutor plan
together. `src/lib/tutor-plan.mjs` owns this build-time derivation, and
`npm run tutor:validate` rejects thin, duplicate, or disconnected plan output.

Printable plans are `noindex, follow` and excluded from the sitemap; the tutor
guide itself remains indexable. This keeps search results focused on learner
lessons while still making every plan directly refreshable and shareable with a
tutor who has its URL.

## Blog authoring

The Blog is a native Astro content collection. The index and article routes are
generated from the MDX files in `src/content/blog/`; there is no card registry or
route list to maintain. Each post supplies validated frontmatter:

```mdx
---
title: A clear article title
description: A complete search and sharing description between 80 and 180 characters.
published: 2026-07-15
category: Methodology
audience: Learners + tutors
minutes: 8
featured: false
---
```

To publish a field note, add one lowercase hyphenated `.mdx` file with this
metadata and write the article body with `##` section headings. The filename
becomes `/blog/{slug}/`; the post then appears on `/blog/`, receives article
social metadata and BlogPosting structured data, enters the sitemap, and joins
related reading automatically. `npm run blog:validate` checks the current
three-post editorial release, metadata, article depth, learning-path links,
direct-refresh routes, schemas, and sitemap membership.

## Dictionary authoring

`/dictionary/` is a curated, fully static word-clearing tool for screen-shared
lessons. Its 26 headwords, 76 individual meanings, and 224 reusable chunks live
in `src/data/dictionary.mjs`. Each entry owns its pronunciation, forms, word
story, optional lesson relationship, and two or more senses. Each sense includes
a CEFR level, part of speech, simple definition, natural examples, useful
chunks, close words, and a contrast that helps the learner choose accurately.

Search, level, and part-of-speech filters update the URL, so a focused result can
be refreshed or shared. “Meaning clear” checkboxes are deliberately temporary:
they support the current lesson and are never written to browser storage. The
complete collection remains readable when JavaScript is unavailable.

To add a word, add one validated entry to `dictionary.mjs`; there is no separate
page registry. Link to an existing clean lesson route when a strong practice
relationship exists, then run:

```bash
npm run dictionary:validate
npm run build
```

The build prevents duplicate words and meanings, thin entries, missing levels,
unlabeled clear controls, persistent learner state, learner-time network calls,
incomplete DefinedTermSet structured data, and missing direct-refresh output.

## Language-transfer authoring

`/languages/` turns cross-linguistic influence into a practical teaching path.
The canonical registry in `src/data/language-transfer.mjs` contains 27 patterns
across Spanish, Portuguese, and Turkish. Each pattern records the source-language
logic, a clearly labeled possible transfer, a natural English rebuild, an
explanation, two production examples, a tutor move, a CEFR level, a decision
category, and one or two lesson IDs.

Lesson IDs are resolved through the canonical lesson catalog. Unknown, planned,
or removed lessons fail validation instead of leaving a dead “Target” label.
The guide deliberately uses no learner profiling, checkboxes, progress state, or
browser storage: patterns are hypotheses to test against a learner’s actual
production.

To add a pattern, edit its language record once, choose an existing ready lesson
ID such as `a1/present-simple`, and run:

```bash
npm run language-transfer:validate
npm run build
```

The build checks minimum depth, unique IDs, A0–B2 coverage, natural examples,
tutor prompts, native disclosure semantics, practice links, direct-refresh
output, and the language-guide ItemList schema.

For Cloudflare Pages, use `npm run build:production` as the build command and
`dist` as the output directory. Set `SITE_URL` to the final public HTTPS origin.
The generated `_headers` file keeps HTML fresh, caches hashed Astro bundles for
one year, caches the versioned self-hosted fonts for one year, gives replaceable
images and audio a short revalidation window, and adds the site’s security
policy. The content security policy intentionally allows fonts and network
connections from this site only.


## Build and validation

```bash
npm run build
```

For the local release-quality pass, build the production artifact and exercise
the generated pages in an installed Chromium browser:

```bash
npm run qa:release
```

`browser:validate` starts its own local Astro preview and drives a separate
headless Chromium installation through the browser debugging protocol. It never
auto-launches `/Applications/Google Chrome.app`, adds no website runtime
dependency, and never changes production behavior. Set
`BROWSER_BIN=/absolute/path/to/chromium` if headless Chromium is installed
somewhere nonstandard. Set `BROWSER_QA_URL=http://localhost:4321` to reuse an
existing local preview instead of starting a second one. The smoke test covers homepage
mobile navigation and breakpoints, curriculum URL/filter state, lesson feedback
and generated sequencing, the quick diagnostic’s keyboard radio behavior and
result flow, and a complete A2 exit-diagnostic journey: missing evidence,
correct recognition and teacher scoring, rejection of an aggregate pass with
weak live production, seven-skill results, focused result summary, shareable
record, reset behavior, and missing-static-audio fallback.
It also covers Dictionary search and private clear marks, Language Transfer
disclosures and direct anchors, horizontal overflow, direct refreshes, and
browser console errors.

The build performs lesson-schema validation, Astro diagnostics, static generation, sitemap and
robots creation, route/link/asset validation, document metadata and heading checks,
editorial description length and sentence-integrity checks,
American English consistency across canonical records, learner-facing source,
and rendered pages,
unique-ID checks, intrinsic image-dimension checks, accessible button-name checks,
semantic image-alternative checks that permit empty alt text only for
illustrations paired with equivalent visible vocabulary labels,
named-link and navigation-landmark checks, ordered heading hierarchy, and
protection against interactive controls inside assistive-technology-hidden
content,
homepage no-JavaScript readability and truthful pre-enhancement rating values,
complete Open Graph/Twitter large-card metadata and social-image dimensions,
exact learner-text fingerprint checks, interaction-count checks, 2,425 semantic
answer-contract checks, audio-reference
validation, direct-refresh output checks, historical redirect checks, 404 recovery
checks, structured-data and sitemap membership checks, production cache and
security-header checks, curriculum-wide pedagogy contour and practice-density checks,
cross-skill exit-readiness scenarios that prevent recognition-only advancement,
single-source tutor-plan routes and relationships, validated MDX field notes and
BlogPosting schemas, the searchable multi-sense Dictionary and DefinedTermSet
schema, validated language-transfer guides and targeted lesson relationships,
licensed self-hosted font checksums and local-only font references,
CSS/JavaScript/page/asset/font performance budgets, and a
scan for forbidden compatibility patterns.

Selectable lesson answers preserve intentional capitalization, so contrasts such
as `Japan` / `japan` and `October` / `october` score honestly. Typed-answer
drills remain case-insensitive and normalize straight and curly apostrophes.
On every lesson load, the shared interaction engine uses a Fisher-Yates shuffle
for tap-to-fill choice banks, matching tiles, sentence-builder tiles, and each
quiz item’s answer options. Assessment answer cards use the same shared
randomizer. The shuffled DOM order is also the visual and keyboard order, and
it stays stable while the learner attempts or resets the activity. Question
order, error-sentence tokens, reference sequences, and reveal-card sequences do
not shuffle because their order may carry meaning.

If a future response bank must preserve a meaningful scale or sequence, put
`data-fixed-order` and a specific `data-fixed-order-reason` on that bank or its
interaction root. The interaction validator rejects undocumented opt-outs.
Do not use fixed order merely to make an answer key easier to remember.

The interaction validator also proves that every keyed assessment or quiz answer
matches exactly one option, every gap answer exists in its bank, every sentence
can be assembled from its single-use tiles, and every matching or repair target
is reachable. It inventories every randomizable response bank and confirms that
all fixed-order exceptions are documented. It also compares each option’s hidden scoring value with the
learner-visible button label. The current 30 deliberate differences are
explicitly classified as `case`, `token`, or `semantic`; any unmarked mismatch
fails the build.

The headless browser release check also opens every published lesson route and
confirms that each eligible response bank receives the runtime `randomized`
state. This catches a missing client bundle or a lesson-specific initialization
failure that a source-only inventory could not detect.

To serve the production build locally:

```bash
npm run serve
```

The local server serves only `dist/`; it has no API, ElevenLabs proxy, database,
or framework runtime. It applies the generated `_redirects` rules, returns the
branded `404.html`, sends correct HTML/XML/font/image content types, and mirrors
the production asset cache tiers. Verify that contract without opening a port
or browser:

```bash
npm run preview:validate
```
