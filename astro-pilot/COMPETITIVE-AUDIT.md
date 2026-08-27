# Thomas’s Classroom Competitive Product Audit

**Audit date:** July 16, 2026
**Scope:** public product capabilities, the current Astro repository, 29 representative lessons, all assessment formats, and the authoring/validation system.
**Companion documents:** [BEST-IN-CLASS-SCORECARD.md](./BEST-IN-CLASS-SCORECARD.md), [LESSON-QUALITY-STANDARD.md](./LESSON-QUALITY-STANDARD.md), [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md), and [PHASE-1-IMPLEMENTATION-PLAN.md](./PHASE-1-IMPLEMENTATION-PLAN.md).

## Executive verdict

Thomas’s Classroom is already a credible curriculum product, not a prototype. Its native Astro architecture, coherent sequence, calm browser-native lessons, contextual grammar explanations, spoken-form notes, direct links, and production-oriented lesson endings are stronger than most small independent ESL sites. The repository currently contains **111 canonical topics: 95 ready and 16 planned**. A0–B2 is complete at 92 ready lessons; C1 has three ready lessons requiring tutor review and 16 planned lessons.

It is not yet best in class. The most important deficiencies are pedagogical quality assurance, limited listening media, uneven item-level feedback, no routine homework/retrieval package, and insufficient differentiation among teaching methods. The newer B1–C1 lesson contract is rigorous but highly uniform. The older A0–A2 lessons feel more individually crafted, but their wrong-answer guidance is inconsistent. Ten approved assessment audio clips are still ungenerated, so browser speech is currently a fallback rather than a premium listening experience.

The right strategy is not to imitate a large LMS. It is to own a narrower, more defensible position:

> A complete A0–C1 browser-native curriculum for one-to-one adult English lessons, where important concepts can be understood through more than one method and immediately used in speech.

The single most important next project is a **content accuracy and exercise-quality pass over the high-use grammar spine and all assessments**, beginning with one narrow A1 Present Simple quality slice. Phase 1 should establish trustworthy review evidence before more content volume, accounts, or visual novelty.

## Method and evidence limits

Competitor findings use official public pages and documentation available on the audit date. Public pricing may change, vary by region, or exclude taxes. Logged-in functionality was not reverse engineered, paid lesson content was not copied, and no competitor received a formal WCAG or laboratory performance audit. Accessibility, mobile, visual, and reliability judgments are therefore conservative and based on public product evidence rather than certification.

Repository findings use source files and the project’s validators. The lesson sample was intentionally stratified across grammar, vocabulary, functional language, pronunciation, speaking, listening-dependent work, and advanced discourse. A sample audit is evidence of patterns, not proof that every item in all 95 ready lessons is correct.

## Current product inventory

| Area | Current state | Product implication |
| --- | --- | --- |
| Curriculum | 92 ready A0–B2 lessons; 3 ready C1 pilots; 16 planned C1 topics | Coherent breadth is already a meaningful advantage, but “complete A0–C1” is not yet a valid availability claim. |
| Lessons | Native `.astro` sources with canonical metadata and reusable lesson components | Direct editing and stable shareable routes are strong. Content QA, not architecture, is now the main bottleneck. |
| Assessments | A0–B2 exit diagnostics, full placement diagnostic, quick level check; C1 exit planned | Better than a resource library, but C1 alignment and listening delivery remain incomplete. |
| Interactions | Answer gaps, choice gaps, matching, sentence building, error spotting, transformations, quizzes | Good browser-native variety; method variety is less developed than mechanic variety. |
| Audio | Static authoring workflow with 10 configured assessment clips; none generated in the current worktree | Secure architecture, incomplete student experience. Normal playback correctly avoids live ElevenLabs requests. |
| Tutor support | Derived tutor plans and print curriculum | Useful foundation, but there is no consistent lesson-level timing, anticipated-error, homework, or adaptation package. |
| Student support | Direct links, accessible controls, immediate checking, no account required | Excellent low-friction access; weak continuity between lessons and no deliberate retrieval schedule. |
| Discovery | Searchable/filterable curriculum, ready/planned state, direct routes, previous/next navigation | Strong for a focused curriculum; weaker than large libraries for topic/media/skill filtering. |
| Reliability | Astro schema, catalog validation, answer contracts, interaction checks, link/asset/audio/SEO/accessibility gates | Unusually strong for an independent static product; automated checks cannot validate pedagogy or naturalness by themselves. |

## Representative lesson audit

### Rating key

- **✓** clearly present and usable.
- **△** present but inconsistent, overly implicit, or dependent on the tutor.
- **—** materially absent.
- **FMU** means form, meaning, and use.
- **Progression** covers controlled practice, guided production, open production, and review/retrieval.

Every inspected lesson was checked for outcomes, FMU, example quality, context, one defensible controlled answer, distractors, feedback, spoken form, practice progression, CEFR fit, tutor usability, and student independence.

### A0 sample

| Lesson | Outcome / FMU | Context and answers | Feedback | Spoken form | Progression | Level and usability | Main finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The verb **to be** | ✓ / ✓ | ✓ adult introductions; answers constrained | △ mostly group-level | ✓ contractions, stress, linking | ✓ controlled to personal speaking and reflection | ✓ high | Excellent conceptual entry point; at roughly 25 minutes it is shorter than the later A0 standard. |
| The alphabet and spelling | ✓ / ✓ functional use | ✓ phone/email repair context | △ generic on most items | ✓ strong B/V, E/I, G/J, M/N work | ✓ listening-like discrimination, builders, spelling production, review | ✓ with tutor; △ alone | One of the strongest functional A0 lessons. Discrimination depends on the tutor because no recorded input is embedded. |
| Countries and nationalities | ✓ / ✓ | ✓ team introductions; mostly defensible | △ generic | ✓ stress movement | ✓ matching, building, repair, real introductions | ✓ | Clear distinction between country and nationality. Formation patterns correctly need to remain examples rather than universal rules. |
| Animals | ✓ / ✓ integrated with articles/plurals | ✓ pet and neighbor contexts | △ generic; some distractors easy | ✓ three plural endings | ✓ eight drills plus description | △ lexically heavy | Thirty animal words plus articles, plurals, **be**, and **have** make this the most overloaded A0 sample. Reduce core targets or mark extension vocabulary. |

### A1 sample

| Lesson | Outcome / FMU | Context and answers | Feedback | Spoken form | Progression | Level and usability | Main finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Present simple | ✓ / ✓ | ✓ routines and adult work; mostly defensible | △ no item hints in inspected source; several obviously wrong distractors | ✓ third-person **-s** | ✓ retrieval through real-life prompts and reflection | ✓ | Strong core lesson and best multi-method pilot candidate. It needs better error-specific feedback and less giveaway distractors. |
| Imperatives | ✓ / ✓ unusually deep | ✓ directions, hosting, procedures, social context | △ mostly group-level | ✓ intonation and directness | ✓ extensive controlled, reading, building, repair, production | △ high cognitive load for A1 | Excellent explanation of hidden **you**, politeness, **let’s**, and tone. Split optional depth from the required path so the lesson remains teachable in one session. |
| Jobs and workplaces | ✓ / ✓ chunks | ✓ party and workplace contexts | △ generic | ✓ word stress | ✓ matching, sentence building, repair, role play | ✓ | Immediately useful for adults. “Typical workplace” matches should be framed as common associations, not fixed truths. |
| Food and drink | ✓ / ✓ countability and requests | ✓ cafe and lunch order | △ one item-level hint only | ✓ sentence stress in requests | ✓ sorting, builders, repair, role play | △ broad scope | Practical and engaging, but vocabulary, countability, **some/any**, **there is/are**, and ordering language compete for attention. |

### A2 sample

| Lesson | Outcome / FMU | Context and answers | Feedback | Spoken form | Progression | Level and usability | Main finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Present perfect | ✓ / ✓ with past-simple contrast | ✓ work/travel dialogue; controlled answers defensible | △ generic on most items | ✓ helper reduction and stress | ✓ 11 tasks, repairs, personal experience, retrieval | ✓ | Very thorough and conceptually clear. Feedback should explain time reference on the first failed attempt, not only reveal the answer later. |
| First conditional | ✓ / ✓ | ✓ future messages and plans | △ generic | ✓ clause rhythm | ✓ controlled choice, building, repair, production | ✓ | Strong meaning-first contrast of possible future, **if/when**, and result choices. |
| Past continuous | ✓ / ✓ camera-angle model | ✓ evening narrative | △ generic | ✓ background/event phrasing | ✓ form to narrative production | ✓ | The “camera angle” explanation is memorable. State-verb exceptions need tutor review across every example. |
| Health and the body | ✓ / ✓ functional chunks | ✓ doctor and sick-message contexts | △ better than the level average; three targeted hints | ✓ spelling/sound contrasts | ✓ symptom/advice practice and role play | ✓ | Strong adult functional lesson and a model for adding contextual hints to older lessons. |
| Travel and transport | ✓ / ✓ collocations | ✓ trip plan and airport contexts | ✓ six useful item hints | ✓ chunk stress | ✓ 11 tasks and real trip production | ✓ | Best A2 example of context-first lexical practice. Long but coherent. |
| Phrasal verbs | ✓ / ✓ including separability | ✓ busy morning and message | △ generic despite nine feedback surfaces | ✓ particle stress | ✓ four gap/build mechanics, repair, transfer | ✓ | Good semantic and syntactic depth. Limit the core set and use later retrieval rather than adding more particles in the same lesson. |

### B1 sample

| Lesson | Outcome / FMU | Context and answers | Feedback | Spoken form | Progression | Level and usability | Main finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Present perfect continuous | ✓ / ✓ simple/continuous contrast | ✓ project context | ✓ nine hints; repair reasons | ✓ weak **been**, stress | ✓ retrieval, noticing, build, repair, fluency, communication, reflection | ✓ | Strong contract exemplar. Some wrong options are malformed rather than plausible meaning competitors. |
| Passive voice | ✓ / ✓ information focus | ✓ complaint, production, notice | ✓ | ✓ weak **be**, participle stress | ✓ full sequence | ✓ | Explains why the passive is chosen, not only how it is formed. |
| Reported speech | ✓ / ✓ viewpoint | ✓ messages and client updates | ✓ | ✓ **that** omission and ambiguous **’d** | ✓ full sequence | ✓ | Appropriately avoids treating backshift as absolute. Pronoun/reference items are especially useful. |
| Question tags | ✓ / ✓ polarity and stance | ✓ arrival/meeting context | ✓ | ✓ rising/falling intonation | ✓ full sequence | ✓ | Spoken meaning is central, a major strength. Audio discrimination would make the intonation distinction more independent. |
| Work and careers | ✓ / ✓ collocations | ✓ job ad and application | ✓ | ✓ compound stress | ✓ from chunks to professional profile | ✓ high adult relevance | Strong vocabulary lesson, though its structure is almost identical to grammar lessons. |
| Discourse linkers | ✓ / ✓ logical relationships | ✓ recommendation/argument context | ✓ | ✓ pause and contrastive stress | ✓ paragraph-level production and retrieval | ✓ | Correctly teaches linkers as logic, not decoration. Needs a visible model revision showing a weak and improved paragraph. |

### B2 sample

| Lesson | Outcome / FMU | Context and answers | Feedback | Spoken form | Progression | Level and usability | Main finding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Third and mixed conditionals | ✓ / ✓ time relationships | ✓ decisions and consequences | ✓ | ✓ **’d** and weak **have** | ✓ review to balanced decision analysis | ✓ | Strong semantic treatment. Timeline visualization would offer a genuinely different route into the concept. |
| Past perfect continuous | ✓ / ✓ process/result | ✓ audit and project history | ✓ | ✓ weak **been** | ✓ timeline production | ✓ | Clear anchoring requirement prevents decontextualized tense guessing. |
| Cleft sentences for emphasis | ✓ / ✓ focus choices | ✓ proposal and narrative contexts | ✓ ten hints | ✓ nuclear stress and pausing | ✓ neutral-to-cleft transformations and production | ✓ | Strong advanced meaning work. A listening contrast would show that syntax and stress cooperate. |
| Advanced discourse markers | ✓ / ✓ grammar/register/punctuation | ✓ sustained policy argument | ✓ | ✓ framing pauses | ✓ analysis, repair, sustained argument | ✓ | Excellent precision. Risk: too many markers without spaced retrieval or a learner-selected core set. |
| Register and formality | ✓ / ✓ continuum, not binary | ✓ internal/external/incident messages | ✓ | ✓ polite contour | ✓ audience analysis and rewriting | ✓ | One of the strongest differentiating lessons. It should become a model for multi-method comparison. |
| Connotation and shades of meaning | ✓ / ✓ framing and semantic preference | ✓ reviews, headlines, policy language | ✓ | ✓ contrastive stress/self-correction | ✓ critical analysis and rewriting | ✓ | Sophisticated and appropriate. Needs tutor review for cultural neutrality and overinterpretation of isolated wording. |

### Current C1 pilots

| Lesson | Verdict | Required review before public promotion |
| --- | --- | --- |
| Advanced tense and aspect review | Strong discourse-level viewpoint framework with defensible contexts, spoken reductions, and sustained production. | Confirm every tense contrast against natural U.S. usage; add at least one authentic listening contrast; tutor-review flag already present. |
| Narrative tenses and viewpoint | Strong separation of background, foreground, backstory, and historic present. | Verify historic-present examples and narrator-distance claims; test two full narratives with real learners. |
| Mixed and implied conditionals | Clear relationship-first approach and appropriately recoverable implied conditions. | Check modality strength and contextual uniqueness; test **otherwise**, **without**, and threshold patterns in speech. |

### Cross-level findings

1. **No decisive grammatical error was found in the inspected sample.** This is not a clean bill of health for all 95 lessons. Several claims and all generated C1 pedagogy still require a second human review.
2. **Context is usually stronger than distractor quality.** Many questions give enough context for one answer, but some wrong options are merely malformed or unrelated. Those items test recognition rather than choice among plausible meanings.
3. **Feedback is the largest lesson-level weakness.** The shared engine supports item hints and reveals an answer after repeated failure, but most A0–A2 items do not provide a specific hint or explanation. B1–C1 are better because the structured lesson data requires hints.
4. **Spoken form is a real advantage.** Every sampled lesson includes pronunciation, stress, rhythm, reduction, linking, or intonation related to its language target. Most competitors isolate pronunciation into separate resources.
5. **Audio does not yet match the spoken-form ambition.** Explanations tell learners what to hear, but most lessons do not let them hear controlled contrasts.
6. **The practice contour is consistently strong.** Retrieval, noticing, controlled work, repair, guided fluency, open communication, and reflection appear across the sample.
7. **B1–C1 need method differentiation.** A single `StructuredLesson` contract creates reliable minimums, but grammar, vocabulary, register, discourse, and stance lessons currently share nearly the same visible rhythm and mechanic counts.
8. **A0–A2 need scope discipline.** The most useful lessons are also long. Core versus extension content should be explicit so tutors can teach a complete 45–60 minute path without rushing.

## Assessment audit

| Format | Strengths | Gaps and risks | Priority |
| --- | --- | --- | --- |
| A0–B2 exit diagnostics | Contextual recognition, reading, two listening clips per level, teacher-scored speaking/writing, skill profile, production/listening minimums, print summary | Ten static clips are configured but absent; no external standard-setting study; controlled sections can over-reward recognition | Critical: generate/review audio, then run a small standard-setting pilot |
| Full placement diagnostic | Honest A0–B2 ceiling, progressive grammar/reading, teacher-mode listening scripts, speaking/writing rubrics, level ladder, evidence coverage | Live teacher-read listening reduces standardization; several early items are decontextualized; no C1 separation | High: add reviewed static listening and collect outcome data before expanding range |
| Quick level check | Clear “rough estimate” language, only ten questions, required speaking confirmation, direct path to full exam | Too short for skill diagnosis; no listening; results should never be marketed as CEFR certification | Maintain as lead/triage tool, not a placement replacement |
| C1 exit relationship | Planned status is honest and integrated into curriculum | No C1 diagnostic exists yet | Build only after enough C1 lessons are reviewed to define valid outcomes |

The assessment architecture is stronger than the site’s small size suggests. The main requirement is validity evidence, not more scoring UI. A full LMS dashboard would not solve that.

## Product-system audit

| Surface/system | What works | Highest-priority improvement |
| --- | --- | --- |
| Homepage | Distinctive tutor voice, verified “1000+ lessons taught” proof, strong curriculum link, accessible mobile navigation, stable deliberate visual theme | Clarify the product offer relative to tutoring: what is free, what a teacher can share, and what booking includes. Do not redesign before testing that message. |
| Curriculum discovery | A0–C1 path, search/filter, ready/planned states, assessment path, URL state, direct lesson links | Add method/skill filters only after multi-method metadata exists; avoid turning it into a crowded resource marketplace. |
| Print curriculum | Complete A0–C1 reference, dynamic data, no duplicated registry | Add ready/planned distinction and a compact “how to use this path” legend; lesson worksheets are a separate future need. |
| About | Clear tutor identity and audience | Add evidence-backed teaching principles and a transparent editorial/review statement once QA workflow exists. |
| Mobile navigation | Progressive `<details>` menu, Escape/link close behavior, focus state, reduced-motion support | Preserve; validate manually with VoiceOver and real narrow devices before launch. |
| Audio workflow | Secure static MP3 workflow, stable filenames, skips existing files, no browser API key | Generate and human-review the ten approved clips; then pilot lesson-level minimal pairs and discourse contrasts. |
| Lesson components | Accessible controls, polite live feedback, reusable engines, reduced motion, progressive disclosure | Add richer feedback contracts and optional method sections without forcing a single template. |
| Metadata/authoring | One canonical record per lesson; routes, counts, sequence, navigation, search, assessment relations derive automatically | Extend metadata only when needed for review status, method tags, homework, and audio. Do not create a second content registry. |
| Validation | Catalog, interactions, accessibility, SEO, audio, performance, links, assets, route refresh, native migration gates | Add semantic editorial checks: review status, item rationale coverage, feedback completeness, and QA sampling reports. |

## Competitor audit

The numbered groupings below cover all requested dimensions: **1–4** curriculum, lesson depth, grammar, vocabulary; **5–8** pronunciation/listening, speaking, assessment/progress; **9–12** teacher workflow, student experience, discovery, print/download; **13–16** audio/video, variety, accessibility, mobile; **17–20** visual quality, performance, SEO, and pricing/monetization. Exact scores and evidence appear in the companion scorecard.

### Off2Class

- **1–4:** The strongest full-platform curriculum competitor: 1,500+ teacher-guided lessons across skills, step-by-step, business, literacy, test prep, and academic content. Grammar is systematic; lesson slides are fixed rather than directly editable.
- **5–8:** Four-skill lessons, voice recording, homework, placement/gap analysis, learning plans, and unit checks create the strongest assessment-to-instruction loop in this set.
- **9–12:** Excellent immediate launch, teacher notes, student/class management, and assigned homework. Download/print is less central than the live platform.
- **13–16:** Rich browser interactivity and asynchronous speaking; public pricing states accessibility/data-security sign-off for districts. Mobile is usable but the product is optimized around managed classroom sessions.
- **17–20:** Polished integrated product with strong public documentation and search visibility. Independent pricing starts at **$24/month paid annually** for one teacher and up to five students.
- **Strongest feature:** placement and gap analysis that turns directly into a managed learning plan.
- **Weakness/opportunity for Thomas:** its LMS breadth adds account and administrative weight; Thomas can make one-to-one lessons faster to open, understand, and share.
- **Official evidence:** [Lesson Library](https://help.off2class.com/features/lesson-library), [platform](https://www.off2class.com/platform/), [unit checks](https://help.off2class.com/features/unit-checks), [lesson customization](https://help.off2class.com/teacher/can-i-customize-lesson-plans), [pricing](https://www.off2class.com/pricing/).

### Ellii

- **1–4:** 2,000+ professionally developed lessons plus grammar courses, ready-made folders, pathways, adult literacy, work, academic, and topic libraries. It offers several ways to teach the same target.
- **5–8:** Dedicated pronunciation, downloadable/streamed audio, four-skill materials, placement/exit tests, CASAS preparation, and lesson assessments are unusually complete.
- **9–12:** Lesson Planner, digital tasks, classes, student accounts, grade feed, PDF presentation/annotation, print and digital versions, and extensive discovery minimize teacher preparation.
- **13–16:** 400+ videos, 4,500+ flashcards, strong format variety, and a designed student task experience. Public evidence is stronger for broad usability than for formal accessibility certification.
- **17–20:** Mature, polished, reliable, and highly discoverable. Individual pricing is advertised from **$14/month** with up to 35 student accounts.
- **Strongest feature:** breadth plus a mature teacher/student assignment and reporting system.
- **Weakness/opportunity for Thomas:** abundance creates choice overload; Thomas can offer a clearer canonical path and deeper concept explanations with less setup.
- **Official evidence:** [product](https://ellii.com/), [pricing](https://ellii.com/pricing?group_type=individual), [sample lessons](https://ellii.com/sample/lessons), [getting started](https://help.ellii.com/article/161-how-to-get-started), [placement and exit tests](https://ellii.com/blog/ellii-placement-test).

### Linguahouse

- **1–4:** Large searchable lesson and course-plan library with general/business English, topics, functions, levels, and free/premium tiers. Materials are typically context-led and worksheet-centered.
- **5–8:** Audio/video filters and integrated media are strong. Assessment/progress is less visible as a coherent curriculum loop than Off2Class or Ellii.
- **9–12:** Freelancer plans, course plans, downloadable worksheets, interactive transcripts, and Expemo provide a good tutor workflow and unusually strong post-lesson review.
- **13–16:** Media-rich variety and mobile Expemo access are advantages; the public search renderer depends heavily on JavaScript, which weakens public accessibility and crawl evidence.
- **17–20:** Professional worksheet design and strong search visibility. Public pricing supports multiple teacher tiers, but the current public renderer did not expose reliable numeric prices during this audit, so none are invented here.
- **Strongest feature:** QR-connected Expemo spaced repetition tied to lesson material.
- **Weakness/opportunity for Thomas:** worksheets and a companion app fragment the student journey; Thomas can keep retrieval in direct browser links.
- **Official evidence:** [lesson search](https://www.linguahouse.com/es/esl-lesson-plans/searchlessons), [Expemo](https://www.linguahouse.com/expemo), [teacher plans](https://www.linguahouse.com/en-GB/subscription-plans/teachers).

### ESL Brains

- **1–4:** More than 1,000 adult A1–C2 lesson plans across standard, flipped, speaking, vocabulary, and critical-reading formats. Individual lessons are exceptionally contextual and current, but the product is more library than canonical A0–C1 course.
- **5–8:** Strong authentic video/audio, discussion, role play, and dedicated pronunciation. Assessment and persistent progress are not the center of the offer.
- **9–12:** PDF and e-lesson versions, clear overviews, teacher/student materials, homework/revision, and frequent publishing make preparation excellent.
- **13–16:** High media and method variety, polished browser presentations, good mobile responsiveness, and modern visuals.
- **17–20:** Excellent SEO and commercial packaging. Public plans are Free, **$6/month Premium**, and **$12/month Unlimited**, with annual discounts.
- **Strongest feature:** contemporary, adult, video-led lesson design with excellent activity flow.
- **Weakness/opportunity for Thomas:** media topics can drive the syllabus more than concept mastery; Thomas can own systematic concept depth and cumulative sequence.
- **Official evidence:** [pricing and formats](https://eslbrains.com/pricing/), [pronunciation sample](https://eslbrains.com/pronunciation-practice/), [A1/A2 grammar sample](https://eslbrains.com/should-and-shouldnt/), [homework/revision](https://eslbrains.com/try-out-the-new-lesson-plan-feature-homework-revision-tasks/).

### Teach-This

- **1–4:** 3,000+ CEFR-labeled grammar, vocabulary, functional, academic, business, activity, and game resources. Excellent practice breadth, but it is not primarily a single sequenced course.
- **5–8:** Communicative speaking, pair work, games, and group formats are central. Listening, pronunciation, formal assessment, and learner progress are comparatively light.
- **9–12:** Extremely low teacher prep, clear notes/keys, editable/printable PDFs, and a link-based online platform are major strengths.
- **13–16:** Outstanding activity variety; limited audio/video emphasis. Public pages are usable, but downloadable worksheets remain the product center.
- **17–20:** Professional resource design, reliable access, strong SEO, and excellent value: **$29.99/3 months, $49.99/6 months, or $79.99/year**.
- **Strongest feature:** the deepest bank of ready-to-run communicative games and pair activities.
- **Weakness/opportunity for Thomas:** a resource bank can leave teachers to assemble progression; Thomas should borrow the spirit of activity variety, not become a worksheet warehouse.
- **Official evidence:** [product and workflow](https://www.teach-this.com/), [pricing](https://www.teach-this.com/pricing).

### Breaking News English

- **1–4:** Current-news lessons in seven difficulty levels rather than a cumulative grammar/vocabulary curriculum. Each topic has enormous practice depth, but pedagogy can become repetitive and form explanation is secondary.
- **5–8:** Five-speed listening, dictation, reading, discussion, and 30+ quizzes are unmatched at no cost. Formal progress and assessment alignment are minimal.
- **9–12:** Very low preparation and extensive PDFs/mini-lessons. Students can practice independently, but the volume can be overwhelming.
- **13–16:** Outstanding audio/activity variety; accessibility, navigation clarity, visual design, and small-screen calm lag modern products.
- **17–20:** Simple technology is durable but visually dated. Search discoverability is exceptional. The core offer is free and donation/book supported.
- **Strongest feature:** free multi-speed listening and exhaustive activity generation around current events.
- **Weakness/opportunity for Thomas:** quantity and repetition can obscure pedagogical priority; Thomas should copy neither its density nor dated interface.
- **Official evidence:** [about and lesson inventory](https://breakingnewsenglish.com/about.html), [link description](https://breakingnewsenglish.com/links.html).

### ESL Pals

- **1–4:** 1,000+ plans, A1–C2 adult and grammar curricula, business/kids tracks, and step-by-step sequences. Lessons use current articles/videos and are typically 90 minutes.
- **5–8:** Strong speaking and media comprehension, downloadable homework, and interactive ESL tests. Pronunciation and fine-grained progress evidence are less prominent.
- **9–12:** Student and teacher versions, e-lessons, PDFs, homework, search, and complete plans deliver excellent immediate usability.
- **13–16:** Good media and curriculum variety; public accessibility evidence is limited and the content-heavy pages are less calm than Thomas’s intended shared-screen experience.
- **17–20:** Modern product presentation and good SEO. Pricing is **$19/month, $49/6 months, or $79/year**.
- **Strongest feature:** a complete, ready-to-teach lesson plus homework package at an accessible annual price.
- **Weakness/opportunity for Thomas:** long video/article lessons can prioritize topic engagement over precise conceptual diagnosis.
- **Official evidence:** [product, curricula, and pricing](https://www.eslpals.com/), [sample lesson](https://eslpals.com/general-english/A2/shopping-habits-esl-lesson-plan), [pricing](https://eslpals.com/pricing).

### iSLCollective

- **1–4:** A community library of roughly 190,000 resources rather than a curriculum. The range is enormous, but grammar, vocabulary, depth, and correctness vary by author.
- **5–8:** Tens of thousands of video lessons and many speaking/listening worksheets; no coherent shared assessment/progress model.
- **9–12:** Search and download breadth are excellent, but curation and quality checking shift preparation back to the teacher.
- **13–16:** Unmatched user-generated variety and a capable video-quiz creator; visual consistency, accessibility, and mobile calm vary across uploaded materials.
- **17–20:** Technically durable and highly discoverable. It is **100% free to use**, supported by donations/supporting memberships and advertising.
- **Strongest feature:** community scale and searchable free worksheet/video inventory.
- **Weakness/opportunity for Thomas:** variable quality and no coherent path are exactly what Thomas should avoid.
- **Official evidence:** [home and pricing model](https://en.islcollective.com/), [upload and interactive quiz tools](https://en.islcollective.com/upload), [video lessons](https://en.islcollective.com/english-esl-video-lessons), [FAQ](https://en.islcollective.com/FAQ).

### Onestopenglish

- **1–4:** Thousands of professionally authored and edited resources across adults, children, professional development, grammar, business, skills, and course series. It is a trusted library rather than one universal sequence.
- **5–8:** Excellent downloadable audio/video, listening series, integrated-skills work, and expert teacher notes. Persistent learner assessment/progress is limited.
- **9–12:** Search by age, level, format, and focus plus print-ready notes/worksheets makes teacher use strong. The student experience usually passes through downloaded materials.
- **13–16:** Very broad variety and high-quality media. The archive mixes older and newer interaction patterns, so visual/mobile consistency is uneven.
- **17–20:** Publisher reliability, editorial quality, and SEO are strong. Public individual pricing is advertised at **£1.75/month paid annually** or **£1.99 monthly**.
- **Strongest feature:** professionally edited breadth backed by a major ELT publisher.
- **Weakness/opportunity for Thomas:** the archive is deep but fragmented; Thomas can offer one consistent browser-native student experience.
- **Official evidence:** [about and features](https://www.onestopenglish.com/about), [grammar library](https://www.onestopenglish.com/adults/grammar), [listening sample](https://www.onestopenglish.com/listening/listening-skills-lesson-plans-catching-up-on-news/146220.article), [sample pricing](https://www.onestopenglish.com/home/sample-material).

### Fluentize (additional direct competitor)

- **1–4:** 650+ video-based lessons with clear level, topic, grammar, vocabulary, speaking, viewing, and series metadata. It has strong progression inside lessons but is not a complete A0–C1 concept sequence.
- **5–8:** Authentic viewing/listening and activation are excellent; pronunciation and formal assessment/progress are secondary.
- **9–12:** Interactive browser lessons, printable/interactive PDFs, Google Slide e-lessons, teacher guides, quizzes, review, and reflection make preparation excellent.
- **13–16:** Video variety and modern visual quality are major strengths; formats work well for online one-to-one lessons.
- **17–20:** Modern, searchable, and SEO-friendly. It uses free samples, lesson credits, annual full access, and custom school pricing; the public pricing renderer did not expose a stable individual numeric price during the audit.
- **Strongest feature:** authentic short video turned into a polished preview-to-activation lesson flow.
- **Weakness/opportunity for Thomas:** third-party video availability and topic-first sequencing are dependencies Thomas can avoid with static, concept-owned media.
- **Official evidence:** [product and lesson flow](https://app.fluentize.com/), [lesson catalog](https://app.fluentize.com/lessons), [free lesson/format model](https://app.fluentize.com/lessons/free-lessons), [pricing](https://app.fluentize.com/pricing).

## What Thomas’s Classroom should own

### Five defensible product advantages

1. **One coherent A0–C1 concept path.** Not a pile of worksheets and not a topic feed: every lesson has a place, prerequisite, assessment relationship, and next step.
2. **Multiple explanations for high-friction concepts.** Rule, timeline/visual, contrast, guided discovery, story/dialogue, chunk drill, and error clinic are optional paths into the same outcome.
3. **Spoken grammar in every lesson.** The grammar choice, connected-speech form, stress, rhythm, intonation, and listening contrast should be one system.
4. **Context-first, tutor-tested error repair.** Controlled items should reflect errors observed across 1,000+ real lessons and explain why the answer fits this situation.
5. **Zero-friction teacher-to-student sharing.** A calm browser lesson opens instantly without an account, download, app, or live third-party API.

### Where Thomas already performs well

- Canonical A0–B2 sequence and honest C1 planned state.
- Deep grammar explanations that include meaning and use.
- Spoken-form notes tied to target language.
- Adult one-to-one contexts and high learner production.
- Direct shareable URLs, no account barrier, and strong static reliability.
- Warm, distinctive, shared-screen visual design.
- Single-source authoring and unusually comprehensive build validation.

### Where Thomas is clearly behind

- Professionally recorded listening breadth and voice variety.
- Item-level explanations and distractor quality at A0–A2.
- Editorial review evidence and published quality policy.
- Homework, spaced retrieval, and between-lesson continuity.
- Method variety within a single concept.
- Teacher notes, timing, adaptation, and optional printable materials.
- Student history, assignment, and personalized review. These matter later, not before content trust.
- A public deployed origin and proven SEO acquisition loop.

### What should not be copied

- A full class-management LMS before user demand proves it is needed.
- A giant user-generated marketplace with uneven quality.
- Topic/news volume that weakens cumulative curriculum coherence.
- Mandatory downloads, apps, or accounts for ordinary lesson use.
- Dependence on third-party video availability for core grammar instruction.
- Dense 20-page worksheets presented on a shared screen.
- Gamification, streaks, or progress theater without valid learning evidence.
- AI-generated lessons published without expert review and learner testing.

### Gaps competitors do not address well

- Showing the same concept through genuinely different cognitive routes without making the teacher assemble several products.
- Combining explicit grammar choice with its real spoken reduction, stress, and listening cues.
- Designing specifically for one-to-one screen sharing while remaining useful for independent review.
- Making every closed exercise context defensible and every wrong answer diagnostically useful.
- Publishing a small, transparent quality record: author, reviewer, learner-test count, revisions, and known limitations.
- Providing premium pedagogy through a direct link without forcing a student account.

## Decisions

- **Single most important next project:** Phase 1 content accuracy and exercise-quality QA for the core grammar spine and assessments.
- **Top five improvements:** (1) editorial QA and review status, (2) contextual item-level feedback, (3) generate and review assessment audio, (4) core/extension lesson timing plus tutor notes, (5) retrieval/homework links.
- **Proposed multi-method pilot:** **A1 Present Simple**. Add four optional routes—guided discovery, direct rule/system, timeline/contrast, and error-to-fluency clinic—while preserving one shared practice/production outcome.
- **C1 first review batch:** the existing lessons 1–3—Advanced tense and aspect review; Narrative tenses and viewpoint; Mixed and implied conditionals. Do not call them fully reviewed until Thomas completes the tutor pass and learner trials.
- **Next C1 authoring batch after review:** lessons 4–6—Inversion after negative expressions; Advanced modal meaning and stance; Participle clauses.
- **Can wait:** accounts, saved progress, subscriptions, teacher dashboards, advanced analytics, large blog output, institutional features, and a second language.
- **Should not be built now:** full LMS, open marketplace, live AI tutor, live visitor-time TTS, generic points/streaks, or a design-system rewrite.

## Narrow first implementation proposed for approval

Run a **Present Simple Phase 1 quality slice**, not a redesign:

1. apply the new lesson-quality rubric to the existing A1 lesson;
2. replace weak distractors with plausible meaning/form contrasts;
3. add item-specific first-attempt hints and concise “why” feedback;
4. label a 45–50 minute core path and optional extension sections;
5. add a 10-minute retrieval/homework follow-up;
6. add automated checks for feedback coverage and answer-contract integrity;
7. have Thomas tutor-review it and record results from three real lessons.

Only after that evidence should the same treatment expand to the rest of the grammar spine.
