# AGENTS.md — English Curriculum Map

Read this before making changes. This file is the working spec for coding agents in this project.

## What This Is

This project is a premium web curriculum for one-on-one English tutoring, used live over screen share with adult learners.

The current implementation is a fully native Astro 7 static site in `astro-pilot/`. Lessons and assessments are directly editable `.astro` source, with reusable layouts, interaction engines, styles, and assets owned by the Astro project. Do not recreate the deleted static-HTML compatibility layer.

The main map currently has top-level tabs:

- Curriculum
- Placement Exam
- Bio
- Languages
- Blog
- Dictionary

The teaching approach blends the Thinking Method / Language Transfer style with modern TEFL practice:

- short noticing-focused theory
- guided discovery before explanation
- high student production
- interactive drills and tile games
- clear form-meaning-use work
- content anchored in the learner's real life
- a speaking prompt or production task at the end of each lesson

Because this is shown on a shared screen, every page must be calm, readable at a distance, and uncluttered.

## Current File Structure

```text
astro-pilot/
  src/pages/                       site and dynamic route entries
  src/content/lessons/{level}/     54 native lesson components
  src/content/assessments/         7 native assessment components
  src/components/lesson/           shared lesson UI and interaction engine
  src/components/assessment/       shared assessment UI and scoring engines
  src/data/                        curriculum and native route inventories
  src/styles/                      design tokens and shared styles
  src/scripts/                     bundled client-side behavior
  public/assets/                   lesson images and flags
  private/voice-scripts.json       approved server-side audio text
```

Keep user-facing implementation in `astro-pilot/`. Generated `.astro/`,
`dist/`, and `node_modules/` directories are ignored and must not be committed.

## Design Direction

The site should feel warm, premium, teacherly, and approachable. Avoid generic SaaS styling, dark/moody palettes, noisy effects, or stock-template layouts.

Use:

- characterful serif titles
- friendly readable sans-serif body/UI text
- generous spacing
- quiet labels and metadata
- soft surfaces and restrained borders
- shared screen readability as a constant constraint

Current visual language is editorial and paper-like, using Newsreader, IBM Plex Sans, and IBM Plex Mono. Preserve that unless the user explicitly asks for a redesign.

## Lesson Method

Every lesson should follow this general contour:

1. **Notice** — show a tiny language sample and ask what the learner notices.
2. **Discover** — turn the observation into a simple rule or pattern.
3. **Build** — controlled practice: gaps, matching, sorting, substitution, sentence building.
4. **Drill** — repetition with feedback, contrast, and increasing fluency.
5. **Communicate** — personalize with real-life prompts, pair prompts, or mini role play.
6. **Reflect** — close with a quick self-check or next-use prompt.

Theory should be short. The student should do most of the work.

## Drill Rules

Drills are the craft of this project.

- Use shared styles from `astro-pilot/src/styles/lesson.css` and `drills.css`.
- Use shared behavior from `astro-pilot/src/scripts/lesson.js` through the native lesson exercise engine.
- Do not hardcode one-off drill colors, spacing systems, or unrelated app variables.
- Answers should not be visible before the student attempts or chooses to reveal/check.
- Exercises should be interactive by default. Do not leave fill-the-gap or sorting tasks as static blanks.
- Correct and incorrect attempts should trigger visible feedback animation using the shared lesson styles/scripts.
- Keep each drill item constrained enough to have one expected answer.
- Avoid items where grammar, vocabulary, spelling, and interpretation are all being tested at once.
- Prefer chunks over isolated words: `there is`, `do you`, `his name`, `I am`, `she is`.

Reusable interactions currently available:

- answer drills with `data-answer-drill`
- click-to-fill gap drills with `data-choice-gap-drill`
- tile games with `data-tile-game`
- sentence builders with `data-tile-builder`
- error spotting with `data-spot-error`
- oral transforms with `data-transform`

When adding new mechanics, make them reusable Astro components or extend the shared native engine, then document the classes and attributes in the Astro README.

## Lesson Page Rules

Lesson pages live at:

```text
astro-pilot/src/content/lessons/{level}/{slug}.astro
```

Examples:

```text
astro-pilot/src/content/lessons/a0/subject-pronouns.astro
astro-pilot/src/content/lessons/a1/present-simple.astro
astro-pilot/src/content/lessons/a2/present-perfect.astro
```

The curriculum map links grammar and vocabulary items automatically using the native route inventory and slug helper.

Slug rule:

- lowercase
- remove parenthetical notes
- replace non-alphanumeric runs with hyphens
- do not include a file extension in the public route

Before creating a lesson, check the generated map link and match its filename.

## Curriculum Map Rules

The map should remain:

- searchable
- filterable by level
- linked from grammar and vocabulary items to lesson pages
- free of progress tracking or objective checkboxes

The user tracks student progress separately, so do not reintroduce student progress UI unless asked.

Assessments are now part of the curriculum map. This is not the same as a student-record dashboard. Each level should show an ability path:

- a start check before the level
- lesson-level micro quizzes and drills
- an end-of-level check
- evidence phrased as what the student can do

Assessment content should demonstrate real improvement across grammar, vocabulary, listening, reading, speaking, and writing. Avoid tests that only measure rule memorization. Good assessments ask the student to notice, choose, build, correct, speak, write, and use language in a realistic situation.

For student-facing level checks, use selectable answer tiles or multiple-choice
cards by default. Avoid tiny typed blanks, especially during screen-shared
lessons. Teacher-scored speaking and production evidence may still use
checkboxes. Do not use end-of-level questions whose answer merely repeats an
obvious label, such as asking what belongs in a field labeled `Name`. Instead,
combine information in profiles, forms, messages, schedules, introductions,
and complete sentences so the item provides useful diagnostic evidence.

Assessment pages live at:

```text
astro-pilot/src/content/assessments/{level}-entry.astro
astro-pilot/src/content/assessments/{level}-exit.astro
astro-pilot/src/styles/assessment.css
astro-pilot/src/scripts/assessment.js
```

Examples:

```text
astro-pilot/src/content/assessments/a0-entry.astro
astro-pilot/src/content/assessments/a0-exit.astro
```

Reusable assessment interactions currently support:

- selected-answer questions with `data-option`
- typed-answer questions with `data-answer`
- teacher-scored evidence with `data-credit`
- ElevenLabs-backed listening clips with `data-voice-clip`
- score bands and feedback labels on the `data-assessment` root
- skill breakdowns via `data-skill`
- reset, check, print summary, and success/error animation

Listening audio is served through `server.mjs`; never place an ElevenLabs API
key in HTML or browser JavaScript. Approved clip text lives in
`astro-pilot/private/voice-scripts.json`, and generated MP3 files are cached privately
in `.audio-cache/`. Keep `data-speak` on audio buttons as an accessibility and
local-development fallback. See `ELEVENLABS.md` for setup and authoring.

Assessment result records are generated by the shared `assessment.js` file.
They include student name, date, score/outcome, skill profile, and a teacher
note. Results are not silently stored in the browser. The teacher deliberately
keeps each record by copying the text into chat or notes, taking a screenshot
of the result card, or using Print / save PDF. This is the preferred static-site
workflow until a real authenticated student database is added.

When building the next level assessments, copy the A0 entry/exit pattern first, then adjust content and pass thresholds.

## Placement Exam Direction

The Placement Exam is separate from lesson quizzes and level checks. It should be student-facing, thorough, and used to estimate a learner's current CEFR level before choosing a starting path.

Placement exam pages live at:

```text
astro-pilot/src/content/assessments/placement-exam.astro
```

The placement exam should:

- estimate A0-B2, not just return a percentage
- show a level ladder across A0, A1, A2, B1, and B2
- show a skill profile across grammar, vocabulary, reading, function, writing, and speaking
- include a recommended starting point, not only a level label
- require enough attempted evidence before showing a CEFR estimate
- include teacher-scored speaking and writing evidence
- include teacher-read listening evidence or audio-backed listening tasks
- include progressive reading passages, not only isolated sentence questions
- avoid childish low-level tasks
- avoid ambiguous blanks that could have multiple correct answers
- keep unscored options visually neutral; use color mainly after checking
- present results as an estimate confirmed by teacher judgment, not a permanent label

The main exam should be more comprehensive than the smaller level tests. Level checks demonstrate progress inside the curriculum; the placement exam decides where the learner should begin.

A serious placement diagnostic should be built in passes:

1. Language use and vocabulary by level band.
2. Reading progression from notices/messages to argument/inference.
3. Listening evidence with teacher scripts hidden until used.
4. Writing and speaking rubrics marked by the teacher.
5. Result analysis with level, confidence/evidence coverage, starting point, strengths, and priorities.

## Content Standards

Use American English spelling unless the user requests otherwise.

Spell language names in full when language-specific content is added. Do not use two-letter language codes in student-facing copy.

Keep examples adult, natural, and useful for live tutoring. Prefer realistic student contexts:

- work
- family
- travel
- daily routines
- city life
- study goals
- conversations with teachers, coworkers, clients, and friends

Avoid childish examples unless explicitly requested.

For A0 and other very low levels, keep the language simple but preserve adult dignity. Do not use babyish recognition tasks like isolated letter picking unless the user explicitly asks for literacy testing. Prefer forms, profiles, short messages, teacher instructions, introductions, bookings, schedules, and other real beginner contexts.

## Product Direction

The native Astro foundation now supports:

- content collections for lessons and blog posts
- directly editable Astro lesson files, with MDX available where it improves authoring
- reusable Astro drill components
- a browse page
- a word-clearing tool
- Cloudflare Pages hosting

The ergonomic goal remains:

```text
adding a lesson = create one content file with metadata + body
```

The lesson should then appear in the path, level page, and browse page automatically.

## Blog Direction

The Blog tab is the future home for teacher-facing and student-facing writing. Starter topics include:

- visible progress and assessment
- CEFR explained clearly
- the Thinking Method in English lessons
- L1 transfer patterns by language
- practical English learning advice for adult students

For now, blog cards can be static draft lanes. Later, turn posts into real content pages or a content collection.

## Word Clearing Direction

The Dictionary tab and floating dictionary are the first interface pass for the planned word-clearing tool. The full tool should:

- let the tutor search a word during a lesson
- return simple learner-friendly definitions
- include etymology where possible
- include idioms and synonyms
- support marking individual meanings as cleared

Keep API keys server-side if this becomes networked later.

## Language Transfer Direction

The Languages tab is the home for L1-to-English transfer work. Each language should collect common and uncommon transfer errors and link them to targeted lessons.

Important examples to develop:

- Spanish: `para / por`, `conocer / saber`, age with `tener`, false friends, do-support.
- Portuguese: `ficar`, `saudade / sentir falta`, age with `ter`, `fazer` into make/do/ask.
- Turkish: articles, English word order, `var / yok`, present simple vs present continuous.

These should become proper lessons over time, not just notes.

## Build And Verification

Run the project from `astro-pilot/` with `npm run dev`. Do not open generated HTML files directly when testing interactions.

Before completing frontend work, run `npm run build`. This checks Astro source,
generates every static route and redirect, validates internal links and assets,
checks audio clip IDs, verifies direct-route output, compares learner-content
fingerprints and interaction counts, and rejects compatibility-layer patterns.

After frontend changes:

- verify the relevant page loads
- check the browser console for errors
- test any changed interactions
- make sure the map link path resolves for new lesson pages
- check mobile-ish widths when layout changes are substantial

## Non-Negotiables

- Calm, readable shared-screen design.
- No student progress tracking UI unless requested.
- Grammar and vocabulary items should link to lessons.
- Drills use shared lesson styles.
- Student-facing answers stay hidden until an attempt, check, or reveal action.
- Every lesson ends with student production, not explanation.
- Keep new lesson authoring easy and self-organizing.
