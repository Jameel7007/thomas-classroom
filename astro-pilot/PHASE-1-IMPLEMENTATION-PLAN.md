# Phase 1 Implementation Plan: Content Accuracy and Pedagogical QA

**Status:** proposed for approval
**Date:** July 16, 2026
**Primary outcome:** every high-use lesson and assessment can show trustworthy evidence for accuracy, one-answer reliability, useful feedback, level fit, and tutor review.

This plan deliberately does not redesign the site, author all remaining C1 lessons, add accounts, or build a full learning-management system.

## The single most important next project

Create a **repeatable editorial QA system and apply it first to the A1 Present Simple lesson**. This one lesson is the best narrow slice because it is foundational, high-frequency, already thorough, and exposes the current product’s main quality gap: strong context and production paired with sparse item-level hints and several weak distractors.

The slice should prove the workflow before the team touches dozens of lessons.

## Phase 1 success measures

Phase 1 is complete when:

- 100% of in-scope lessons have a canonical review record;
- every in-scope controlled item has one defensible answer and an explicit rationale;
- at least 95% of first incorrect attempts receive a context-specific cue;
- every in-scope distractor maps to a real misconception or nearby concept;
- all in-scope spoken-form claims are human-reviewed and teachable;
- the ten configured assessment audio files are generated and human-approved;
- every level assessment has reviewed receptive keys and productive rubrics;
- at least three real lesson uses inform each lesson’s final review;
- every change passes Astro check, production build, route/link/asset/audio/interaction validation, direct refresh, and representative keyboard/mobile checks;
- no A0–C1 routes, canonical metadata relationships, or ready/planned counts regress unintentionally.

## Scope

### In scope

1. Review-state and QA evidence model.
2. One narrow Present Simple quality slice.
3. Batched review of the high-use grammar spine.
4. Review of all seven ready assessment formats.
5. Generation and review of the ten approved assessment clips.
6. Feedback-contract and semantic editorial validators.
7. Tutor-use notes and revision evidence.

### Out of scope

- broad visual changes;
- curriculum redesign or route renaming;
- a second lesson registry;
- all-catalog homework production;
- all-catalog multi-method conversion;
- new accounts, database, payments, or saved progress;
- authoring C1 lessons 4–19;
- C1 exit diagnostic implementation;
- live AI or visitor-time TTS.

## Workstream 1: QA evidence foundation

### 1.1 Decide the smallest single-source model

Recommended fields:

- `reviewStatus`: `unreviewed`, `editorial-review`, `learner-pilot`, `reviewed`, `revision-due`;
- `reviewedBy`;
- `reviewedOn`;
- `learnerPilotCount`;
- `lastRevisionSummary`;
- `nextReviewOn` or `nextReviewAfterUses`;
- `generatedPedagogy`: boolean where relevant.

Implementation constraint: metadata must remain attached to, or deterministically derived from, the canonical lesson source. Do not add a hand-maintained list that can disagree with `lesson-catalog.mjs`.

### 1.2 Migrate existing state honestly

- Existing A0–B2 lessons remain `ready` for route availability but begin as `unreviewed` or `legacy-reviewed` unless evidence supports a stronger label.
- The three C1 lessons remain `tutorReviewRequired` and must not be automatically upgraded.
- Planned C1 topics remain planned and receive no review status implying content exists.
- Assessment pages receive a parallel review record or a common content-review type.

### 1.3 Validation

Add failures for:

- a reviewed item without reviewer/date;
- a reviewed lesson still carrying `tutorReviewRequired`;
- a planned lesson carrying pilot/review claims;
- duplicate review records;
- unknown reviewer state;
- review metadata that changes public availability or routes accidentally.

### Exit criteria

- One canonical lookup returns lesson metadata plus review evidence.
- Curriculum, search, counts, sequence, and routes still derive from the existing source.
- Authoring documentation explains how a lesson moves through review.
- Current build passes before content editing begins.

## Workstream 2: Narrow first slice — A1 Present Simple

### Existing strengths to preserve

- adult routine/work context;
- clear positive/negative/question system;
- third-person spelling and pronunciation;
- present-simple meaning categories;
- retrieval bridge;
- controlled practice, builders, repair, oral transform, real-life prompts, reflection;
- existing public route and lesson styling.

### Problems to solve

1. Most items have no item-specific first-attempt hint.
2. Some distractors are visibly malformed or unrelated, so learners can guess without understanding.
3. Group feedback confirms a score but often does not explain the decisive cue.
4. The 55–65 minute lesson has no explicit core-versus-extension path.
5. The final “next use” does not yet provide a structured direct retrieval task.

### Required changes

#### Editorial item review

For every scorable item:

- identify the visible contextual cue;
- confirm one answer with natural U.S. English;
- document accepted alternatives where appropriate;
- replace giveaway distractors with plausible errors such as third-person agreement, auxiliary/main-verb interaction, routine versus happening-now meaning, and question word order;
- add a concise first-attempt hint;
- add a correction explanation when the distinction is conceptually important.

#### Core and extension path

- Mark a complete 45–55 minute core path.
- Place extra spelling, pronunciation, or fluency work in clearly optional extension sections if timing requires it.
- Keep open production inside the core path.
- Reflect the timing in the tutor plan, not through visual clutter on the student page.

#### Retrieval follow-up

Add a 5–10 minute direct or printable follow-up:

- two no-notes recall prompts;
- three contextual form/meaning decisions;
- one error repair;
- one 30–60 second routine recording or spoken response;
- answer/reveal only after commitment.

#### Regression validation

Add checks that prove:

- every audited item has a hint/rationale;
- the correct option appears exactly once;
- all options are unique;
- the public route remains `/lessons/a1/present-simple/`;
- previous/next navigation is unchanged;
- copied and accessible text remains correct;
- no existing interaction is lost.

### Tutor pilot protocol

Teach the revised lesson to at least three appropriate A1 learners. Record only anonymous product evidence:

- starting misconception;
- first explanation used;
- item(s) that caused uncertainty;
- whether the hint led to a correction;
- actual core time;
- quality of final production;
- what Thomas had to explain that the page did not;
- revision made afterward.

### Slice exit criteria

- Lesson scores at least 85/100 under `LESSON-QUALITY-STANDARD.md`.
- Thomas signs off on accuracy and teachability.
- Three pilot uses are recorded.
- No item remains ambiguous.
- At least 95% of wrong-answer paths provide specific guidance.
- Build and representative browser checks pass.

## Workstream 3: High-use grammar spine batches

Do not edit all lessons simultaneously. Use batches of 5–8 and finish review/pilot evidence before the next batch.

### Batch A — Foundations

1. A0 The verb **to be**
2. A0 Subject pronouns
3. A0 Articles **a/an**
4. A0 Possessive adjectives
5. A0 Question words
6. A0 This/that/these/those

Focus: simple instructions, adult dignity, one new system at a time, contractions, answer clarity.

### Batch B — A1 sentence engine

1. Present simple (completed first slice)
2. Present continuous
3. There is/there are
4. Have got
5. Can for ability/permission
6. Some/any with countable/uncountable nouns
7. Prepositions of time/place
8. Was/were

Focus: question/negative mechanics, time meaning, countability, social use, core-versus-extension scope.

### Batch C — A2 time and choice

1. Past simple
2. Past continuous
3. Present perfect
4. Be going to
5. Will for predictions/offers
6. First conditional
7. Modals: should/must/have to
8. Verb + infinitive/**-ing**

Focus: time reference, speaker choice, plausible meaning distractors, feedback that cites context.

### Batch D — B1 independence

1. Present perfect continuous
2. Past perfect
3. Passive voice
4. Reported speech
5. Second conditional
6. Relative clauses
7. Question tags
8. Discourse linkers

Focus: avoid template sameness, add listening where intonation matters, maintain paragraph-level meaning.

### Batch E — B2 precision

1. Third and mixed conditionals
2. Past perfect continuous
3. Modals of past speculation
4. Full passive
5. Reported speech
6. Cleft sentences
7. Advanced discourse markers
8. Register and formality

Focus: multiple defensible formulations, stance, register, information structure, sustained production, and cultural neutrality.

### Per-batch exit criteria

- All critical accuracy and answer-key issues resolved.
- Each lesson has a completed rubric and human reviewer.
- Every changed item has a rationale and feedback path.
- Three live uses per lesson, or a documented reason for a staged pilot before public “reviewed” status.
- Change report lists issues found, items rewritten, and open questions.
- Production build and representative direct-route refresh pass.

## Workstream 4: Assessment and audio QA

### Assessment inventory

- Quick level check
- Full A0–B2 placement diagnostic
- A0 exit diagnostic
- A1 exit diagnostic
- A2 exit diagnostic
- B1 exit diagnostic
- B2 exit diagnostic

### Review checklist

For each assessment:

- confirm its stated purpose and ceiling;
- map every item to level and skill evidence;
- prove each controlled key from visible/heard context;
- remove items that merely repeat obvious labels;
- verify option plausibility and position balance;
- confirm productive rubric descriptors are observable;
- confirm the result language does not claim certification;
- verify incomplete live evidence blocks overconfident advancement;
- check reset, print summary, skill profile, direct refresh, and accessible feedback.

### Static audio work

Configured clips:

1. `a0-spell-jameel`
2. `a0-price-forty`
3. `a1-routine-message`
4. `a1-weather-plan`
5. `a2-train-delay`
6. `a2-doctor-appointment`
7. `b1-project-update`
8. `b1-community-report`
9. `b2-research-briefing`
10. `b2-policy-consultation`

For each clip:

- review script before generation;
- generate locally with the existing authoring utility;
- listen for pronunciation, pace, phrasing, stress, noise, and truncation;
- confirm file path and transcript;
- test static playback and missing-file speech fallback;
- confirm browser playback makes no ElevenLabs request;
- record reviewer/date/settings version.

### Calibration pilot

For at least ten full-diagnostic cases, record anonymously:

- recognition score by level/skill;
- listening score;
- speaking/writing rubric evidence;
- teacher-confirmed starting point;
- disagreement between automated estimate and teacher judgment;
- lesson performance after placement where available.

Do not market these ten cases as scientific validation. Use them to identify obvious threshold and item problems.

### Assessment exit criteria

- All 10 clips exist and pass review.
- No assessment relies on live visitor-time TTS.
- Every item has a skill/level/rationale record.
- Productive evidence remains necessary at the stated levels.
- Placement still states A0–B2 and does not infer C1.
- At least ten cases are reviewed before changing threshold claims.

## Workstream 5: Shared feedback contract

The engine currently supports hints and progressive help, but content coverage is uneven.

### Required behavior

- No answer before an attempt.
- First failure gives a relevant cue.
- Second failure narrows or supplies a usable partial model.
- Reveal/check gives the complete answer and concise reason when necessary.
- Correct feedback states the decisive reason on contrast items.
- Feedback is a polite live region and is not color-only.
- Reset clears state, attempts, classes, and feedback.

### Architecture rule

Extend existing components and `lesson.js`; do not create per-lesson scripts or a new exercise engine. Existing native Astro pages, routes, and styling remain intact.

### Exit criteria

- Shared components accept item rationale/hint/fix data.
- Legacy lesson markup still works.
- Audited lessons meet feedback coverage targets.
- Keyboard, arrow-key radio behavior, focus, live announcements, reduced motion, and mobile layout pass.

## Workstream 6: Documentation and release report

Update author documentation with:

- exact review-state workflow;
- item rationale and distractor examples;
- tutor pilot template;
- how to generate/review static audio;
- what “reviewed” means;
- how critical reported errors are triaged;
- how to add a new lesson without duplicate registration.

The Phase 1 report should list:

- lessons/assessments reviewed;
- reviewer and date;
- pilot uses;
- issues found by category;
- items rewritten;
- audio generated;
- unresolved risks;
- build/validation results;
- lessons still unreviewed.

## Recommended delivery cadence

| Stage | Typical duration | Deliverable |
| --- | --- | --- |
| Foundation | 2–4 focused days | Review model, migration, validators, documentation |
| Present Simple slice | 3–5 focused days plus real lesson time | One reviewed lesson, richer feedback, retrieval follow-up, QA report |
| Each grammar batch | 1–2 weeks plus pilots | 5–8 reviewed lessons and evidence report |
| Assessment/audio pass | 4–7 focused days plus calibration sessions | Reviewed clips/items/rubrics and preliminary cases |

Calendar time depends on access to appropriate learners. Do not mark a batch reviewed merely to meet a date.

## Validation matrix

| Check | Every code/content batch | Present Simple slice | Assessment/audio |
| --- | ---: | ---: | ---: |
| Catalog/schema validation | ✓ | ✓ | ✓ relationships |
| Astro check | ✓ | ✓ | ✓ |
| Production build | ✓ | ✓ | ✓ |
| Route/direct-refresh validation | ✓ | ✓ | ✓ |
| Internal links/assets | ✓ | ✓ | ✓ |
| Answer/interactions validator | ✓ | ✓ | ✓ |
| Feedback coverage validator | ✓ | ✓ | ✓ |
| Audio manifest/files | when relevant | if added | ✓ |
| Keyboard/focus/live feedback | representative | ✓ full | ✓ full |
| 320/375/768/desktop widths | representative | ✓ | ✓ |
| Reduced motion | representative | ✓ | ✓ |
| Human accuracy review | ✓ all changed | ✓ | ✓ |
| Tutor pilot | 3 uses/lesson target | ✓ | calibration cases |

## Risks and controls

| Risk | Control |
| --- | --- |
| Review metadata becomes a duplicate registry | Keep it in lesson source or derive it by canonical lesson ID with validation; one authoritative lookup only. |
| QA edits erase tutor-tested strengths | Preserve original outcome/context unless a documented issue requires change; report every material rewrite. |
| The rubric rewards length | Use level/time bands as guidance; score outcome focus and cognitive load, not word count. |
| Hints reveal answers too early | Enforce progressive help and test first/second attempt behavior. |
| Advanced items have multiple natural answers | Add context, accept equivalents, or make the task open/teacher-scored instead of forcing a false key. |
| Synthetic audio models poor prosody | Human-listen every clip; use native recording or tutor-read input when nuance cannot be modeled reliably. |
| Pilot evidence contains personal data | Record only anonymous product observations; never store names, recordings, or identifying details without explicit consent and policy. |
| Scope expands into multi-method redesign | Finish Phase 1 quality slice first. Multi-method UI belongs to Phase 2 approval. |

## Approval requested

Approve this single first implementation task:

> **Implement the QA evidence foundation and apply it only to A1 Present Simple:** add canonical review evidence, audit every scorable item, improve distractors and contextual feedback, label the core/extension path through the tutor plan, add one short retrieval follow-up, add regression checks, and prepare it for three tutor-led pilot uses.

No other lesson content, site design, routes, curriculum data, accounts, or payment systems should change in that first task.
