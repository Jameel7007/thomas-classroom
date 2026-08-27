import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLesson, getLessonsForLevel } from "../src/data/lesson-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelFlag = process.argv.indexOf("--level");
const level = levelFlag >= 0 ? String(process.argv[levelFlag + 1] || "").toUpperCase() : "";
const lessonFlag = process.argv.indexOf("--lesson");
const lessonId = lessonFlag >= 0 ? String(process.argv[lessonFlag + 1] || "").toLowerCase() : "";
if ((!level && !lessonId) || (level && lessonId)) {
  throw new Error("Usage: node tools/refresh-content-fingerprints.mjs (--level B1 | --lesson a0/the-verb-to-be)");
}

const fingerprintsPath = path.join(root, "src/data/migration-fingerprints.json");
const fingerprints = JSON.parse(await readFile(fingerprintsPath, "utf8"));
const selectedLesson = lessonId ? getLesson(lessonId) : undefined;
if (lessonId && (!selectedLesson || selectedLesson.status !== "ready")) {
  throw new Error(`No ready lesson found for ${lessonId}.`);
}
const lessons = selectedLesson ? [selectedLesson] : getLessonsForLevel(level, { status: "ready" });
if (!lessons.length) throw new Error(`No ready lessons found for ${level}.`);

for (const lesson of lessons) {
  const content = await learnerContent(lesson.route, "main");
  fingerprints.lessons[lesson.id] = {
    features: [
      "LessonPage",
      "LessonNavigation",
      "LessonExerciseEngine",
      "StructuredLesson",
      "MultipleChoiceExercise",
      "RevealCard",
      "FeedbackPanel",
      "SentenceBuilder",
      "SentenceCorrection"
    ],
    contentTextHash: textHash(content),
    interactionCounts: dataAttributeCounts(content),
    audioClips: audioClipIds(content)
  };
}

const assessmentSlug = level ? `${level.toLowerCase()}-exit` : "";
const assessment = level ? fingerprints.assessments.find((item) => item.slug === assessmentSlug) : undefined;
if (assessment) {
  const content = await learnerContent(assessment.route, "body");
  Object.assign(assessment, {
    engine: "assessment",
    features: [
      "AssessmentPage",
      "AssessmentNavigation",
      "AssessmentEngine",
      "ProgressIndicator",
      "FeedbackPanel",
      "MultipleChoiceExercise",
      "AudioControls"
    ],
    contentTextHash: textHash(content),
    interactionCounts: dataAttributeCounts(content),
    audioClips: audioClipIds(content)
  });
}

await writeFile(fingerprintsPath, `${JSON.stringify(fingerprints, null, 2)}\n`, "utf8");
console.log(selectedLesson
  ? `Refreshed the ${selectedLesson.id} lesson fingerprint.`
  : `Refreshed ${lessons.length} ${level} lesson fingerprints${assessment ? ` and ${assessmentSlug}` : ""}.`);
if (assessment) console.log(`${assessmentSlug} content hash: ${assessment.contentTextHash}`);

async function learnerContent(route, container) {
  const clean = route.replace(/^\//, "").replace(/\/$/, "");
  const html = await readFile(path.join(root, "dist", clean, "index.html"), "utf8");
  const content = container === "main"
    ? html.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    : html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!content) throw new Error(`${route}: could not find ${container} learner content in built output.`);
  return content;
}

function textContent(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textHash(value) {
  const visible = textContent(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<a\b[^>]*class="[^"]*\b(?:page-skip|skip-link|home-skip)\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ""));
  return createHash("sha256").update(visible).digest("hex");
}

function dataAttributeCounts(value) {
  return [...String(value).matchAll(/\b(data-[a-z0-9-]+)(?=[\s=>])/gi)]
    .reduce((counts, match) => {
      const name = match[1].toLowerCase();
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
}

function audioClipIds(value) {
  return [...String(value).matchAll(/\bdata-voice-clip="([^"]+)"/g)].map((match) => match[1]);
}
