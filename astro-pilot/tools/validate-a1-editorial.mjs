import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const reviewedA1 = readyLessons.filter((lesson) => lesson.level === "A1" && lesson.qualityReview);

if (reviewedA1.length !== 20) {
  errors.push(`expected 20 A1 lessons with canonical review evidence, found ${reviewedA1.length}`);
}

for (const lesson of reviewedA1) {
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
  "a1/present-simple",
  /data-core-duration="45–55 min"[\s\S]*id="next-day-retrieval" data-lesson-extension="Five-minute next-day retrieval"/,
  "core timing and later retrieval should remain explicit",
);
validateSourceContract(
  "a1/present-continuous",
  /open situation viewed from inside[\s\S]*final syllable is unstressed[\s\S]*visiting · opening · snowing · fixing[\s\S]*be → being[\s\S]*future arrangement[\s\S]*people have organized it[\s\S]*State or action\? Meaning comes first[\s\S]*I have a car[\s\S]*I'm having lunch[\s\S]*data-lesson-extension="Tutor-read present-simple and present-continuous listening check"[\s\S]*never need to show your camera[\s\S]*id="next-day-retrieval"/,
  "open-viewpoint meaning, future-use boundary, spelling conditions, state/action contrast, listening, privacy, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/there-is-there-are",
  /data-core-duration="45–55 minutes"[\s\S]*introduce something into the scene[\s\S]*New thing or known thing\?[\s\S]*normally writes[\s\S]*there are[\s\S]*data-lesson-extension="Tutor-read there is and there are listening check"[\s\S]*There aren’t any seats[\s\S]*There are no seats[\s\S]*never need to describe your actual home[\s\S]*Final production: recommend one neighborhood[\s\S]*id="next-day-retrieval"/,
  "introduction meaning, known-information contrast, spoken plural form, quantity boundary, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/have-got",
  /data-core-duration="45–55 minutes"[\s\S]*Get to the root: a present connection[\s\S]*neutral U\.S\. English[\s\S]*Have you got a car\?[\s\S]*Do you have a car\?[\s\S]*Sound natural: contractions, linking, and focus[\s\S]*Possession is not an activity[\s\S]*Present possession, past possession, and U\.S\.[\s\S]*have gotten[\s\S]*data-lesson-extension="Tutor-read have got and ordinary have listening check"[\s\S]*never need to disclose your possessions[\s\S]*Final production: prepare a first-day resource kit[\s\S]*id="next-day-retrieval"/,
  "present-connection meaning, neutral U.S. alternative, activity and tense boundaries, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/can-for-ability-and-permission",
  /data-core-duration="45–55 minutes"[\s\S]*Get to the root: one idea, four everyday uses[\s\S]*present possibility[\s\S]*Ability or this situation\?[\s\S]*Keep the time boundary clear[\s\S]*could swim when I was five[\s\S]*Permission, requests, and politeness[\s\S]*Sound natural: can or can’t in U\.S\. English\?[\s\S]*final <span class="ex">t<\/span> may be light or unreleased[\s\S]*data-lesson-extension="Tutor-read can meaning and spoken-contrast listening check"[\s\S]*never need to disclose your real skills[\s\S]*Final production: run a fictional community-center help desk[\s\S]*id="next-day-retrieval"/,
  "ability and situational-possibility contrast, time boundary, social response, U.S. spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/adverbs-of-frequency",
  /data-core-duration="45–55 minutes"[\s\S]*pattern across repeated occasions[\s\S]*percentages are memory aids, not measurements[\s\S]*the adverb stays near the verb[\s\S]*a modal[\s\S]*negative do[\s\S]*Sometimes[\s\S]*[Ff]ront, middle, and end positions[\s\S]*Not always[\s\S]*not <em>never<\/em>[\s\S]*Sound natural: stress the message[\s\S]*YOO-zhuh-lee[\s\S]*How often[\s\S]*data-lesson-extension="Tutor-read frequency placement and spoken-rhythm listening check"[\s\S]*never need to disclose your real routine[\s\S]*Final production: present a fictional weekly service report[\s\S]*id="next-day-retrieval"/,
  "evidence-based frequency meaning, ordinary-verb, be, modal, negative and question placement, flexible sometimes, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/prepositions-of-time-and-place",
  /data-core-duration="45–55 minutes"[\s\S]*useful starting rule, but English also has conventional chunks[\s\S]*thinking tool, not a complete law[\s\S]*Three conventional time chunks[\s\S]*Use no time preposition before[\s\S]*Street line or exact address\?[\s\S]*at 245 Oak Street[\s\S]*Transportation chunks in U\.S\. English[\s\S]*on a bus, on a train, on a plane[\s\S]*Same noun, different picture[\s\S]*at school \/ in school[\s\S]*on time \/ in time[\s\S]*Sound natural: keep the preposition light[\s\S]*at-eight[\s\S]*data-lesson-extension="Tutor-read time, address, and transportation listening check"[\s\S]*never need to disclose your real address[\s\S]*Final production: plan a fictional community event[\s\S]*id="next-day-retrieval"/,
  "time and place frames, fixed and zero-preposition chunks, U.S. address, institution and transport contrasts, spoken linking, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/some-any-with-countable-and-uncountable-nouns",
  /data-core-duration="45–55 minutes"[\s\S]*Countability is not only about the real object[\s\S]*One countable thing needs a singular marker[\s\S]*speaker’s orientation[\s\S]*polite exception: offers and requests[\s\S]*There isn’t any milk[\s\S]*There is no milk[\s\S]*Any seat is fine[\s\S]*Unstressed[\s\S]*some-rice[\s\S]*data-lesson-extension="Tutor-read some and any meaning and rhythm check"[\s\S]*never need to disclose your real home[\s\S]*Final production: prepare a fictional community workshop[\s\S]*id="next-day-retrieval"/,
  "countability viewpoint, singular-unit and quantity-meaning system, offer/request, zero and free-choice boundaries, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/object-pronouns",
  /data-core-duration="45–55 minutes"[\s\S]*They \/ them[\s\S]*one person[\s\S]*roles inside the sentence[\s\S]*Same spelling, different job: her[\s\S]*Do not guess a pronoun from a person’s name or appearance[\s\S]*Different person or the same person\?[\s\S]*CALL<\/strong>-im[\s\S]*TELL<\/strong>-em[\s\S]*data-lesson-extension="Tutor-read object-pronoun role, reference, and linking check"[\s\S]*Send it to her[\s\S]*Send her it[\s\S]*never need to disclose your real family[\s\S]*Final production: coordinate a fictional community event[\s\S]*id="next-day-retrieval"/,
  "subject/object roles, explicit and singular reference, object/possessive and reflexive boundaries, pronoun placement, linked speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/imperatives",
  /data-core-duration="45–55 minutes"[\s\S]*ordinary imperative starts with the[\s\S]*base verb[\s\S]*ordinary imperative addresses you[\s\S]*Do not enter[\s\S]*When you is spoken[\s\S]*Grammar is simple; social meaning is not[\s\S]*does not automatically make every command appropriate[\s\S]*Can you…\?[\s\S]*compact beat \/doʊnt\/[\s\S]*light or unreleased[\s\S]*data-lesson-extension="Tutor-read imperative purpose, politeness, and intonation check"[\s\S]*apostrophe matters[\s\S]*Let me[\s\S]*first, next, then, after that, finally[\s\S]*never need to disclose your real home[\s\S]*Final production: orient a fictional conference visitor[\s\S]*id="next-day-retrieval"/,
  "base and negative forms, understood and explicit addressees, social-action and request choices, do not, let's and let me, U.S. spoken form, listening, sequencing, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/was-were",
  /data-core-duration="45–55 minutes"[\s\S]*Short answers repeat the matching past form[\s\S]*Pronouns and noun subjects[\s\S]*You<\/span> always takes[\s\S]*Questions: move was or were before the subject[\s\S]*ordinary action usually needs a past action verb[\s\S]*never needs the helper[\s\S]*do \/ did[\s\S]*There wasn’t[\s\S]*There weren’t[\s\S]*was\/were born[\s\S]*\/wəz\/[\s\S]*\/wɚ\/[\s\S]*data-lesson-extension="Tutor-read was and were agreement, polarity, and reduction check"[\s\S]*never need to disclose your real location[\s\S]*Final production: report the fictional skills fair[\s\S]*id="next-day-retrieval"/,
  "past-state meaning, pronoun and noun agreement, questions and short answers, action and did boundaries, there was/were, born, U.S. reductions, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/daily-routines-and-telling-the-time",
  /data-core-duration="45–55 minutes"[\s\S]*two ways to read the clock[\s\S]*common number style[\s\S]*eight oh five[\s\S]*Use[\s\S]*o’clock[\s\S]*only with an exact hour[\s\S]*A routine is a repeated pattern[\s\S]*wake up \/ get up[\s\S]*go home[\s\S]*get home[\s\S]*have breakfast, have lunch, have dinner[\s\S]*What time do \+ I\/you\/we\/they[\s\S]*What time does \+ he\/she\/it[\s\S]*does Maya starts[\s\S]*ends \/s\/[\s\S]*end \/z\/[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read routine time, person, and connected-speech check"[\s\S]*never need to disclose your real sleep[\s\S]*Final production: present Maya’s two-day routine[\s\S]*id="next-day-retrieval"/i,
  "U.S. number and past/to clock styles, exact-hour boundary, routine meaning and sequence, chunk contrasts, question and third-person forms, spoken endings, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/jobs-and-workplaces",
  /data-core-duration="45–55 minutes"[\s\S]*four kinds of work information[\s\S]*What do you do\?[\s\S]*Where do you work\?[\s\S]*Who do you work for\?[\s\S]*What do you do at work\?[\s\S]*work from home[\s\S]*At and in can overlap[\s\S]*a university student[\s\S]*cook[\s\S]*chef[\s\S]*works[\s\S]*ends with \/s\/[\s\S]*teaches[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read role, workplace, employer, department, and remote-work listening check"[\s\S]*never need to disclose your real job[\s\S]*Final production: introduce a fictional community-center team for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "role, workplace, employer and responsibility questions, article and at/in boundaries, U.S. lexical and spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/food-and-drink",
  /data-core-duration="45–55 minutes"[\s\S]*countability is a language viewpoint[\s\S]*The same food can enter different frames[\s\S]*some coffee[\s\S]*a coffee[\s\S]*a cup of coffee[\s\S]*Pluralize the unit, not the amount noun[\s\S]*I like \+ food[\s\S]*I’d like \+ order[\s\S]*For here or to go\?[\s\S]*one syllable \/aɪd\/[\s\S]*sandwiches[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read preference, order, portion, amount, and U\.S\. service-choice listening check"[\s\S]*never need to disclose your real diet[\s\S]*Final production: run a fictional lunch-counter exchange for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "countability viewpoint, portion units, preference and request contrast, U.S. service language, connected speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/rooms-and-furniture",
  /data-core-duration="45–55 minutes"[\s\S]*four kinds of room information[\s\S]*locate a known thing[\s\S]*The room has[\s\S]*Furniture is uncountable[\s\S]*bathroom \/ restroom[\s\S]*closet \/ wardrobe[\s\S]*There is a lamp in the room[\s\S]*It is on the desk[\s\S]*next to \/ beside[\s\S]*In the front of the room[\s\S]*FUR<\/strong>-nuh-cher[\s\S]*there’s-a[\s\S]*couches[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read room category, new-information, known-location, and place-relation listening check"[\s\S]*never need to disclose your real home[\s\S]*Final production: present a fictional guest studio for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "object categories, uncountable furniture, information chain and room-feature viewpoints, U.S. room vocabulary, precise place boundaries, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/hobbies-and-free-time",
  /data-core-duration="45–55 minutes"[\s\S]*is uncountable:[\s\S]*Go plus -ing is not a general rule for every -ing word[\s\S]*play the guitar[\s\S]*watch TV[\s\S]*listen to music[\s\S]*avoids bare[\s\S]*do exercise[\s\S]*on weekends[\s\S]*Enjoy is different[\s\S]*is not the same as ordinary[\s\S]*Are you free this Saturday\?[\s\S]*whaddaya[\s\S]*pho-<strong>TOG<\/strong>-ra-phy[\s\S]*watches[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read routine, preference, ability, present-interest, question-purpose, and availability listening check"[\s\S]*never need to disclose your real interests[\s\S]*Final production: recommend two fictional community-center activities for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "fixed and independent activity chunks, like/enjoy/can/would-like meaning boundaries, question purposes, U.S. usage, spelling, connected speech, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/clothes-and-shopping",
  /data-core-duration="45–55 minutes"[\s\S]*Clothes[\s\S]*plural word[\s\S]*Clothing[\s\S]*uncountable[\s\S]*This pair of jeans is[\s\S]*The noun controls the chain[\s\S]*Can I try them on\?[\s\S]*Two kinds of plural are not the same[\s\S]*Four clothing actions[\s\S]*wear[\s\S]*put on[\s\S]*take off[\s\S]*try on[\s\S]*Size, fit, and sale do different jobs[\s\S]*on sale[\s\S]*For sale[\s\S]*U\.S\. clothing words[\s\S]*pants[\s\S]*trousers[\s\S]*Clothes<\/span> is normally one syllable[\s\S]*sizes[\s\S]*final syllable \/ɪz\/[\s\S]*data-lesson-extension="Tutor-read item number, distance, try-on pronoun, and sale-meaning listening check"[\s\S]*never need to disclose your real clothes[\s\S]*Final production: help a fictional customer compare two items for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "clothing noun systems, pair agreement, demonstrative and pronoun chains, shopping actions, size and fit, sale meanings, U.S. usage, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/weather-and-seasons",
  /data-core-duration="45–55 minutes"[\s\S]*Weather<\/span> describes conditions over a short time[\s\S]*Climate<\/span> describes patterns observed over many years[\s\S]*A forecast and a live camera[\s\S]*Get to the root: noun, adjective, or event[\s\S]*does not point to an object[\s\S]*Do not add -ing to every weather noun[\s\S]*The sun is shining[\s\S]*The wind is blowing[\s\S]*some lightning and thunder[\s\S]*Ask for the information you need[\s\S]*What’s X like\?[\s\S]*Always make the unit clear across countries[\s\S]*72 degrees Fahrenheit[\s\S]*22 degrees Celsius[\s\S]*A chance is not a promise[\s\S]*Seasons depend on place and system[\s\S]*Northern Hemisphere[\s\S]*Southern Hemisphere[\s\S]*wet and dry seasons[\s\S]*next spring[\s\S]*American English commonly uses[\s\S]*fall[\s\S]*What’s-the[\s\S]*TEM<\/strong>-pruh-cher[\s\S]*FAIR<\/strong>-en-height[\s\S]*SEL<\/strong>-see-us[\s\S]*data-lesson-extension="Tutor-read condition, event, forecast-label, probability, and hemisphere listening check"[\s\S]*never need to disclose your real location[\s\S]*Final production: give a fictional community weather bulletin for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "weather and climate scope, word families, dummy it, current and forecast viewpoints, questions, temperature units, probability, global season systems, U.S. usage, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/common-verbs-and-adjectives",
  /data-core-duration="45–55 minutes"[\s\S]*A common word is not automatically an easy word[\s\S]*Notice the whole light-verb chunk[\s\S]*Get to the root: light verbs carry the grammar[\s\S]*rough tendency, not a law[\s\S]*Take the bus[\s\S]*ride the bus[\s\S]*Go by bus[\s\S]*Take a shower[\s\S]*do some exercises[\s\S]*Ordinary verbs need the right complement[\s\S]*listen to an update[\s\S]*speak English[\s\S]*speak to the coordinator[\s\S]*buy a ticket[\s\S]*pay for the ticket[\s\S]*Keep the present-simple form around the chunk[\s\S]*doesn’t make[\s\S]*Adjectives need a position and a viewpoint[\s\S]*two expensive tickets[\s\S]*Common adjective meanings are not automatic labels[\s\S]*Cheap[\s\S]*Inexpensive[\s\S]*The workshop is free[\s\S]*Thing or person: boring \/ bored[\s\S]*Very and too are not the same[\s\S]*DUZ[\s\S]*data-lesson-extension="Tutor-read light-verb viewpoint, free meaning, and thing-person adjective listening check"[\s\S]*Maya is free at three[\s\S]*never need to disclose your real routine[\s\S]*Final production: give a fictional community-center shift briefing for 45–60 seconds[\s\S]*id="next-day-retrieval"/i,
  "whole verb chunks, light-verb tendency boundaries, U.S. usage, ordinary complement patterns, present-simple form, adjective grammar and nuance, spoken form, listening, privacy, production, and retrieval should remain explicit",
);
validateSourceContract(
  "a1/definite-and-zero-article",
  /data-core-duration="45–55 minutes"[\s\S]*Can my listener identify[\s\S]*general plural or uncountable noun[\s\S]*have breakfast \/ lunch \/ dinner[\s\S]*by bus \/ train \/ car \/ plane[\s\S]*go to work \/ school \/ bed[\s\S]*Sound natural: keep <em>the<\/em> light and linked[\s\S]*data-lesson-extension="Tutor-read identifiable, general, and fixed-chunk listening check"[\s\S]*Final production: give Leila’s first-day update[\s\S]*never need to disclose your real workplace[\s\S]*id="next-day-retrieval"/i,
  "known reference, general plurals and uncountables, fixed daily chunks, transfer repair, spoken form, tutor-read listening, privacy, production, and retrieval should remain explicit",
);

if (errors.length) {
  console.error(`\nA1 editorial validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `A1 editorial validation passed for ${reviewedA1.length} reviewed-slice lessons: targeted form, meaning, use, spoken-language, privacy, and retrieval contracts are intact${sourceOnly ? " in source" : " in source and rendered output"}.`,
);

function validateSourceContract(id, pattern, description) {
  const lesson = reviewedA1.find((entry) => entry.id === id);
  if (!lesson) {
    errors.push(`${id}: lesson is missing from the A1 reviewed slice`);
    return;
  }
  const source = readFileSync(path.join(projectRoot, lesson.source), "utf8");
  if (!pattern.test(source)) errors.push(`${id}: ${description}`);
}
