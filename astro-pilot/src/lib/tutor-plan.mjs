import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const interactionPattern = "answer-drill|choice-gap-drill|tile-game|tile-builder|spot-error|transform|quiz";

export function buildTutorBrief(lesson, structuredLesson) {
  return structuredLesson
    ? fromStructuredLesson(structuredLesson)
    : fromNativeSource(lesson);
}

function fromStructuredLesson(content) {
  return {
    source: "structured",
    duration: content.duration,
    coreDuration: content.duration,
    extensionDuration: "",
    extensionTitles: [],
    outcome: content.outcome,
    principle: content.discover.principle,
    retrieval: content.retrieval.slice(0, 3),
    practiceTitles: unique([
      content.notice.title,
      content.builder.title,
      content.context.title,
      ...content.repairs.map((item) => item.title),
    ]).slice(0, 6),
    errors: content.discover.errors.slice(0, 3).map((item) => ({
      repair: item.correct,
      why: item.why,
    })),
    production: {
      title: content.communicate.title,
      setup: content.communicate.setup,
      prompts: content.communicate.prompts.slice(0, 4),
      success: content.communicate.success.slice(0, 4),
    },
    nextUse: content.reflect.nextUse,
    sectionHeadings: ["Retrieve", "Notice", "Discover", "Build", "Drill", "Communicate", "Reflect"],
  };
}

function fromNativeSource(lesson) {
  const sourcePath = path.resolve(projectRoot, lesson.source);
  if (!sourcePath.startsWith(path.join(projectRoot, "src", "content", "lessons") + path.sep)) {
    throw new Error(`${lesson.id}: tutor brief source escapes the native lesson directory`);
  }
  const source = readFileSync(sourcePath, "utf8");
  const prompts = [...source.matchAll(/<div\b[^>]*class="[^"]*\bprompt-card\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
  const nextUse = prompts.find((prompt) => /^next use:/i.test(prompt));
  const communicationPrompts = prompts.filter((prompt) => prompt !== nextUse);
  const interactiveErrors = [...source.matchAll(new RegExp(`<(?:div|article)\\b[^>]*\\bdata-spot-error\\b([^>]*)>`, "gi"))]
    .map((match) => ({
      repair: attribute(match[1], "data-fix"),
      why: attribute(match[1], "data-why"),
    }))
    .filter((item) => item.repair && item.why);
  const referenceErrors = [...source.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .filter((match) => /\bclass="[^"]*\bcross\b|<s\b/i.test(match[1]))
    .map((match) => {
      const wrong = cleanText(match[1].match(/<s\b[^>]*>([\s\S]*?)<\/s>/i)?.[1]);
      const repair = cleanText(match[1].match(/<span\b[^>]*class="[^"]*\bex\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
      const full = cleanText(match[1]);
      return {
        repair: repair || full,
        why: wrong
          ? `Replace “${wrong}” with the repaired form and ask the learner to explain the contrast.`
          : full,
      };
    })
    .filter((item) => item.repair && item.why);
  const errors = uniqueBy([...interactiveErrors, ...referenceErrors], (item) => item.repair);
  const practiceTitles = [...source.matchAll(new RegExp(
    `<div\\b[^>]*\\bdata-(?:${interactionPattern})\\b[^>]*>[\\s\\S]*?<h3\\b[^>]*>([\\s\\S]*?)<\\/h3>`,
    "gi",
  ))].map((match) => cleanText(match[1]));
  const sectionHeadings = [...source.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
  const duration = cleanText(source.match(/<span\b[^>]*class="[^"]*\btag\b[^"]*"[^>]*>\s*≈?\s*([\s\S]*?)<\/span>/i)?.[1]);
  const mainAttributes = source.match(/<main\b([^>]*)>/i)?.[1] || "";
  const coreDuration = attribute(mainAttributes, "data-core-duration");
  const extensionDuration = attribute(mainAttributes, "data-extension-duration");
  const extensionTitles = unique([...source.matchAll(/\bdata-lesson-extension="([^"]+)"/gi)]
    .map((match) => decode(match[1]).trim()));
  const principle = cleanText(source.match(/<p\b[^>]*class="[^"]*\bnote-line\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1])
    || lesson.description;

  return {
    source: "native",
    duration: duration || "50–65 min",
    coreDuration: coreDuration || duration || "50–65 min",
    extensionDuration,
    extensionTitles,
    outcome: lesson.description,
    principle,
    retrieval: [],
    practiceTitles: unique(practiceTitles).slice(0, 6),
    errors: errors.slice(0, 3),
    production: {
      title: "Learner production",
      setup: communicationPrompts[0] || `Use ${lesson.topic} in a personalized exchange.`,
      prompts: communicationPrompts.slice(1, 5),
      success: [],
    },
    nextUse: nextUse?.replace(/^next use:\s*/i, "") || `Retrieve ${lesson.topic} in one true sentence at the next lesson.`,
    sectionHeadings: unique(sectionHeadings),
  };
}

function attribute(source, name) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decode(match[1]).trim() : "";
}

function cleanText(value = "") {
  return decode(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\s+/g, " "))
    .trim();
}

function decode(value) {
  const named = {
    amp: "&",
    apos: "'",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };
  return String(value)
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const id = key(value);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
