import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const a0Lessons = readyLessons.filter((lesson) => lesson.level === "A0");

if (a0Lessons.length !== 16) {
  errors.push(`expected 16 ready A0 lessons, found ${a0Lessons.length}`);
}

for (const lesson of a0Lessons) {
  const sourcePath = path.join(projectRoot, lesson.source);
  const source = readFileSync(sourcePath, "utf8");
  validateLearnerText(lesson.id, source, "source");

  for (const [label, pattern] of [
    ["teacher-facing standfirst", /\bLearners notice\b/i],
    ["teacher-only note heading", />Teaching move</i],
    ["third-person reveal instruction", /Reveal after student answers/i],
    ["third-person writing instruction", /\blearners write\b/i],
    ["objectifying family question", /Who does Diego belong to/i],
    ["incorrect alphabet rhyme claim", /rhymes with <b>egg<\/b>/i],
    ["incorrect beige rhyme claim", /beige[\s\S]{0,160}rhymes with [“\"]page/i],
  ]) {
    if (pattern.test(source)) errors.push(`${lesson.id}: ${label} remains in source`);
  }

  if (!sourceOnly) {
    const output = path.join(outputRoot, lesson.route.replace(/^\//, ""), "index.html");
    if (!existsSync(output)) {
      errors.push(`${lesson.id}: rendered lesson output is missing`);
      continue;
    }
    const html = readFileSync(output, "utf8");
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
    if (!main) {
      errors.push(`${lesson.id}: rendered learner content has no main landmark`);
      continue;
    }
    validateLearnerText(lesson.id, main, "rendered learner content");
  }
}

validateSourceContract(
  "a0/animals",
  /Vocabulary · Lesson \{page\.sequence\}/,
  "lesson sequence label should derive from canonical metadata",
);
validateSourceContract(
  "a0/countries-and-nationalities",
  /Vocabulary · Lesson \{page\.sequence\}/,
  "lesson sequence label should derive from canonical metadata",
);
validateSourceContract(
  "a0/the-alphabet-and-spelling",
  /begins with the vowel sound in <b>egg<\/b>[\s\S]*many other English varieties[\s\S]*no single universal clue-word list[\s\S]*data-lesson-extension="Tutor-read letter-name listening check"[\s\S]*Do not share real contact information[\s\S]*id="next-day-retrieval"/,
  "letter-name sound scope, English-variety boundary, clue words, listening, privacy, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/days-months-dates",
  /Common U\.S\. writing[\s\S]*same numbers may mean August 3[\s\S]*What day is it today\?[\s\S]*What's the date today\?[\s\S]*See you tomorrow[\s\S]*data-lesson-extension="Tutor-read day and date listening check"[\s\S]*you do not need to share your real birth date[\s\S]*id="next-day-retrieval"/,
  "written/spoken date scope, international ambiguity, day/date meaning, zero preposition, listening, privacy, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/colours-and-basic-adjectives",
  /descriptive adjective does not change[\s\S]*Color helps identify; it should not be the only clue[\s\S]*U\.S\. spelling <span class="ex">gray<\/span>[\s\S]*Inexpensive[\s\S]*soft final sound in vision[\s\S]*data-lesson-extension="Tutor-read color and adjective listening check"[\s\S]*you do not need to describe your possessions[\s\S]*id="next-day-retrieval"/,
  "adjective scope, inclusive color identification, U.S. spelling, price register, pronunciation, listening, privacy, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/family-members",
  /specific words such as[\s\S]*neutral words such as[\s\S]*appearance does not tell you their family role[\s\S]*A family may have one parent, two parents, or another structure[\s\S]*data-lesson-extension="Tutor-read family relationship listening check"[\s\S]*does not mean Omar owns a person[\s\S]*you do not need to share real names[\s\S]*id="next-day-retrieval"/,
  "specific and neutral relationship words, varied structures, appearance boundary, non-ownership meaning, listening, privacy, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/classroom-objects",
  /Regular countable object words add[\s\S]*After <span class="ex">one<\/span>, use the singular[\s\S]*a paper clip[\s\S]*Three object words need a different pattern[\s\S]*two mice[\s\S]*standard U\.S\. English[\s\S]*data-lesson-extension="Tutor-read classroom object and instruction listening check"[\s\S]*Ask for the object or for help[\s\S]*you do not need to show your real desk[\s\S]*id="next-day-retrieval"/,
  "number scope, paper/scissors/mouse boundaries, U.S. compound form, listening, clarification, access, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/animals",
  /zero or a number greater than one[\s\S]*two <b>mice<\/b>[\s\S]*two <b>octopuses<\/b>[\s\S]*relationship with people and its situation[\s\S]*not <span class="ex">a wildlife<\/span>[\s\S]*scientific or specialized contexts[\s\S]*data-lesson-extension="Tutor-read singular and plural animal listening check"[\s\S]*adult male is a large wild cat with a mane[\s\S]*A hen is an adult female[\s\S]*never need to share information about your home[\s\S]*safe distance[\s\S]*id="next-day-retrieval"/,
  "number and fish/fishes scope, special plurals, contextual categories, factual clues, listening, privacy, safety, and retrieval should remain explicit",
);
validateSourceContract(
  "a0/countries-and-nationalities",
  /nationality adjective[\s\S]*flag does not prove a person's nationality[\s\S]*Some nationality words can also be person nouns[\s\S]*one fact does not prove the others[\s\S]*Do not infer identity from a name, appearance, accent, or flag[\s\S]*the United States[\s\S]*the United Kingdom[\s\S]*British[\s\S]*English[\s\S]*The Americas[\s\S]*official country name used here is <span class="ex">Türkiye<\/span>[\s\S]*data-lesson-extension="Tutor-read country, nationality, and language listening check"[\s\S]*never need to share your nationality[\s\S]*id="next-day-retrieval"/i,
  "country, nationality adjective, language, person-word, article, identity, current naming, listening, privacy, and retrieval boundaries should remain explicit",
);
validateSourceContract(
  "a0/the-verb-to-be",
  /Are you ready\? Yes, I ___\./,
  "positive short-answer quiz should include its question context",
);
validateSourceContract(
  "a0/possessive-adjectives",
  /The company has a new logo\.[\s\S]*data-answer="its"/,
  "its should be practiced in a contextualized choice gap",
);
validateSourceContract(
  "a0/greetings-and-introductions",
  /Use <span class="ex">Good evening<\/span> when you arrive[\s\S]*Use <span class="ex">Good night<\/span> when you leave[\s\S]*U\.S\. workplaces vary[\s\S]*Nice to meet you<\/span> when you meet someone for the first time[\s\S]*Optional tutor-read greeting-purpose listening[\s\S]*id="next-day-retrieval"/,
  "arrival/leaving, workplace register, first/later meetings, tutor-read listening, and next-day retrieval should remain explicit",
);
validateSourceContract(
  "a0/regular-plural-nouns",
  /zero clients[\s\S]*person → people[\s\S]*Optional tutor-read plural-ending listening[\s\S]*id="next-day-retrieval"/,
  "plural number scope, irregular boundary, tutor-read pronunciation, and next-day retrieval should remain explicit",
);
validateSourceContract(
  "a0/cardinal-numbers-0-100",
  /read one digit at a time[\s\S]*commonly say <span class="ex">oh<\/span>[\s\S]*ordinal numbers[\s\S]*Optional tutor-read -teen and -ty listening[\s\S]*id="next-day-retrieval"/,
  "number-use boundaries, zero/oh phone reading, cardinal/ordinal scope, tutor-read listening, and next-day retrieval should remain explicit",
);

if (errors.length) {
  console.error(`\nA0 editorial validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `A0 editorial validation passed for ${a0Lessons.length} lessons: learner-facing punctuation, targeted language corrections, lesson order, and contextualized answer contracts are intact${sourceOnly ? " in source" : " in source and rendered output"}.`,
);

function validateLearnerText(id, value, label) {
  if (value.includes("—")) {
    errors.push(`${id}: prohibited em dash remains in ${label}`);
  }
}

function validateSourceContract(id, pattern, description) {
  const lesson = a0Lessons.find((entry) => entry.id === id);
  if (!lesson) {
    errors.push(`${id}: lesson is missing from the ready catalog`);
    return;
  }
  const source = readFileSync(path.join(projectRoot, lesson.source), "utf8");
  if (!pattern.test(source)) errors.push(`${id}: ${description}`);
}
