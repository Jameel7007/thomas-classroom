# C1 curriculum authoring and review

C1 is a 19-topic course path in the canonical lesson catalog. Three pilot lessons are published. The remaining 16 records are planned and do not generate learner routes.

## Pedagogical definition

C1 work must develop precise and flexible language use across sustained discourse. A lesson should make learners choose among nuanced grammar, vocabulary, register, tone, stance, implication, rhythm, stress, and intonation. It should require argumentation, reformulation, self-correction, and control across more than one sentence.

C1 is not B2 material with rarer vocabulary. Each lesson must change what a learner can do with viewpoint, information structure, interpersonal meaning, or discourse organization.

## Canonical sequence

| Sequence | Topic | Status |
| ---: | --- | --- |
| 1 | Advanced tense and aspect review | Ready pilot |
| 2 | Narrative tenses and viewpoint | Ready pilot |
| 3 | Mixed and implied conditionals | Ready pilot |
| 4 | Inversion after negative expressions | Planned |
| 5 | Advanced modal meaning and stance | Planned |
| 6 | Participle clauses | Planned |
| 7 | Reduced relative clauses | Planned |
| 8 | Nominalization and information density | Planned |
| 9 | Advanced emphasis and cleft structures | Planned |
| 10 | Advanced discourse markers and cohesion | Planned |
| 11 | Hedging and cautious language | Planned |
| 12 | Register, tone, and formality | Planned |
| 13 | Concession, contrast, and counterargument | Planned |
| 14 | Referencing and avoiding repetition | Planned |
| 15 | Organizing complex spoken arguments | Planned |
| 16 | Collocation and lexical precision | Planned |
| 17 | Connotation, nuance, and implied meaning | Planned |
| 18 | Idiomatic language and fixed expressions | Planned |
| 19 | Phrasal verbs in formal and informal contexts | Planned |

## Assessment relationship

The ready B2 exit diagnostic is the entry evidence for C1. The canonical `c1-exit` relationship is planned. It is displayed as planned but has no public route or link until its content and scoring model are complete.

The existing placement diagnostic remains an A0–B2 instrument. A strong B2 result can trigger a separate advanced sample, but the current placement exam must not claim to classify C1.

## Recommended batch workflow

Author two or three lessons per batch. Three works well for a connected grammar cluster; use two when the topic requires substantial discourse, listening, or pronunciation design.

1. Confirm the next planned records and their prerequisite graph.
2. Draft context and the final production task before writing the grammar explanation.
3. Build form, meaning, use, contrast, and spoken-form guidance around that communicative outcome.
4. Add controlled choices, contextual questions, sentence building, error repair, fluency retrieval, and extended production.
5. Check that every scored question has enough context for one defensible answer.
6. Set `status` to `ready` and `tutorReviewRequired` to `true` only when the complete lesson body exists.
7. Run `npm run check`, `npm run build`, and `npm run c1:validate`.
8. Review the rendered lesson with a tutor for naturalness, level fit, answer defensibility, timing, cognitive load, spoken form, and production value.
9. Revise the lesson, then remove `tutorReviewRequired` only after the tutor signs off.
10. Begin the next batch only after shared issues from the current batch have been resolved in the component or authoring guidance.

## Tutor review checklist

- The opening context is understandable before terminology is introduced.
- Every target choice changes meaning, viewpoint, stance, register, or discourse effect.
- Distractors are wrong for a clear reason, not merely less elegant.
- Feedback explains the decision the learner should make next time.
- Examples sound natural in U.S. English and suit adult communication.
- The spoken-form section includes useful stress, rhythm, reduction, or intonation guidance.
- Controlled work leads to sustained speaking or writing.
- The learner must reformulate or self-correct, not only recognize forms.
- Student-facing text contains no em dashes.
- The lesson does not assume that rare vocabulary equals C1 performance.
