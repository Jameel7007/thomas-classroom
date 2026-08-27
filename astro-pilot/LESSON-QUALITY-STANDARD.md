# Thomas’s Classroom Lesson Quality Standard

**Version:** 1.0 audit draft
**Date:** July 16, 2026
**Purpose:** define the measurable editorial and pedagogical standard a lesson must meet before it is marked `ready` and promoted as reviewed.

This document is the target product standard. It complements the repository’s current build contracts and supersedes any older content standard where the two conflict. It does **not** impose one rigid lesson template. Grammar, vocabulary, listening, speaking, functional-language, pronunciation, and advanced-discourse lessons require different learning sequences.

## Product promise

A Thomas’s Classroom lesson must help an adult learner understand and use one coherent outcome in real communication. It should be calm enough to teach over screen share, clear enough to review through a direct link, and specific enough that a tutor can diagnose what went wrong.

A polished page is not a quality lesson if its language is inaccurate, its question has two possible answers, or its final activity does not produce the target language.

## Review states

| State | Meaning | Public behavior |
| --- | --- | --- |
| `planned` | Metadata and sequence exist; lesson is not teachable | Appears as planned, never as available |
| `draft` | Student-facing content is being authored; answer contracts may change | Local/review only; not indexed or linked as ready |
| `editorial-review` | Complete lesson awaits language/pedagogy review | Previewable to reviewer; not promoted as reviewed |
| `learner-pilot` | Tutor-approved lesson is being tested in real sessions | Available only if clearly labeled pilot |
| `ready` | Required reviews and automated gates pass | Public, indexed, sequenced, shareable |
| `revision-due` | Ready lesson has a reported issue or scheduled review | Remains available only if issue is non-critical; critical errors revert to draft |

The current schema only supports `planned` and `ready`. Phase 1 may implement the expanded workflow as metadata or a separate derived review record, but it must remain single-source and must not create a second lesson registry.

## Non-negotiable release gates

A ready lesson passes all 12 gates:

1. **Accurate:** grammar, vocabulary, pragmatics, pronunciation, and examples have been checked by a qualified human reviewer.
2. **Natural:** examples sound like current, natural U.S. English unless a variety is explicitly labeled.
3. **Outcome-led:** one primary can-do outcome is visible; secondary outcomes support it rather than compete with it.
4. **Form, meaning, and use:** the learner can see how the language is built, what it means here, and why a speaker chooses it.
5. **Context-defensible:** every closed item contains enough information for one intended answer.
6. **Diagnostic:** plausible wrong choices or anticipated errors reveal a misunderstanding worth correcting.
7. **Explanatory:** feedback helps the learner revise the decision, not merely learn that it was wrong.
8. **Spoken:** the lesson teaches or practices a relevant sound, stress, rhythm, reduction, linking, or intonation feature.
9. **Progressive:** practice moves from supported noticing/control to guided and open production.
10. **Retrievable:** the lesson reactivates prior knowledge and defines a later review action.
11. **Usable:** a tutor can identify the core path, optional extensions, answers, and likely problems quickly.
12. **Accessible:** interaction, meaning, feedback, and media work by keyboard, at narrow widths, with reduced motion, and without color alone.

A critical failure in Gates 1, 4, 5, 6, or answer-key reliability blocks release regardless of aggregate score.

## Lesson score

The editorial rubric uses 100 points. A lesson needs **85/100**, no critical failure, human tutor approval, and all automated checks to become `ready`.

| Dimension | Points | Evidence |
| --- | ---: | --- |
| Accuracy and naturalness | 20 | Reviewer sign-off; examples and keys checked aloud and in context |
| Outcome and CEFR fit | 10 | Observable can-do; task and language load match the level |
| Form, meaning, use, and contrast | 15 | Explanations, contrast examples, restrictions, and choice logic |
| Context and answer reliability | 15 | One defensible answer; plausible distractors; item rationale |
| Feedback and repair | 10 | First-attempt cue, second-attempt support, concise why/fix |
| Practice progression | 10 | Controlled, guided, open, and retrieval evidence |
| Spoken English/listening | 10 | Target-linked pronunciation plus playable input where needed |
| Tutor/student usability | 5 | Timing, core path, notes, directions, answer access |
| Accessibility/mobile | 5 | Keyboard, live feedback, touch target, overflow, transcript, reduced motion |

## Length and cognitive-load bands

Time is a design constraint, not a quality target. A lesson should be as long as its outcome requires and should expose a complete core path.

| Level | Core live path | Optional extension | Typical student-facing reading load | Principle |
| --- | --- | --- | --- | --- |
| A0 | 30–45 minutes | 10–15 minutes | 600–1,100 words, heavily chunked and visual | One new system plus immediately useful language |
| A1 | 40–55 minutes | 10–20 minutes | 900–1,500 words | One main structure or lexical function; avoid stacking several new systems |
| A2 | 50–65 minutes | 10–20 minutes | 1,200–1,900 words | One main contrast plus realistic connected context |
| B1 | 55–70 minutes | 10–20 minutes | 1,100–1,800 words | Choice, contrast, and connected production |
| B2 | 60–75 minutes | 10–20 minutes | 1,200–2,000 words | Nuance, stance, discourse, and sustained response |
| C1 | 60–80 minutes | 10–25 minutes | 1,300–2,200 words | Flexible reformulation and discourse-level control, not harder vocabulary alone |

These are review bands, not hard build failures. A shorter lesson may be excellent if its outcome is narrow. A longer lesson must label a **core path** and **extension** so the tutor does not rush production.

## Core lesson contour

Every lesson needs the functions below, but not necessarily these headings or this order:

1. **Orient:** a can-do outcome and a reason the language matters.
2. **Retrieve:** 2–4 quick prompts from prerequisites or prior knowledge.
3. **Encounter:** a small, credible context before abstraction.
4. **Understand:** explanation or discovery of form, meaning, use, and limits.
5. **Notice sound:** spoken form connected to the concept.
6. **Control:** constrained practice with one defensible answer.
7. **Diagnose:** error repair or contrast that reveals misconception.
8. **Use with support:** guided production with chunks, roles, or content support.
9. **Use freely:** a meaningful real-life outcome that requires the target.
10. **Retrieve later:** a concise follow-up task or next-use prompt.

## Quantitative content standards

Numbers set minimum evidence, not a template. An item may serve more than one purpose if it genuinely does both.

### Examples and explanation

- A focused grammar lesson normally contains **12–20 contextual target examples** across explanation and practice.
- A0–A1 may use **8–14 examples** if each is short and recycled productively.
- Include at least **3 contrast pairs** when the outcome depends on a choice between forms or meanings.
- Include at least **2 negative examples or boundaries** showing when not to use the target, if misuse is predictable.
- No explanation paragraph should exceed roughly **110 words** without a table, example, question, or learner action.
- Metalanguage must be explained in learner language or omitted. Advanced level does not justify unnecessary terminology.

### Controlled and guided practice

- **8–14 scorable controlled decisions** are typical for grammar and functional-language lessons.
- **10–18 target chunks** are typical for vocabulary lessons; teach fewer when collocation, connotation, or register depth is high.
- Use at least **3 practice mechanics or cognitive operations**, such as noticing, choosing, sorting, building, repairing, transforming, listening discrimination, or information-gap response.
- Different buttons around the same recognition task do not count as different methods.
- At least **one task must require explanation or repair**, not only selection.
- At least **3 guided production prompts** should elicit the target with meaningful content variation.

### Open production and retrieval

- Every lesson ends with at least **one purposeful open task** that would be difficult to complete well without the target language.
- The open task includes **2–4 success criteria** that describe language and communication, not vague effort.
- A later retrieval task takes **5–15 minutes**, can be shared directly, and reuses the target in a new context.
- A lesson should reference one relevant prerequisite and one next/related concept when those relationships are real.

## Answer and distractor standard

### Closed item contract

Before release, every scorable item records or can derive:

- the intended answer;
- the exact contextual cue that makes it correct;
- why each distractor is wrong **in this context**;
- accepted equivalent answers when input is typed;
- the CEFR/language point being measured;
- whether the item tests form, meaning, use, listening, reading, or more than one.

### One defensible answer test

An item fails if a proficient speaker can reasonably choose another option without inventing unlikely circumstances. Add time reference, speaker intention, physical context, relationship, or discourse before changing the key.

Bad:

> She ___ tomorrow. `works / is working`

Both may be natural. Better:

> Her manager has already put the client meeting in the calendar for 10:00 tomorrow. She ___ with the client at ten. `is meeting / meets`

### Distractor rules

- At least one distractor should represent a **documented learner error** or nearby concept.
- Avoid nonsense morphology unless the item explicitly diagnoses form formation.
- Avoid unrelated meanings that make the answer obvious without understanding the target.
- Keep option length, punctuation, and specificity balanced enough that formatting does not reveal the key.
- Do not use stereotypes or false factual generalizations as distractors.
- Randomize answer position in authored sets and validate that no simple position pattern dominates.

## Feedback standard

Feedback should preserve productive struggle and then teach.

| Moment | Required behavior |
| --- | --- |
| No attempt | Ask the learner to make a choice; do not reveal the answer. |
| First incorrect attempt | Identify the relevant cue or relationship without giving the complete answer. |
| Second incorrect attempt | Narrow the choice, show the needed form/chunk, or provide a partial model. |
| Correct attempt | Confirm briefly and state the decisive reason when the distinction matters. |
| Review/reveal | Show the answer, a concise why, and one contrast or repair where useful. |

Generic messages such as “Try again” or “Compare the choices” do not meet the standard unless the item itself makes the decisive cue unmistakable. Feedback must be exposed to assistive technology through a live region and must not rely only on red/green color.

## Spoken-English standard

Every lesson needs a target-linked spoken feature. It may be:

- a sound contrast affecting intelligibility;
- word or compound stress;
- sentence focus;
- weak forms and reductions;
- linking or assimilation;
- rhythm and chunking;
- question, tag, politeness, stance, or narrative intonation;
- listening discrimination between meanings.

The note must tell the learner **what to listen for, why it matters, and what to say**. IPA is optional support, never the only explanation.

For a distinction that depends on sound or intonation, text alone is insufficient. Provide a reviewed static clip or a clearly labeled tutor-read script. Static audio must include a transcript and must never call a visitor-time generation API.

## Lesson-type standards

### Grammar and usage

Required emphasis:

- time/reference, speaker intention, or information structure before formula;
- positive, negative, and question form where relevant;
- meaning contrasts and restrictions;
- natural contractions/reductions;
- at least one error clinic based on a likely learner pattern;
- controlled choice, sentence building, guided oral transform, and real production.

Do not turn every grammar lesson into the same sequence. Suitable alternate approaches include timelines, visual focus, story reconstruction, minimal-pair meaning contrasts, corpus-like example sorting, dialogue repair, and learner-error diagnosis.

### Vocabulary and collocation

Required emphasis:

- teach **chunks**, not isolated translations;
- organize by semantic situation, collocation, register, or word family;
- include pronunciation and stress for high-value items;
- show at least two natural sentence frames per core chunk across the lesson;
- include recognition, recall, collocation choice, and personalized use;
- for B2–C1, include connotation, semantic preference, register, or constraint.

Avoid one long “meet the words” list. Mark core versus extension vocabulary.

### Functional language

Required emphasis:

- relationship, setting, channel, purpose, and stakes;
- degrees of directness/politeness and likely responses;
- intonation or rhythm that changes social meaning;
- a dialogue with an information gap or problem to solve;
- role reversal and at least one unexpected follow-up.

Success is pragmatic: the learner achieves the purpose without sounding unintentionally rude, vague, or unnatural.

### Pronunciation

Required emphasis:

- reviewed model audio and transcript;
- perception before production when the distinction is hard to hear;
- word, phrase, and communicative-context practice;
- clear mouth/voice guidance without pseudoscientific claims;
- intelligibility as the goal, not accent erasure;
- comparison recording or tutor observation criteria.

Recommended minimum: **8–12 perception decisions**, **8–12 short productions**, and **one communicative transfer task**.

### Listening

Required emphasis:

- at least **two listening passes** with different purposes: gist then detail/inference;
- no transcript before the first meaningful listen;
- a transcript available after the attempt;
- level-appropriate speed with natural phrasing, not artificially separated words;
- speaker/context/purpose identified;
- answerable tasks that do not depend on obscure world knowledge;
- a post-listening speaking or reformulation task.

A full listening lesson should normally include **2–3 short clips or one staged longer clip**, more than one voice over a sequence, and at least one feature of real connected speech.

### Speaking and fluency

Required emphasis:

- input or model language without scripting the entire response;
- planning time and useful chunks;
- repetition with changed content or pressure, not verbatim drilling alone;
- interaction moves: follow-up, clarification, repair, reformulation;
- observable success criteria for range, control, intelligibility, and task achievement;
- learner reflection or a second improved attempt.

### Advanced discourse (B2–C1)

Required emphasis:

- paragraph/turn-level meaning, not isolated sentence display;
- stance, register, cohesion, implication, framing, and audience;
- reformulation and self-correction;
- comparison of at least two defensible versions and their effects;
- sustained spoken and written production;
- critical-thinking claims separated from grammar facts;
- cultural neutrality and alternative viewpoints reviewed explicitly.

C1 must not be B2 with rarer words. It requires flexible choice across extended discourse.

## CEFR appropriateness

Level fit considers the total task load, not only the target form:

- known vocabulary must carry new grammar at A0–A2;
- instructions should be simpler than the language being practiced;
- reading length, inference, cultural knowledge, typing, and interface demands count toward difficulty;
- B1 tasks connect ideas and justify; B2 tasks qualify, compare evidence, and sustain interaction; C1 tasks reframe, infer, control register, and manage nuance flexibly;
- a lesson may include extension language above the level only when clearly optional and supported.

At least one reviewer should complete each controlled task as a learner at the claimed level, not only proofread the answer key as an expert.

## Tutor usability standard

A tutor-facing plan should derive from lesson data and include:

- primary outcome and prerequisite;
- **core timing** and optional extension timing;
- target language and spoken feature;
- anticipated errors with short explanations;
- which tasks are screen-shared, spoken, typed, or teacher-read;
- answer/rationale access without exposing answers to the student early;
- adaptation notes for one-to-one, small group, lower confidence, and faster learner where relevant;
- a 5–15 minute homework/retrieval link;
- tutor review status and last review date.

The student page must remain uncluttered. Teacher notes belong in the tutor plan or a deliberate teacher mode, not permanently beside every prompt.

## Homework and retrieval standard

Homework is not a second full worksheet by default. It should be a short retrieval loop:

1. 2–3 recall items without notes;
2. 3–5 contextual decisions or repairs;
3. one short spoken or written production;
4. one self-check or model after commitment;
5. one prompt to use the language before the next lesson.

The task should work through a direct link, print cleanly when practical, and avoid requiring an account during the initial product stage.

## Accessibility and mobile standard

Every lesson is tested at 320 px, 375 px, 768 px, and desktop.

Required:

- logical heading order and one clear main landmark;
- visible keyboard focus and no keyboard trap;
- native buttons/inputs or correct semantics and state;
- minimum comfortable touch targets;
- no horizontal page overflow;
- feedback announced through a status/live region;
- correct/incorrect meaning available beyond color;
- revealed content exposes `aria-expanded` and appropriate visibility;
- audio has transcript and an understandable label;
- motion respects `prefers-reduced-motion`;
- tables reflow or scroll with an accessible label;
- copying text and screen-reader output preserve real spaces and punctuation.

Automated validation is necessary, not sufficient. Each shared component requires periodic keyboard, VoiceOver, and narrow-device manual checks.

## Editorial review workflow

### 1. Author self-check

- Complete the rubric.
- Read every example and answer aloud.
- Prove each closed answer from the visible context.
- Identify the misconception behind every distractor.
- Run all build and content validators.

### 2. Language and pedagogy review

Reviewer checks:

- accuracy/naturalness;
- form, meaning, use, and limits;
- CEFR load;
- pragmatic/cultural claims;
- distractor plausibility and answer uniqueness;
- feedback usefulness;
- spoken-form claims and audio script.

The author resolves each comment or records a reasoned exception.

### 3. Tutor review

Thomas teaches the core path without preparatory rewriting and records:

- actual time;
- points needing extra explanation;
- unexpected learner answers;
- distractors no learner chose;
- feedback that did or did not unlock a correction;
- production success and remaining errors.

### 4. Learner pilot

Minimum before “reviewed” promotion:

- **3 real one-to-one uses** for an ordinary lesson;
- **5 uses** for a new interaction pattern or high-risk advanced concept;
- **10+ uses plus score review** for assessment thresholds.

These are product thresholds, not research claims. More evidence is required before claiming validated learning gains.

### 5. Release and monitor

- Store reviewer, date, pilot count, and revision note in a single derived QA record.
- Publish only after checks pass.
- Give every reported critical accuracy/answer issue a same-day triage.
- Schedule a review after six months or 25 uses, whichever provides useful evidence first.

## Automated validation additions

Phase 1 should add checks for:

- ready lessons have a review status and review date;
- controlled items have an answer and a contextual hint/rationale;
- answer options are unique and include the answer;
- no answer-position pattern exceeds a defined threshold in a set;
- feedback/live regions are present;
- lesson has retrieval, spoken-form, production, and next-use evidence;
- audio references have a script, stable path, transcript, and file or explicit fallback state;
- core and extension sections do not break route/content fingerprints unexpectedly;
- student-facing content avoids em dashes where the curriculum rule prohibits them;
- tutor-review-required content cannot be presented as fully reviewed.

Automation must not pretend to verify grammatical truth, CEFR validity, or naturalness. Those remain human responsibilities.

## Definition of best in class

Thomas’s Classroom reaches the target standard when:

- 100% of ready lessons have documented human review;
- 100% of scorable closed items have one defensible answer and rationale coverage;
- at least 95% of first incorrect attempts receive a specific cue rather than generic feedback;
- every ready lesson has a spoken feature and every sound-dependent distinction has reviewed audio;
- every lesson has a complete core path, production, and retrieval follow-up;
- representative lessons of each type pass keyboard, VoiceOver, narrow-width, and direct-refresh checks;
- assessments have reviewed audio and teacher-scored productive evidence;
- learner/tutor pilot notes lead to visible revisions rather than being collected as vanity data;
- the product remains calm, direct-link accessible, and teachable without an LMS.
