import { getLesson } from "./lesson-catalog.mjs";
import { LESSON_LEVELS } from "./lesson-schema.mjs";

export const TRANSFER_CATEGORIES = Object.freeze([
  "Grammar",
  "Word order",
  "Meaning",
  "Collocation",
  "Tense and aspect",
  "Discourse",
]);

const records = [
  {
    slug: "spanish",
    name: "Spanish",
    note: "Spanish and English share a large amount of vocabulary, but they package subjects, auxiliaries, time, and common meanings differently. Use the similarities for speed and the contrasts for precision.",
    principle: "Do not translate the Spanish word alone. First identify its job in the complete message, then choose the English structure that performs that job.",
    patterns: [
      {
        id: "age-with-be",
        level: "A0",
        category: "Grammar",
        sourcePattern: "tener + age",
        title: "English describes age with be",
        listenFor: "I have 30 years.",
        rebuild: "I’m 30.",
        explanation: "Spanish treats age as something a person has. English treats age as a current description, so the changing verb is be: I am, she is, and they are.",
        examples: ["My sister is 28, and I’m 31.", "How old is your manager?"],
        tutorMove: "Ask about three real people, change the subject each time, and make the learner choose am, is, or are before saying the age.",
        lessonIds: ["a0/the-verb-to-be"],
      },
      {
        id: "explicit-subjects",
        level: "A0",
        category: "Word order",
        sourcePattern: "subject understood from the verb",
        title: "Keep the English subject visible",
        listenFor: "Works in finance.",
        rebuild: "She works in finance.",
        explanation: "Spanish verb endings often make the subject recoverable. English verb forms carry less person information, so a normal statement usually needs an explicit subject such as I, she, they, or it.",
        examples: ["He lives near the office.", "It starts at nine."],
        tutorMove: "Give five short Spanish-style subjectless ideas and ask who or what each sentence is about before the learner builds the English sentence.",
        lessonIds: ["a0/subject-pronouns", "a1/present-simple"],
      },
      {
        id: "do-support",
        level: "A1",
        category: "Grammar",
        sourcePattern: "no before a verb; questions by inversion or intonation",
        title: "Use do to carry questions and negatives",
        listenFor: "You work here? / I no work Fridays.",
        rebuild: "Do you work here? / I don’t work Fridays.",
        explanation: "Spanish can negate a lexical verb directly and forms many questions without a separate helper. In the English present simple, do or does carries the question or negative grammar while the main verb returns to its base form.",
        examples: ["Does Ana drive to work?", "We don’t open on Sundays."],
        tutorMove: "Start with one true statement, then transform it rapidly into a yes/no question, a negative, and a wh-question without changing the main verb.",
        lessonIds: ["a1/present-simple", "a0/question-words-what-where-who-how"],
      },
      {
        id: "por-para-map",
        level: "A1",
        category: "Meaning",
        sourcePattern: "por / para",
        title: "Choose the relationship, not one translation",
        listenFor: "I sent it for email. / I stayed for the rain.",
        rebuild: "I sent it by email. / I stayed because of the rain.",
        explanation: "Spanish por and para cover several relationships that English divides among for, to, by, through, because of, and other phrases. The useful question is whether the message expresses purpose, recipient, method, duration, exchange, route, or cause.",
        examples: ["I bought this for my colleague.", "We traveled by train because of the weather."],
        tutorMove: "Sort real examples into purpose, recipient, method, duration, and cause; only then ask the learner to choose the English preposition or phrase.",
        lessonIds: ["a1/prepositions-of-time-and-place", "a2/travel-and-transport"],
      },
      {
        id: "know-meet-recognize",
        level: "A1",
        category: "Meaning",
        sourcePattern: "conocer / saber",
        title: "Separate know, meet, and know how",
        listenFor: "I knew her for the first time yesterday. / I know to cook.",
        rebuild: "I met her for the first time yesterday. / I know how to cook.",
        explanation: "Conocer and saber do not divide meaning exactly like English. Know can describe existing familiarity or knowledge, meet marks a first encounter, and know how to introduces an ability learned through knowledge.",
        examples: ["Do you know our new director?", "I met him at a conference last week."],
        tutorMove: "Ask about one familiar person, one first meeting, one fact, and one learned skill so the learner must choose a different English frame each time.",
        lessonIds: ["a1/common-verbs-and-adjectives", "a2/past-simple"],
      },
      {
        id: "ser-estar-choices",
        level: "A2",
        category: "Meaning",
        sourcePattern: "ser / estar",
        title: "Let the complement choose the English pattern",
        listenFor: "I am agree. / She is married with a doctor.",
        rebuild: "I agree. / She is married to a doctor.",
        explanation: "English be covers many ser and estar meanings, but some Spanish adjective expressions correspond to English verbs or fixed chunks. Decide whether English needs identity, state, location, a current action, or a lexical verb such as agree.",
        examples: ["She is tired, but she is working.", "I agree with your main point."],
        tutorMove: "Present identity, temporary state, location, current action, and opinion examples; ask the learner to name the job before choosing be or another verb.",
        lessonIds: ["a1/common-verbs-and-adjectives", "a1/prepositions-of-time-and-place"],
      },
      {
        id: "finished-time-past",
        level: "A2",
        category: "Tense and aspect",
        sourcePattern: "recent past expressed with a perfect form",
        title: "A finished time normally selects past simple",
        listenFor: "I have sent it yesterday.",
        rebuild: "I sent it yesterday.",
        explanation: "Present-perfect use varies across Spanish-speaking regions, but English strongly separates a finished past time from an unfinished connection to now. Yesterday, last week, and in 2024 normally anchor the past simple.",
        examples: ["We signed the contract last Friday.", "I’ve already sent the contract, so you can check it now."],
        tutorMove: "Contrast one finished-time sentence with one present-result sentence, then remove the verb and make the learner use the time phrase as the deciding evidence.",
        lessonIds: ["a2/past-simple", "a2/present-perfect"],
      },
      {
        id: "false-friend-check",
        level: "B1",
        category: "Meaning",
        sourcePattern: "familiar-looking Latin words",
        title: "Verify cognates by meaning and collocation",
        listenFor: "I assisted the meeting. / I’m actually working in Bogotá.",
        rebuild: "I attended the meeting. / I currently work in Bogotá.",
        explanation: "English and Spanish share many Latin-based words, which makes reading faster but can also invite false friends. A word is not fully known until its meaning, grammar pattern, register, and frequent partners all fit the message.",
        examples: ["I attended a lecture about public health.", "She was embarrassed by the mistake."],
        tutorMove: "Use a short set such as attend, assist, actually, currently, realize, and carry out; make the learner explain the meaning before completing a natural chunk.",
        lessonIds: ["b1/collocations-and-word-families", "b2/connotation-and-shades-of-meaning"],
      },
    ],
  },
  {
    slug: "portuguese",
    name: "Portuguese",
    note: "Portuguese offers many helpful cognates and familiar tense ideas, yet English divides several high-frequency verbs, prepositions, and question patterns more explicitly.",
    principle: "When one Portuguese word has several natural English outcomes, build a meaning map rather than memorizing one permanent translation.",
    patterns: [
      {
        id: "age-with-be",
        level: "A0",
        category: "Grammar",
        sourcePattern: "ter + age",
        title: "Use be—not have—for age",
        listenFor: "I have 25 years.",
        rebuild: "I’m 25.",
        explanation: "Portuguese expresses age with ter, literally have. English makes age a description with be, so the verb agrees with the person: I am 25, he is 25, and they are 25.",
        examples: ["My parents are both 62.", "How old were you when you moved?"],
        tutorMove: "Move from present ages to a past age and a future birthday so the learner practices am, is, are, was, were, and will be around one stable meaning.",
        lessonIds: ["a0/the-verb-to-be", "a1/was-were"],
      },
      {
        id: "explicit-subjects",
        level: "A0",
        category: "Word order",
        sourcePattern: "subject omitted when context or conjugation is clear",
        title: "Name the English subject",
        listenFor: "Is very important.",
        rebuild: "It is very important.",
        explanation: "Portuguese can omit a subject in contexts where the verb form or conversation makes it clear. Standard English usually needs the subject expressed, including dummy it for weather, time, distance, and evaluations.",
        examples: ["It is raining again.", "She works with international clients."],
        tutorMove: "Mix people, things, weather, and time prompts; before completing the sentence, require the learner to choose the visible English subject.",
        lessonIds: ["a0/subject-pronouns", "a0/the-verb-to-be"],
      },
      {
        id: "question-auxiliaries",
        level: "A1",
        category: "Grammar",
        sourcePattern: "statement order plus question intonation",
        title: "Build the English question frame",
        listenFor: "You like your job? / Where she went?",
        rebuild: "Do you like your job? / Where did she go?",
        explanation: "Brazilian Portuguese can often mark a question through intonation while keeping statement order. English normally signals the question grammatically with do, be, have, or a modal before the subject.",
        examples: ["Does this train stop downtown?", "Where did you buy that laptop?"],
        tutorMove: "Give a statement and a question word, then make the learner select the helper, place it before the subject, and return the main verb to its base form.",
        lessonIds: ["a1/present-simple", "a2/past-simple"],
      },
      {
        id: "ficar-map",
        level: "A2",
        category: "Meaning",
        sourcePattern: "ficar",
        title: "Map ficar by result, location, or arrangement",
        listenFor: "I stayed nervous. / The office stays downtown.",
        rebuild: "I got nervous. / The office is downtown.",
        explanation: "Ficar can express remaining, becoming, location, a resulting state, or an arrangement. English distributes those meanings across stay, be, get, become, end up, and phrases such as be located or agree to meet.",
        examples: ["We stayed at a small hotel.", "She became more confident after the course."],
        tutorMove: "Ask what changed, what remained, where something is, or what people arranged; the answer to that question selects the English verb.",
        lessonIds: ["a1/common-verbs-and-adjectives", "a2/feelings-and-personality"],
      },
      {
        id: "fazer-map",
        level: "A2",
        category: "Collocation",
        sourcePattern: "fazer",
        title: "Learn make, do, and ask as chunks",
        listenFor: "I made my homework. / She did a question.",
        rebuild: "I did my homework. / She asked a question.",
        explanation: "Portuguese fazer covers work, creation, causation, weather, elapsed time, and many fixed expressions. English uses several verbs, and the most reliable unit is the whole collocation rather than an abstract make-versus-do rule.",
        examples: ["We made a difficult decision.", "Could I ask you a quick question?"],
        tutorMove: "Sort useful noun chunks under make, do, take, and ask, then personalize five of them in complete sentences about the learner’s week.",
        lessonIds: ["a1/common-verbs-and-adjectives", "b1/collocations-and-word-families"],
      },
      {
        id: "saudade-miss-map",
        level: "B1",
        category: "Meaning",
        sourcePattern: "saudade / sentir falta",
        title: "Choose what kind of absence miss expresses",
        listenFor: "I have saudade of home. / I lost the meeting.",
        rebuild: "I miss home. / I missed the meeting.",
        explanation: "English miss can express emotional absence, failure to attend or catch something, failure to notice, or narrowly avoiding an event. Miss out on adds the idea of losing an opportunity or experience.",
        examples: ["I miss my friends back home.", "We missed out on the early-booking discount."],
        tutorMove: "Contrast a person, a train, a detail, and an opportunity; ask the learner to build the correct miss pattern and explain which meaning is active.",
        lessonIds: ["b1/relationships", "b1/collocations-and-word-families"],
      },
      {
        id: "preposition-collocations",
        level: "A2",
        category: "Collocation",
        sourcePattern: "Portuguese preposition carried into an English chunk",
        title: "Store the English verb and preposition together",
        listenFor: "It depends of the price. / I’m married with Ana.",
        rebuild: "It depends on the price. / I’m married to Ana.",
        explanation: "Prepositions rarely align word for word across languages. In English, many choices belong to a lexical chunk—depend on, interested in, responsible for, married to—so the verb or adjective should be learned with its partner.",
        examples: ["Who is responsible for this account?", "The result depends on the final interview."],
        tutorMove: "Remove only the preposition from six personally relevant chunks, then ask the learner to recall and extend each complete phrase in a new sentence.",
        lessonIds: ["a1/prepositions-of-time-and-place", "b1/collocations-and-word-families"],
      },
      {
        id: "unreal-if-past",
        level: "B1",
        category: "Tense and aspect",
        sourcePattern: "present-shaped condition for an unreal situation",
        title: "Use past form to signal present distance",
        listenFor: "If I have more time, I would study more.",
        rebuild: "If I had more time, I would study more.",
        explanation: "Portuguese and English do not signal hypothetical distance in exactly the same way. In an English second conditional, the past form in the if-clause marks the situation as unreal or remote now; it does not locate the situation in past time.",
        examples: ["If I worked remotely, I would travel more.", "What would you change if you were the manager?"],
        tutorMove: "Contrast one realistic future condition with one imaginary present condition, and make the learner explain whether the speaker sees it as open or remote.",
        lessonIds: ["a2/first-conditional", "b1/second-conditional"],
      },
      {
        id: "false-friend-intention",
        level: "B2",
        category: "Meaning",
        sourcePattern: "pretender and other familiar-looking words",
        title: "Check the intended action behind a cognate",
        listenFor: "I pretend to apply next month.",
        rebuild: "I intend to apply next month.",
        explanation: "Portuguese and English share many recognizable roots, but a familiar form may have developed a different meaning. English pretend means act as if something false were true; intend describes a real plan or purpose.",
        examples: ["We intend to expand the service next year.", "He pretended not to recognize the reporter."],
        tutorMove: "Contrast intend, pretend, realize, carry out, assist, and attend through short scenarios; require a definition and a natural verb pattern before production.",
        lessonIds: ["b1/collocations-and-word-families", "b2/connotation-and-shades-of-meaning"],
      },
    ],
  },
  {
    slug: "turkish",
    name: "Turkish",
    note: "Turkish builds meaning through regular suffixes, flexible information order, and structures that can leave subjects or copulas implicit. English relies more heavily on separate helper words and a stable sentence frame.",
    principle: "First unpack the Turkish suffix or compressed structure into its meaning jobs; then rebuild those jobs with English subjects, auxiliaries, word order, and prepositions.",
    patterns: [
      {
        id: "article-signals",
        level: "A0",
        category: "Grammar",
        sourcePattern: "no direct a / an / the system",
        title: "Use articles as meaning signals",
        listenFor: "I bought new phone. / Sun is bright today.",
        rebuild: "I bought a new phone. / The sun is bright today.",
        explanation: "Turkish does not organize noun reference with the same article system. English uses a or an to introduce one non-specific countable thing and the when the listener can identify the intended thing.",
        examples: ["I need a charger for my laptop.", "The charger on your desk is mine."],
        tutorMove: "Use a real object first as new information and then mention it again; ask the learner to explain why the article changes from a to the.",
        lessonIds: ["a0/articles-a-an", "a0/this-that-these-those"],
      },
      {
        id: "copula-be",
        level: "A0",
        category: "Grammar",
        sourcePattern: "nominal or adjectival predicate carried by a suffix or zero form",
        title: "Make be audible in the English sentence",
        listenFor: "I ready. / My brother doctor.",
        rebuild: "I’m ready. / My brother is a doctor.",
        explanation: "Turkish can express identity and description without a separate word matching English be in the same position. English requires am, is, or are to connect the subject with a noun, adjective, or location.",
        examples: ["The client is ready now.", "My parents are in Ankara."],
        tutorMove: "Alternate identity, adjective, and location prompts while changing the subject; the learner must supply the correct be form before adding the complement.",
        lessonIds: ["a0/the-verb-to-be"],
      },
      {
        id: "explicit-subjects",
        level: "A0",
        category: "Word order",
        sourcePattern: "person encoded in the verb ending",
        title: "Keep the English subject in place",
        listenFor: "Am working today.",
        rebuild: "I’m working today.",
        explanation: "Turkish verb endings can identify the subject, which makes a separate pronoun unnecessary. English normally requires an overt subject even when the verb form or context makes the person obvious.",
        examples: ["We start at eight tomorrow.", "She is waiting outside."],
        tutorMove: "Give verb phrases with different people and require the learner to place the subject tile before choosing the matching verb form.",
        lessonIds: ["a0/subject-pronouns", "a1/present-continuous"],
      },
      {
        id: "svo-frame",
        level: "A1",
        category: "Word order",
        sourcePattern: "subject–object–verb as a neutral Turkish frame",
        title: "Anchor the English verb after the subject",
        listenFor: "I every morning my email check.",
        rebuild: "I check my email every morning.",
        explanation: "Neutral Turkish commonly places the verb at the end and allows constituents to move for information focus. A neutral English statement usually anchors subject–verb–object first, then places time and other details around that core.",
        examples: ["Our team reviews the figures every Friday.", "Yesterday, I called the supplier from my office."],
        tutorMove: "Color-code subject, verb, object, and extra information; keep the first three stable while moving only the time or place phrase.",
        lessonIds: ["a1/present-simple", "a2/past-time-expressions"],
      },
      {
        id: "question-helpers",
        level: "A1",
        category: "Grammar",
        sourcePattern: "question particle mı / mi / mu / mü",
        title: "Select an English auxiliary instead of one question particle",
        listenFor: "You coffee like? / She at home?",
        rebuild: "Do you like coffee? / Is she at home?",
        explanation: "Turkish has a highly regular question particle. English spreads that work across be, do, have, and modal verbs, and the correct helper depends on the verb phrase already present in the statement.",
        examples: ["Can you join the call?", "Did they send the invoice?"],
        tutorMove: "Show four statements built with be, a lexical verb, have, and can; ask the learner to identify the existing helper or add do before changing the word order.",
        lessonIds: ["a1/present-simple", "a1/can-for-ability-and-permission"],
      },
      {
        id: "var-yok-existence",
        level: "A1",
        category: "Grammar",
        sourcePattern: "var / yok",
        title: "Build existence with there is or there are",
        listenFor: "In the office two meeting rooms have.",
        rebuild: "There are two meeting rooms in the office.",
        explanation: "Turkish var and yok express existence or absence without matching English have word for word. English normally starts an existence statement with there is or there are, then names the thing and its location.",
        examples: ["There is a pharmacy near the station.", "There aren’t any empty tables."],
        tutorMove: "Use a room or neighborhood picture and contrast possession with existence: I have a desk, but there is a desk by the window.",
        lessonIds: ["a1/there-is-there-are", "a1/rooms-and-furniture"],
      },
      {
        id: "present-aspect-choice",
        level: "A1",
        category: "Tense and aspect",
        sourcePattern: "Turkish tense and aspect categories do not divide time exactly like English",
        title: "Choose routine, current scene, or temporary period",
        listenFor: "I am going to work every day. / Now I work from home.",
        rebuild: "I go to work every day. / Now I’m working from home.",
        explanation: "The English present simple presents routines, facts, and stable patterns; the present continuous opens a current or temporary scene. Turkish forms and usage do not map one to one, so time meaning must lead the choice.",
        examples: ["She usually takes the bus, but today she is driving.", "I’m staying with friends this month."],
        tutorMove: "Place routine, right-now, and temporary-period time cards beside the same verb; make the learner choose the aspect and explain the scene created.",
        lessonIds: ["a1/present-simple", "a1/present-continuous"],
      },
      {
        id: "case-to-preposition",
        level: "A2",
        category: "Meaning",
        sourcePattern: "case suffixes such as -de, -den, and -e",
        title: "Unpack a suffix into an English relationship",
        listenFor: "I arrived to the airport. / We discussed about the plan.",
        rebuild: "I arrived at the airport. / We discussed the plan.",
        explanation: "Turkish case suffixes package location, direction, source, and other relationships compactly. English may use at, in, on, to, from, or no preposition, and the governing verb often determines the natural pattern.",
        examples: ["She arrived in Mexico City on Monday.", "We discussed the budget during lunch."],
        tutorMove: "Start with the governing verb and ask whether the rest expresses location, direction, source, or a direct object; then retrieve the complete English chunk.",
        lessonIds: ["a1/prepositions-of-time-and-place", "b1/collocations-and-word-families"],
      },
      {
        id: "relative-clause-direction",
        level: "B1",
        category: "Word order",
        sourcePattern: "noun-modifying information before the noun",
        title: "Put the English relative clause after its noun",
        listenFor: "Yesterday met I woman is our new director.",
        rebuild: "The woman I met yesterday is our new director.",
        explanation: "Turkish can place substantial modifying information before the noun. English first names the noun and then adds a relative clause with who, that, which, where, or an omitted object relative pronoun.",
        examples: ["The report that you sent was very clear.", "The colleague who trained me now leads the team."],
        tutorMove: "Give the main noun first, then add one fact at a time after it; finally compare a subject relative pronoun that must stay with an object relative pronoun that may disappear.",
        lessonIds: ["b1/defining-relative-clauses", "b2/non-defining-relative-clauses"],
      },
      {
        id: "evidential-distance",
        level: "B2",
        category: "Discourse",
        sourcePattern: "reported or inferred past in -miş",
        title: "Express the source of knowledge explicitly",
        listenFor: "Apparently he came, but I saw him arrive.",
        rebuild: "Apparently he came. / I saw him arrive.",
        explanation: "Turkish can grammatically mark that past information is reported, inferred, or newly discovered. English has no single equivalent ending, so speakers choose evidence phrases and stance verbs such as apparently, reportedly, seems, must have, or I was told.",
        examples: ["The figures must have been copied from an older report.", "Apparently, the committee changed its decision overnight."],
        tutorMove: "Give the same event with direct observation, a colleague’s report, and an inference from evidence; require a different English stance frame for each source.",
        lessonIds: ["b1/reported-speech", "b2/modals-of-past-speculation"],
      },
    ],
  },
];

export const transferLanguages = defineTransferLanguages(records);

export function transferCounts() {
  const patterns = transferLanguages.flatMap((language) => language.patterns);
  return Object.freeze({
    languages: transferLanguages.length,
    patterns: patterns.length,
    lessons: new Set(patterns.flatMap((pattern) => pattern.lessons.map((lesson) => lesson.id))).size,
  });
}

function defineTransferLanguages(languages) {
  const errors = [];
  const languageSlugs = new Set();
  const patternKeys = new Set();
  const exactLanguageKeys = new Set(["slug", "name", "note", "principle", "patterns"]);
  const exactPatternKeys = new Set(["id", "level", "category", "sourcePattern", "title", "listenFor", "rebuild", "explanation", "examples", "tutorMove", "lessonIds"]);

  if (!Array.isArray(languages) || languages.length < 3) errors.push("at least three transfer languages are required");

  const resolved = languages.map((language, languageIndex) => {
    const source = `language ${languageIndex + 1}`;
    for (const key of Object.keys(language)) if (!exactLanguageKeys.has(key)) errors.push(`${source}: unknown field ${key}`);
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(language.slug || "")) errors.push(`${source}: slug must be lowercase words separated by hyphens`);
    if (languageSlugs.has(language.slug)) errors.push(`${source}: duplicate slug ${language.slug}`);
    languageSlugs.add(language.slug);
    for (const field of ["name", "note", "principle"]) {
      if (typeof language[field] !== "string" || language[field].trim().length < (field === "name" ? 3 : 80)) {
        errors.push(`${source}: ${field} is missing or too thin`);
      }
    }
    if (!Array.isArray(language.patterns) || language.patterns.length < 8) errors.push(`${source}: at least eight patterns are required`);

    const patterns = (language.patterns || []).map((pattern, patternIndex) => {
      const patternSource = `${language.slug || source} pattern ${patternIndex + 1}`;
      for (const key of Object.keys(pattern)) if (!exactPatternKeys.has(key)) errors.push(`${patternSource}: unknown field ${key}`);
      const patternKey = `${language.slug}/${pattern.id}`;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pattern.id || "")) errors.push(`${patternSource}: id must be lowercase words separated by hyphens`);
      if (patternKeys.has(patternKey)) errors.push(`${patternSource}: duplicate pattern id ${pattern.id}`);
      patternKeys.add(patternKey);
      if (!LESSON_LEVELS.includes(pattern.level)) errors.push(`${patternSource}: invalid CEFR level ${pattern.level}`);
      if (!TRANSFER_CATEGORIES.includes(pattern.category)) errors.push(`${patternSource}: invalid category ${pattern.category}`);
      for (const [field, minimum] of [["sourcePattern", 5], ["title", 12], ["listenFor", 8], ["rebuild", 5], ["explanation", 90], ["tutorMove", 70]]) {
        if (typeof pattern[field] !== "string" || pattern[field].trim().length < minimum) errors.push(`${patternSource}: ${field} is missing or too thin`);
      }
      if (pattern.listenFor === pattern.rebuild) errors.push(`${patternSource}: listenFor and rebuild must contrast`);
      if (!Array.isArray(pattern.examples) || pattern.examples.length < 2 || pattern.examples.some((example) => typeof example !== "string" || example.trim().length < 15)) {
        errors.push(`${patternSource}: at least two substantial natural examples are required`);
      }
      if (!Array.isArray(pattern.lessonIds) || pattern.lessonIds.length < 1 || pattern.lessonIds.length > 2) {
        errors.push(`${patternSource}: one or two lesson relationships are required`);
      }

      const lessons = (pattern.lessonIds || []).flatMap((lessonId) => {
        const lesson = getLesson(lessonId);
        if (!lesson) {
          errors.push(`${patternSource}: unknown lesson ${lessonId}`);
          return [];
        }
        if (lesson.status !== "ready") errors.push(`${patternSource}: lesson ${lessonId} is not available`);
        return [{ id: lesson.id, topic: lesson.topic, level: lesson.level, route: lesson.route }];
      });

      return Object.freeze({ ...pattern, examples: Object.freeze([...pattern.examples]), lessonIds: Object.freeze([...pattern.lessonIds]), lessons: Object.freeze(lessons) });
    });

    return Object.freeze({ ...language, patterns: Object.freeze(patterns) });
  });

  const representedLevels = new Set(resolved.flatMap((language) => language.patterns.map((pattern) => pattern.level)));
  for (const level of ["A0", "A1", "A2", "B1", "B2"]) {
    if (!representedLevels.has(level)) errors.push(`no language-transfer pattern represents ${level}`);
  }
  if (errors.length) throw new Error(`Invalid language-transfer registry\n- ${errors.join("\n- ")}`);
  return Object.freeze(resolved);
}
