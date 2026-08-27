# Native Astro migration report

Completed: 2026-07-12  
Restore checkpoint: `94ee098` (`Checkpoint Astro compatibility migration`)

Post-migration authoring update: lesson metadata now lives once in each lesson
source file and is validated through `lesson-schema.mjs` and
`lesson-catalog.mjs`. One dynamic static-route entry generates all ready lesson
URLs. The original 54-page migration was subsequently expanded with 38
native-authored B1 and B2 lessons, bringing the canonical curriculum to 92
ready lessons with no planned-only records.

## Completion status

- 54 of 54 original lessons were migrated to direct, editable Astro source.
- 38 additional B1 and B2 lessons were authored natively; all 92 canonical
  A0–B2 topics are now ready.
- 7 of 7 assessments and placement checks are direct, editable Astro source.
- Homepage, curriculum, print curriculum, About, Languages, Blog, and Dictionary are native Astro pages.
- The old static `outputs/` implementation, runtime HTML adapter, raw HTML imports, asset adapter, and one-time migration tools were removed after validation.
- No iframe, full-document string injection, raw legacy passthrough, runtime HTML loader, or lesson dependency on old HTML remains.
- Clean routes and historical `.html` redirects are retained.

## Shared native architecture

- `LessonPage` and `LessonNavigation` own lesson document structure, metadata, canonical links, fonts, and curriculum navigation.
- `LessonExerciseEngine` owns answer drills, multiple choice, click-to-fill gaps, tile games, sentence builders, sentence correction, reveal cards, feedback, ARIA state, and animations.
- `AssessmentPage`, `QuickCheckPage`, `AssessmentEngine`, and `QuickCheckEngine` own assessment layout, scoring, level analysis, progress, teacher evidence, result records, and reset/print/copy behavior.
- Reusable authoring components include `MultipleChoiceExercise`, `RevealCard`, `SentenceCorrection`, `FeedbackPanel`, `VocabularyCards`, `AudioControl`, and `ProgressIndicator`.
- Shared styles and client scripts now live entirely under `src/styles/` and `src/scripts/`; images and flags live under `public/assets/`.
- A lazy dynamic lesson route imports only the selected native lesson component; assessments retain their native route entries.

## Top-level pages

| Original page | Native source | Public route | Shared architecture |
|---|---|---|---|
| `outputs/index.html` | `src/pages/index.astro` | `/` | HomeInteractions, home.css |
| `outputs/English Curriculum Map.html` | `src/pages/curriculum/index.astro` | `/curriculum/` | SiteLayout, native curriculum data and route inventory |
| `outputs/English Curriculum Map-print.html` | `src/pages/curriculum/print.astro` | `/curriculum/print/` | Native curriculum data, curriculum-print.css |
| New Astro section | `src/pages/about.astro` | `/about/` | SiteLayout |
| New Astro section | `src/pages/languages.astro` | `/languages/` | SiteLayout, site-content |
| New Astro section | `src/pages/blog.astro` | `/blog/` | SiteLayout, site-content |
| New Astro section | `src/pages/dictionary.astro` | `/dictionary/` | SiteLayout, site-content |

## Original migration inventory

The table below maps every original lesson and assessment page to its native
replacement. The 38 later B1/B2 lessons had no legacy source page; their native
source, route, sequence, and relationships are registered in the canonical
lesson catalog and validated on every build.

| Original page | Native content source | Public route | Reusable components / engine features |
|---|---|---|---|
| `outputs/lessons/a0/animals.html` | `src/content/lessons/a0/animals.astro` | `/lessons/a0/animals/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/articles-a-an.html` | `src/content/lessons/a0/articles-a-an.astro` | `/lessons/a0/articles-a-an/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/cardinal-numbers-0-100.html` | `src/content/lessons/a0/cardinal-numbers-0-100.astro` | `/lessons/a0/cardinal-numbers-0-100/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/classroom-objects.html` | `src/content/lessons/a0/classroom-objects.astro` | `/lessons/a0/classroom-objects/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/colours-and-basic-adjectives.html` | `src/content/lessons/a0/colours-and-basic-adjectives.astro` | `/lessons/a0/colours-and-basic-adjectives/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/countries-and-nationalities.html` | `src/content/lessons/a0/countries-and-nationalities.astro` | `/lessons/a0/countries-and-nationalities/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/days-months-dates.html` | `src/content/lessons/a0/days-months-dates.astro` | `/lessons/a0/days-months-dates/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/family-members.html` | `src/content/lessons/a0/family-members.astro` | `/lessons/a0/family-members/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/greetings-and-introductions.html` | `src/content/lessons/a0/greetings-and-introductions.astro` | `/lessons/a0/greetings-and-introductions/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a0/possessive-adjectives.html` | `src/content/lessons/a0/possessive-adjectives.astro` | `/lessons/a0/possessive-adjectives/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/question-words-what-where-who-how.html` | `src/content/lessons/a0/question-words-what-where-who-how.astro` | `/lessons/a0/question-words-what-where-who-how/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/regular-plural-nouns.html` | `src/content/lessons/a0/regular-plural-nouns.astro` | `/lessons/a0/regular-plural-nouns/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/subject-pronouns.html` | `src/content/lessons/a0/subject-pronouns.astro` | `/lessons/a0/subject-pronouns/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/the-alphabet-and-spelling.html` | `src/content/lessons/a0/the-alphabet-and-spelling.astro` | `/lessons/a0/the-alphabet-and-spelling/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/the-verb-to-be.html` | `src/content/lessons/a0/the-verb-to-be.astro` | `/lessons/a0/the-verb-to-be/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a0/this-that-these-those.html` | `src/content/lessons/a0/this-that-these-those.astro` | `/lessons/a0/this-that-these-those/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/adverbs-of-frequency.html` | `src/content/lessons/a1/adverbs-of-frequency.astro` | `/lessons/a1/adverbs-of-frequency/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/can-for-ability-and-permission.html` | `src/content/lessons/a1/can-for-ability-and-permission.astro` | `/lessons/a1/can-for-ability-and-permission/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/clothes-and-shopping.html` | `src/content/lessons/a1/clothes-and-shopping.astro` | `/lessons/a1/clothes-and-shopping/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/common-verbs-and-adjectives.html` | `src/content/lessons/a1/common-verbs-and-adjectives.astro` | `/lessons/a1/common-verbs-and-adjectives/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/daily-routines-and-telling-the-time.html` | `src/content/lessons/a1/daily-routines-and-telling-the-time.astro` | `/lessons/a1/daily-routines-and-telling-the-time/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/food-and-drink.html` | `src/content/lessons/a1/food-and-drink.astro` | `/lessons/a1/food-and-drink/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/have-got.html` | `src/content/lessons/a1/have-got.astro` | `/lessons/a1/have-got/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/hobbies-and-free-time.html` | `src/content/lessons/a1/hobbies-and-free-time.astro` | `/lessons/a1/hobbies-and-free-time/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/imperatives.html` | `src/content/lessons/a1/imperatives.astro` | `/lessons/a1/imperatives/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/jobs-and-workplaces.html` | `src/content/lessons/a1/jobs-and-workplaces.astro` | `/lessons/a1/jobs-and-workplaces/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/object-pronouns.html` | `src/content/lessons/a1/object-pronouns.astro` | `/lessons/a1/object-pronouns/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/prepositions-of-time-and-place.html` | `src/content/lessons/a1/prepositions-of-time-and-place.astro` | `/lessons/a1/prepositions-of-time-and-place/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/present-continuous.html` | `src/content/lessons/a1/present-continuous.astro` | `/lessons/a1/present-continuous/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/present-simple.html` | `src/content/lessons/a1/present-simple.astro` | `/lessons/a1/present-simple/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/rooms-and-furniture.html` | `src/content/lessons/a1/rooms-and-furniture.astro` | `/lessons/a1/rooms-and-furniture/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a1/some-any-with-countable-and-uncountable-nouns.html` | `src/content/lessons/a1/some-any-with-countable-and-uncountable-nouns.astro` | `/lessons/a1/some-any-with-countable-and-uncountable-nouns/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/there-is-there-are.html` | `src/content/lessons/a1/there-is-there-are.astro` | `/lessons/a1/there-is-there-are/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/was-were.html` | `src/content/lessons/a1/was-were.astro` | `/lessons/a1/was-were/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a1/weather-and-seasons.html` | `src/content/lessons/a1/weather-and-seasons.astro` | `/lessons/a1/weather-and-seasons/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/adverbs-of-manner.html` | `src/content/lessons/a2/adverbs-of-manner.astro` | `/lessons/a2/adverbs-of-manner/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/be-going-to-for-plans.html` | `src/content/lessons/a2/be-going-to-for-plans.astro` | `/lessons/a2/be-going-to-for-plans/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/comparatives-and-superlatives.html` | `src/content/lessons/a2/comparatives-and-superlatives.astro` | `/lessons/a2/comparatives-and-superlatives/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/education-and-study.html` | `src/content/lessons/a2/education-and-study.astro` | `/lessons/a2/education-and-study/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/feelings-and-personality.html` | `src/content/lessons/a2/feelings-and-personality.astro` | `/lessons/a2/feelings-and-personality/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/first-conditional.html` | `src/content/lessons/a2/first-conditional.astro` | `/lessons/a2/first-conditional/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/health-and-the-body.html` | `src/content/lessons/a2/health-and-the-body.astro` | `/lessons/a2/health-and-the-body/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/modals-should-must-have-to.html` | `src/content/lessons/a2/modals-should-must-have-to.astro` | `/lessons/a2/modals-should-must-have-to/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/past-continuous.html` | `src/content/lessons/a2/past-continuous.astro` | `/lessons/a2/past-continuous/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/past-simple.html` | `src/content/lessons/a2/past-simple.astro` | `/lessons/a2/past-simple/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/past-time-expressions.html` | `src/content/lessons/a2/past-time-expressions.astro` | `/lessons/a2/past-time-expressions/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/phrasal-verbs.html` | `src/content/lessons/a2/phrasal-verbs.astro` | `/lessons/a2/phrasal-verbs/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/present-perfect.html` | `src/content/lessons/a2/present-perfect.astro` | `/lessons/a2/present-perfect/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/quantifiers-much-many-a-lot-of.html` | `src/content/lessons/a2/quantifiers-much-many-a-lot-of.astro` | `/lessons/a2/quantifiers-much-many-a-lot-of/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/technology-and-devices.html` | `src/content/lessons/a2/technology-and-devices.astro` | `/lessons/a2/technology-and-devices/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/town-and-directions.html` | `src/content/lessons/a2/town-and-directions.astro` | `/lessons/a2/town-and-directions/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/travel-and-transport.html` | `src/content/lessons/a2/travel-and-transport.astro` | `/lessons/a2/travel-and-transport/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder, VocabularyCards |
| `outputs/lessons/a2/verb-infinitive-ing.html` | `src/content/lessons/a2/verb-infinitive-ing.astro` | `/lessons/a2/verb-infinitive-ing/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/lessons/a2/will-for-predictions-and-offers.html` | `src/content/lessons/a2/will-for-predictions-and-offers.astro` | `/lessons/a2/will-for-predictions-and-offers/` | LessonPage, LessonNavigation, LessonExerciseEngine, MultipleChoiceExercise, RevealCard, SentenceCorrection, FeedbackPanel, SentenceBuilder |
| `outputs/assessments/a0-exit.html` | `src/content/assessments/a0-exit.astro` | `/assessments/a0-exit/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise, AudioControls |
| `outputs/assessments/a1-exit.html` | `src/content/assessments/a1-exit.astro` | `/assessments/a1-exit/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise, AudioControls |
| `outputs/assessments/a2-exit.html` | `src/content/assessments/a2-exit.astro` | `/assessments/a2-exit/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise, AudioControls |
| `outputs/assessments/b1-exit.html` | `src/content/assessments/b1-exit.astro` | `/assessments/b1-exit/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise, AudioControls |
| `outputs/assessments/b2-exit.html` | `src/content/assessments/b2-exit.astro` | `/assessments/b2-exit/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise, AudioControls |
| `outputs/assessments/placement-exam.html` | `src/content/assessments/placement-exam.astro` | `/assessments/placement-exam/` | AssessmentPage, AssessmentNavigation, AssessmentEngine, ProgressIndicator, FeedbackPanel, MultipleChoiceExercise |
| `outputs/assessments/quick-level-check.html` | `src/content/assessments/quick-level-check.astro` | `/assessments/quick-level-check/` | AssessmentPage, AssessmentNavigation, QuickCheckEngine, ProgressIndicator, FeedbackPanel, AudioControls |

## Automated verification

Final `npm run build` result:

- Astro diagnostics: 0 errors, 0 warnings.
- Static generation: 203 Astro pages.
- Generated HTML outputs including redirects: 305.
- Canonical lessons validated: 92.
- Assessments validated: 7.
- Audio references validated against the private voice-script inventory: 10.
- Every canonical route has a direct-refresh `index.html` output.
- Exact learner-visible content fingerprints and interaction counts are enforced
  for all learner-facing lessons and assessments.
- Historical lesson and assessment `.html` redirects exist, including the old some/any alias.
- Compatibility scan confirms no iframe, legacy adapter, raw HTML loader, or injected document fragment.
- `server.mjs` passes Node syntax validation and serves only the Astro production build.

## Manual browser verification

| Format | Representative route | Result |
|---|---|---|
| Homepage | `/` | Loader, counters, booking and curriculum links, editorial transitions, and responsive navigation work. |
| A0 special grammar styling | `/lessons/a0/the-verb-to-be/` | Preserved IBM Plex/Newsreader treatment remains isolated to this page. |
| A0 vocabulary + illustrations + reveal + correction | `/lessons/a0/animals/` | 30 illustration references, vocabulary layout, reveal state, ARIA state, and incorrect correction feedback verified. |
| A1 complete grammar lesson | `/lessons/a1/present-simple/` | Choice gaps, correct feedback, incorrect feedback, status live region, page navigation, and style isolation verified. |
| A2 complex grammar lesson | `/lessons/a2/present-perfect/` | Answer, choice, tile, correction, reveal, quiz, and previous/next navigation structures verified. |
| Quick diagnostic | `/assessments/quick-level-check/` | Answer selection and question progress from 1 to 2 verified. |
| Scored level diagnostic | `/assessments/a2-exit/` | Correct, incorrect, missing, score, outcome, result focus, feedback, static-audio fallback, reset, and seven-row skill profile are covered by the release browser gate. |
| Placement exam | `/assessments/placement-exam/` | 58 items, A0–B2 ladder, seven skill areas, teacher evidence, and result analysis fields verified. |
| Mobile lesson and curriculum | `/lessons/a1/present-simple/`, `/curriculum/` | Responsive type, hidden compact crumb, reduced padding, contained tables, and navigation verified at a narrow viewport. |
| Historical URLs | `/lessons/a1/present-simple.html`, `/assessments/quick-level-check.html` | Both redirect to their clean routes and render the correct pages. |

No browser console errors were present during representative QA.

## Interaction parity notes

No existing lesson or assessment interaction was intentionally removed or replaced with a static approximation. The controls, answer logic, feedback, explanations, reveal behavior, animations, scoring, result records, teacher mode, print/copy behavior, and browser speech fallback remain in the native engines.

Assessment listening controls retain their approved clip IDs and `data-speak` fallback. Playback now uses pre-generated static MP3 files; ElevenLabs credentials are authoring-only and are never required or exposed by the production website.

All five exit diagnostics are now complete learner-facing assessments with
connected reading, listening references, controlled language evidence,
teacher-scored speaking and writing, skill profiles, actionable outcomes, and
shareable result records. No diagnostic planning stub remains.
