import { readFile } from "node:fs/promises";
import path from "node:path";
import { lessonCatalog, lessonCounts } from "../src/data/lesson-catalog.mjs";
import { lessonMatchesFilters } from "../src/lib/curriculum-filter.mjs";

const root = process.cwd();
const html = await readFile(path.join(root, "dist/curriculum/index.html"), "utf8");
const counts = lessonCounts();
const errors = [];
const levelCount = (html.match(/\bdata-curriculum-level=/g) || []).length;
const topicCount = (html.match(/\bdata-curriculum-topic(?:\s|>)/g) || []).length;
const readyCount = (html.match(/\bdata-topic-availability="ready"/g) || []).length;
const plannedCount = (html.match(/\bdata-topic-availability="planned"/g) || []).length;

if (levelCount !== 5) errors.push(`curriculum renders ${levelCount} levels; expected 5`);
if (topicCount !== counts.total) errors.push(`curriculum renders ${topicCount} topics; expected ${counts.total}`);
if (readyCount !== counts.ready) errors.push(`curriculum renders ${readyCount} ready topics; expected ${counts.ready}`);
if (plannedCount !== counts.planned) errors.push(`curriculum renders ${plannedCount} planned topics; expected ${counts.planned}`);
if (!/data-curriculum-finder/.test(html) || !/data-finder-status/.test(html) || !/data-curriculum-empty/.test(html)) {
  errors.push("curriculum finder controls or empty state are missing");
}

const searchable = lessonCatalog.map((lesson) => ({
  level: lesson.level,
  text: lesson.topic,
  type: lesson.contentType,
  availability: lesson.status,
}));

const cases = [
  { name: "present perfect search", filters: { query: "present perfect", level: "all", type: "all", availability: "all" }, expected: 2 },
  { name: "A1 ready lessons", filters: { query: "", level: "A1", type: "all", availability: "ready" }, expected: 19 },
  { name: "B1 planned grammar", filters: { query: "", level: "B1", type: "grammar", availability: "planned" }, expected: 11 },
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

console.log(`Curriculum verified: ${levelCount} levels, ${topicCount} searchable topics (${readyCount} ready, ${plannedCount} planned), finder controls, and ${cases.length} filter combinations.`);
