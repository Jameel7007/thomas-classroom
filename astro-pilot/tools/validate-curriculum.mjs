import { readFile } from "node:fs/promises";
import path from "node:path";
import { lessonCatalog, lessonCounts } from "../src/data/lesson-catalog.mjs";
import { lessonMatchesFilters } from "../src/lib/curriculum-filter.mjs";
import { assessmentRoutes } from "../src/data/assessment-routes.mjs";
import { LESSON_LEVELS } from "../src/data/lesson-schema.mjs";

const root = process.cwd();
const html = await readFile(path.join(root, "dist/curriculum/index.html"), "utf8");
const diagnosticsHtml = await readFile(path.join(root, "dist/assessments/index.html"), "utf8");
const counts = lessonCounts();
const errors = [];
const expectedLevelCount = LESSON_LEVELS.length;
const courseRange = `${LESSON_LEVELS[0]}–${LESSON_LEVELS.at(-1)}`;
const levelCount = (html.match(/\bdata-curriculum-level=/g) || []).length;
const topicCount = (html.match(/\bdata-curriculum-topic(?:\s|>)/g) || []).length;
const readyCount = (html.match(/\bdata-topic-availability="ready"/g) || []).length;
const plannedCount = (html.match(/\bdata-topic-availability="planned"/g) || []).length;
const startCheckCount = (html.match(/\bdata-level-start-check=/g) || []).length;
const learningEvidenceCount = (html.match(/\bdata-level-learning-evidence=/g) || []).length;
const endCheckCount = (html.match(/\bdata-level-end-check=/g) || []).length;

if (levelCount !== expectedLevelCount) errors.push(`curriculum renders ${levelCount} levels; expected ${expectedLevelCount}`);
if (topicCount !== counts.total) errors.push(`curriculum renders ${topicCount} topics; expected ${counts.total}`);
if (readyCount !== counts.ready) errors.push(`curriculum renders ${readyCount} ready topics; expected ${counts.ready}`);
if (plannedCount !== counts.planned) errors.push(`curriculum renders ${plannedCount} planned topics; expected ${counts.planned}`);
if (startCheckCount !== 0 || learningEvidenceCount !== 0 || endCheckCount !== 0 || /assessment-band/.test(html)) {
  errors.push(`curriculum still mixes diagnostic controls into the lesson path: ${startCheckCount} start, ${learningEvidenceCount} learning, ${endCheckCount} end stages`);
}
const diagnosticRouteCount = (diagnosticsHtml.match(/\bdata-diagnostic-route=/g) || []).length;
const readyDiagnosticCount = (diagnosticsHtml.match(/\bdata-diagnostic-status="ready"/g) || []).length;
const plannedDiagnosticCount = (diagnosticsHtml.match(/\bdata-diagnostic-status="planned"/g) || []).length;
if (diagnosticRouteCount !== assessmentRoutes.length || readyDiagnosticCount !== assessmentRoutes.filter((item) => item.status === "ready").length || plannedDiagnosticCount !== assessmentRoutes.filter((item) => item.status === "planned").length) {
  errors.push(`diagnostics hub is incomplete: ${diagnosticRouteCount} records, ${readyDiagnosticCount} ready, ${plannedDiagnosticCount} planned`);
}
if (!/data-curriculum-finder/.test(html) || !/data-finder-status/.test(html) || !/data-curriculum-empty/.test(html)) {
  errors.push("curriculum finder controls or empty state are missing");
}
const levelControlCount = (html.match(/\bdata-finder-level(?:\s|>)/g) || []).length;
if (levelControlCount !== expectedLevelCount + 1) {
  errors.push(`curriculum finder renders ${levelControlCount} level controls; expected All plus ${courseRange}`);
}
const browseByLevelCount = (html.match(/Browse by level/g) || []).length;
if (browseByLevelCount !== 1) errors.push(`curriculum renders ${browseByLevelCount} visible level-control labels; expected only the lesson finder`);
if (/level-jumps|Jump to level/.test(html)) errors.push("duplicate navigation-level controls are still rendered");
if (/CEFR stages|one coherent path/.test(html)) errors.push("redundant curriculum masthead statistics are still rendered");
if (!new RegExp(`<b>${counts.total}<\\/b> curriculum topics · ${counts.ready} available now`).test(html)) {
  errors.push("curriculum masthead topic statistics are missing or stale");
}
if (!new RegExp(`<b>${courseRange}<\\/b> complete learning path`).test(html)) errors.push("curriculum masthead path statistic is missing");
if (!/Find your next lesson/i.test(html) || !/Find a lesson\./.test(html) || !/Search by grammar, vocabulary, or real-life topic\./.test(html)) {
  errors.push("curriculum finder uses unexpected introductory copy");
}
if (!/Browse by level/.test(html) || !/Lesson type/.test(html) || !/>Show<\/span>/.test(html)) {
  errors.push("curriculum finder visible labels are incomplete");
}
if (!/>All topics<\/option>/.test(html) || !/>Available now<\/option>/.test(html)) {
  errors.push("curriculum finder availability wording is unclear");
}
if (!/What is CEFR\?/.test(html) || !/Common European Framework of Reference for Languages/.test(html)) {
  errors.push("compact CEFR explanation is missing");
}
const finderIndex = html.indexOf("data-curriculum-finder");
const firstLevelIndex = html.indexOf('data-curriculum-level="A0"');
if (finderIndex < 0 || finderIndex > firstLevelIndex) errors.push("curriculum finder does not precede the first level");
if (/curriculum-guide|How this curriculum works|<article class="card" data-curriculum-detail>/.test(html)) {
  errors.push("curriculum still renders static skill cards or the redundant curriculum guide");
}

for (const level of LESSON_LEVELS) {
  const section = html.match(new RegExp(`<section\\b[^>]*data-curriculum-level="${level}"[\\s\\S]*?<\\/section>`))?.[0] || "";
  const expectedLessons = lessonCatalog.filter((lesson) => lesson.level === level);
  const renderedSequences = [...section.matchAll(/data-lesson-sequence="(\d+)"/g)].map((match) => Number(match[1]));
  if (!section.includes(`data-curriculum-lesson-path="${level}"`)) errors.push(`${level}: ordered lesson path is missing`);
  if (renderedSequences.length !== expectedLessons.length || renderedSequences.some((sequence, index) => sequence !== expectedLessons[index].sequence)) {
    errors.push(`${level}: lesson path does not follow canonical sequence metadata`);
  }
}

for (const assessment of assessmentRoutes) {
  const element = diagnosticsHtml.match(new RegExp(`<(?:a|article)\\b[^>]*data-diagnostic-route="${assessment.slug}"[^>]*>`))?.[0] || "";
  if (!element) {
    errors.push(`diagnostics: ${assessment.slug} is missing`);
  } else if (assessment.status === "ready" && !element.includes(`href="${assessment.route}"`)) {
    errors.push(`diagnostics: ${assessment.slug} does not link to its canonical route`);
  } else if (assessment.status === "planned" && /\bhref=/.test(element)) {
    errors.push(`diagnostics: planned ${assessment.slug} is incorrectly linked as available`);
  }
}

const searchable = lessonCatalog.map((lesson) => ({
  level: lesson.level,
  text: lesson.topic,
  type: lesson.contentType,
  availability: lesson.status,
}));

const cases = [
  { name: "present perfect search", filters: { query: "present perfect", level: "all", type: "all", availability: "all" }, expected: 2 },
  { name: "A1 ready lessons", filters: { query: "", level: "A1", type: "all", availability: "ready" }, expected: lessonCatalog.filter((lesson) => lesson.level === "A1" && lesson.status === "ready").length },
  { name: "B1 ready grammar", filters: { query: "", level: "B1", type: "grammar", availability: "ready" }, expected: lessonCatalog.filter((lesson) => lesson.level === "B1" && lesson.contentType === "grammar" && lesson.status === "ready").length },
  { name: "C1 planned lessons", filters: { query: "", level: "C1", type: "all", availability: "planned" }, expected: lessonCatalog.filter((lesson) => lesson.level === "C1" && lesson.status === "planned").length },
  { name: "C1 ready grammar", filters: { query: "", level: "C1", type: "grammar", availability: "ready" }, expected: lessonCatalog.filter((lesson) => lesson.level === "C1" && lesson.contentType === "grammar" && lesson.status === "ready").length },
  { name: "combined zero result", filters: { query: "travel", level: "A1", type: "all", availability: "ready" }, expected: 0 },
];

for (const testCase of cases) {
  const actual = searchable.filter((lesson) => lessonMatchesFilters(lesson, testCase.filters)).length;
  if (actual !== testCase.expected) errors.push(`${testCase.name} returned ${actual}; expected ${testCase.expected}`);
}

if (errors.length) {
  console.error(`Curriculum validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Curriculum verified: ${levelCount} ordered lesson paths, ${topicCount} searchable topics (${readyCount} ready, ${plannedCount} planned), ${diagnosticRouteCount} diagnostics in a separate hub, finder controls, and ${cases.length} filter combinations.`);
