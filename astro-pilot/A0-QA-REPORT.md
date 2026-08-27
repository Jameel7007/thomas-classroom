# A0 Editorial and Pedagogical QA Report

Date: July 16, 2026

Scope: all 16 A0 lessons only. A1 was not reviewed or edited as part of this pass.

## Result

- Lessons reviewed: 16 of 16
- Substantive grammar, wording, pronunciation, instruction, or pedagogy issue groups corrected: 62
- Exercise contexts added or strengthened: 18
- Incorrect stored answer keys found: 0
- Feedback-text defects corrected: 2
- Prohibited em-dash occurrences removed from A0 learner content: 253
- Tutor-judgment items left unchanged and flagged for later review: 2

The substantive count groups repeated manifestations of one editorial issue as one correction. For example, rewriting several related teacher-facing instructions as direct student instructions counts as one issue group. The 253 punctuation replacements are reported separately.

## Lesson-by-lesson record

| Lesson | Substantive issue groups | Contexts added or strengthened | Changes |
| --- | ---: | ---: | --- |
| The verb *to be* | 4 | 1 | Broadened the meaning of *be* beyond a false action/non-action split; clarified full forms versus contractions; distinguished linked speech from written word spacing; added negative contractions and the *I’m not* pattern; added the missing question before the positive short answer in the final quiz. |
| Subject pronouns | 5 | 0 | Rewrote the standfirst and practice guidance directly to the learner; clarified the use of *it*; replaced the teacher-only note with a learner memory strategy; made the error-repair feedback reproduce the complete corrected example; rewrote personalization instructions independently. |
| Articles *a / an* | 4 | 1 | Made the error-spotting instruction exact; changed reveal and production directions from third person to direct learner language; clarified information-gap and fluency directions; stated Sofia’s job before the sentence builder. |
| *This, that, these, those* | 2 | 0 | Corrected awkward feedback grammar and quotation; rewrote the information gap as direct student-facing instructions. |
| Regular plural nouns | 2 | 0 | Corrected the explanation from “city is consonant + y” to “city ends in consonant + y”; rewrote the quick-fire task as an independent learner instruction. |
| Possessive adjectives | 6 | 4 | Clarified the core explanation; added missing practice for *your* and *its*; added the *its / it’s* contrast; completed the pronoun-to-possessive matching set; repaired an unnatural client-call example; rewrote the information gap directly; clarified ownership and team-perspective prompts. |
| Question words | 4 | 2 | Removed an overgeneralized opening claim; explained why *Where is your name?* can be grammatical in a different situation; rewrote information-gap directions directly; clarified the country and name scenarios in the final quiz. |
| Cardinal numbers 0–100 | 2 | 1 | Replaced unnatural U.S. English about “floor thirteen” with a room-number example; rewrote listening directions directly; replaced the unnatural address sentence with a complete street address. |
| Greetings and introductions | 5 | 1 | Distinguished *Good evening* from *Good night*; corrected the description of casual greetings that can also be real questions; repaired the casual-response table; clarified the reply after a person gives a name; converted dialogue markers into explicit speaker labels; improved the 2 p.m. call greeting. |
| The alphabet and spelling | 3 | 2 | Corrected the false claim that F, L, M, N, S, and X rhyme with *egg*; standardized the repair phrase as “B as in Boston”; rewrote production directions directly; made the *email* clue singular and made the uppercase/lowercase quiz context explicit. |
| Days, months, and dates | 3 | 0 | Qualified the Monday–Friday workweek as common rather than universal; prioritized U.S. *fall* while retaining *autumn*; repaired the comma splice in the schedule reading. |
| Colors and basic adjectives | 5 | 0 | Corrected the noticing heading; removed grammatical ellipsis from a supposedly wrong example; narrowed the two-adjective ordering claim to the combinations taught; made the error-spotting target unique; replaced another grammatical distractor with an unambiguously wrong sentence. |
| Family members | 7 | 1 | Clarified formal and informal family vocabulary; simplified the overloaded noticing sentence; removed objectifying ownership language about people; improved the pronunciation guide for *daughter*; renamed and rewrote the family-connection section; rewrote the interview task directly; identified the woman in the final quiz as the learner’s sister. |
| Classroom objects | 4 | 2 | Added missing articles to singular countable picture labels; aligned the instructions heading with its content and made location examples complete sentences; rewrote production directions directly and removed a double punctuation mark; clarified the reading instruction and the exact location of the pen. |
| Animals | 3 | 2 | Corrected the lesson number; replaced the false “all animals add -s” generalization with regular, *-es*, and unchanged plural patterns; made the fish clue unique and required enough clues for one clear animal in the production task. |
| Countries and nationalities | 3 | 1 | Corrected the lesson number; defined nationality as a word describing where someone is from rather than “the person”; replaced an unreliable ending system with accurate grouped pairs and explicit exceptions; changed the final team prompt to refer to plural team members. |

## Feedback and answer integrity

No incorrect `data-answer`, quiz answer, tile-builder answer, or selectable answer-key value was found in A0.

Two feedback defects were corrected:

1. Subject pronouns now reveals the complete corrected two-sentence example rather than only its second sentence.
2. *This, that, these, those* now gives grammatical, clearly quoted feedback for the plural demonstrative.

The shared interaction validator confirmed that every stored answer still maps to exactly one available answer where required.

## Tutor-review flags

These are pacing decisions rather than accuracy errors, so the content was preserved:

1. **Colors and basic adjectives:** decide later whether the 18-color reference should display a smaller core set first and an extension set second.
2. **Animals:** decide later whether the 30-animal reference should display a smaller core set first and an extension set second.

## Regression protection

`tools/validate-a0-editorial.mjs` now checks:

- the expected 16 ready A0 lessons;
- absence of em dashes in A0 source and rendered learner content;
- removal of targeted teacher-facing or inaccurate legacy phrases;
- the corrected lesson order for Animals and Countries and Nationalities;
- the alphabet pronunciation correction;
- the contextualized *be* short-answer question;
- practice for *its*;
- the *Good evening / Good night* distinction.

Run it with:

```sh
npm run a0:editorial:validate
```

## Validation results

- `npm run check`: passed with 0 errors, 0 warnings, and 0 hints.
- `npm run build`: passed.
- Astro static build: 203 pages generated.
- Lesson catalog: 92 unique ready lessons with contiguous sequences and valid relationships.
- Curriculum: 92 searchable topics and all filter combinations passed.
- Interaction integrity: 2,427 answer contracts passed.
- Accessibility: 203 canonical pages passed.
- Pedagogy: all 92 rendered lessons passed; A0 lessons contain 865–1,566 visible words and 8–11 interaction mechanics.
- Internal routes, links, assets, and output: 305 HTML outputs, 3,674 local references, and 414 dimensioned images passed.
- Content fingerprints: all 16 A0 lesson fingerprints refreshed and exact migration-fingerprint validation passed.
- Native architecture: passed with no compatibility layer.
- A0 editorial source and rendered-output gate: passed.
- Mobile navigation: 320, 375, 768, 819, 821, 1024, and 1440 px contract coverage passed.
- Static audio references: validated; 10 approved assessment MP3 files remain intentionally pending generation and retain browser-speech fallback text.

The repository sandbox does not permit opening a local listening socket (`listen EPERM`), so an additional socket-based `curl` preview was not possible in this environment. The production build’s socket-free preview-server validator passed canonical pages, redirects, headers, static assets, the custom 404, unsupported methods, and static-only behavior. No installed Chrome application was launched.
