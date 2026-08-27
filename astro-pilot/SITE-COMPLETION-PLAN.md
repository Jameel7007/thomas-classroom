# Thomas’s Classroom — completion and launch plan

## Goal

Complete Thomas’s Classroom as a production-ready, premium A0–B2 English
curriculum: finish the planned lessons and meaningful level assessments,
preserve the native Astro authoring system, make the learning path easy to
discover and teach from, meet a dependable accessibility/SEO/performance
baseline, and prepare a reliable public launch.

## Definition of complete

The site is complete for its first public release when:

- every canonical A0–B2 topic has a native, editable, production-ready lesson;
- every completed level has a meaningful end diagnostic covering receptive and
  productive evidence, not only grammar recall;
- lesson metadata, routes, discovery, sequencing, and navigation remain
  single-source and schema-validated;
- the production build validates all routes, internal links, assets, audio
  references, redirects, content fingerprints, and native interactions;
- representative page families work at 320px through desktop, with keyboard and
  screen-reader state exposed by the shared interaction engines;
- canonical URLs, sitemap, robots discovery, and page metadata use the public
  HTTPS domain;
- a learner can reach a real booking or contact destination;
- all public claims and unfinished editorial areas have been approved, completed,
  or deliberately hidden from primary navigation.

## Current checkpoint

### Complete

- **Native architecture:** Astro 7, no legacy passthrough or compatibility layer.
- **Curriculum:** 92 of 92 topics available across A0, A1, A2, B1, and B2.
- **Pedagogy:** B1 and B2 use the reusable structured lesson system with
  Notice → Discover → Build → Drill → Communicate → Reflect safeguards.
- **Spoken-language coverage:** all 92 lessons now teach an explicit
  pronunciation, stress, rhythm, reduction, or connected-speech feature in the
  context of the lesson language. The source and rendered pedagogy gates reject
  a ready lesson if this spoken-form guidance is removed.
- **Assessment:** every level visibly moves from the comprehensive A0–B2
  placement diagnostic through lesson evidence to a real level-specific exit
  diagnostic; the build enforces placement depth, skill coverage, minimum
  evidence logic, and canonical entry/exit relationships. Exit outcomes require
  the aggregate threshold plus 60% speaking, 60% writing, and 50% listening;
  recognition-heavy scores cannot independently confirm advancement. Placement
  B1/B2 confirmation now correctly includes its listening evidence.
- **Authoring:** one canonical lesson record derives routes, curriculum data,
  finder results, counts, availability, redirects, and previous/next links.
- **Prerequisite path:** 188 canonical prerequisite relationships now connect
  every ready A1–B2 lesson to earlier language. The catalog rejects missing
  upper-level entry knowledge, forward or planned dependencies, duplicates,
  cycles, and mismatched level diagnostics; the same competencies appear in
  tutor plans and lesson structured data.
- **Discovery:** searchable and filterable curriculum with direct URL state.
- **Quality gate:** Astro diagnostics, static generation, internal links,
  assets, audio IDs, direct refreshes, historical redirects, fingerprints,
  interactions, and forbidden compatibility patterns are automated. A semantic
  interaction audit now verifies 2,425 generated answer contracts, including
  unique selectable answers, option-bank reachability, multiword sentence
  builders, matching targets, repair targets, typed responses, and agreement
  between hidden scoring values and visible labels. Thirty-four intentional
  case/token/semantic variants are explicit rather than silently exempt.
- **Answer correctness:** two mismatched B1 listening keys were repaired, and
  selectable lesson grading now preserves intentional capitalization contrasts
  while typed work remains learner-friendly and case-insensitive.
- **Editorial language consistency:** learner-facing lesson, assessment,
  curriculum, tutor, and editorial output uses American English spelling. A
  source-and-rendered-output gate rejects common mixed-convention forms while
  allowing preserved historical route slugs.
- **Technical SEO baseline:** complete editorial titles, descriptions, and
  canonicals across page families, with source and rendered-output gates that
  reject duplicate or overlong page titles, stale title suffixes, social-title
  mismatches, truncated copy, invalid description length, repeated whitespace,
  and spaces before punctuation; lesson breadcrumbs, complete large-card Open
  Graph/Twitter metadata with a branded 1200×630 image, shared browser identity,
  sitemap, robots endpoint, and a noindex 404 recovery page.
- **Production release gate:** the public build requires an HTTPS origin and
  rejects local, reserved, and placeholder domains; its preflight reports every
  missing static MP3 before the full build and prevents environment
  configuration from diverging from the approved Preply destination. The output
  gate then verifies public claims, static audio, canonicals, sitemap, and robots
  output in the generated artifact.
- **Host release gate:** the build derives 102 permanent Cloudflare Pages
  redirects from canonical route data, pins the build runtime, and includes a
  post-deployment validator for every public route, live header/cache policy,
  custom 404, sitemap, audio file, and historical redirect.
- **Local artifact preview:** the static-only Node preview now serves `dist/`,
  applies generated redirects, returns the branded 404, uses correct content
  types and cache tiers, and exposes no ElevenLabs endpoint. A socket-free build
  validator proves this behavior even in restricted environments.
- **Static-audio authoring QA:** assessment clips render as native static
  `<audio src>` controls without a JavaScript dependency. An offline provider
  simulation verifies missing-file generation, existing-file skips, dry runs,
  targeted regeneration, stable paths, request settings, failure reporting,
  MP3 signatures, secret-safe output, and preservation of an existing recording
  after a failed regeneration.
- **Layout stability:** all rendered lesson illustrations declare intrinsic
  dimensions, lazy loading, and asynchronous decoding.
- **Image accessibility:** all 414 lesson illustrations with empty alternative
  text are deliberately redundant with a visible vocabulary label in the same
  card. The rendered accessibility gate rejects empty-alt images outside that
  labeled pattern, generic alternative text, and filename-like descriptions.
- **Document semantics:** every rendered link has an accessible name, repeated
  navigation landmarks have unique names, headings do not skip levels, and
  interactive elements cannot sit inside `aria-hidden` content. The homepage,
  print curriculum, and two migrated A0 lessons were repaired after the
  curriculum-wide heading audit.
- **Performance regression guard:** every build enforces individual CSS,
  JavaScript, HTML, and public-asset limits plus total bundle and output budgets.
  The eight self-hosted font declarations are emitted once as a shared linked
  stylesheet instead of being duplicated across page-family bundles, preserving
  useful headroom below the 200 KB combined CSS/JavaScript ceiling.
- **Responsive QA:** representative homepage, curriculum, B2 lesson, and B2
  diagnostic views tested from 320px through desktop without horizontal overflow.
- **Runtime release QA:** a dependency-free local browser gate launches the
  generated production site in Chromium and verifies critical homepage,
  curriculum, lesson, quick-check, full exit-diagnostic, Dictionary, and
  Language Transfer journeys. The exit-diagnostic path covers keyboard radio
  state, missing and complete evidence, teacher-scored production, seven-skill
  results, result focus, shareable records, reset, and static-audio fallback;
  the wider gate also checks feedback, direct refreshes, console health, and
  layouts from 320px through desktop.
- **Runtime failure diagnostics:** the browser gate captures Chromium output and
  recognizes both exit codes and signal termination, so a missing browser,
  operating-system restriction, or launch failure reports its real cause rather
  than degrading into a generic startup timeout.
- **Progressive homepage:** the complete public homepage remains readable with
  JavaScript unavailable; the loader and custom cursor disengage, reveal content
  and correction states remain visible, and rating values remain truthful. The
  animated experience and accessible mobile menu remain intact when enhanced.
- **Tutor planning:** a searchable A0–B2 tutor index and 92 printable session
  plans derive from the native lesson source, including prerequisites, related
  work, diagnostics, sequencing, teaching stages, outcomes, central language
  decisions, repairs, practice routes, production tasks, success evidence, and
  next-use prompts. The build enforces 92 distinct substantive briefs rather
  than a repeated generic shell.
- **Editorial release:** three substantial native MDX field notes are published
  with automatically generated routes, article metadata, BlogPosting structured
  data, related reading, sitemap membership, and build-time content-quality checks.
- **Word clearing:** the Dictionary is a searchable, URL-aware A0–B2 collection
  with 26 headwords, 76 distinct meanings, word origins, examples, reusable
  chunks, close-word contrasts, lesson links, and private in-session clear marks.
- **Language transfer:** Spanish, Portuguese, and Turkish now have 27 validated
  contrastive patterns spanning A0–B2, with responsible-use framing, natural
  rebuilds, tutor prompts, and direct relationships to 27 ready lessons.

### Owner input required before the public release

1. **Canonical domain** — choose the HTTPS production origin and set it as
   `SITE_URL` during the production build. A build without this value correctly
   remains a local preview and produces localhost canonicals.
2. **Static assessment audio** — run the authoring-only generator with private
   ElevenLabs credentials to create the 10 configured MP3 files. The production
   gate deliberately refuses to launch without those files, while the deployed
   website itself requires no ElevenLabs credential or request.

The booking destination is now the approved Preply profile. The public lesson
claim (**1000+ lessons taught**), rating, and review count are canonical,
source-controlled proof points rather than duplicated homepage literals.
Production audio is pre-generated static MP3 only. The Blog and Dictionary are
complete public sections rather than placeholder launch decisions.

## Remaining release sequence

### Release gate 1 — product decisions

- Record the domain and generate the 10 approved static assessment clips. The
  booking, claims, audio architecture, first Blog release, and Dictionary
  decisions are already recorded in source and docs.
- Keep these decisions in deployment documentation rather than scattering them
  through lesson source.

### Release gate 2 — final public shell

- **Complete:** the homepage’s primary, FAQ, and closing calls to action use the
  approved booking destination, while the complete curriculum remains available
  beside the primary action.
- **Complete:** author-only homepage notes are removed from public HTML, and the
  build rejects their return alongside other draft language.
- Keep the useful 404 page and branded social sharing image in the build gate.
- Add a concise privacy page if analytics, contact forms, or other data collection
  are enabled. The public site now self-hosts its fonts and static audio; document
  any future visitor-time third-party service before enabling it.

### Release gate 3 — production verification

Build with the real origin and approved launch inputs:

```bash
SITE_URL=https://your-domain.example npm run release:status
SITE_URL=https://your-domain.example npm run build:production
```

Then verify:

- `/`, `/curriculum/`, one lesson per level, all seven assessments, and the 404;
- `/robots.txt` and `/sitemap-index.xml` contain the production HTTPS origin;
- the booking/contact path works from desktop and mobile;
- audio uses the approved production behavior without exposing API credentials;
- keyboard-only navigation, visible focus, reduced motion, and live feedback;
- a screen-reader smoke test on one lesson drill and one assessment result;
- no browser console errors, broken links, missing assets, or horizontal overflow;
- a final performance run on the homepage, curriculum, an image-heavy A0/A1
  lesson, a B2 lesson, and an assessment.

Run the host-level gate after deployment:

```bash
npm run live:validate -- https://your-domain.example
```

### Release gate 4 — launch and observation

- Deploy the exact validated build artifact.
- Test direct refreshes on the public host and confirm historical `.html`
  redirects.
- Submit the sitemap to the chosen search-console account.
- Monitor 404s, audio failures, and core web vitals for the first two weeks.
- Collect learner/tutor friction notes before expanding features.

## Post-launch priorities

These improve the product but do not need to delay a curriculum-first v1 once
the release gates above pass:

1. Turn the most persistent language-transfer patterns into dedicated production
   lessons after real tutoring evidence shows which contrasts need more than the
   current linked A0–B2 practice paths.
2. Continue the editorial calendar with language-transfer and practical learner notes.
3. Grow the curated Dictionary when real lesson friction reveals another high-value word.
4. Add periodic screen-reader regression QA and expand the existing runtime
   browser gate when new interaction families are introduced.
5. **Complete:** the existing type families are self-hosted with immutable
   caching, source checksums, license notices, a local-only font policy, and no
   visitor-time Google Fonts request. Continue measuring image and type loading
   against field performance data after launch.

## Change discipline

- Keep lessons and assessments native Astro/MDX.
- Keep lesson creation single-source.
- Do not reintroduce compatibility layers, client-side compilers, or duplicate
  registries.
- Treat `npm run build` as the non-negotiable release gate.
- Preserve learner content fingerprints unless a content change is intentional and
  reviewed.
