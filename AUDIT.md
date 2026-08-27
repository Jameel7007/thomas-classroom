# AUDIT.md — Read-Only Audit: State, Contrast, Consistency

Date: 2026-07-18. Scope: `astro-pilot/` (Astro site, CEFR A0–C1, "Thomas's Classroom").
All contrast ratios below were **computed** (WCAG 2.x relative luminance, with oklch→sRGB
conversion and alpha compositing), not estimated. Thresholds: 4.5:1 body text,
3:1 large text (≥24px, or ≥18.66px bold) and UI components/focus indicators.

No files were changed. Suggested replacements stay inside the existing warm
red/paper palette and were all verified to pass.

---

## (a) Current state summary

### What's built

| Area | State |
|---|---|
| Lessons A0–B2 | **92 files, all `ready`** (A0: 16, A1/A2/B1/B2: 19 each). Matches the B1/B2 blueprints exactly. |
| Lessons C1 | 19 files, only **3 ready** (`advanced-tense-and-aspect-review`, `narrative-tenses-and-viewpoint`, `mixed-and-implied-conditionals`); the other 16 are metadata-only stubs with no rendered route. |
| Assessments | 7 built: `a0–b2-exit`, `placement-exam`, `quick-level-check`. `c1-exit` is registered as `planned` in `assessment-routes.mjs` but has no content file (intentional per `C1-AUTHORING.md`). No `{level}-entry` files exist — entry is handled by the placement exam. |
| Blog | Real content collection, 3 published MDX posts (not static draft lanes anymore). |
| Dictionary | Native registry, 76 entries. |
| Languages | 30 L1-transfer patterns (Spanish/Portuguese/Turkish). |
| Tutor area | Plan pages generated for every ready lesson, plus `PilotEvidenceWorksheet`. |

### Plan vs reality gaps

1. **C1 is 84% unbuilt** — the only substantive content gap on the site.
2. **No learner pilots completed** — every QA report shows `0 of 3` pilots and
   `editorial-review` status on every lesson; the tutor-sign-off gate is open across all levels.
3. **AGENTS.md is stale**: says "54 native lesson components" (actual: 111 files, 95 ready),
   "27 patterns" in Languages (actual: 30), and documents an `{level}-entry.astro`
   assessment pattern that was never built (placement exam took its role).
4. **B2-QA-REPORT.md header stale**: says "first seventeen sequential lessons implemented";
   all 19 are ready.
5. `lesson-catalog.mjs` is derived by scanning lesson files and validating metadata at
   build time, so there are **no orphan catalog entries and no unregistered lessons** —
   the catalog cannot drift from the file tree. Zero TODO/FIXME/"coming soon" markers in `src/`.

### What already passes (for confidence)

The core token system is in good shape. Computed on `--paper #ECE8E1` / `--surface #F2EFE8`:

- `--text-primary #111111`: 15.5–16.4:1 · `--text-secondary #4D483F`: 6.7–7.9:1 ·
  `--text-muted #5C574E`: 5.3–6.2:1 — all pass with room.
- `--accent-deep #B82912` as text on paper/surface/tint: 5.1–5.4:1 — passes.
- Semantic `--good`/`--wrong` pairs and the drills.css state inks: 4.8–9.8:1 — all pass.
- The per-level oklch accent system (curriculum map, tutor, print — hues 28/70/150/245/305/345):
  `oklch(0.46 0.13 H)` as text passes at **every hue** (5.47–6.28:1); `oklch(0.58 0.13 H)`
  as bullets/borders passes 3:1 at every hue (3.31–3.73:1). No per-level fix needed.
- The dark result cards (`.result-record`, `.placement-level`): even the 62% color-mix
  paper text computes to 6.4:1 on `#111111` — passes.

---

## (b) Contrast fixes, ranked by severity

### Severity 1 — hard AA failures in shared CSS (hit every lesson/assessment)

**1. `--accent #FF3B1F` used as text or the only indicator — 2.92:1 on paper, 3.10:1 on surface.**
Fails 4.5:1 always, and fails the 3:1 UI bar on paper. Fixes, in palette:
as text → `--accent-deep #B82912` (5.11:1); as fill/large UI where the bright red matters →
`#D62E0E` (4.04:1 on paper); as a button background with paper text → `#C22C10` (4.70:1).

| File / selector | Current | Ratio | Suggested |
|---|---|---|---|
| `src/styles/lesson.css` ~L79 `.cal-mark` (calendar "today" disc) | `#ECE8E1` text on `#FF3B1F` | 2.92:1 | disc bg → `#C22C10` (4.70:1) |
| `src/styles/quick-level-check.css` L23–25 progress fill; `assessment.css` L83–91 + L108–113 meter/level bars | `#FF3B1F` fill on `#ECE8E1` track | 2.92:1 | fill → `#D62E0E` (4.04:1); on `#F2EFE8` tracks current is 3.10:1 (borderline pass) — same swap recommended |
| `src/styles/tokens.css` L57 `.page-skip:focus` outline | `#FF3B1F` on paper | 2.92:1 | outline → `#B82912` (5.11:1), matching site.css focus rings |
| `src/styles/assessment.css` L191–197 `.answer-input` focus border | `#FF3B1F` 1.5px | 2.92:1 | `#B82912` |
| `src/styles/assessment.css` L199–200 `.credit-check` `accent-color` | `#FF3B1F` | 2.92:1 | `accent-color:#B82912` |

**2. Interactive control borders in `#CDC8BC` — 1.37:1 on paper, 1.45:1 on surface (UI bar is 3:1).**
This is the biggest washed-out-on-Zoom risk: input boundaries and drop-zones nearly vanish
under compression. Verified replacement: **`#8A8477`** (3.04:1 on paper, 3.24:1 on surface).
Scope this to *interactive* controls only — decorative card/table borders may stay light.

| File / selector | Current | Suggested |
|---|---|---|
| `src/styles/site.css` L46 `.finder-field input/select` 1px border | `#CDC8BC` | `#8A8477` |
| `src/styles/assessment.css` L60–62 form inputs; L191 `.answer-input` 1.5px bottom border | `#CDC8BC` | `#8A8477` |
| `src/styles/drills.css` L85–104 `.choice-gap.is-empty`, `.slot` dashed drop-zone borders | `#CDC8BC` dashed | `#8A8477` dashed |
| `src/styles/quick-level-check.css` L80–85 `.speaking-score select` | `#CDC8BC` | `#8A8477` |
| dictionary/languages inputs (`dictionary.css` L1) | `#CDC8BC` | `#8A8477` |

**3. `src/styles/assessment.css` ~L124 `.check-item.is-partial` border — `oklch(0.68 0.13 80)` = 2.39:1.**
The partial-credit state is the least visible of the four states. → `oklch(0.55 0.12 80)` (4.02:1).

**4. `src/styles/assessment.css` L162–167 `.listen-btn` playing state — `#B82912` on `#F6D3CB` = 4.49:1.**
Just under 4.5 at 13px/600. → text `#A82410` (5.16:1), or keep `#B82912` and use
`--accent-tint #FBE7E1` as the playing bg (5.24:1).

### Severity 2 — hard AA failures on single pages

**5. `src/styles/home.css` (landing page — own palette, does not import tokens.css):**

| Selector | Current | Ratio | Suggested |
|---|---|---|---|
| L305–308 `.kicker`, L284–290 `.pen-note`, L429–436 `.tutor-note`, L255–264 `.stage-label b.is-active` | `#FF3B1F` text at 11–12.5px on `#ECE8E1` | 2.92:1 | `#B82912` (5.11:1) — keeps red identity |
| L255–264 `.stage-label b` (inactive) | `#55524B` at opacity .4 | **1.85:1** | opacity ≥ .8, or full-opacity `#8A8477`-range gray; inactive-but-meaningful step labels shouldn't be ghosted this far |
| L400–408 `.faq-item a` | `#FF3B1F` 600 inline in 1rem text on `#F2EFE8` | 3.10:1 (needs 4.5) | `#B82912` (5.44:1) |
| L99–100 `.nav-link:hover` | `#FF3B1F` on paper | 2.92:1 | `#B82912` — hovered nav text is still text |
| L202–219 `.btn:hover` | `#ECE8E1` text on `#FF3B1F` fill | 2.92:1 | fill → `#C22C10` (4.70:1) |
| L134–137 focus rings | 3px `#FF3B1F` vs paper | 2.92:1 (needs 3:1) | `#B82912` or `#111111` |
| L340–356 `.scard .transfer` | `#D32A10` mono 12px on `#ECE8E1` | 4.19:1 | `#C22C10` (4.70:1) or `#B82912` |

**6. `src/styles/curriculum-print.css` — `--muted #837F76` on white = 3.99:1.**
Used for 9.5–12px labels (`.cover .overline`, `.index-title span`, `.index-hours`,
`.level-cefr`, `.section-label`, `.sheet-foot`). Fails 4.5:1 and these sheets are also
viewed on screen. → `#6E6A61` (5.39:1).

**7. `src/content/lessons/a0/the-verb-to-be.astro` L438+ — rogue `<style is:global>`.**
Its re-themed `--text-muted` `oklch(0.56 0.012 65)` on its near-white paper = **4.48:1** (fails).
Don't patch the color — **delete the whole block** (see consistency §1); the shared tokens
it suppresses all pass.

### Severity 3 — AA-exempt but bad over a compressed screen share

WCAG exempts disabled states, but at these ratios they effectively disappear on Zoom:

- `src/styles/drills.css` L81 `.tile:disabled` — opacity .3 → **1.98:1**. This is the
  "spent tile" state students need to perceive during tile games. Suggest opacity .55
  (≈4:1-equivalent) or a solid `#8A8477` text treatment.
- `src/styles/quick-level-check.css` L50–53 `.primary-button:disabled` — opacity .4 → 1.97:1.
- `src/styles/site.css` L76–79 `.finder-reset:disabled` — opacity .55 → 2.35:1.

Hover-only affordances (invisible to students watching, who can't see your cursor's hover
state reliably over compression): `.site-tab` color-only hover (site.css L29),
card border `#CDC8BC → #FF3B1F` hovers (`.stop`, `.blog-card`), transfer-pattern summary
bg-mix hover. No AA violation; consider persistent affordances later — out of scope for
this phase's zero-layout-change rule.

Legibility-at-distance (contrast passes, size is the problem — flagging only, since fixing
means typography changes): `dictionary.css` sense meta at **8–9px** mono uppercase;
`languages.css` labels at **8–9.5px**; recurring 10–10.5px mono labels across site.css.
Also `home.css` L38–42 applies a noise overlay at opacity .07 over the whole landing page —
mildly degrades every pair on that page and compresses badly on video.

---

## (c) Consistency issues

1. **`a0/the-verb-to-be.astro` (L438–end) ships a ~70-line `<style is:global>`** that
   redefines `:root` with an abandoned pre-migration palette (near-white paper, hue-28
   muted accent, old Newsreader/IBM Plex fonts) and re-declares `body`, `.wrap`, `.kicker`,
   `h1`, `h2`, tables, etc. Because it loads after `lesson.css`/`tokens.css`, this one lesson
   renders with a different background and accent than the entire site — and introduces its
   own AA failure (§b.7). The markup already uses the standard classes; the block can be
   deleted outright. **This is the single highest-value fix in the audit.**
2. **The A2 Present Perfect "multi-method pilot" is not a structural outlier.**
   `a2/present-perfect.astro` is fully standard: shared `LessonPage`, shared drills, no
   embedded styles, richest-but-conforming section flow. The "pilot" character lives in
   metadata (`qualityReview`, 49 scored items) and the tutor-side `PilotEvidenceWorksheet`,
   not in the lesson markup. Note: `PRESENT-SIMPLE-PILOT.md` documents the **A1
   present-simple** pilot — if you believed A2 present-perfect had bespoke pilot code,
   nothing needs re-unifying there.
3. **Two authoring paradigms coexist**: 90 inline-HTML lessons vs 5 `StructuredLesson`
   data-driven lessons (2 in B2, 3 in C1). The two B2 StructuredLesson files
   (`phrasal-verbs`, `connotation-and-shades-of-meaning`) are also the only A0–B2 lessons
   **missing the `qualityReview`/`tutorReviewRequired` metadata** — the newer path didn't
   adopt the bookkeeping convention.
4. **Deliberate-looking drill-mix drift by level** (flagging, not necessarily a defect):
   A0 is transform-heavy; A2 vocab lessons drop `data-transform` entirely while A2 grammar
   keeps 13–15; **B1 uses zero transform/tile/answer drills across all 19 lessons**
   (choice-gap only); B2 partially restores transforms. If oral transforms are core to the
   method, B1 is the outlier level.
5. **Page-local palettes bypass tokens.css**: `home.css` defines its own `:root`
   (`--ink-soft #55524B` vs the shared `#4D483F`, hardcoded cobalt `#1D3EE8`, `#D32A10`);
   `curriculum-print.css` likewise (`#837F76` muted, `#D32A10` accent-deep default).
   Both mostly pass AA (§a), but drift means future token fixes won't reach these pages.
6. Minor: `a0/colours-and-basic-adjectives.astro` hardcodes 18 swatch hexes
   (defensible — the colors *are* the content) and one inline `margin-top:2.4rem`.
7. Metadata is otherwise uniform: all 92 in-scope lessons carry all 12 required schema
   fields; the build-time validator makes field-name drift impossible.

---

## (d) Recommended order of work

Each step is independently shippable; 1–4 are pure color-value edits with zero layout risk.

1. **Delete the `<style is:global>` block in `a0/the-verb-to-be.astro`** — one deletion
   fixes the site's only whole-page visual drift plus a contrast failure. Verify the page
   against a sibling A0 lesson afterward.
2. **Shared-CSS severity-1 fixes** (§b.1–4): accent-as-indicator swaps, interactive
   border darkening to `#8A8477`, partial-state amber, listen-btn. This clears every
   lesson, assessment, and the curriculum map in one pass. Run `npm run build` +
   `npm run qa:release` after.
3. **home.css fixes** (§b.5) — self-contained file, no effect on the rest of the site.
4. **curriculum-print.css muted** (§b.6) — one token line.
5. **Disabled-state visibility floor** (§b Severity 3) — small opacity changes; worth doing
   for screen share even though WCAG exempts them.
6. **Docs cleanup**: AGENTS.md counts (111 lessons / 95 ready, 30 patterns, remove the
   `{level}-entry` pattern), B2-QA header. Add `qualityReview` blocks to the two B2
   StructuredLesson files.
7. **Later / needs your call** (out of this phase's scope): 8–9px dictionary/languages
   label sizes, persistent (non-hover) affordances, B1 drill-mix question, C1 buildout.
