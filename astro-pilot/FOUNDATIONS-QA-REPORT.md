# Foundations grammar QA report

Batch: A0 foundations
Status: editorial implementation complete; learner pilots pending
Public availability remains separate from review evidence.

## Batch inventory

| Lesson | Editorial state | Scored items audited | Learner pilots | Notes |
| --- | --- | ---: | ---: | --- |
| The verb to be | `editorial-review` | 26 | 0 of 3 | First foundation slice complete; tutor review still required |
| Subject pronouns | `editorial-review` | 34 | 0 of 3 | Second foundation slice complete; tutor review still required |
| Articles a/an | `editorial-review` | 24 | 0 of 3 | Third foundation slice complete; tutor review still required |
| Possessive adjectives | `editorial-review` | 37 | 0 of 3 | Fourth foundation slice complete; tutor review still required |
| Question words | `editorial-review` | 31 | 0 of 3 | Fifth foundation slice complete; tutor review still required |
| This/that/these/those | `editorial-review` | 30 | 0 of 3 | Sixth foundation slice complete; tutor review still required |
| Regular plural nouns | `editorial-review` | 37 | 0 of 3 | Seventh foundation slice complete; tutor review still required |
| Cardinal numbers 0–100 | `editorial-review` | 40 | 0 of 3 | Eighth foundation slice complete; tutor review still required |
| Greetings and introductions | `editorial-review` | 42 | 0 of 3 | Ninth foundation slice complete; tutor review still required |
| The alphabet and spelling | `editorial-review` | 48 | 0 of 3 | Tenth foundation slice complete; tutor review still required |
| Days, months, and dates | `editorial-review` | 45 | 0 of 3 | Eleventh foundation slice complete; tutor review still required |
| Colors and basic adjectives | `editorial-review` | 45 | 0 of 3 | Twelfth foundation slice complete; tutor review still required |
| Family members | `editorial-review` | 45 | 0 of 3 | Thirteenth foundation slice complete; tutor review still required |
| Classroom objects | `editorial-review` | 45 | 0 of 3 | Fourteenth foundation slice complete; tutor review still required |
| Animals | `editorial-review` | 50 | 0 of 3 | Fifteenth foundation slice complete; tutor review still required |
| Countries and nationalities | `editorial-review` | 47 | 0 of 3 | Sixteenth foundation slice complete; tutor review still required |

This table is an editorial report, not a second route or lesson registry. The
machine-enforced status and scored-item count remain in each canonical lesson
file. Update this report after a completed audit or real learner pilot, never in
anticipation of one.

## Shared live-pilot workflow

Open `/tutor/` and choose a foundations lesson in the human review queue. Its
printable tutor plan includes an anonymous learner-pilot worksheet derived from
the lesson’s canonical review state, outcome, core decision, and production
criteria. Use one fresh worksheet per real session. Do not record names,
contact details, employers, or other identifying information. The page submits
and stores nothing; update the canonical lesson metadata only after the session
is complete.

## Batch implementation summary

- All sixteen foundations lessons now have canonical `qualityReview` evidence.
- The batch contains 626 audited scored decisions with item-level hints and
  explicit repairs.
- Every lesson declares a core path, optional extension time, observable open
  production, and a direct next-day retrieval route.
- Curriculum availability, public routes, sequencing, and legacy redirects are
  unchanged by review status.
- No foundations lesson is claimed as `reviewed`: each still needs three real
  learner pilots, resolved revision notes, tutor sign-off, and a review date.
- The remaining human evidence is 48 anonymized lesson uses, three per lesson.
  Record evidence after each real session rather than backfilling it from
  memory.

## The verb to be: issues found and resolved

- The original 25-minute estimate understated the amount of noticing,
  pronunciation, controlled work, and production. The tutor path now identifies
  a 35–45 minute core plus 10–15 minutes of optional work.
- A shared answer bank produced lowercase `are` at the beginning of a question.
  Question formation now has its own short drill, so copied, visible, and
  screen-reader text contains `Are you…?` with correct capitalization.
- Twenty-two existing scored decisions had no item-specific hint. The revised
  lesson has 26 scored decisions, each with a contextual first cue and an
  explicit repair.
- Correct responses previously received generic praise. Every checked activity
  now states the decisive agreement, word-order, or negative-form relationship.
- The negative-form quiz used isolated, low-information word distractors. It now
  asks the learner to select a complete sentence in a clear at-work versus
  at-home context.
- The next-use note had no direct retrieval activity. The lesson now includes a
  five-minute next-day route with form decisions, error repair, no-notes recall,
  and a short personal response.

## Live pilot protocol for The verb to be

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner understood the equals-sign explanation.
3. The first agreement pair that caused hesitation.
4. Whether the first hint produced self-correction.
5. Whether question order remained accurate during the mini interview.
6. Actual time for the core path.
7. Independent final production: one statement, one negative, and one question.
8. Next-day retrieval result before rereading.
9. Any explanation the tutor still had to supply.
10. The revision made or proposed.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Do not mark the lesson `reviewed` until all three
pilots are recorded, the tutor has resolved material issues, and the metadata
contains the tutor’s name and review date.

## Subject pronouns: issues found and resolved

- Several examples expected learners to infer a person’s pronoun from a first
  name alone. The revised contexts explicitly identify a family relationship,
  title, or stated pronoun before asking the learner to choose.
- The original pattern presented `they` only as plural. The lesson now teaches
  plural and singular `they`, including an adult workplace context where a
  caller or visitor’s gender is not known.
- Shared lowercase answer tiles could create sentence-initial text such as
  `she is…`. Sentence-initial choices now use real capitalization in visible,
  copied, and accessible text.
- The revised lesson has 34 scored decisions. Every decision now gives a
  contextual first hint and an explicit repair after another unsuccessful
  check; correct feedback states the decisive reference relationship.
- The lesson now identifies a 35–45 minute core path and 10–15 minutes of
  optional typed recall and next-day retrieval.
- A direct five-minute retrieval route now checks known people, things,
  singular `they`, a common `we` versus `they` repair, oral recall, and a short
  independent response.

## Live pilot protocol for Subject pronouns

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the speaker, listener, and other-person contrast was clear.
3. Whether the learner chose a pronoun from stated context instead of a name.
4. Whether the singular `they` example was understood without extra theory.
5. The first `we` versus `they` decision that caused hesitation.
6. Whether the first hint produced self-correction.
7. Actual time for the core path and any optional activity used.
8. Independent final production with `I`, `you`, and a third-person pronoun.
9. Next-day retrieval result before rereading.
10. Any explanation the tutor still had to supply and the revision proposed.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and the material issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date in canonical metadata.

## Articles a/an: issues found and resolved

- The original explanation treated “not specific” as the only central meaning.
  The revised lesson separates introducing one nonspecific person or thing from
  classifying what a person or thing is, including jobs.
- `Countable` appeared before it was explained. The lesson now defines it with
  transparent one-versus-two examples and marks the plural and general-water
  boundaries without pretending that restaurant uses such as `a water` do not
  exist.
- The first-letter trap was explained well, but it had no listening procedure.
  A closed tutor-read script now checks six common and spelling-versus-sound
  contrasts before the learner sees the answers.
- The revised lesson has 24 scored decisions. Every decision now provides a
  sound, number, or noun-chunk cue first and the exact repaired chunk after
  another unsuccessful check.
- Correct feedback now names the relevant first sound or countability decision
  instead of reporting only a score.
- The live path is now a 35–45 minute core plus 10–15 minutes of optional
  listening and no-choice recall. Open production has four observable success
  criteria.
- The new direct five-minute retrieval route contrasts vowel sounds, consonant
  sounds, a spelling trap with `useful`, missing job articles, adjectives, and
  a short independent response.

## Live pilot protocol for Articles a/an

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner understood “one countable person or thing.”
3. Whether introducing something and classifying a job both felt clear.
4. Whether the learner initially chose from spelling or from the first sound.
5. Results for `hour`, `honest`, `university`, and `useful` after tutor modeling.
6. Whether the first contextual hint produced self-correction.
7. Whether the learner connected the article and next word without a long pause.
8. Actual time for the core path and any optional activity used.
9. Independent final production with at least one `a` and one `an` chunk.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Family members: issues found and resolved

- The original organizing claim presented most family vocabulary as female and
  male pairs. The revised system distinguishes specific words such as `mother`,
  `brother`, and `wife` from neutral relationship words such as `parent`,
  `sibling`, `child`, `spouse`, `partner`, and `grandparent`.
- Several explanations defined `parents` as a mother and father together. The
  lesson now explains singular `parent` and plural `parents`, explicitly allows
  varied family structures, and uses mother-plus-father only inside named
  fictional examples where both relationships are stated.
- The relationship table now marks an A0 boundary: `aunt` and `uncle` name a
  parent's sibling in the taught pattern, while everyday use may also include
  that sibling's spouse or partner. `Cousin` remains neutral for gender.
- Images are now described as representative labeled pictures, not evidence of
  a person's family role. Learners are told to use the relationship word a
  person provides rather than infer a role from appearance, clothing, or name.
- Possessive `'s` was explained as the person who “has” another person. It now
  identifies a relationship or connection and explicitly rejects ownership
  language and doubled forms such as `Omar's his brother`.
- U.S. spoken guidance now covers the voiced `th` in `mother`, `father`, and
  `brother`; silent `gh` and the common quick `t` in `daughter`; stress in
  `sibling`, `children`, and longer family words; two common U.S.
  pronunciations of `aunt`; and the joined `/z/` sound in `Omar's`.
- A closed six-item tutor-read check distinguishes neutral and specific words,
  singular and irregular plural forms, generations, and possessive chunks
  before the script is opened.
- All 45 scored decisions now provide a contextual relationship or number cue,
  an explicit repair, and concept-specific correct feedback. No item requires
  the learner to infer gender from a name or picture.
- Personal production no longer requires real names, living arrangements,
  photos, ages, family structure, or coworker information. Every prompt offers
  a pictured or invented route, and the final family-map task has five
  observable success criteria.
- The live path is a 45–55 minute core plus 15–20 minutes of optional listening,
  oral transformation, and later retrieval. The direct next-day route checks
  `parent`, `sibling`, `spouse`, `children`, possessive `'s`, and a short
  independent family-map explanation.

## Live pilot protocol for Family members

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner understood specific versus neutral relationship words.
3. Whether varied family structures felt clear without adding excessive A0
   language load.
4. Whether the learner used `children` rather than `childs` in controlled and
   independent production.
5. Whether possessive adjectives and name plus `'s` identified the correct
   relationship without doubled possessives.
6. Whether the learner avoided inferring a relationship from a name or picture.
7. Results of the six-item tutor-read check and the spoken possessive chunk.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent fictional family-map production result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Classroom objects: issues found and resolved

- The original summary said that an object takes `-s` after a number. The
  revised scope distinguishes `one book` from `zero books` and `two books` and
  limits regular plural guidance to regular countable object nouns.
- `Paper`, `scissors`, and `mouse` appeared in the visual inventory without
  their different number systems. A compact reference now teaches `some paper`,
  `a sheet of paper`, plural `scissors` versus singular `a pair`, and the
  irregular computer-object plural `mice`.
- The page displayed `paperclip` as one word. Learner-facing copy now uses the
  standard U.S. form `paper clip` and connects it to the compound-noun rhythm of
  `notebook`, `laptop`, and `backpack`.
- Representative object pictures remain paired with visible written labels,
  and the instructions now allow pointing, digital selection, position
  description, or spoken identification instead of relying on a picture or a
  physical action alone.
- Pronunciation guidance now includes light `a/an`, stress in `eraser`, object
  compounds, the voiced final sound in `scissors`, U.S. `ruler`, and strong
  object words inside classroom instructions.
- A closed six-item tutor-read check distinguishes similar object words, special
  number chunks, and the request `Can you repeat that, please?` before the
  transcript is opened.
- The lesson now includes a practical clarification system: asking for
  repetition, meaning, spelling, the correct book or page, reporting a missing
  object, and politely asking to borrow something.
- All 45 scored decisions now have a sound, number, use, location, or message
  cue followed by an exact repair and concept-specific correct feedback.
- Open practice no longer requires a real desk, room, camera, belongings, or
  name. The final fictional preparation task accepts physical, spoken, or
  digital responses and has five observable criteria.
- The live path is a 45–55 minute core plus 15–20 minutes of optional listening,
  oral transformation, clarification work, and later retrieval. The direct
  next-day route checks `an eraser`, `mice`, `a pair of scissors`, `repeat`,
  `scissors are`, and independent repair of an unclear instruction.

## Live pilot protocol for Classroom objects

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner distinguished one from zero and numbers above one.
3. Whether `paper`, `scissors`, and `mouse` remained accurate after leaving the
   reference table.
4. Whether the learner identified objects from labels and descriptions rather
   than depending only on pictures.
5. Whether compound stress and the weak article improved spoken object chunks.
6. Results of the six-item tutor-read check before the script was revealed.
7. Whether the learner independently asked for repetition, meaning, or an
   object when needed.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent fictional classroom-preparation result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Animals: issues found and resolved

- The original summary said that a plural follows “a number,” which incorrectly
  included one. The revised scope distinguishes exactly one from zero and
  numbers greater than one, then connects singular and plural subjects to
  `is` and `are`.
- The original table presented `fish` as a plural that never changes. The
  revised lesson teaches `fish` as the usual plural for individual animals and
  marks `fishes` as a scientific or specialized form for species or types. It
  also includes unchanged `sheep`, irregular `mice`, and standard U.S.
  `octopuses`.
- Pet, farm animal, wild animal, and wildlife appeared without a meaning
  boundary. A new reference explains that the first three describe an
  animal’s relationship with people or situation, that a rabbit can fit
  different categories in different contexts, and that `wildlife` is an
  uncountable group word.
- Several clues overgeneralized from culture or biology. “King of animals” was
  removed; the lion clue now specifies an adult male with a mane; the chicken
  clue defines a hen as an adult female chicken; and bird, cow, pet, and riding
  descriptions are limited to the pictured or stated context.
- Representative pictures retain visible labels, and learners may point,
  describe a position, or say the label. The page states that the pictures are
  language prompts rather than a biology identification test.
- Spoken guidance now covers all three regular plural endings, including the
  extra syllable in `horses` and `foxes`; stress in longer animal words; and
  common U.S. `ZEE-bruh` while acknowledging another English pronunciation.
- A closed six-item tutor-read check distinguishes singular and plural noun
  forms, unchanged `sheep`, `an owl`, and `zebra` before the script is opened.
- All 50 scored decisions now have a sound, number, agreement, feature, or
  context cue followed by an exact repair and concept-specific correct
  feedback.
- Production no longer requires disclosure about a learner’s pet, home, or
  street. Learners may use a public picture or invented profile, and the final
  information card has five observable language, context, evidence, and safety
  criteria.
- The safety boundary now tells learners to observe unknown wildlife from a
  distance, avoid approaching, feeding, or handling it, and follow local expert
  guidance. The next-day route retrieves articles, `foxes`, unchanged `sheep`,
  uncountable `wildlife`, and plural agreement.

## Live pilot protocol for Animals

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner distinguished exactly one from zero and numbers greater
   than one.
3. Whether `fish`, `fishes`, `sheep`, `mice`, and `octopuses` remained accurate
   after the reference table.
4. Whether pet, farm animal, wild animal, and uncountable `wildlife` remained
   distinct in a changed context.
5. Whether factual clues supported identification without relying on a picture
   or cultural slogan alone.
6. Results of the six-item tutor-read check before the script was opened.
7. Whether plural endings and common U.S. `zebra` were intelligible in speech.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent animal-information-card result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Countries and nationalities: issues found and resolved

- The original visual introduction said that each flag “is” a country and that
  the nationality word names a person or thing. The revised lesson treats the
  flags as representative prompts with visible labels and teaches the core
  form as a nationality adjective after `be`.
- Country, nationality, language, birthplace, and current home were easy to
  collapse into one identity claim. A four-part meaning system now separates
  them and states that one fact does not prove the others.
- The adjective pattern now has a clear person-noun boundary: `I'm Brazilian`
  is the dependable A0 form, while person nouns vary. `A Brazilian person` and
  `two Brazilian people` provide a consistent low-level pattern without
  incorrectly extending `a + nationality` to words such as `French`.
- The country-name system now teaches `the United States` and `the United
  Kingdom`, contrasts British with English, and explains that the Americas is
  wider than the common nationality use of `American`.
- The primary country label is now `Türkiye`, with `Turkey` retained only as a
  recognition form still encountered in English-language contexts. The
  nationality adjective remains `Turkish`.
- Capitalization guidance now covers country names, nationality words, and
  language names. Common endings remain memory aids rather than a false system
  for generating every nationality word.
- All pronouns in fictional profiles are stated explicitly. No activity asks a
  learner to infer pronouns, nationality, language, or identity from a name,
  appearance, accent, or flag.
- Spoken guidance covers stress movement in country and nationality pairs,
  strong `-ese`, and recognition of connected U.S. `Where are you from?` and
  light `I'm from` without changing the written forms.
- A closed six-item tutor-read check distinguishes country, nationality,
  language, current home, and the article in `the United States` before the
  transcript is opened.
- All 47 scored decisions now have a form, meaning, article, capitalization,
  or stated-profile cue followed by an explicit repair and concept-specific
  correct feedback.
- Production no longer requires nationality, birthplace, current home,
  immigration history, languages, or information about real coworkers,
  clients, family, or friends. Fictional profiles are the default, and the
  final team welcome has five observable criteria.
- The next-day route retrieves country after `from`, adjective after `be`, the
  article in `the United Kingdom`, a stated language, question order, and one
  fact that cannot be inferred from the profile.

## Live pilot protocol for Countries and nationalities

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner consistently separated country, nationality adjective,
   language, and current home.
3. Whether `from + country` and `be + adjective` remained accurate outside the
   reference section.
4. Whether `the United States` and `the United Kingdom` retained their article.
5. Whether the learner understood the British/English and American/Americas
   boundaries without excessive A0 language load.
6. Results of the six-item tutor-read check before the script was opened.
7. Whether word stress and the connected origin question were intelligible.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent fictional-team-welcome result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Regular plural nouns: issues found and resolved

- The lesson defined a plural as only “more than one.” The revised meaning
  scope distinguishes exactly one from zero and numbers greater than one, and
  limits the spelling patterns to countable nouns.
- The original introduction claimed that three rules covered almost every
  needed plural. The revised lesson identifies four regular spelling decisions
  and marks their boundary with common irregular nouns, variable `-o` and
  `-f / -fe` spellings, and final `z` doubling.
- The `-es` reference omitted final `z`. It now includes the full high-value
  ending group and gives `quiz → quizzes` as a learn-with-the-word spelling.
- A short pronunciation note named `/s/`, `/z/`, and `/ɪz/` but did not explain
  the conditioning sound or provide listening practice. The revised lesson
  connects each ending to the final singular sound, explains the extra
  syllable, and adds a closed tutor-read six-word discrimination check.
- The revised lesson has 37 scored decisions. Every decision now provides a
  spelling, number, or sound cue before an explicit repaired form; checked
  activities explain the rule that made the answer correct.
- The live path is now a 40–45 minute core plus 10–15 minutes of optional
  ending-sound listening, no-choice oral transformation, and later retrieval.
- Open production now requires a meaningful one-minute inventory with four
  observable criteria. A direct five-minute next-day route checks all three
  endings, the consonant-versus-vowel `y` contrast, error repair, spoken recall,
  and short independent production.

## Live pilot protocol for Regular plural nouns

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner used a plural after zero without extra explanation.
3. Whether the learner understood that the page teaches regular patterns, not
   every English plural.
4. The first confusion among `-s`, `-es`, consonant + `y`, and vowel + `y`.
5. Whether the first contextual hint produced self-correction.
6. Results of the tutor-read `/s/`, `/z/`, and `/ɪz/` discrimination before the
   transcript was opened.
7. Whether an extra syllable was audible in plurals such as `buses` or
   `watches`.
8. Actual time for the core path and any optional activity used.
9. Independent one-minute production and which success criterion still needed
   support.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Cardinal numbers 0–100: issues found and resolved

- The original lesson treated number reading as one general skill. The revised
  lesson distinguishes whole-number reading for quantity, age, and price from
  digit-by-digit reading for phone numbers and codes.
- The phone-number guidance now teaches both `zero` and the common spoken form
  `oh`, uses a fictional number rather than requesting private information, and
  asks the learner to pause and confirm important numbers.
- The original stress rule implied that stress always separates `-teen` from
  `-ty`. The revised explanation keeps the useful clear-speech pattern while
  warning that sentence rhythm and contrast can move stress. Learners also
  listen for final `n` and confirm the numeral when accuracy matters.
- Relaxed U.S. pronunciation is now acknowledged without turning it into a
  spelling model: `t` can sound quick in some `-ty` words, and `twenty` may
  sound close to `twenny`.
- The comparison table now covers the complete 13/30 through 19/90 family, and
  the lesson marks the boundary between cardinal numbers and ordinal words such
  as `first`, `second`, and `third`.
- A closed tutor-read six-chunk listening check now tests three `-teen/-ty`
  pairs before the transcript appears. The revised lesson has 40 scored
  decisions, each with a contextual first hint and an explicit repair.
- Previously obvious malformed quiz distractors were replaced with legitimate
  number words that require the learner to use the numeral, order, or place
  value rather than choose by appearance.
- The live path is now a 40–45 minute core plus 10–15 minutes of optional
  listening, no-choice recall, and later retrieval. Open production has four
  observable criteria and avoids requiring a real phone number or address.
- A direct five-minute next-day route checks `-teen/-ty`, `forty`, a hyphenated
  joined number, written `zero` versus spoken `oh`, error repair, oral recall,
  and short independent production.

## Live pilot protocol for Cardinal numbers 0–100

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner understood whole-number versus digit-by-digit reading.
3. The first `-teen/-ty` pair that caused hesitation.
4. Whether stress, final `n`, or the written numeral was the most useful cue.
5. Results of the six-item tutor-read listening check before the transcript.
6. Whether relaxed U.S. `-ty` pronunciation was recognized without changing
   the learner’s spelling.
7. Whether the first contextual hint produced self-correction.
8. Actual time for the core path and any optional activity used.
9. Independent one-minute production and which success criterion still needed
   support.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Greetings and introductions: issues found and resolved

- The original formal-versus-informal table implied that a boss or client
  normally requires titles and a time-of-day greeting. The revised lesson
  explains that U.S. workplaces vary, first names and `Hi` can be normal, and
  learners should follow how the other person introduces themself.
- Titles are no longer assigned automatically. `Mr.` or `Ms.` plus a last name
  is presented as appropriate when the person uses that title or the setting
  expects it.
- `Fine, thanks` was the repeated default reply to `How are you?`. The core
  model now uses the more natural U.S. chunk `I'm good, thanks. How about you?`
  while preserving `Fine, thanks` and `I'm okay, thanks` as valid alternatives.
- The lesson now distinguishes the social use of a brief `How are you?` from a
  concerned question that invites a fuller answer. It also distinguishes the
  often formulaic `What's up?` from `What's going on?` and `What's happening?`,
  which more often ask about a real situation.
- A missing first-meeting boundary is now explicit: `Nice to meet you` is for
  the first meeting, while `Nice to see you again` or `Good to see you again`
  fits a later meeting.
- Time-of-day labels are presented as approximate local conventions rather
  than universal clock boundaries. `Hello` remains the safe all-day option,
  and `Good evening` versus `Good night` retains its arrival-versus-leaving
  contrast.
- Connected-speech guidance now prepares learners to recognize relaxed U.S.
  forms such as `Nice tuh meetcha` and `How-er-ya?` without teaching those as
  spellings or requiring imitation.
- A closed six-chunk tutor-read check tests social purpose, first versus later
  meetings, and familiar versus more formal register before the transcript is
  shown.
- Ambiguous matching prompts and visibly malformed final-quiz distractors were
  replaced with complete, natural lines whose situation supports one intended
  response. The lesson now has 42 scored decisions with staged hints, explicit
  repairs, and concept-specific correct feedback.
- The live path is a 45–55 minute core plus 15–20 minutes of optional casual
  language, listening, no-choice response practice, and later retrieval. Tutors
  choose the extensions that fit the learner rather than rushing every path.
  Final production uses two contrasting role-plays with four observable
  criteria.
- A direct five-minute next-day route retrieves arrival versus leaving, first
  versus later meetings, error repair, no-choice responses, and a complete
  short meeting.

## Live pilot protocol for Greetings and introductions

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner chose phrases from social purpose rather than clock time
   or a memorized formal-versus-informal list.
3. Whether the learner understood how to follow another person’s name and title
   choice in a U.S. workplace.
4. Whether `Nice to meet you` and `Nice to see you again` remained distinct.
5. Results of the six-item tutor-read purpose check before the transcript.
6. Whether relaxed connected forms were recognized without changing spelling.
7. Whether the first contextual hint produced self-correction.
8. Actual time for the core path and any optional activity used.
9. Independent formal and familiar role-plays and which success criterion still
   needed support.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## The alphabet and spelling: issues found and resolved

- The original opening assumed that every learner already recognized all 26
  written letter shapes. The revised opening states the practical outcome
  directly and supports learners who are still consolidating written forms.
- Letter names and sounds in words remain explicitly separate. The vowel note
  now avoids an unnecessary syllable claim and keeps its scope on spelling.
- The U.S. target `zee` is now explicit, while `zed` is included as a
  recognition form used in many other English varieties.
- `Double L` was presented as the only repeated-letter move. The revised lesson
  teaches both `L-L` and `double L`, and recommends saying every letter
  separately when exact information matters.
- Email spelling now includes `at`, `dot`, `underscore`, and `hyphen` or `dash`.
  All open practice uses the reserved domain `example.com` and tells learners
  not to share real contact or account information.
- Confusable letter pairs had pronunciation notes but no closed listening
  decision. A tutor-read eight-code check now tests both sides of B/V, E/I,
  G/J, and M/N before the transcript and clue-word repairs are opened.
- The lesson previously taught clue words without marking their boundary. It
  now explains that ordinary calls do not have one universal list, while some
  formal systems use standardized words.
- Spelling was treated mainly as production. The revised communication sequence
  now requires asking for repetition, checking one contrast, repairing with
  `as in`, reading the complete item back, and confirming or correcting it.
- The Barcelona repair no longer claims that its pronunciation always contains
  one particular sound. It asks for the standard written spelling and states
  that a sound alone cannot identify the correct written letter.
- All 48 scored decisions now have a contextual first hint, an explicit repair,
  and concept-specific correct feedback. Existing malformed or weak distractors
  were replaced where they could reward test-taking instead of spelling.
- The live path is a 45–55 minute core plus 15–20 minutes of optional listening,
  no-choice response, and later retrieval. Final production is a front-desk
  exchange with five observable communication criteria.
- A direct five-minute next-day route retrieves `zee`, clarification language,
  email symbols, clue-word repair, oral spelling, and read-back confirmation.

## Live pilot protocol for The alphabet and spelling

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Which written letter shapes or U.S. letter names were not yet secure.
3. Results for B/V, E/I, G/J, and M/N before the listening transcript opened.
4. Whether a clue word or direct two-letter contrast produced faster repair.
5. Whether the learner recognized `zed` but consistently used the U.S. target
   `zee` during production.
6. Whether the learner could ask for repetition, check one letter, and read the
   complete item back without tutor prompting.
7. Whether the first contextual hint produced self-correction.
8. Actual time for the core path and any optional activity used.
9. Independent front-desk role-play and which success criterion still needed
   support.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Days, months, and dates: issues found and resolved

- The original lesson moved directly from days and months to `on` and `in`
  without distinguishing a weekday question from a calendar-date question.
  Learners now contrast `What day is it today?` with `What's the date today?`
  in theory, controlled practice, final production, and later retrieval.
- U.S. date style was presented as `March 8th` in both writing and speech. The
  revised lesson distinguishes common written `March 8` from spoken `March
  eighth`, while preserving the ordinal suffix as an accepted informal form.
- A full U.S. date now includes the comma and year model `March 8, 2026`, spoken
  `March eighth, twenty twenty-six`.
- Numeric dates previously assumed that `3/8` was self-explanatory. The revised
  lesson states that common U.S. order makes it March 8 while other countries
  may read the same numbers as August 3. Important dates should use the written
  month name and a read-back confirmation.
- The page listed all ordinal suffixes but did not explain their pattern. It now
  groups `1st`, `2nd`, and `3rd`, the irregular spellings learners need, the
  `11th/12th/13th` exceptions, and the returning `21st/22nd/23rd/31st` pattern.
- The original two-row preposition table omitted a high-frequency boundary.
  Learners now use no preposition before `today`, `tomorrow`, `yesterday`, and
  time phrases with `this`, `next`, or `last`.
- The calendar displayed Sunday first while the ordering activity began with
  Monday. The lesson now explains that many U.S. calendars display Sunday first
  while the teaching sequence uses Monday to keep the common workweek and
  weekend together.
- Pronunciation guidance now models common U.S. `Tuesday`, the reduced middle of
  `Wednesday`, later stress in `July` and `September`, ordinal `th`, and the
  stress contrast between `thirteenth` and `thirtieth`.
- A closed six-item tutor-read check now tests similar day names, month stress,
  ordinal contrasts, and month-first date order before the script is shown.
- All 45 scored decisions now provide a contextual first hint, explicit repair,
  and concept-specific correct feedback. Weak malformed distractors were
  replaced with natural alternatives where the context, not appearance, must
  determine the answer.
- Open work no longer requests a real birth date, appointment, or work schedule.
  A privacy note and fictional calendar support a final appointment role-play
  with five observable success criteria.
- The live path is a 45–55 minute core plus 15–20 minutes of optional listening,
  oral recall, and later retrieval. A direct five-minute next-day route checks
  day versus date, `on`, U.S. numeric order, zero-preposition forms, error
  repair, and read-back production.

## Live pilot protocol for Days, months, and dates

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner could retrieve the day and month sequences without
   treating a Sunday-first calendar as a conflicting rule.
3. Whether `What day is it?` and `What's the date?` produced different answers.
4. The first confusion among `on`, `in`, and no preposition.
5. Whether the learner recognized the international ambiguity in a numeric date
   and chose to write or repeat the month name.
6. Results of the six-item tutor-read day and date check before the transcript.
7. Whether ordinal endings and stress remained clear during spontaneous dates.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent appointment role-play result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Colors and basic adjectives: issues found and resolved

- The original explanation said that an adjective has exactly two positions and
  never adds `-s`. The revised scope is accurate for the descriptive adjectives
  in this lesson and avoids claiming that every English adjective behaves
  identically in every construction.
- Color decisions based on grass, sky, snow, signs, and coffee were presented as
  universal facts. Each scored item now provides a conventional, lighting, U.S.
  standard, or lexical context that supports one intended color word.
- Swatches were described as showing the “real color.” They are now explicitly
  representative and paired with visible text, with a reminder that screens,
  lighting, and color perception differ.
- A new inclusive-use note teaches learners to add a label, location, size, or
  other identifier rather than rely on color alone for directions, safety, or
  finding an object.
- The page now uses and explains U.S. `gray` while preparing learners to
  recognize `grey` in other English varieties.
- The grammar system now connects earlier foundations: `a/an` follows the next
  sound, `is/are` agrees with the subject, the noun carries plural marking, and
  the descriptive adjective remains unchanged.
- Two-adjective use is now contrasted across positions: `a small black notebook`
  before a noun and `The notebook is small and black` after `be`. The page marks
  size, age, or opinion plus color as an A0 practice pattern rather than the
  entire English adjective-order system.
- Subjective adjectives now have defensible comparisons. `Big`, `fast`, and
  `expensive` use explicit room, route-time, or budget reference points.
  `Inexpensive` is added as the neutral price word, while `cheap` is marked as
  potentially suggesting low quality.
- The original pronunciation note incorrectly said `beige` rhymes with `page`.
  It now models one-syllable “bayzh,” with the vowel in `day` and the soft final
  sound in `vision`. Neutral noun stress and contrastive adjective stress are
  also distinguished.
- A closed six-item tutor-read check tests color contrasts, size, temperature,
  price, and light-versus-dark shades before the script is opened.
- All 45 scored decisions now have contextual first hints, explicit repairs,
  and concept-specific correct feedback. A new sentence builder directly tests
  `and` between two adjectives after `be`.
- Open practice no longer requires personal possessions, clothing, home, or
  appearance. The final lost-and-found task uses fictional items and five
  observable criteria, including a non-color identifier.
- The live path is a 45–55 minute core plus 15–20 minutes of optional listening,
  oral transformation, and later retrieval. A direct five-minute next-day route
  checks article choice, plural agreement, adjective order, `and`, `be`
  agreement, and independent description.

## Live pilot protocol for Colors and basic adjectives

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner distinguished adjective-before-noun from adjective-after-
   `be` without translating word for word.
3. Whether `a/an`, plural noun marking, and `is/are` remained accurate inside a
   complete description.
4. Whether the learner kept adjectives unchanged with plural nouns.
5. Whether two qualities used size or age before color and `and` after `be`.
6. Whether explicit comparisons made `big`, `fast`, and `expensive` easier to
   interpret than isolated labels.
7. Results of the six-item tutor-read check and production of `beige` after the
   model.
8. Whether the first contextual hint produced self-correction.
9. Actual core time and independent lost-and-found production result.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## This/that/these/those: issues found and resolved

- The original shorthand used `many` for every plural. The revised explanation
  says `more than one`, so two keys or two chairs fit the rule without implying
  a large quantity.
- Near and far are no longer presented as fixed measurements. The page explains
  that the speaker’s viewpoint, gesture, and situation establish the contrast.
- Full-sentence choice drills previously inserted lowercase demonstratives at
  the beginning of visible, copied, and accessible text. Those choices now use
  real sentence capitalization.
- The phone dialogue used `Who’s that?` and `Is that Mr. Lopez?`. The U.S.
  English model now uses `Who’s this?` and `Is this Mr. Lopez?`, while a separate
  note distinguishes phone identification, physical pointing, and reference to
  an earlier idea.
- A tutor-read discrimination check now contrasts `this/these` and `that/those`
  before the learner sees the script, with clear final-sound and vowel cues.
- The final near-car item previously used visibly malformed distractors. It now
  contrasts `this car`, `that car`, and `these cars`, requiring both distance
  and number rather than error spotting by appearance.
- The revised lesson has 30 scored decisions with contextual number, distance,
  noun, and `be`-agreement cues plus exact repairs.
- The live path is now a 40–45 minute core plus 10–15 minutes of optional
  matching, sound discrimination, oral transformation, and retrieval. Open
  production has four observable success criteria.

## Live pilot protocol for This/that/these/those

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner checked number before distance or relied on one cue.
3. Whether two objects were understood as plural without the word `many`.
4. The first confusion between `this/these` or `that/those`.
5. Whether nouns and `is/are` agreed during independent production.
6. Results of the tutor-read `this/these` and `that/those` discrimination.
7. Whether the first contextual hint produced self-correction.
8. Whether U.S. phone identification with `this` felt natural and usable.
9. Actual core time and independent use of all four demonstratives.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Question words: issues found and resolved

- Shared answer tiles inserted lowercase words at the start of questions, so
  completed, copied, and accessible text could read `where are you from?`.
  The revised choice drills use real sentence-initial capitalization.
- One oral cue paired `It’s Ana` with `What is your name?`, although that answer
  more naturally responds to `Who is it?`. Name questions now receive the
  first-person answer `My name is Ana`, while person-identification questions
  receive `That’s my manager` or a person’s name.
- The original rule did not mark its boundary. The lesson now states that
  question word + `be` + subject applies to `am/is/are` questions and contrasts
  the later action-word form `Where do you work?` with the inaccurate
  `Where are you work?`.
- A complete-question quiz now tests `be` word order, not only question-word
  recognition. Its distractors represent embedded-question order and agreement
  errors rather than unrelated language.
- The pronunciation note now has a closed tutor-read comparison of falling
  information questions and often-rising yes/no questions.
- The revised lesson has 31 scored decisions. Each decision identifies the
  answer type or word-order relationship before revealing a complete repair.
- The live path is now a 40–45 minute core plus 10–15 minutes of optional
  information matching, intonation listening, oral recall, and retrieval.
- Open production has four observable criteria. The direct next-day route
  checks place, person, and condition cues, question-word repair, no-notes word
  order, and four-question independent production.

## Live pilot protocol for Question words

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether the learner classified each expected answer before choosing a word.
3. The first confusion among `what`, `where`, `who`, and `how`.
4. Whether `be` came before the subject in independent questions.
5. Whether the learner tried to combine `be` with the action word `work`.
6. Whether the first contextual hint produced self-correction.
7. Whether information and yes/no intonation were distinguishable when heard.
8. Actual time for the core path and any optional activity used.
9. Independent production of four natural questions and matching answers.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.

## Possessive adjectives: issues found and resolved

- The page used literal ownership as the full rule even though phrases such as
  `my sister`, `her manager`, and `their client` express relationship or
  connection. The explanation and feedback now cover both ownership and
  connection without changing the familiar pronoun-pair model.
- Several items expected a possessive form from a first name alone. Every
  `his` and `her` decision now states the person’s pronoun before testing the
  learner’s choice.
- `Their` previously appeared only as plural, which contradicted the preceding
  Subject Pronouns lesson. The revised lesson uses `their` for a group and for
  one caller, client, or driver whose gender is not known or relevant.
- The old lesson mentioned `its` versus `it’s` once but did not diagnose the
  contrast. A compact reference and tutor-read listening check now compare
  `your/you’re`, `its/it’s`, and `their/they’re` by sentence job, followed by
  repair and quiz evidence.
- The revised lesson has 37 scored decisions. Each has a contextual reference
  cue and an explicit repaired chunk; checked activities explain why the
  reference and noun require that form.
- The live path is now a 40–45 minute core plus 10–15 minutes of optional pair
  matching, same-sound listening, no-choice transformation, and retrieval.
- Open production has four observable success criteria. The direct next-day
  route checks the listener, a company or app, singular `their`, subject versus
  possessive form, oral recall, and independent connected language.

## Live pilot protocol for Possessive adjectives

Use the lesson with three appropriate adult A0 learners. Keep notes anonymous.

Record for each session:

1. Date and approximate starting level.
2. Whether ownership and non-ownership connections were both clear.
3. Whether the learner chose from the connected person rather than the noun.
4. Whether singular `their` transferred from the Subject Pronouns lesson.
5. Whether the learner distinguished `its` from `it’s` by the following noun.
6. Results of the same-sound tutor-read check before the script was revealed.
7. Whether the first contextual hint produced self-correction.
8. Actual time for the core path and any optional activity used.
9. Independent production using four possessive words accurately.
10. Next-day retrieval result and any explanation the tutor still had to add.

After the first completed pilot, change the canonical state to `learner-pilot`
and increment the count to 1. Keep `tutorReviewRequired` true until all three
pilots are recorded and substantive issues are resolved. Mark the lesson
`reviewed` only with the tutor’s name and review date.
