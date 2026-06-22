# Lesson Authoring Guide

Use this structure for grammar and vocabulary lesson pages. It blends guided noticing from the Thinking Method with current TEFL practice: clear outcomes, minimal teacher-talk, high student response rate, form-meaning-use, retrieval, feedback, and communicative transfer.

Modern lessons should include a brief cumulative retrieval section near the start: one recent item, one older item, and one common error/contrast.

## Page Flow

1. Notice
   Give learners a tiny language sample and ask what they observe before explaining the rule.

2. Discover
   Turn the pattern into a simple rule. Keep the explanation short and visible.

3. Build
   Use controlled practice: gap fills, substitution, matching, sorting, sentence building.

4. Drill
   Add speed, repetition, contrast, and immediate feedback. Use tiles and micro-games where possible.

5. Communicate
   Move into pair prompts, personalization, role play, or a short production task.

6. Reflect
   End with one quick self-check: what changed, what still feels slow, what to reuse next time.

## Reusable Interactions

The shared files are:

- `lesson.css`
- `lesson.js`

Exercises should be interactive by default. Static blanks are only acceptable inside explanatory text, not inside a practice block. Correct and incorrect attempts should use the shared feedback states from `lesson.js`, which animate the drill card and individual answers.

Current reusable mechanics:

- answer drills with `data-answer-drill`
- click-to-fill gap drills with `data-choice-gap-drill`
- tile matching games with `data-tile-game`
- sentence builders with `data-tile-builder`
- error spotting with `data-spot-error`
- oral transforms with `data-transform`
- final quizzes with `data-quiz`

Add `data-success-message="..."` to a `data-quiz` element when the lesson
needs ability-specific success feedback. Describe what the learner can now do,
not merely that the score is high.

Optional explanatory feedback works on answer inputs, choice gaps, matching
slots, sentence builders, quiz items, and error-spotting choices:

- `data-hint="..."` gives a short cue on the first failed attempt.
- `data-why="..."` gives a short rule or reason when no hint is supplied.
- `data-fix="..."` supplies the expected form after a repeated failed check.

Keep each message to one short sentence. Put the attribute on the individual
item when the cue is item-specific, or on the drill root when one cue applies
to the whole exercise. Existing exercises without these attributes receive
safe generic feedback automatically.

Interactive answer drill:

```html
<div class="practice" data-answer-drill>
  <h3>Quick practice</h3>
  <div class="q"><span class="n">1</span><span>I <input class="answer-input" data-answer="am|'m"> happy.</span></div>
  <div class="drill-actions">
    <button class="lesson-btn" data-check-answers>Check</button>
    <button class="lesson-btn" data-reset-answers>Reset</button>
  </div>
  <p class="feedback" data-feedback></p>
</div>
```

Click-to-fill gap drill:

```html
<div class="practice" data-choice-gap-drill>
  <h3>Quick practice</h3>
  <p class="choice-hint">Tap a gap, then choose the word</p>
  <div class="choice-bank">
    <button class="choice-option" data-choice-option="am">am</button>
    <button class="choice-option" data-choice-option="is">is</button>
    <button class="choice-option" data-choice-option="are">are</button>
  </div>
  <div class="q"><span class="n">1</span><span>I <button class="choice-gap" data-choice-gap data-answer="am" data-placeholder="choose">choose</button> ready.</span></div>
  <div class="drill-actions">
    <button class="lesson-btn" data-check-choices>Check</button>
    <button class="lesson-btn" data-reset-choices>Reset</button>
  </div>
  <p class="feedback" data-feedback></p>
</div>
```

Tile game:

```html
<div class="tile-game" data-tile-game>
  <h3>Tile game</h3>
  <div class="tile-bank">
    <button class="tile" data-tile="i">I</button>
    <button class="tile" data-tile="you">you</button>
  </div>
  <div class="slot-board">
    <button class="slot" data-slot="i" data-placeholder="subject">subject</button>
    <button class="slot" data-slot="you" data-placeholder="subject">subject</button>
  </div>
  <div class="drill-actions">
    <button class="lesson-btn" data-check-tiles>Check</button>
    <button class="lesson-btn" data-reset-tiles>Reset</button>
  </div>
  <p class="feedback" data-feedback></p>
</div>
```

TileBuilder:

```html
<div class="tile-game" data-tile-builder data-answer="i am a teacher">
  <h3>Build the sentence</h3>
  <p class="tile-target">Say it after you build it.</p>
  <div class="tile-bank" data-build-bank>
    <button class="tile" data-build-tile="teacher">teacher</button>
    <button class="tile" data-build-tile="i">I</button>
    <button class="tile" data-build-tile="am">am</button>
    <button class="tile" data-build-tile="a">a</button>
  </div>
  <div class="build-area" data-build-area data-placeholder="Tap tiles here"></div>
  <div class="drill-actions">
    <button class="lesson-btn" data-check-build>Check</button>
    <button class="lesson-btn" data-reset-build>Reset</button>
  </div>
  <p class="feedback" data-feedback></p>
</div>
```

SpotError:

```html
<div class="micro-drill" data-spot-error data-answer="do" data-fix="Are you a student?" data-why="Use be before the subject in questions with be.">
  <h3>Spot the error</h3>
  <p>Tap the word that makes the sentence wrong.</p>
  <div class="spot-options">
    <button class="error-choice" data-error-choice="do">Do</button>
    <button class="error-choice" data-error-choice="you">you</button>
    <button class="error-choice" data-error-choice="are">are</button>
    <button class="error-choice" data-error-choice="student">student?</button>
  </div>
  <p class="hidden-answer" data-error-feedback></p>
</div>
```

Transform:

```html
<div class="micro-drill" data-transform>
  <h3>Transform</h3>
  <div class="transform-list">
    <div class="transform-item" data-transform-item>
      <p class="transform-cue"><b>Cue</b> I am a teacher. -> question</p>
      <button class="lesson-btn" data-reveal-transform>Reveal after student answers</button>
      <p class="transform-answer" data-transform-answer><strong>Am I</strong> a teacher?</p>
    </div>
  </div>
</div>
```

## Naming

The map links grammar and vocabulary items to:

`lessons/{level}/{slug}.html`

Examples:

- `lessons/a0/subject-pronouns.html`
- `lessons/a1/present-simple.html`
- `lessons/a2/present-perfect.html`

Keep slugs lowercase and hyphenated.
