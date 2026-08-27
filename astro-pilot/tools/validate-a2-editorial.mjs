import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const reviewedA2 = readyLessons.filter((lesson) => lesson.level === "A2" && lesson.qualityReview);

if (reviewedA2.length !== 19) {
  errors.push(`expected 19 A2 lessons with canonical review evidence, found ${reviewedA2.length}`);
}

for (const lesson of reviewedA2) {
  const source = readFileSync(path.join(projectRoot, lesson.source), "utf8");
  if (source.includes("—")) errors.push(`${lesson.id}: prohibited em dash remains in learner source`);

  if (!sourceOnly) {
    const output = path.join(outputRoot, lesson.route.replace(/^\//, ""), "index.html");
    if (!existsSync(output)) {
      errors.push(`${lesson.id}: rendered lesson output is missing`);
      continue;
    }
    const html = readFileSync(output, "utf8");
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
    if (!main) errors.push(`${lesson.id}: rendered learner content has no main landmark`);
    else if (main.includes("—")) errors.push(`${lesson.id}: prohibited em dash remains in rendered learner content`);
  }
}

validateSourceContract(
  "a2/past-simple",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice one routine and one finished day[\s\S]*Get to the root: locate the situation in finished past time[\s\S]*complete fact[\s\S]*completed sequence[\s\S]*repetition inside a finished period[\s\S]*Context, not a magic time word[\s\S]*A time period does not have to be over[\s\S]*Regular spelling: the precise pattern[\s\S]*short stressed vowel \+ final consonant[\s\S]*opened[\s\S]*openned[\s\S]*snowed, fixed, played[\s\S]*Frequent irregular forms[\s\S]*Get to the root: did carries one past marker[\s\S]*information question[\s\S]*Be keeps its own past system[\s\S]*Who called Rina\?[\s\S]*Who did Rina call\?[\s\S]*The final[\s\S]*sound[\s\S]*voiceless sound other than \/t\/[\s\S]*vowel or voiced sound other than \/d\/[\s\S]*after \/t\/ or \/d\/[\s\S]*didja[\s\S]*data-lesson-extension="Tutor-read past form, polarity, be, and -ed listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a fictional community-event report for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "finished-past viewpoint, discourse time, precise regular spelling, irregular forms, single-marker did, independent past be, subject/object questions, sound-based -ed pronunciation, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/past-continuous",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice one scene and the events around it[\s\S]*Get to the root: open the past scene at a reference point[\s\S]*open viewpoint[\s\S]*does not promise that the situation finished later[\s\S]*Duration does not choose the tense[\s\S]*not always an interruption[\s\S]*Build the form: was or were plus verb-ing[\s\S]*Did they were working[\s\S]*Retrieve verb-ing spelling precisely[\s\S]*opening[\s\S]*lying[\s\S]*traveling[\s\S]*Choose viewpoint before choosing a connector[\s\S]*While[\s\S]*When[\s\S]*During[\s\S]*does not select a tense automatically[\s\S]*State or activity\? Meaning comes first[\s\S]*Rina had a key[\s\S]*Rina was having lunch[\s\S]*Sound natural: keep the scene light and the event clear[\s\S]*\/wəz\/[\s\S]*\/wɚ\/[\s\S]*What-were-you[\s\S]*data-lesson-extension="Tutor-read open-scene, bounded-event, polarity, question, state, and parallel-action listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a fictional power-outage report for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "open past viewpoint, duration boundary, non-interruption events, was/were form, -ing spelling, past-simple contrast, when/while/during syntax, state/activity meaning, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/be-going-to-for-plans",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice what exists before the future event[\s\S]*Get to the root: a present basis for a future idea[\s\S]*prior intention[\s\S]*present evidence[\s\S]*does not make the future certain[\s\S]*A future-time expression does not choose the form[\s\S]*Build the form: be \+ going to \+ base verb[\s\S]*Do not add[\s\S]*does[\s\S]*Choose meaning, not just a future time[\s\S]*organized arrangement with a concrete detail[\s\S]*decision at the moment of speaking[\s\S]*Going to go is grammatical[\s\S]*Sound natural: contractions, stress, and[\s\S]*gonna[\s\S]*cannot replace movement followed only by a place[\s\S]*data-lesson-extension="Tutor-read intention, arrangement, now-decision, evidence, negative, and movement listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second planning update[\s\S]*id="next-day-retrieval"/i,
  "prior intention, present-evidence prediction, modal certainty boundary, independent be form, arrangement and now-decision contrasts, grammatical going-to-go, U.S. spoken reduction, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/will-for-predictions-and-offers",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice four messages in one event-day conversation[\s\S]*Get to the root: the speaker’s present stance[\s\S]*belief or neutral forecast[\s\S]*decision announced now[\s\S]*willingness or offer[\s\S]*commitment or promise[\s\S]*Not every idea with[\s\S]*will[\s\S]*begins at the moment of speaking[\s\S]*Build the form: will or won’t \+ base verb[\s\S]*Do not add[\s\S]*do[\s\S]*to[\s\S]*third-person[\s\S]*Offer, request, decision, or prediction\?[\s\S]*Will you carry this box\?[\s\S]*is a request, not an offer[\s\S]*useful A2 contrast, not a law[\s\S]*Sound natural: weak[\s\S]*clear[\s\S]*won’t[\s\S]*It does not sound like[\s\S]*want[\s\S]*probably[\s\S]*Maybe[\s\S]*data-lesson-extension="Tutor-read prediction, immediate decision, offer, promise, request, and evidence-based future listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second event-day response[\s\S]*id="next-day-retrieval"/i,
  "modal stance, non-spontaneous prediction and commitment boundary, invariant form, offer/request roles, nonabsolute going-to contrast, probability-word order, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/comparatives-and-superlatives",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice the evidence before the grammar[\s\S]*Get to the root: choose a scale, reference, and set[\s\S]*does not require exactly two physical things[\s\S]*extreme inside a defined set[\s\S]*does not guarantee one unique winner[\s\S]*one of the cheapest rooms[\s\S]*Build the form without a false syllable shortcut[\s\S]*Two-syllable adjectives do not follow one perfect mechanical rule[\s\S]*Precise spelling conditions[\s\S]*Do not double final[\s\S]*w[\s\S]*x[\s\S]*y[\s\S]*farther[\s\S]*further[\s\S]*our largest room[\s\S]*Equal, unequal, and measured differences[\s\S]*not as bad as yesterday’s[\s\S]*much \/ far \/ a lot \+ comparative[\s\S]*amount \+ comparative[\s\S]*very bigger[\s\S]*Sound natural: stress the scale, lighten the frame[\s\S]*\/ðən\/[\s\S]*data-lesson-extension="Tutor-read comparative reference, superlative set, equality, unequal degree, exact difference, and tied-extreme listening check"[\s\S]*never need to disclose your real home[\s\S]*Final production: give a 45–60 second room recommendation[\s\S]*id="next-day-retrieval"/i,
  "comparison scale, reference and set, nonunique extrema, precise form variation and spelling, irregular distance forms, articles, equality, measured degree, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/present-perfect",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice a live status beside a finished event log[\s\S]*Get to the root: view before-now time from now[\s\S]*current result[\s\S]*experience[\s\S]*continuing state[\s\S]*unfinished period[\s\S]*since[\s\S]*for[\s\S]*The rule is not simply “no time stated\.”[\s\S]*Build the form: have or has \+ past participle[\s\S]*Past form and past participle are not always the same[\s\S]*go[\s\S]*went[\s\S]*gone[\s\S]*Choose the time viewpoint before the tense[\s\S]*A calendar word does not choose automatically[\s\S]*definite closed event-time[\s\S]*Natural U\.S\. English with[\s\S]*just[\s\S]*already[\s\S]*yet[\s\S]*do not treat the common U\.S\. simple-past alternatives as errors[\s\S]*Been to, gone to[\s\S]*been at[\s\S]*Sound natural: weaken the helper, stress the result[\s\S]*\/bɪn\/[\s\S]*She’s finished[\s\S]*can be ambiguous without context[\s\S]*data-lesson-extension="Tutor-read current result, closed event detail, continuing state, unfinished total, been-gone status, and U\.S\. recent-event listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional event-status briefing[\s\S]*id="next-day-retrieval"/i,
  "present connection, result, experience, continuing state, unfinished period, nonmechanical time choice, form and participles, duration, U.S. recent-event alternatives, been/gone/been-at status, spoken ambiguity, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/modals-should-must-have-to",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice four messages for one fictional event[\s\S]*Get to the root: choose the meaning before the form[\s\S]*Do not treat these forms as three fixed steps on one strength ladder[\s\S]*recommendation[\s\S]*ordinary requirement in conversation[\s\S]*firm instruction or formal requirement[\s\S]*prohibition[\s\S]*no necessity[\s\S]*Must[\s\S]*and[\s\S]*have to[\s\S]*overlap[\s\S]*Context and register matter more than a memorized[\s\S]*inside versus outside authority[\s\S]*Build two form systems[\s\S]*she shoulds call[\s\S]*she should to call[\s\S]*does she should call[\s\S]*Does she have to call[\s\S]*Keep recommendation, prohibition, and choice apart[\s\S]*Move requirements through time with[\s\S]*have to[\s\S]*musted[\s\S]*will must[\s\S]*had to[\s\S]*will have to[\s\S]*Ask for advice or ask about a rule[\s\S]*Must I[\s\S]*uncommon in ordinary U\.S\. conversation[\s\S]*can’t[\s\S]*not allowed to[\s\S]*Sound natural: reduce the frame and stress the action[\s\S]*\/ʃəd\/[\s\S]*\/ˈhæftə\/[\s\S]*\/ˈhæstə\/[\s\S]*Strong stress can change the stance, not the grammar[\s\S]*data-lesson-extension="Tutor-read recommendation, ordinary requirement, prohibition, optional action, past requirement, and rule-question listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional event-team briefing[\s\S]*Register switch:[\s\S]*id="next-day-retrieval"/i,
  "meaning-first modal choice, obligation overlap, nonmechanical authority framing, invariant modal and changing have-to form, negative meaning, past and future requirements, U.S. register and speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/quantifiers-much-many-a-lot-of",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice one supply packaged two ways[\s\S]*Get to the root: grammar packages the quantity[\s\S]*Countability is not simply a physical property[\s\S]*unit phrase changes the grammatical package[\s\S]*much advice[\s\S]*many pieces of advice[\s\S]*general noncount meanings[\s\S]*information[\s\S]*advice[\s\S]*equipment[\s\S]*furniture[\s\S]*One noun can change its package and meaning[\s\S]*much coffee[\s\S]*two coffees[\s\S]*Choose quantity, sentence environment, and register[\s\S]*everyday positive U\.S\. conversation[\s\S]*Positive[\s\S]*many[\s\S]*is normal[\s\S]*tendencies, not sentence-type laws[\s\S]*A lot of[\s\S]*questions and negatives[\s\S]*too much noise[\s\S]*so much work[\s\S]*as much time as we need[\s\S]*A lot of[\s\S]*before a noun[\s\S]*a lot[\s\S]*without one[\s\S]*Place the quantity on a useful scale[\s\S]*A few[\s\S]*a little[\s\S]*some, more than zero[\s\S]*few[\s\S]*little[\s\S]*shortage[\s\S]*not many[\s\S]*not much[\s\S]*Too many[\s\S]*too much[\s\S]*do not simply mean[\s\S]*Let the noun control agreement[\s\S]*A lot of chairs are ready[\s\S]*A lot of equipment is ready[\s\S]*Sound natural: link the frame, stress the quantity or noun[\s\S]*\/ə ˈlɑɾəv\/[\s\S]*\/ˈlɑtsəv\/[\s\S]*data-lesson-extension="Tutor-read count question, amount question, large quantity, useful small count, shortage, and countable-serving listening check"[\s\S]*never need to disclose your real food[\s\S]*Final production: give a 45–60 second fictional supply briefing[\s\S]*Repackage the quantity:[\s\S]*id="next-day-retrieval"/i,
  "noun-meaning countability, countable units and sense shifts, noncount forms, nonabsolute polarity and register tendencies, nounless a lot, small and excessive quantities, noun-controlled agreement, U.S. connected speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/first-conditional",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice one event plan with different results[\s\S]*Get to the root: one situation activates another[\s\S]*future condition as open and relevant[\s\S]*not automatically unlikely[\s\S]*does not promise that its result is objectively[\s\S]*likely[\s\S]*Build the core future pattern without a false absolute[\s\S]*same basic condition-result relationship[\s\S]*information flow and emphasis[\s\S]*Do not put[\s\S]*will[\s\S]*merely to mark future time[\s\S]*special meanings such as willingness[\s\S]*Choose a result that matches the speaker’s purpose[\s\S]*will \/ won’t[\s\S]*may \/ might[\s\S]*can[\s\S]*imperative[\s\S]*Frame the future with[\s\S]*if[\s\S]*when[\s\S]*unless[\s\S]*speaker’s expectation[\s\S]*does not guarantee the event in the real world[\s\S]*same future can be framed differently[\s\S]*unless the inspection runs late[\s\S]*if the inspection does not run late[\s\S]*Do not add another negative[\s\S]*Sound natural: make the condition and response one path[\s\S]*\/ɪf jə\/[\s\S]*\/wil\/[\s\S]*\/wəl\/[\s\S]*second syllable[\s\S]*\/ənˈlɛs\/[\s\S]*data-lesson-extension="Tutor-read open condition, expected time, exception, predicted plan, weaker possibility, and imperative-result listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional contingency briefing[\s\S]*Reframe one event:[\s\S]*id="next-day-retrieval"/i,
  "open condition-result logic, nonprobability claims, scoped future-present form, information flow, result modal and imperative range, if-when-unless framing, U.S. connected speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/adverbs-of-manner",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice where each description points[\s\S]*Get to the root: choose the target before the form[\s\S]*manner adverb describes how an action is performed[\s\S]*adjective after a linking meaning[\s\S]*Do not decide from the verb alone[\s\S]*The fabric feels soft[\s\S]*Maya felt the edge carefully[\s\S]*Build common manner forms accurately[\s\S]*consonant \+[\s\S]*y[\s\S]*consonant \+[\s\S]*le[\s\S]*ending in[\s\S]*-ic[\s\S]*true → truly[\s\S]*full → fully[\s\S]*Keep changed forms and changed meanings apart[\s\S]*well[\s\S]*fast[\s\S]*hardly[\s\S]*lately[\s\S]*flat adverbs[\s\S]*Place the manner without breaking the action[\s\S]*safest neutral pattern[\s\S]*frequency before the main verb[\s\S]*manner after the action[\s\S]*can also appear before the main verb[\s\S]*Do not turn a useful core pattern into an absolute rule[\s\S]*linking meaning and adjective[\s\S]*action meaning and manner adverb[\s\S]*Use natural U\.S\. forms without inventing a false ban[\s\S]*Drive safe[\s\S]*Go slow[\s\S]*recognized expression[\s\S]*Sound natural: attach[\s\S]*-ly[\s\S]*\/ˈkɛrfəli\/[\s\S]*\/ˈkwɪkli\/[\s\S]*\/ˈizəli\/[\s\S]*data-lesson-extension="Tutor-read adjective complement, neutral manner, hard-hardly, late-lately, flat U\.S\. form, and preverb-manner listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional observation briefing[\s\S]*Meaning check:[\s\S]*id="next-day-retrieval"/i,
  "description target, linking and action meanings, contextual spelling patterns, changed forms and meanings, nonabsolute neutral and preverb placement, U.S. flat forms, spoken stress, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/verb-infinitive-ing",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice six jobs inside one plan[\s\S]*to-infinitive complement[\s\S]*-ing complement[\s\S]*person plus to-infinitive[\s\S]*negative to-infinitive[\s\S]*preposition plus -ing[\s\S]*ended activity[\s\S]*Get to the root: store the[\s\S]*pattern with the verb[\s\S]*first verb allows one or more shapes[\s\S]*meaning tendency can help memory, but it cannot safely predict an unfamiliar verb[\s\S]*avoid making[\s\S]*future goal[\s\S]*Let the first verb carry tense, agreement, questions, and main negation[\s\S]*Do not add tense or agreement again to the second verb[\s\S]*Name the second performer and place negation precisely[\s\S]*asked Leo to test[\s\S]*told Leo not to open[\s\S]*did not decide to cancel[\s\S]*decided not to cancel[\s\S]*Two kinds of[\s\S]*to[\s\S]*plan to meet[\s\S]*look forward to meeting[\s\S]*reliable rule is not[\s\S]*every[\s\S]*to[\s\S]*takes a base verb[\s\S]*When both shapes are possible, check the meaning[\s\S]*Many contexts overlap[\s\S]*both forms are often possible with little practical difference[\s\S]*Do not force a difference where context does not support one[\s\S]*Three high-value meaning contrasts[\s\S]*stop doing[\s\S]*stop to do[\s\S]*remember to do[\s\S]*remember doing[\s\S]*try to do[\s\S]*try doing[\s\S]*Sound natural: weaken infinitive[\s\S]*\/tə\/[\s\S]*\/ˈwɑnə\/[\s\S]*standard spelling[\s\S]*remove a person[\s\S]*\/ɪŋ\/[\s\S]*\/ˈwɝkɪŋ\/[\s\S]*data-lesson-extension="Tutor-read core complement, second performer, complement negation, prepositional to, stopped activity, and experimental try listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional workshop update[\s\S]*Meaning check:[\s\S]*id="next-day-retrieval"/i,
  "stored lexical complements, nonpredictive meaning tendency, tense and agreement, second performer, negation scope, infinitive and prepositional to, overlapping and changed meanings, U.S. reduction and -ing sound, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/travel-and-transport",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice one complete travel path[\s\S]*general travel mode[\s\S]*location on a specific vehicle[\s\S]*schedule change[\s\S]*Get to the root: choose the travel viewpoint[\s\S]*Do not choose a preposition only from the object’s size[\s\S]*by \+ mode[\s\S]*on foot[\s\S]*shared or ride-on vehicle[\s\S]*specific car or taxi[\s\S]*conventional, not a perfect physical rule[\s\S]*Bicycles and motorcycles[\s\S]*Name the trip, route, and place precisely[\s\S]*travel[\s\S]*trip[\s\S]*journey[\s\S]*luggage[\s\S]*public transportation[\s\S]*bus stop[\s\S]*platform[\s\S]*terminal[\s\S]*gate[\s\S]*Build the journey from action chunks[\s\S]*Take a train[\s\S]*Catch the 7:15 train[\s\S]*Miss the 7:15 train[\s\S]*arrive in Denver[\s\S]*arrive at the hotel[\s\S]*airport path is useful, but it is not universal[\s\S]*Sound natural: hear the content words in fast travel messages[\s\S]*\/flaɪt\/[\s\S]*eigh[\s\S]*TEEN[\s\S]*data-lesson-extension="Tutor-read destination, departure time, platform, gate change, delay, and replacement-service listening check"[\s\S]*never need to disclose your real home[\s\S]*Final production: give a 45–60 second fictional travel briefing[\s\S]*Clarify important information:[\s\S]*id="next-day-retrieval"/i,
  "travel viewpoint, conventional vehicle patterns, general and countable travel nouns, U.S. public-transportation usage, station and airport wayfinding, scheduled-service actions, nonuniversal airport path, stress and number listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/health-and-the-body",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Communication lesson, not medical advice[\s\S]*cannot diagnose[\s\S]*health care professional or medicine label[\s\S]*Notice six kinds of health information[\s\S]*countable symptom[\s\S]*feeling or state[\s\S]*pain location[\s\S]*finished onset[\s\S]*duration to now[\s\S]*severity report[\s\S]*Get to the root: report observations, not a diagnosis[\s\S]*have \+ symptom noun[\s\S]*feel \+ adjective[\s\S]*body part \+ hurt[\s\S]*have pain in \+ location[\s\S]*does not always require[\s\S]*Locate the problem with useful body groups[\s\S]*head and face[\s\S]*upper body[\s\S]*arm and hand[\s\S]*leg and foot[\s\S]*inside the body[\s\S]*feet[\s\S]*teeth[\s\S]*Add onset, duration, severity, and useful questions[\s\S]*What brings you in today[\s\S]*Where does it hurt[\s\S]*When did it start[\s\S]*How long have you had it[\s\S]*How bad is the pain from zero to ten[\s\S]*Are you allergic to any medicines[\s\S]*Advice, instructions, and urgent help are different messages[\s\S]*Do not invent a medicine, dose, or treatment[\s\S]*not always the same[\s\S]*fills a prescription[\s\S]*Urgent-help language[\s\S]*call 911[\s\S]*local emergency number[\s\S]*trouble breathing[\s\S]*severe chest pain[\s\S]*fainted[\s\S]*bleeding won’t stop[\s\S]*suddenly confused[\s\S]*Sound natural: stress the new health information[\s\S]*\/eɪk\/[\s\S]*\/ˈstʌmək\/[\s\S]*\/ˈmɛdəsən\/[\s\S]*\/fɚ\/[\s\S]*data-lesson-extension="Tutor-read symptom, location, onset, duration, allergy, and urgent-help listening check"[\s\S]*never need to disclose your real health[\s\S]*Final production: give a 45–60 second fictional clinic intake[\s\S]*Do not diagnose the cause or invent a treatment[\s\S]*Clarify and reformulate:[\s\S]*id="next-day-retrieval"/i,
  "language-only medical boundary, observable symptom patterns, countability, body location and agreement, onset and duration, severity, intake questions, reported instructions, nonfixed care path, official urgent-help language, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/town-and-directions",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice six jobs in one complete route[\s\S]*start point and viewpoint[\s\S]*forward movement[\s\S]*exact turn point[\s\S]*passed landmark[\s\S]*destination location[\s\S]*too-far check[\s\S]*Get to the root: build from viewpoint to destination[\s\S]*Left[\s\S]*right[\s\S]*traveler’s current viewpoint[\s\S]*establish[\s\S]*move[\s\S]*change direction[\s\S]*verify[\s\S]*arrive[\s\S]*recover[\s\S]*not a bag of interchangeable commands[\s\S]*Choose a movement or a location relationship[\s\S]*walk along Oak Street[\s\S]*turn onto Pine Avenue[\s\S]*go past the bank[\s\S]*cross Pine Avenue[\s\S]*across from the park[\s\S]*Past[\s\S]*Passed[\s\S]*block[\s\S]*length varies[\s\S]*Ask, check, and repair directions politely[\s\S]*where is the museum[\s\S]*how do I get to the museum[\s\S]*How far is it[\s\S]*Could you repeat that more slowly[\s\S]*Did you say the first or second traffic light[\s\S]*Pine Avenue, not Pine Street[\s\S]*Keep route order and reference precise[\s\S]*first, then, after that[\s\S]*two landmarks could be[\s\S]*at[\s\S]*turn point[\s\S]*onto[\s\S]*street entered[\s\S]*Sound natural: stress the decision points and chunk the route[\s\S]*\/streɪt\/[\s\S]*\/lɛft\/[\s\S]*\/raɪt\/[\s\S]*\/haʊ də aɪ ɡɛt tə ðə mjuˈziəm\/[\s\S]*\/əˈkrɔs\/[\s\S]*data-lesson-extension="Tutor-read start point, turn number, entered street, passed landmark, destination location, and corrected detail listening check"[\s\S]*never need to disclose your real home[\s\S]*Final production: give a 45–60 second fictional visitor route[\s\S]*Meaning check:[\s\S]*id="next-day-retrieval"/i,
  "traveler viewpoint, executable route sequence, movement and location distinctions, variable block meaning, natural polite requests, clarification and repair, precise reference, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/past-time-expressions",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice five time jobs in one update[\s\S]*reference day[\s\S]*event point[\s\S]*later sequence[\s\S]*duration[\s\S]*overlap[\s\S]*reference back[\s\S]*Get to the root: every expression needs a reference time[\s\S]*moment of speaking[\s\S]*current calendar period[\s\S]*stated calendar point[\s\S]*another past event[\s\S]*shared discourse context[\s\S]*Ago[\s\S]*before[\s\S]*earlier[\s\S]*Locate a finished point precisely[\s\S]*Ordinary U\.S\. English says[\s\S]*last night[\s\S]*Last week[\s\S]*The last week[\s\S]*Last Monday[\s\S]*use the date[\s\S]*Order events and keep the reference clear[\s\S]*first, then, after that, later[\s\S]*finally[\s\S]*Separate point, duration, endpoint, and overlap[\s\S]*for \+ amount of time[\s\S]*from \+ start \+ to \+ end[\s\S]*until \+ endpoint[\s\S]*by \+ point[\s\S]*during \+ noun phrase[\s\S]*while \+ clause[\s\S]*Neither word automatically chooses[\s\S]*tense[\s\S]*A duration does not tell us whether a situation continues now[\s\S]*this morning[\s\S]*Sound natural: stress the reference and link the frame[\s\S]*\/ˈjɛstɚdeɪ\/[\s\S]*\/əˈgoʊ\/[\s\S]*\/ˈdɪdʒə\/[\s\S]*data-lesson-extension="Tutor-read reference point, relative sequence, duration, deadline, overlap, and continuing-to-now listening check"[\s\S]*never need to disclose your real work[\s\S]*Final production: give a 45–60 second fictional event timeline[\s\S]*id="next-day-retrieval"/i,
  "reference-time anchoring, point and precision, ago-before-earlier contrast, last and the last, explicit sequencing, duration and endpoint relations, during-while syntax, nonmechanical tense compatibility, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/feelings-and-personality",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice six description jobs in one update[\s\S]*past feeling[\s\S]*stimulus[\s\S]*experiencer reaction[\s\S]*general tendency[\s\S]*observed behavior[\s\S]*stated preference[\s\S]*Get to the root: describe state, reaction, tendency, or behavior[\s\S]*be \/ feel \+ adjective[\s\S]*was \/ were \/ felt \+ adjective[\s\S]*experiencer \+ -ed[\s\S]*stimulus \+ -ing[\s\S]*usually \/ often \/ can be[\s\S]*Feel like[\s\S]*not automatically temporary[\s\S]*not automatically permanent[\s\S]*Choose the experiencer or the stimulus[\s\S]*not “person versus thing\.”[\s\S]*A person can therefore be[\s\S]*A group or organization can be[\s\S]*Add the complement and degree[\s\S]*interested in[\s\S]*excited about[\s\S]*worried about[\s\S]*nervous about[\s\S]*surprised by \/ at[\s\S]*angry with \/ at someone[\s\S]*Choose degree from evidence, not drama[\s\S]*Describe tendencies with evidence and limits[\s\S]*quiet does not automatically mean shy[\s\S]*fun[\s\S]*funny[\s\S]*one late task does not prove laziness[\s\S]*direct[\s\S]*describe the behavior before applying a label[\s\S]*Avoid diagnosing a feeling from appearance alone[\s\S]*Ask the question you actually mean[\s\S]*How is Maya feeling[\s\S]*What’s Maya like[\s\S]*What does Maya like[\s\S]*What does Maya look like[\s\S]*Sound natural: let endings, stress, and questions carry the contrast[\s\S]*\/bɔrd\/[\s\S]*\/ɪmˈbærəst\/[\s\S]*\/ˈɪntrəstɪd\/[\s\S]*\/ɪkˈsaɪtɪd\/[\s\S]*\/ɪŋ\/[\s\S]*\/haʊɚjə ˈfilɪŋ\/[\s\S]*data-lesson-extension="Tutor-read current feeling, stimulus, evidence, limited tendency, question purpose, and role-repair listening check"[\s\S]*never need to disclose your real feelings[\s\S]*Final production: give a 45–60 second fictional team introduction[\s\S]*id="next-day-retrieval"/i,
  "feeling state, experiencer-stimulus roles, nonhuman and human boundaries, adjective complements and degree, evidence-based limited tendencies, behavior-label separation, question purpose, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a2/technology-and-devices",
  /data-core-duration="50–60 minutes"[\s\S]*Can-do:[\s\S]*Notice six jobs in one support request[\s\S]*device and location[\s\S]*attempted action[\s\S]*observable symptom[\s\S]*start time[\s\S]*scope check[\s\S]*exact message[\s\S]*Get to the root: name the technology layer[\s\S]*hardware device or part[\s\S]*app or software[\s\S]*connection or network[\s\S]*account or access[\s\S]*file or location[\s\S]*Report the symptom before diagnosing the cause[\s\S]*Keep the action and result distinct[\s\S]*download a file[\s\S]*upload a file[\s\S]*download an app[\s\S]*install the app[\s\S]*save the document[\s\S]*back up the document[\s\S]*restart the device[\s\S]*reset the device[\s\S]*may erase information[\s\S]*connect to Wi-Fi[\s\S]*pair the headphones[\s\S]*mute the microphone[\s\S]*turn off the microphone[\s\S]*not synonyms[\s\S]*Place the object inside the correct chunk[\s\S]*separable[\s\S]*turn it on[\s\S]*log in to your account[\s\S]*connect to the network[\s\S]*search for the file[\s\S]*send me the link[\s\S]*send the link to me[\s\S]*Report the symptom and scope before the solution[\s\S]*will not[\s\S]*can mean that a device or app fails or refuses[\s\S]*not a prediction here[\s\S]*Safety boundary: protect the device and the account[\s\S]*password, PIN, or verification code[\s\S]*unexpected link or attachment[\s\S]*unusually hot[\s\S]*Do not attempt a battery repair[\s\S]*Do not reset a device, erase data, install unknown software, or change security settings[\s\S]*Sound natural: stress the failed action and link the command[\s\S]*\/ˈwaɪfaɪ\/[\s\S]*\/dɪˈvaɪs\/[\s\S]*\/ˈpæsˌwɝd\/[\s\S]*\/ˈɛrɚ\/[\s\S]*\/woʊnt\/[\s\S]*\/wɑnt\/[\s\S]*\/kənjə\/[\s\S]*\/kʊdʒə\/[\s\S]*data-lesson-extension="Tutor-read device, attempted action, symptom, scope, exact message, and safe account response listening check"[\s\S]*never need to disclose your real devices[\s\S]*Final production: give a 45–60 second fictional support report[\s\S]*id="next-day-retrieval"/i,
  "technology layers, observable evidence, action-result distinctions, phrasal-verb placement, precise symptoms and scope, account and battery safety, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceTerms(
  "a2/education-and-study",
  [
    'data-core-duration="50–60 minutes"',
    "Can-do:",
    "Notice six jobs in one learning update",
    "learning goal",
    "course and program",
    "study routine",
    "progress evidence",
    "current gap",
    "next step",
    "Get to the root: locate each word on the learning path",
    "Education systems use some labels differently",
    "subject",
    "course",
    "class",
    "lesson",
    "program",
    "qualification",
    "Certificate, diploma",
    "degree",
    "not automatic synonyms",
    "Keep enrollment, participation, and results distinct",
    "sign up for / register for / enroll in a course",
    "take a course",
    "attend class",
    "do homework",
    "complete / submit an assignment",
    "study for an exam",
    "homework",
    "normally noncount",
    "assignment",
    "countable",
    "take an exam",
    "get a score, grade, or feedback",
    "complete a course",
    "pass a course / exam",
    "score",
    "grade",
    "Feedback",
    "Systems vary",
    "Separate study, learn, teach, practice, and review",
    "Study",
    "does not guarantee that learning happened",
    "learn",
    "not limited to a completed result",
    "teach someone something",
    "teach something to someone",
    "Use evidence and ask for the exact help you need",
    "reports effort",
    "does not by itself show progress",
    "before-and-now sample",
    "I understand the first step",
    "Could you repeat that more slowly",
    "Could you give me another example",
    "When is the assignment due",
    "Sound natural: stress the learning result and link the question",
    "/kɔrs/",
    "/lɝn/",
    "/ˈstʌdi/",
    "/ˌɛdʒəˈkeɪʃən/",
    "/əˈsaɪnmənt/",
    "/ˈprɑɡrɛs/",
    "/kʊdʒə/",
    "/wɛr ʃədaɪ/",
    'data-lesson-extension="Tutor-read learning goal, course-class distinction, study action, progress evidence, feedback, and clarification check"',
    "never need to disclose your real school",
    "Final production: give a 45–60 second fictional learning update",
    'id="next-day-retrieval"',
  ],
  "learning-path terminology, variable education-system labels, participation-result distinctions, homework countability, study-learn-teach-practice meaning, evidence-based progress, classroom repair, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceTerms(
  "a2/phrasal-verbs",
  [
    'data-core-duration="50–60 minutes"',
    "Can-do:",
    "Notice six chunks doing six different jobs",
    "collect an item",
    "record information",
    "search for something",
    "activate equipment",
    "return a phone call",
    "discard something",
    "Get to the root: store four facts, not two words",
    "whole chunk",
    "meaning in one context",
    "object pattern",
    "complete example",
    "show up",
    "used without an object here",
    "turn off",
    "separable",
    "look for",
    "stays together before the object",
    "take off",
    "pattern changes with meaning",
    "The main verb carries tense and agreement; the particle stays the same",
    "return the main verb to its base form",
    "A practical label, not a false grammar rule",
    "Some grammar books label combinations",
    "Pattern 1: no object in the meaning used here",
    "A following time, place, or manner phrase is not a movable object",
    "got up",
    "went out",
    "came back",
    "sat down",
    "showed up",
    "grew up",
    "Pattern 2: a separable chunk has two noun positions",
    "turn off the projector · turn the projector off",
    "A personal pronoun must go in the middle",
    "turn it off",
    "turn off it",
    "Pattern 3: keep the chunk together before its object",
    "look for the sheets · look for them",
    "look them for",
    "Let context select the meaning and register",
    "pick the box up",
    "pick up the box at the desk",
    "take your coat off",
    "the plane took off",
    "turn the music down",
    "turn the invitation down",
    "Do you mean lift the box or collect it from the desk",
    "Register: common does not mean careless",
    "neutral in everyday U.S. English",
    "complete the form, power off the equipment, return the call",
    "Put off",
    "postpone",
    "Do not replace every phrasal verb mechanically",
    "Sound natural: stress meaning, not a memorized particle rule",
    "particle often carries a clear result beat",
    "preposition may be lighter",
    "Actual stress changes",
    "/kənjə/",
    "/dɪdʒə/",
    'data-lesson-extension="Tutor-read collection, object placement, fixed chunk, polysemy, register, and clarification listening check"',
    "never need to disclose your real home",
    "Final production: give a 45–60 second fictional workshop handoff",
    'id="next-day-retrieval"',
  ],
  "meaning transparency, tense and agreement, practical terminology, three object patterns, context-selected polysemy, register, U.S. spoken form, listening, clarification, privacy, production, and retrieval should remain explicit",
);

if (errors.length) {
  console.error(`\nA2 editorial validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `A2 editorial validation passed for ${reviewedA2.length} reviewed-slice lessons: targeted form, meaning, use, discourse time, spoken-language, privacy, and retrieval contracts are intact${sourceOnly ? " in source" : " in source and rendered output"}.`,
);

function validateSourceContract(id, pattern, description) {
  const lesson = reviewedA2.find((entry) => entry.id === id);
  if (!lesson) {
    errors.push(`${id}: lesson is missing from the A2 reviewed slice`);
    return;
  }
  const source = readFileSync(path.join(projectRoot, lesson.source), "utf8");
  if (!pattern.test(source)) errors.push(`${id}: ${description}`);
}

function validateSourceTerms(id, terms, description) {
  const lesson = reviewedA2.find((entry) => entry.id === id);
  if (!lesson) {
    errors.push(`${id}: lesson is missing from the A2 reviewed slice`);
    return;
  }
  const source = readFileSync(path.join(projectRoot, lesson.source), "utf8");
  let offset = 0;
  for (const term of terms) {
    const next = source.indexOf(term, offset);
    if (next === -1) {
      errors.push(`${id}: ${description}; missing or out-of-order source term: ${term}`);
      return;
    }
    offset = next + term.length;
  }
}
