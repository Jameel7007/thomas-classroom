# Live-teaching audit — August 2026

**Standard applied:** can Thomas teach any current student from this site, live, on
video, sharing his screen, with no preparation beforehand?

**Scope:** 96 ready lessons (A0 16 · A1 20 · A2 19 · B1 19 · B2 19 · C1 3) plus 16
planned C1 stubs and 7 assessments. Read pass weighted to A1/A2/B1.

**Method.** All 23 source validators were run first and all 23 pass. They check
structure only — keyword presence, interaction counts, word floors — so nothing
they cover is repeated here. On top of that, every scored item in the site was
machine-checked against the exact comparison semantics in `src/scripts/lesson.js`
(4,743 items: 2,777 choice-gap, 1,399 quiz, 201 tile-builder, 296 spot-error, 70
typed input). Every internal link in all 318 built pages was resolved. The
remainder is a hand read of answer-key semantics and rule statements.

---

## 1. Broken or wrong

**Ten dead audio files — every exit assessment at every level.**

| Clip | Referenced at | Expected file |
|---|---|---|
| `a0-spell-jameel` | `src/content/assessments/a0-exit.astro:154` | `public/audio/assessments/a0-exit/spell-jameel.mp3` |
| `a0-price-forty` | `src/content/assessments/a0-exit.astro:190` | `…/a0-exit/price-forty.mp3` |
| `a1-routine-message` | `src/content/assessments/a1-exit.astro:189` | `…/a1-exit/routine-message.mp3` |
| `a1-weather-plan` | `src/content/assessments/a1-exit.astro:196` | `…/a1-exit/weather-plan.mp3` |
| `a2-train-delay` | `src/content/assessments/a2-exit.astro:198` | `…/a2-exit/train-delay.mp3` |
| `a2-doctor-appointment` | `src/content/assessments/a2-exit.astro:205` | `…/a2-exit/doctor-appointment.mp3` |
| `b1-project-update` | `src/content/assessments/b1-exit.astro:161` | `…/b1-exit/project-update.mp3` |
| `b1-community-report` | `src/content/assessments/b1-exit.astro:168` | `…/b1-exit/community-report.mp3` |
| `b2-research-briefing` | `src/content/assessments/b2-exit.astro:164` | `…/b2-exit/research-briefing.mp3` |
| `b2-policy-consultation` | `src/content/assessments/b2-exit.astro:171` | `…/b2-exit/policy-consultation.mp3` |

`public/` contains zero audio files of any kind. These are the only broken links in
the built site.

The page does not hard-fail. `src/scripts/assessment.js:627–671` swaps in a "Use
browser voice" button on the `<audio>` `error` event. But `AudioControl.astro:12`
sets `preload="none"`, so the 404 is not discovered until the play button is
pressed. Live, that sequences as: normal-looking player → tutor clicks play →
nothing happens → the control disappears and is replaced → browser
speech-synthesis voice starts. Two further consequences: the synthesized voice
plays through the tutor's own speakers, so on a video call the student hears
nothing unless system-audio sharing is on; and the substituted voice is not the
approved recording, so the listening item is no longer testing what it was
written to test.

`tools/validate-audio.mjs:33` classifies missing MP3s as a *warning*, not an error,
unless `--require-files` is passed — and no script in `package.json` passes it.
That is why the build is green with every clip missing.

**Nothing else is broken.** Stating the negative precisely, because it is the main
result of this section:

- No unanswerable items. Every `data-answer` in all 4,743 scored items resolves to
  a selectable option, a constructible tile sequence, or a tappable word, under the
  same case- and apostrophe-sensitivity the runtime actually applies (`choiceNorm`
  at `lesson.js:59` does not lowercase; `norm` at `lesson.js:53` does).
- No double-keyed items, no duplicate options, no tile builder whose answer leaves
  unused tiles or needs a tile that isn't there.
- No dead internal links across 318 pages apart from the ten MP3s above.
- No incorrectly stated rule found in the A1/A2/B1 read pass. The hard cases are
  handled correctly, including `unless` paraphrase (`a2/first-conditional.astro:172`,
  `:249`), `as…as` with a base adjective (`a2/comparatives-and-superlatives.astro:250`),
  `used to` vs `be used to` + gerund (`b1/used-to-would-for-past-habits.astro:293`),
  tag polarity after `nobody` (`b1/question-tags.astro:272`), truthful `No, I haven't`
  (`b1/question-tags.astro:275`), `say`/`tell` complementation (`b1/reported-speech.astro:278`),
  and refusing the passive on an intransitive (`b1/passive-voice.astro:277`).
- Numeric facts stay consistent across drills within a lesson. In
  `a2/comparatives-and-superlatives.astro` the room set (Cedar 42 m²/30 dB/$55,
  Pine 30 m²/35 dB/$40, Maple 50 m²/35 dB) is used identically at lines 83–87,
  130–137, 172–177, 233 and 312–314.

---

## 2. Unusable live

**The teacher's listening script is printed on the student's screen. 77 lessons.**

Every tutor-read listening section stores the lines the tutor must read aloud in a
`<details>` on the learner page — the same page being screen-shared. Example:
`a1/was-were.astro:225`, whose `<summary>` reads "Open the teacher script after
checking" and which contains the six sentences (`The workshop was useful.`, `The
rooms weren't ready.`, …) that the student is supposed to identify by ear at
`:215–220`. To read them, Thomas must open the disclosure, which displays them.
Same shape at `a2/past-simple.astro:253` and across all 77 lessons carrying
`data-lesson-extension="Tutor-read …"`.

The script exists nowhere else. `src/lib/tutor-plan.mjs` does not surface listening
scripts (no match for script/transcript/clip anywhere in its 161 lines), and lesson
pages never link to `/tutor/plans/…` — that route is reachable only from
`/tutor/index.astro:77,126`. So there is no second surface to read from.

**Lessons are two to three times longer than a 50-minute slot, and nothing marks a
stopping point.** Rendered visible words and scored items per lesson:

| Level | n | words min/median/max | scored items min/median/max | `<h2>` sections (median) |
|---|---|---|---|---|
| A0 | 16 | 1,200 / 2,112 / 2,274 | 24 / 43 / 49 | 12 |
| A1 | 20 | 1,501 / 2,628 / 2,897 | 43 / 54 / 54 | 11 |
| A2 | 19 | 2,407 / 2,768 / 3,047 | 54 / 54 / 55 | 14 |
| B1 | 19 | 2,869 / 3,251 / 4,472 | 55 / 66 / 71 | 16 |
| B2 | 19 | 1,548 / 4,013 / 4,828 | 14 / 80 / 82 | 14 |
| C1 | 3 | 1,771 / 1,842 / 1,910 | 13 / 13 / 13 | 10 |

A median B1 lesson is 66 scored items across 16 sections. At twenty seconds per
item — fast, with a tutor correcting — that is 22 minutes of pure item-work before
any explanation, speaking, or feedback. `b2/non-defining-relative-clauses` is 4,828
words and 79 items. There is no duration field in the lesson schema
(`src/data/lesson-schema.mjs` carries only `status`, `scoredItemCount`,
`learnerPilotCount`, `generatedPedagogy`, `revisionSummary`), and no "if you have
30 minutes, do these sections" marker in `LessonPage.astro` or the tutor plan. The
decision of where to stop is made live, every lesson, with no guide on the page.

**Drill cues carry a stage-direction preamble that has to be read past.** The gap
sentences are prefixed with an evidence frame rather than starting at the language:
"The fictional train log shows an on-time departure on every recorded day. It
[always] leaves on time." (`a1/adverbs-of-frequency.astro:93`); "The fictional
media log records zero television viewing." (`:96`); "The fictional equipment
profile says he owns a laptop." (`a1/have-got.astro:93`). Roughly half of each cue
is scaffolding for why the answer is determinate. On a shared screen the student
reads the whole line, and the tutor either reads it aloud or paraphrases it on the
fly.

**Section headings in five lessons don't say what's on screen.** See §4 — the five
`StructuredLesson` lessons label sections "Notice before the rule", "Discover the
system", "Build controlled accuracy", "Communicate". Scanning for the teaching
point mid-call gives no signal.

**Navigation is fine and is not a finding.** `/curriculum/` has a live search box
(`CurriculumFinder.astro:25`, placeholder "Try 'present perfect' or 'travel'") plus
level filters and `?level=` / `#lvl-A2` deep links, and every lesson has prev/next
(`LessonSequenceNavigation.astro:29–34`). Reaching any lesson is a search and a
click.

---

## 3. Gaps that block a real student

Ranked by how often it comes up.

**1. Irregular verb forms. No page exists.** From A2 onward this is the single most
common mid-lesson lookup, and it is needed in past simple, present perfect, past
perfect, both passives, reported speech and all narrative work — a large fraction
of A2, B1 and B2. `a2/past-simple.astro` drills `went`, `took`, `bought`, `said`
(lines 155–158) and describes itself as covering "regular & irregular verbs", but
prints no list of forms. Searching the whole of `src/` for "irregular verb" returns
three lessons, all using the phrase in passing. `src/data/dictionary.mjs` holds 26
entries total (`be, from, name, have, get, make, do, take, work, like, mean, right,
still, just, since, while, miss, matter, run, set, turn, would, experience,
actually, issue, claim`). A student asking "what's the past participle of *bring*"
has nothing to open.

**2. Possessive `'s`. Never taught.** `a0/possessive-adjectives.astro` covers only
my/your/his/her/its/our/their, and is explicit about it at line 39 ("One small word
… my phone, your manager"). Its contrast drill at line 121 distinguishes possessive
*words* from the `it's` contraction, not from possessive `'s` on a noun. Nothing in
the catalog teaches noun + `'s`. An A0/A1 student trying to say "Maria's book" —
which arrives immediately, in the family, jobs, and rooms lessons — has no page.

**3. Irregular plurals. One sentence, and it points somewhere that can't help.**
`a0/regular-plural-nouns.astro:111` is the whole treatment: it names
person→people, child→children, man→men, woman→women, then advises "check a
dictionary when you are unsure" for the `-o` and `-f/-fe` classes. The site's own
dictionary has none of `foot`, `tooth`, `photo`, `tomato`, `knife`, `leaf`. The
lesson's stated fallback does not exist on the site.

**4. C1 is three lessons.** Sixteen of the nineteen C1 files are
`status: "planned"`, and `src/data/lesson-catalog.mjs:26` refuses to route a planned
lesson, so they are not pages at all. The two B2-to-C1 students have exactly
`c1/advanced-tense-and-aspect-review`, `c1/narrative-tenses-and-viewpoint`, and
`c1/mixed-and-implied-conditionals` — and all three are the site's thinnest lessons
at 13 scored items (see §4). Missing and unroutable: inversion, participle clauses,
reduced relatives, nominalization, hedging, cleft structures, cohesion, concession,
referencing, and six more.

---

## 4. Inconsistency across lessons

**Two lesson architectures produce visibly different pages.** Five lessons render
via `<StructuredLesson>`; the other 91 are hand-authored markup.

- `b2/connotation-and-shades-of-meaning`, `b2/phrasal-verbs`
- `c1/advanced-tense-and-aspect-review`, `c1/mixed-and-implied-conditionals`,
  `c1/narrative-tenses-and-viewpoint`

Those five are exactly the five thinnest lessons in the site: 14, 14, 13, 13 and 13
scored items, against a B2 median of 80. A student going from `b2/full-passive` (82
items, 4,460 words) to `b2/phrasal-verbs` (14 items, 1,559 words) is doing something
that barely resembles the same course.

The headings diverge too. `b2/phrasal-verbs` labels its sections by method —
"Retrieval bridge", "Notice before the rule", "Discover the system", "Build
controlled accuracy", "Communicate", "Reflect and transfer". `b2/full-passive`
labels its sections by content — "Choose the camera angle without hiding
responsibility", "Report claims without changing their time or certainty", "Notice
and repair the broken layer".

This passes validation because `tools/validate-pedagogy.mjs:44–56` branches: a
lesson rendering `StructuredLesson` is checked for the presence of
notice/discover/build/communicate/reflect keys and is exempted from the
"at least 8 interactive mechanics" floor that the other 91 must meet.

**Tense names change capitalization at the A2→B1 boundary.** A0–A2 write "past
simple", "present perfect", "present simple" in lowercase; B1 and B2 switch to
"Past Simple", "Present Perfect". Files using each convention:

| Level | lowercase | Capitalized |
|---|---|---|
| A0 | 1 | 0 |
| A1 | 11 | 0 |
| A2 | 9 | 0 |
| B1 | 3 | 9 |
| B2 | 2 | 6 |
| C1 | 2 | 0 |

The switch lands exactly where several students are crossing.

**The same control has ten different labels.** The tutor-script disclosure is
called: "Open the teacher script after checking" (25 lessons), "Tutor script and
transcript" (17), "Tutor transcript and evidence notes" (16), "Teacher: open the
script after the learner checks" (7), "Reveal the listening evidence" (6), "Open
the tutor listening check" (6), "Tutor script · open only after the learner answers"
(3), "Tutor script and listening key" (2), "Tutor script and delivery notes" (2),
"Tutor script and answers" (2).

---

## 5. Quick wins

Each of these is under 30 minutes.

1. **Make missing audio fail the build instead of warning.** In `package.json`,
   change `node tools/validate-audio.mjs` to `node tools/validate-audio.mjs
   --require-files` in the `build` script. `validate-audio.mjs:33` already
   implements the flag. This stops the ten dead clips from being invisible.

2. **Make the fallback appear before the click, not after it.** In
   `src/components/assessment/AudioControl.astro:12`, change `preload="none"` to
   `preload="metadata"`. The `error` handler at `assessment.js:671` then fires on
   load, so the "Use browser voice" button is already in place when Thomas reaches
   the listening item, instead of the control mutating mid-lesson.

3. **Fix the dictionary pointer in the plural lesson.** `a0/regular-plural-nouns.astro:111`
   ends "check a dictionary when you are unsure". Either name the four irregulars it
   already lists as the ones to memorize and drop the pointer, or add `foot`,
   `tooth`, `photo`, `tomato`, `knife`, `leaf` to `src/data/dictionary.mjs` so the
   advice resolves on the site.

4. **Standardize the ten `<summary>` labels to one string.** A single
   find-and-replace across `src/content/lessons/*/*.astro` to
   `Tutor script — do not open on a shared screen`, which also documents the
   §2 hazard in place until the script is moved.

5. **Normalize tense-name capitalization in B1 and B2 to the lowercase A0–A2
   convention.** Fifteen files, mechanical replacement of "Past Simple" →
   "past simple", "Present Perfect" → "present perfect", "Present Simple" →
   "present simple", "Past Perfect" → "past perfect".

6. **Regenerate the ten MP3s** if the ElevenLabs key is still available —
   `npm run audio:status` reports what is pending and `npm run audio:generate`
   writes them; `private/voice-scripts.json` already holds the approved text for
   all ten clips, so nothing needs writing.

Not a quick win, listed here only so it isn't mistaken for one: moving the tutor
listening scripts off the learner page (§2) touches 77 lessons and needs a decision
about where they go — most likely rendered into `/tutor/plans/[level]/[slug]`, which
already exists as a route but currently carries no script content.
