import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTutorBrief } from "./tutor-plan.mjs";

const projectRoot = path.resolve(process.cwd());

export function buildQuickReviewItem(lesson, structuredLesson) {
  const brief = buildTutorBrief(lesson, structuredLesson);
  const source = structuredLesson ? "" : readLessonSource(lesson);
  const retrieval = structuredLesson
    ? structuredRetrieval(structuredLesson)
    : nativeRetrieval(source, lesson, brief);
  const repair = structuredLesson
    ? structuredRepair(structuredLesson)
    : nativeRepair(source, lesson, brief);
  const contrast = structuredLesson
    ? structuredContrast(structuredLesson)
    : nativeContrast(lesson, brief);
  const firstProductionPrompt = brief.production.prompts[0] || "";
  const productionPrompt = (firstProductionPrompt.trim().length >= 24 ? firstProductionPrompt : brief.production.setup)
    || `Use ${lesson.topic} in a true, complete response.`;

  return Object.freeze({
    id: lesson.id,
    level: lesson.level,
    sequence: lesson.sequence,
    topic: lesson.topic,
    route: lesson.route,
    planRoute: `/tutor/plans/${lesson.id}/`,
    retrieval,
    contrast,
    repair,
    production: {
      title: brief.production.title || "Use it in conversation",
      prompt: productionPrompt,
      support: brief.production.setup,
      monitor: brief.production.success.slice(0, 3),
    },
  });
}

function structuredRetrieval(content) {
  const item = content.retrieval[0];
  return {
    prompt: item?.prompt || "Give one accurate example without looking back at the lesson.",
    answer: item?.answer || content.discover.principle,
  };
}

function structuredRepair(content) {
  const item = content.discover.errors[0];
  return {
    prompt: item?.wrong || "Correct one likely error with today’s target language.",
    answer: item?.correct || content.discover.principle,
    why: item?.why || "Explain the form, meaning, or use that makes the correction necessary.",
  };
}

function structuredContrast(content) {
  const first = content.discover.meaningRows[0];
  const second = content.discover.meaningRows[1];
  if (!first || !second) {
    return {
      prompt: "Explain the most important choice in this lesson.",
      answer: content.discover.principle,
    };
  }
  return {
    prompt: `Contrast “${first.choice}” with “${second.choice}.” What changes in meaning or use?`,
    answer: `${first.choice}: ${first.use}. ${second.choice}: ${second.use}.`,
  };
}

function nativeRetrieval(source, lesson, brief) {
  const question = firstChoiceQuestion(source);
  if (question) return question;
  return {
    prompt: `Without reopening the lesson, give one accurate example of ${lesson.topic}.`,
    answer: brief.principle,
  };
}

function nativeRepair(source, lesson, brief) {
  const marker = source.search(/<div\b[^>]*\bdata-spot-error\b/i);
  if (marker >= 0) {
    const sample = source.slice(marker, marker + 2200);
    const opening = sample.match(/<div\b([^>]*)\bdata-spot-error\b([^>]*)>/i);
    const attributes = `${opening?.[1] || ""} ${opening?.[2] || ""}`;
    const prompt = cleanText(sample.match(/<p\b[^>]*class="[^"]*\bex\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    const answer = attribute(attributes, "data-fix");
    const why = attribute(attributes, "data-why") || attribute(attributes, "data-hint");
    if (prompt && answer) return { prompt, answer, why };
  }
  const error = brief.errors[0];
  return {
    prompt: `Produce and explain one correction involving ${lesson.topic}.`,
    answer: error?.repair || brief.principle,
    why: error?.why || "Name the form, meaning, or use that makes the correction necessary.",
  };
}

function nativeContrast(lesson, brief) {
  const repair = brief.errors[1] || brief.errors[0];
  return {
    prompt: `What is the most useful contrast a learner must control when using ${lesson.topic}?`,
    answer: repair ? `${repair.repair} ${repair.why}` : brief.principle,
  };
}

function firstChoiceQuestion(source) {
  const questions = [...source.matchAll(/<div\b[^>]*class="[^"]*\bq\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  for (const match of questions) {
    if (!/\bdata-answer=/.test(match[1])) continue;
    const question = match[1].replace(/<span\b[^>]*class="[^"]*\bn\b[^"]*"[^>]*>[\s\S]*?<\/span>/i, "");
    const button = question.match(/<button\b([^>]*)\bdata-answer="([^"]+)"([^>]*)>[\s\S]*?<\/button>/i);
    if (!button) continue;
    const attributes = `${button[1]} ${button[3]}`;
    const prompt = cleanText(question.replace(button[0], " ___ "));
    const answer = decode(button[2]).split("|")[0].trim();
    const cue = attribute(attributes, "data-fix") || attribute(attributes, "data-hint");
    if (prompt && answer) return { prompt, answer: cue || answer };
  }
  return undefined;
}

function readLessonSource(lesson) {
  const sourcePath = path.resolve(projectRoot, lesson.source);
  const allowedRoot = path.join(projectRoot, "src", "content", "lessons") + path.sep;
  if (!sourcePath.startsWith(allowedRoot)) throw new Error(`${lesson.id}: quick-review source escapes the lesson directory`);
  return readFileSync(sourcePath, "utf8");
}

function attribute(source, name) {
  const match = String(source).match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decode(match[1]).trim() : "";
}

function cleanText(value = "") {
  return decode(String(value)
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, " ___ ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]*\}/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decode(value) {
  const named = {
    amp: "&", apos: "'", hellip: "…", ldquo: "“", lsquo: "‘", mdash: "—",
    nbsp: " ", ndash: "–", quot: '"', rdquo: "”", rsquo: "’",
  };
  return String(value)
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}
