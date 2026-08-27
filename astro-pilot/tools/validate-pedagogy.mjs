import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LESSON_LEVELS } from "../src/data/lesson-schema.mjs";
import { readyLessons } from "../src/data/lesson-catalog.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const metrics = [];

const noticePattern = /\b(?:notice|noticing|discover(?:y)?|observe|think first)\b/i;
const communicationPattern = /\b(?:communicat(?:e|ion)|use it|your turn|production|speak|role[- ]?play|personalize|make it real)\b/i;
const reflectionPattern = /\b(?:reflect|self[- ]?check|next use|exit ticket|can you do this without the page)\b/i;
const spokenFormPattern = /(?:\bpronunciation\s*:|Sound natural:|Pronunciation focus:|Hear the difference:|How -ed sounds|What you hear:|Two numbers that sound close|plural ending sounds like|Contractions make(?: the pattern| it) sound natural)/i;
const interactionAttributes = [
  "data-answer-drill",
  "data-choice-gap-drill",
  "data-tile-game",
  "data-tile-builder",
  "data-spot-error",
  "data-transform",
  "data-quiz",
];

const structuredLessonSource = readFileSync(path.join(projectRoot, "src/components/lesson/StructuredLesson.astro"), "utf8");
if (interactionCount(structuredLessonSource) < 7 || !/\bdata-feedback\b/.test(structuredLessonSource)) {
  errors.push("src/components/lesson/StructuredLesson.astro: shared upper-level practice or feedback contract is incomplete");
}

for (const lesson of readyLessons) {
  const sourcePath = path.join(projectRoot, lesson.source);
  const source = readFileSync(sourcePath, "utf8");
  validateContour(lesson, source, "source");
  if (!spokenFormPattern.test(source)) {
    errors.push(`${lesson.id}: explicit pronunciation, stress, rhythm, or connected-speech guidance is missing from source`);
  }

  const usesStructuredLesson = /<StructuredLesson\b/.test(source);
  if (usesStructuredLesson) {
    for (const field of ["notice", "discover", "build", "communicate", "reflect"]) {
      if (!new RegExp(`\\b${field}\\s*:`).test(source)) errors.push(`${lesson.id}: structured lesson data is missing ${field}`);
    }
  } else {
    const sourceInteractions = interactionCount(source);
    if (sourceInteractions < 8) {
      errors.push(`${lesson.id}: expected at least 8 interactive practice mechanics in source, found ${sourceInteractions}`);
    }
    if (!/\bdata-feedback\b/.test(source)) errors.push(`${lesson.id}: learner feedback output is missing`);
  }

  if (!sourceOnly) validateRenderedLesson(lesson);
}

if (!sourceOnly && !existsSync(outputRoot)) {
  errors.push("dist: production output is missing; run the Astro build first");
}

if (errors.length) {
  console.error(`\nPedagogy validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

if (sourceOnly) {
  console.log(`Pedagogy source contracts passed for ${readyLessons.length} lessons: notice/discover, interactive practice, feedback, communication, and reflection are present.`);
} else {
  const levelSummary = LESSON_LEVELS.map((level) => {
    const rows = metrics.filter((metric) => metric.level === level);
    const words = rows.map((row) => row.words);
    const interactions = rows.map((row) => row.interactions);
    return `${level} ${rows.length} lessons · ${range(words)} words · ${range(interactions)} interactions`;
  }).join("; ");
  console.log(`Pedagogy validation passed for ${metrics.length} rendered lessons. ${levelSummary}.`);
}

function validateRenderedLesson(lesson) {
  const output = path.join(outputRoot, lesson.route.replace(/^\//, ""), "index.html");
  if (!existsSync(output)) {
    errors.push(`${lesson.id}: rendered lesson output is missing`);
    return;
  }

  const html = readFileSync(output, "utf8");
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
  if (!main) {
    errors.push(`${lesson.id}: rendered learner content has no main landmark`);
    return;
  }

  const headings = [...main.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map((match) => textContent(match[1]));
  const headingText = headings.join(" | ");
  validateContour(lesson, headingText, "rendered headings");

  const visibleText = textContent(main
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ""));
  const words = visibleText.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length || 0;
  const interactions = interactionCount(main);
  const reflectionIndex = headings.findIndex((heading) => reflectionPattern.test(heading));

  if (words < 700) errors.push(`${lesson.id}: rendered lesson is too thin at ${words} visible words; expected at least 700`);
  if (interactions < 8) errors.push(`${lesson.id}: rendered lesson has ${interactions} interactive mechanics; expected at least 8`);
  if (reflectionIndex < Math.floor(headings.length * 0.55)) {
    errors.push(`${lesson.id}: reflection or next-use close appears too early in the lesson sequence`);
  }
  if (!/class="[^"]*\bprompt-card\b/i.test(main)) errors.push(`${lesson.id}: personalized learner-production prompt is missing`);
  if (!/\bdata-feedback\b/i.test(main)) errors.push(`${lesson.id}: rendered feedback output is missing`);
  if (!spokenFormPattern.test(visibleText)) errors.push(`${lesson.id}: rendered spoken-form guidance is missing`);

  metrics.push({ level: lesson.level, words, interactions });
}

function validateContour(lesson, value, label) {
  if (!noticePattern.test(value)) errors.push(`${lesson.id}: notice or discovery stage is missing from ${label}`);
  if (!communicationPattern.test(value)) errors.push(`${lesson.id}: communication or learner-production stage is missing from ${label}`);
  if (!reflectionPattern.test(value)) errors.push(`${lesson.id}: reflection or next-use close is missing from ${label}`);
}

function interactionCount(value) {
  return interactionAttributes.reduce((total, attribute) =>
    total + (String(value).match(new RegExp(`\\b${attribute}(?=[\\s=>])`, "gi")) || []).length, 0);
}

function textContent(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function range(values) {
  return `${Math.min(...values)}–${Math.max(...values)}`;
}
