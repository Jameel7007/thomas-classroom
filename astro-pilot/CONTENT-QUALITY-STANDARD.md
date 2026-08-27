# Thomas’s Classroom Content Quality Standard

This is the release standard for every lesson and assessment in the A0–B2
curriculum. A page is `ready` only when its learner experience, tutor value,
interaction quality, and technical behavior all satisfy this document.

## Lesson definition of done

### 1. Learning purpose

- The lesson has one clear communicative outcome appropriate to its CEFR level.
- Examples are adult, natural, and useful in work, family, travel, study, or city life.
- Prerequisites and related lessons are accurate in the canonical lesson
  record. A prerequisite is ready, genuinely needed, and earlier in the course
  path; it is not merely another interesting topic.
- The canonical description is a complete 80–180 character sentence that states
  the learner outcome. It has no cut-off words, repeated whitespace, or spaces
  before punctuation.
- Learner-facing copy uses American English spelling consistently. Historical
  route slugs may retain their established spelling, but titles, topic labels,
  explanations, options, diagnostics, curriculum copy, and tutor output do not
  mix conventions.
- Vocabulary load does not make the grammar task harder than the target structure.

### 2. Learning sequence

Every lesson includes the complete teaching contour:

1. **Notice** — a short sample that invites observation before terminology.
2. **Discover** — a learner-friendly rule connecting form, meaning, and use.
3. **Build** — constrained practice with one defensible expected answer.
4. **Drill** — repeated retrieval, contrast, and increasingly fluent production.
5. **Communicate** — a realistic personalized task, exchange, or role play.
6. **Reflect** — a brief self-check and a specific next-use prompt.

### 3. Theory standard

Theory is layered instead of delivered as one long block. It must explain:

- what the form looks and sounds like;
- what meaning the form contributes;
- when a speaker chooses it instead of a nearby alternative;
- word order, agreement, contractions, and pronunciation where relevant;
- two or three high-value learner errors and how to repair them;
- at least one contrast that reveals the underlying grammar rather than a memorized rule.

The short discovery explanation comes first. A fuller reference can follow after
the learner has worked with examples. Thoroughness should create clarity, not a
wall of terminology.

### 4. Practice standard

- Answers remain hidden until an attempt, check, or deliberate reveal.
- Controlled items test the lesson target rather than spelling, rare vocabulary,
  and interpretation at the same time.
- Distractors represent plausible learner errors, not random wrong answers.
- A selectable answer matches exactly one option after the same normalization
  used by the browser engine. Capitalization contrasts remain distinct when
  capitalization is part of the choice; typed responses remain forgiving.
- A selectable control’s scoring value matches its visible label. If the
  difference is deliberate, mark it explicitly as `case`, `token`, or
  `semantic` with `data-value-label-variant`; an unexplained hidden/visible
  mismatch is a release failure.
- Every choice-gap answer is present in its bank, every sentence-builder answer
  is constructible from its single-use tiles, and every matching or repair
  target is reachable.
- Feedback clearly distinguishes correct, incorrect, partial, and missing work.
- At least one task requires building language, not only recognizing it.
- The final production task cannot be completed by copying a model unchanged.

### 5. Tutor and accessibility standard

- The canonical lesson title is concise and unbranded, begins with an uppercase
  letter, and identifies its CEFR level and lesson type. Rendered document,
  Open Graph, Twitter, and page-level structured-data titles stay aligned and
  within the shared title-length budget.
- Instructions are readable at screen-sharing distance and work without guesswork.
- Interactive controls have accessible names, keyboard focus, and usable target sizes.
- Links have accessible names, multiple navigation landmarks have unique names,
  and headings move through the document hierarchy without skipping levels.
- Focusable or interactive content is never placed inside an `aria-hidden`
  subtree.
- Meaning is not communicated by color alone.
- Informative images have meaningful alternative text. An illustration may use
  empty alternative text only when the same vocabulary meaning is already
  presented as a visible, screen-reader-accessible label in its card.
- The page works at narrow mobile widths and on direct route refresh.
- Audio uses a native control with a direct static MP3 source, works without
  JavaScript, and offers browser speech only as a missing-file fallback.
- Previous/next navigation and curriculum relationships are generated from metadata.
- The printable tutor plan derives the lesson’s actual outcome, central
  decision, error repairs, practice route, final production, and next-use
  prompt from the same native source; a generic planning shell is not enough.

## Assessment definition of done

Each level diagnostic measures usable language rather than rule recall alone.

- Grammar and vocabulary appear inside messages, profiles, schedules, conversations,
  practical decisions, or connected sentences.
- Reading includes a short coherent text with detail and main-idea evidence.
- Listening uses approved server-side audio text plus an accessible local fallback.
- Speaking and writing are teacher-scored with observable, level-appropriate criteria.
- Tasks sample the whole level without trying to test every lesson equally.
- Options are unambiguous, and no answer merely repeats an obvious field label.
- Results include a total score, skill profile, readiness band, and actionable next step.
- Checking a long diagnostic moves keyboard and screen-reader focus to its
  named result summary; resetting clears score, evidence, visual state, and
  radio selection state.
- A passing result requires both the aggregate threshold and meaningful live
  evidence: at least 60% in teacher-scored speaking, 60% in teacher-scored
  writing, and 50% in listening. Missing or weak production cannot be hidden by
  a high multiple-choice score.
- No placeholder, “next build,” or unfinished assessment language remains.

## Review workflow

For each batch of no more than four lessons, or for one assessment:

1. Review linguistic accuracy and CEFR fit.
2. Review the Notice → Reflect learning sequence.
3. Test every interaction with correct, incorrect, and incomplete attempts.
4. Test keyboard access, narrow and desktop layouts, audio, and direct refresh.
5. Run `npm run check` and `npm run build`.
6. Publish only after the canonical record, generated route, curriculum state, and
   previous/next relationships all agree.

## Level release gate

A level is complete only when every canonical topic is `ready`, the curriculum
shows the comprehensive placement diagnostic before the lesson path, its
level-specific exit diagnostic meets the assessment standard, its audio
references resolve, and the production build validates every route, link, asset,
redirect, content fingerprint, interaction count, and semantic answer contract.
