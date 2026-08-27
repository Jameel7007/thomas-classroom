# Thomas’s Classroom Product Roadmap

**Roadmap date:** July 16, 2026
**Decision rule:** correctness → clarity → pedagogical value → teacher usefulness → student usefulness → reliability → differentiation → monetization → visual novelty.

This roadmap turns the competitive audit into measurable product work. It assumes the native Astro architecture and canonical lesson registry remain in place. It does not authorize mass implementation.

## Strategic outcome

Build the strongest browser-native A0–C1 curriculum for independent tutors and adult one-to-one learners, distinguished by:

1. trustworthy, tutor-reviewed language;
2. multiple cognitive routes into high-friction concepts;
3. spoken grammar and vocabulary in every lesson;
4. context-first exercises with diagnostic feedback;
5. immediate direct-link teaching and review.

## Work classes

| Class | Included roadmap items | Release rule |
| --- | --- | --- |
| **Launch-critical** | P1.1–P1.3, P6.1, P8.1 | Complete before a serious public product launch or paid claim |
| **Quality improvement** | P2.1–P4.3, P6.2–P6.3, P8.3 | Raises pedagogy and tutor/student value; ship incrementally after review |
| **Commercial** | P7.1–P7.2, selected P5.2 | Build only after demand and willingness-to-pay evidence |
| **Long-term platform** | P5.1–P5.2, P8.2 | Useful later; must not delay content trust and the complete C1 path |

## Phase 1: Content accuracy and pedagogical QA

### P1.1 — Single-source editorial review record

- **User problem solved:** Teachers and students cannot tell which lessons have been human-reviewed, learner-tested, or generated and still awaiting review.
- **Competitor benchmark:** Ellii and Onestopenglish explicitly emphasize professional authors/editors; Thomas needs transparent evidence rather than a vague quality claim.
- **Expected benefit:** Prevents unreviewed pedagogy from looking final, makes revisions auditable, and creates commercial trust.
- **Scope:** Add review state, reviewer, review date, pilot count, notes, and next-review date without duplicating lesson metadata.
- **Affected files/systems:** `src/data/lesson-schema.mjs`, `src/data/lesson-catalog.mjs`, lesson metadata, tutor-plan derivation, curriculum badges only if user-facing status is approved, validation tools, README authoring workflow.
- **Dependencies:** Agreement on the states in `LESSON-QUALITY-STANDARD.md`; migration defaults for 95 ready lessons.
- **Risk:** Medium. A careless schema change can relabel ready lessons or create a second registry.
- **Effort:** Medium.
- **Priority:** Critical.
- **Measurable completion criteria:** Every ready lesson has one canonical review record; C1 pilots remain marked tutor-review-required; duplicate/missing reviewer data fails validation; no route or ready/planned count changes unintentionally.

### P1.2 — High-use grammar spine QA

- **User problem solved:** Some controlled items have generic feedback, obvious distractors, or scope that asks the tutor to supply the real explanation.
- **Competitor benchmark:** ESL Brains excels at context-led activity flow; Ellii provides edited grammar series; Thomas should exceed both in explanation and diagnostic feedback.
- **Expected benefit:** Higher answer reliability, faster learner self-correction, and less tutor improvisation in the lessons used most often.
- **Scope:** Review the core progression from **be** through tense/aspect, questions, conditionals, voice, reporting, and discourse; verify every example, answer, distractor, hint, and open task.
- **Affected files/systems:** Selected `src/content/lessons/{a0..b2}/`, `src/components/lesson/`, `src/scripts/lesson.js`, pedagogy validators, QA report.
- **Dependencies:** P1.1 review record and the quality rubric.
- **Risk:** Medium. Rewriting many items at once can create regressions or erase existing tutor-tested language.
- **Effort:** Large, delivered in 5–8 lesson batches.
- **Priority:** Critical.
- **Measurable completion criteria:** 100% reviewed items have one documented answer rationale; at least 95% of first wrong attempts receive a specific cue; no grammar/naturalness blockers; every batch passes build and three representative live lessons before the next batch.

### P1.3 — Assessment and audio validity pass

- **User problem solved:** Assessment clips are configured but absent, and current thresholds have not been calibrated against enough real learner evidence.
- **Competitor benchmark:** Off2Class and Ellii connect multi-skill placement to plans and reports. Thomas should keep its human judgment while improving standardization.
- **Expected benefit:** More credible level decisions, repeatable listening evidence, and clearer remediation.
- **Scope:** Generate/review ten static clips; inspect all A0–B2 exit, placement, and quick-check items; check productive rubrics and threshold behavior; document the A0–B2 ceiling.
- **Affected files/systems:** `private/voice-scripts.json`, `public/audio/assessments/`, assessment sources/components/scripts, audio validators, assessment QA report.
- **Dependencies:** Approved ElevenLabs authoring credentials locally; no production credential dependency.
- **Risk:** High pedagogically, low technically. Poor voice pacing or uncalibrated thresholds can misplace learners.
- **Effort:** Medium for audio/editorial pass; large for meaningful calibration data.
- **Priority:** Critical.
- **Measurable completion criteria:** All 10 configured files exist and pass human audio review; every receptive item has a rationale; productive rubrics have observable descriptors; at least 10 anonymized full-diagnostic cases are reviewed before threshold claims are strengthened.

## Phase 2: Multi-method lesson pilot

### P2.1 — Optional method model and authoring contract

- **User problem solved:** Learners who do not understand the first explanation currently move into more practice of the same explanation.
- **Competitor benchmark:** Ellii offers different grammar series and ESL Brains offers distinct formats, but teachers must often find separate lessons.
- **Expected benefit:** Creates the signature advantage: several concise ways into one concept on one direct lesson route.
- **Scope:** Define optional method blocks such as direct system, guided discovery, visual timeline, contrast, story/dialogue, chunk rehearsal, and error clinic. Do not require all blocks in every lesson.
- **Affected files/systems:** New or extended lesson components, lesson schema method tags, tutor plan, curriculum filters only after enough content exists, README.
- **Dependencies:** Phase 1 feedback/QA contract; clear student-page disclosure design.
- **Risk:** Medium. Too many choices can lengthen lessons and confuse the primary path.
- **Effort:** Medium.
- **Priority:** High.
- **Measurable completion criteria:** One component/API supports at least four method types; methods remain optional; no duplicate lesson route; keyboard/mobile/accessibility tests pass; tutor plan identifies when to switch methods.

### P2.2 — A1 Present Simple multi-method pilot

- **User problem solved:** Present simple is foundational and frequent, yet learners fail for different reasons: form, time meaning, third-person agreement, question mechanics, or speaking automaticity.
- **Competitor benchmark:** Ellii provides several separate present-simple resources; Thomas can put the right routes behind one coherent outcome.
- **Expected benefit:** Tests whether multi-method teaching improves understanding without creating page clutter or tutor prep.
- **Scope:** Preserve existing content and route; add four optional paths: guided discovery, system/rule, routine-versus-now contrast, and error-to-fluency clinic; converge on shared practice and production.
- **Affected files/systems:** `src/content/lessons/a1/present-simple.astro`, method components, lesson styles/scripts, tutor plan, validation fixture.
- **Dependencies:** P2.1 and Phase 1 QA of the lesson.
- **Risk:** Medium. The pilot can become an overlong showcase instead of a teachable lesson.
- **Effort:** Medium.
- **Priority:** High.
- **Measurable completion criteria:** Complete core path remains 45–55 minutes; tutor can select a route in under 30 seconds; at least five learners use the pilot; notes show which route unlocked which misconception; no interaction/accessibility regression.

## Phase 3: C1 curriculum

### P3.1 — Review the existing C1 batch 1

- **User problem solved:** The first three C1 lessons are complete but explicitly require tutor review; promoting them as final would overstate quality.
- **Competitor benchmark:** ESL Brains and Fluentize have substantial C1 content; Thomas must differentiate with precise discourse-level choices and transparent review.
- **Expected benefit:** Establishes a reliable C1 voice and prevents later lessons from repeating weak assumptions.
- **Scope:** Advanced tense/aspect; narrative tenses/viewpoint; mixed/implied conditionals. Verify every claim, item, spoken note, and extended task.
- **Affected files/systems:** `src/content/lessons/c1/` first three files, QA metadata/report, assessment relationship.
- **Dependencies:** P1.1 and quality standard.
- **Risk:** High pedagogically. C1 nuance permits multiple defensible formulations.
- **Effort:** Medium.
- **Priority:** High.
- **Measurable completion criteria:** Tutor-review flag is cleared only after human sign-off and three real uses per lesson; no ambiguous closed item remains; each lesson includes reformulation and sustained production.

### P3.2 — Author C1 in three-lesson batches

- **User problem solved:** Sixteen C1 topics remain planned; authoring all at once would produce inconsistent, untested content.
- **Competitor benchmark:** Strong C1 competitors publish regularly and in varied formats; Thomas needs a coherent sequence and slower review discipline.
- **Expected benefit:** Completes the A0–C1 promise without sacrificing accuracy.
- **Scope:** Next batch: Inversion after negative expressions; Advanced modal meaning and stance; Participle clauses. Continue in explicit sequence, three at a time.
- **Affected files/systems:** `src/content/lessons/c1/`, canonical metadata, tutor plans, related/prerequisite links, QA records.
- **Dependencies:** P3.1 review patterns; review capacity; audio plan for sound-dependent lessons.
- **Risk:** High. Generated advanced pedagogy can sound plausible while oversimplifying nuance.
- **Effort:** Large across 16 lessons; medium per batch.
- **Priority:** High after P3.1.
- **Measurable completion criteria:** Each batch passes 85/100 rubric, human review, three learner uses, interactions, direct refresh, and build before the next batch starts; planned counts fall only when a lesson truly becomes ready.

### P3.3 — C1 exit diagnostic blueprint, then build

- **User problem solved:** A complete C1 path needs evidence of flexible discourse, not a grammar-recognition quiz.
- **Competitor benchmark:** Ellii offers productive placement; Thomas can build a smaller tutor-led assessment aligned tightly to its C1 outcomes.
- **Expected benefit:** Makes the A0–C1 path complete and gives tutors defensible next-step evidence.
- **Scope:** Blueprint now; author after enough C1 lessons are reviewed. Include listening inference/stance, spoken argument/reformulation, register, lexical precision, and sustained writing.
- **Affected files/systems:** assessment route registry, new C1 assessment source, static audio, scoring/rubric components, curriculum relationship.
- **Dependencies:** At least 12 reviewed C1 lessons and agreed level outcomes.
- **Risk:** High. A premature diagnostic would test the authored syllabus rather than C1 ability.
- **Effort:** Large.
- **Priority:** High for curriculum completion; deferred build.
- **Measurable completion criteria:** Blueprint maps every task to C1 outcome evidence; productive evidence is required; audio is reviewed; threshold is piloted on at least 10 appropriate learners; planned status remains until all gates pass.

## Phase 4: Teacher usability and materials

### P4.1 — Complete tutor plans

- **User problem solved:** A tutor can open a lesson quickly but still has to infer timing, core/extension choices, anticipated errors, and adaptations.
- **Competitor benchmark:** Off2Class teacher notes and Teach-This answer/instruction packs minimize prep.
- **Expected benefit:** Makes Thomas’s Classroom genuinely “open and teach” while preserving the clean student page.
- **Scope:** Derive outcome, core timing, optional extensions, spoken feature, anticipated errors, answers/rationales, and one-to-one adaptations.
- **Affected files/systems:** `src/lib/tutor-plan.mjs`, tutor-plan pages/styles, lesson QA metadata.
- **Dependencies:** Review record and item rationales.
- **Risk:** Low–medium. Auto-derived notes can become generic if source data is thin.
- **Effort:** Medium.
- **Priority:** High.
- **Measurable completion criteria:** Tutor plan exists for every ready lesson; a tutor finds core timing, three likely errors, and answer rationale in under one minute; student pages expose no early answers.

### P4.2 — Direct-link retrieval and homework

- **User problem solved:** Learning ends at the lesson page; there is no structured between-lesson recall.
- **Competitor benchmark:** Linguahouse Expemo and ESL Brains homework/revision provide continuity.
- **Expected benefit:** Improves retention and student independence without building accounts.
- **Scope:** Add one 5–15 minute retrieval follow-up per reviewed lesson with recall, contextual decisions, and short production.
- **Affected files/systems:** lesson content/metadata, new homework/review route or component, tutor plans, sitemap/SEO rules, print styles.
- **Dependencies:** Phase 1 reviewed answers/feedback; decision on public indexing.
- **Risk:** Medium. Duplicated content or manual registration would undermine authoring simplicity.
- **Effort:** Large across the catalog; small per lesson.
- **Priority:** High quality improvement.
- **Measurable completion criteria:** Every reviewed lesson has one direct review link; no account required; answers remain hidden until attempt; print and mobile work; review references a prerequisite or later retrieval interval.

### P4.3 — Focused printable student packs

- **User problem solved:** Tutors sometimes need offline backup, writing space, or a compact handout; the print curriculum is not a lesson worksheet.
- **Competitor benchmark:** Teach-This, ESL Brains, ESL Pals, and Onestopenglish make printable teacher/student material easy.
- **Expected benefit:** Adds classroom flexibility and commercial packaging without turning the site into PDF-first content.
- **Scope:** Pilot printable core practice and homework for 6–10 high-use lessons, generated from the same source where possible.
- **Affected files/systems:** print styles/templates, lesson data, asset/build validation.
- **Dependencies:** Reviewed lesson and homework contract.
- **Risk:** Medium. Parallel PDF content can drift from the browser source.
- **Effort:** Medium pilot; large catalog-wide.
- **Priority:** Medium.
- **Measurable completion criteria:** Pilot prints cleanly on Letter and A4; answers/teacher notes separate; no duplicated answer registry; browser lesson remains primary.

## Phase 5: Student progress and personalization

### P5.1 — Account-free review queue pilot

- **User problem solved:** A student needs to know what to review next, but accounts and persistent tracking are premature.
- **Competitor benchmark:** Linguahouse provides spaced repetition; Thomas can test the learning model with lower privacy and infrastructure cost.
- **Expected benefit:** Validates whether scheduled retrieval is useful before building authentication.
- **Scope:** Teacher-generated/shareable review sequence or printable schedule using lesson relationships; no hidden local student profile and no claim of adaptive learning.
- **Affected files/systems:** tutor tools, lesson relationships, review routes, documentation.
- **Dependencies:** P4.2 coverage.
- **Risk:** Low technically, medium pedagogically if schedules are generic.
- **Effort:** Medium.
- **Priority:** Medium.
- **Measurable completion criteria:** Tutors can create a 2–4 week review path from selected lessons; students access it by direct link or print; no personal data is stored; five tutors/learners report whether it was used.

### P5.2 — Optional accounts and assignments discovery

- **User problem solved:** At scale, tutors may need assignment history, completion, and feedback across students.
- **Competitor benchmark:** Off2Class and Ellii lead this area, but their administrative depth is not automatically appropriate for independent tutors.
- **Expected benefit:** Could support paid retention and student continuity if research proves demand.
- **Scope:** Discovery interviews, data/privacy model, minimal assignment/history prototype only after evidence. Not a full LMS.
- **Affected files/systems:** future authentication/database/hosting architecture; not the current static lesson core.
- **Dependencies:** 20+ active tutors or equivalent repeated demand; privacy/security plan; commercial model.
- **Risk:** High cost, high scope, high privacy responsibility.
- **Effort:** Large.
- **Priority:** Later/commercial.
- **Measurable completion criteria:** At least 10 target tutors identify the same high-value workflow and willingness to pay; minimal scope is documented; no build begins without approval and a data-retention policy.

## Phase 6: Listening and premium static audio

### P6.1 — Generate and review assessment audio

- **User problem solved:** Current assessments show audio controls but depend on fallback because static files are missing.
- **Competitor benchmark:** Ellii, ESL Brains, and Breaking News English deliver dependable recordings.
- **Expected benefit:** Makes existing listening evidence real and consistent.
- **Scope:** Generate the ten configured files locally, review pacing/pronunciation/noise, and commit only approved MP3s.
- **Affected files/systems:** `private/voice-scripts.json`, `private/audio-settings.json`, `public/audio/assessments/`, audio validation/docs.
- **Dependencies:** Local authoring API key; no production key.
- **Risk:** Low technically; medium quality/licensing if voice settings are not documented.
- **Effort:** Small.
- **Priority:** Critical.
- **Measurable completion criteria:** `audio:status` reports all ten skipped/existing and zero planned/failed; student playback makes zero ElevenLabs requests; transcripts and fallbacks remain; human review log passes.

### P6.2 — High-value spoken-contrast audio pilot

- **User problem solved:** Learners read about reductions and intonation but often cannot hear the contrast independently.
- **Competitor benchmark:** Breaking News English provides speed variation; Ellii and ESL Brains provide recorded pronunciation/listening.
- **Expected benefit:** Turns spoken-form notes into perception and production training, a signature product advantage.
- **Scope:** Add short static contrasts to 6–10 high-value lessons: question tags, contractions, third-person endings, conditionals, clefts, and register/intonation.
- **Affected files/systems:** lesson audio manifest, static files, AudioControl generalization, lesson sources, validation.
- **Dependencies:** P6.1 workflow proven; reviewed scripts.
- **Risk:** Medium. Synthetic speech may not model nuanced intonation reliably.
- **Effort:** Medium.
- **Priority:** High quality improvement.
- **Measurable completion criteria:** Each pilot has perception-before-production, transcript, replay, no live API, human prosody review, and at least three learner trials.

### P6.3 — Audio quality and accessibility policy

- **User problem solved:** Scaling audio without standards creates inconsistent voices, speed, loudness, transcripts, and rights.
- **Competitor benchmark:** Mature media libraries provide consistent, downloadable/streamed recordings and scripts.
- **Expected benefit:** Protects intelligibility, accessibility, and maintainability as audio grows.
- **Scope:** Voice/style guide, pronunciation notation, loudness/file target, transcript rule, speaker diversity plan, regeneration/versioning, rights record.
- **Affected files/systems:** `ELEVENLABS.md`, private audio config, validators, metadata.
- **Dependencies:** Two completed audio pilots.
- **Risk:** Low.
- **Effort:** Small.
- **Priority:** High before catalog-scale generation.
- **Measurable completion criteria:** Every clip validates against stable ID/path/transcript/settings; approved voice rights documented; replaced audio invalidates the correct review record.

## Phase 7: Monetization and accounts

### P7.1 — Offer and pricing validation

- **User problem solved:** The site has tutoring proof and free curriculum value but no clear paid curriculum offer.
- **Competitor benchmark:** ESL Brains, Teach-This, ESL Pals, and Onestopenglish have simple individual tiers; Off2Class and Ellii bundle platform depth at higher prices.
- **Expected benefit:** Identifies what target tutors will pay for before expensive account development.
- **Scope:** Interview tutors, test landing-page positioning, and package reviewed browser lessons, tutor plans, homework, and print/audio pilots conceptually.
- **Affected files/systems:** research documents and possibly one approved offer page; no checkout initially.
- **Dependencies:** Meaningful reviewed catalog, tutor plans/homework samples, public deployment.
- **Risk:** Low if tested manually; high if pricing is inferred from competitors alone.
- **Effort:** Medium.
- **Priority:** Medium commercial.
- **Measurable completion criteria:** 15 target-tutor interviews, at least two offer tests, documented willingness-to-pay range, and a go/no-go decision with evidence.

### P7.2 — Minimal paid access, only after validation

- **User problem solved:** A validated tutor materials package needs payment and entitlement without degrading direct student links.
- **Competitor benchmark:** Content-only rivals gate teacher assets while allowing samples; Thomas should preserve student sharing.
- **Expected benefit:** Sustainable editorial/audio investment.
- **Scope:** Gate tutor plans, downloads, or premium method packs; keep approved student lesson links frictionless. Avoid per-student account complexity initially.
- **Affected files/systems:** hosting/auth/payment architecture, entitlement, legal/privacy, support workflow.
- **Dependencies:** P7.1 go decision, public origin, terms/privacy/refund policy, operational support capacity.
- **Risk:** High security/commercial scope.
- **Effort:** Large.
- **Priority:** Later commercial.
- **Measurable completion criteria:** Paid boundary is documented; direct student links still work as promised; payments/auth/security tests pass; support and refund process exists; no secrets enter browser code.

## Phase 8: SEO, growth, and ongoing publishing

### P8.1 — Production origin and release validation

- **User problem solved:** Crawlability and reliability cannot be proven from localhost or an unspecified `SITE_URL`.
- **Competitor benchmark:** ESL Brains, Fluentize, Teach-This, and Onestopenglish win search through public indexable lesson pages.
- **Expected benefit:** Makes the existing SEO layer real and provides a stable destination for shared lessons.
- **Scope:** Supply canonical origin, deploy static build, validate live redirects/headers/caching/sitemap/404/audio/direct routes.
- **Affected files/systems:** environment/deployment configuration, hosting, `DEPLOYMENT.md`, live validator.
- **Dependencies:** Domain/host decision and launch-critical content/audio fixes.
- **Risk:** Medium operationally.
- **Effort:** Small–medium.
- **Priority:** Critical before public launch.
- **Measurable completion criteria:** `build:production` and `live:validate` pass against HTTPS origin; sitemap/canonicals use the real domain; `.html` redirects and custom 404 work; no localhost URL appears in production output.

### P8.2 — Intent-led publishing program

- **User problem solved:** The site has curriculum content but little public editorial content answering tutor/learner questions.
- **Competitor benchmark:** ESL Brains, Teach-This, Fluentize, and Onestopenglish attract search through frequently updated topic and lesson pages.
- **Expected benefit:** Sustainable discovery, authority, and entry points into the curriculum.
- **Scope:** Publish reviewed articles and selected lesson pages around real tutor friction: CEFR, transfer patterns, spoken grammar, and common adult errors.
- **Affected files/systems:** blog content collection, structured data, internal links, editorial calendar.
- **Dependencies:** Public origin, review workflow, ability to sustain quality.
- **Risk:** Medium. Publishing volume can distract from curriculum QA.
- **Effort:** Ongoing medium.
- **Priority:** Later growth.
- **Measurable completion criteria:** One high-quality article or lesson update every 2–4 weeks for three months; each maps to a curriculum route; impressions/qualified clicks are measured without publishing thin pages.

### P8.3 — Learning and product evidence loop

- **User problem solved:** “Tutor-tested” must mean more than a marketing claim; the product needs a disciplined way to learn from real sessions.
- **Competitor benchmark:** Off2Class and Ellii collect platform data; Thomas can use smaller, more qualitative one-to-one evidence without surveillance.
- **Expected benefit:** Makes the 1,000+ lesson experience visible in better examples, errors, feedback, and sequencing.
- **Scope:** Anonymous issue taxonomy, lesson-use notes, revision reasons, tutor interviews, optional learner feedback, and quarterly review.
- **Affected files/systems:** QA records, research templates, roadmap review; no student identity database initially.
- **Dependencies:** P1.1 and tutor consent/operational habit.
- **Risk:** Medium privacy and bias risk.
- **Effort:** Medium ongoing.
- **Priority:** High quality improvement.
- **Measurable completion criteria:** Quarterly report lists observed errors, revisions, unresolved issues, and sample size; no personal learner data is stored; at least five lesson revisions per quarter cite real evidence when usage supports it.

## Recommended sequence and decision gates

1. **Now:** P1.1, then a narrow P1.2 Present Simple slice; generate P6.1 assessment audio in parallel only after script review.
2. **Next:** finish Phase 1 batches and review C1 batch 1.
3. **Then:** run the Present Simple multi-method pilot and build direct-link retrieval for reviewed lessons.
4. **Before public launch:** production origin/live validation and a transparent quality statement.
5. **Before monetization:** prove teacher demand for tutor plans, homework, print, and audio; do not assume accounts are the product.
6. **Before student accounts:** validate the account-free retrieval model and conduct privacy/scope discovery.

## What can wait

- Student accounts and persistent history
- Tutor/team dashboards
- Subscription billing
- Institutional rostering and analytics
- Broad printable catalog
- Large blog cadence
- C1 exit build before C1 outcomes are sufficiently reviewed
- Additional language versions

## What should not be built in this roadmap horizon

- A full LMS matching Off2Class feature for feature
- An open user-generated lesson marketplace
- Live visitor-time ElevenLabs generation
- A generic AI tutor that bypasses reviewed lessons
- Points, streaks, leaderboards, or progress claims without evidence
- A new design system or framework migration
- Hundreds of thin SEO pages
