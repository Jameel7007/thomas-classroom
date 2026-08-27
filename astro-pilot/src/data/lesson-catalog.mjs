import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLessonMetadata, LESSON_LEVELS } from "./lesson-schema.mjs";
import { assessmentRoutes } from "./assessment-routes.mjs";

const sourceProjectRoot = fileURLToPath(new URL("../..", import.meta.url));
const projectRoot = [process.cwd(), path.join(process.cwd(), "astro-pilot"), sourceProjectRoot]
  .find((candidate) => existsSync(path.join(candidate, "src/content/lessons")));
if (!projectRoot) throw new Error("Could not locate the Astro project root containing src/content/lessons");
const lessonRoot = path.join(projectRoot, "src/content/lessons");
const sourcePaths = await findLessonSources(lessonRoot);

const records = await Promise.all(sourcePaths.map(async (absolutePath) => {
  const source = path.relative(projectRoot, absolutePath).split(path.sep).join("/");
  const sourceText = await readFile(absolutePath, "utf8");
  const metadata = extractLessonMetadata(sourceText, source);
  assertLessonMetadata(metadata, source);

  const expectedSource = `src/content/lessons/${metadata.level.toLowerCase()}/${metadata.slug}.astro`;
  if (source !== expectedSource) throw new Error(`${source}: metadata resolves to ${expectedSource}; the file path, level, and slug must agree`);
  if (metadata.status === "ready" && !/<LessonPage\b/.test(sourceText)) {
    throw new Error(`${source}: ready lessons must render the shared LessonPage component`);
  }
  if (metadata.status === "planned" && /<LessonPage\b/.test(sourceText)) {
    throw new Error(`${source}: planned lessons cannot render a learner route; change status to ready when the lesson body is complete`);
  }

  const id = `${metadata.level.toLowerCase()}/${metadata.slug}`;
  return Object.freeze({
    ...metadata,
    id,
    source,
    route: `/lessons/${id}/`,
    legacyRoute: `/lessons/${id}.html`,
  });
}));

validateCatalog(records);

const levelRank = new Map(LESSON_LEVELS.map((level, index) => [level, index]));
export const lessonCatalog = Object.freeze(records.sort((a, b) =>
  levelRank.get(a.level) - levelRank.get(b.level) || a.sequence - b.sequence
));
export const readyLessons = Object.freeze(lessonCatalog.filter((lesson) => lesson.status === "ready"));
export const plannedLessons = Object.freeze(lessonCatalog.filter((lesson) => lesson.status === "planned"));

const lessonById = new Map(lessonCatalog.map((lesson) => [lesson.id, lesson]));
const lessonsByLevel = new Map(LESSON_LEVELS.map((level) => [level, Object.freeze(lessonCatalog.filter((lesson) => lesson.level === level))]));

export function getLesson(id) {
  return lessonById.get(String(id).toLowerCase());
}

export function getLessonsForLevel(level, options = {}) {
  const lessons = lessonsByLevel.get(level) ?? [];
  return options.status ? lessons.filter((lesson) => lesson.status === options.status) : lessons;
}

export function getLessonNavigation(id) {
  const current = getLesson(id);
  if (!current || current.status !== "ready") return { previous: undefined, next: undefined, isCourseEnd: false };
  const fullCourse = getLessonsForLevel(current.level);
  const course = getLessonsForLevel(current.level, { status: "ready" });
  const index = course.findIndex((lesson) => lesson.id === current.id);
  return {
    previous: index > 0 ? course[index - 1] : undefined,
    next: index >= 0 && index < course.length - 1 ? course[index + 1] : undefined,
    isCourseEnd: current.id === fullCourse.at(-1)?.id,
  };
}

export function lessonCounts() {
  return Object.freeze({ total: lessonCatalog.length, ready: readyLessons.length, planned: plannedLessons.length });
}

function extractLessonMetadata(sourceText, source) {
  const marker = "export const page = defineLesson(";
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${source}: missing canonical export const page = defineLesson({...}) metadata`);
  const objectStart = sourceText.indexOf("{", markerIndex + marker.length);
  if (objectStart < 0) throw new Error(`${source}: lesson metadata object is missing`);
  const objectEnd = findMatchingBrace(sourceText, objectStart);
  if (objectEnd < 0) throw new Error(`${source}: lesson metadata object is not balanced`);
  try {
    return JSON.parse(sourceText.slice(objectStart, objectEnd + 1));
  } catch (error) {
    throw new Error(`${source}: lesson metadata must remain JSON-compatible (${error.message})`);
  }
}

function findMatchingBrace(value, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function validateCatalog(catalog) {
  const ids = new Set();
  const routes = new Set();
  const topicKeys = new Set();
  const sequenceKeys = new Set();
  const assessmentIds = new Set(assessmentRoutes.map((assessment) => assessment.slug));
  const byId = new Map(catalog.map((lesson) => [lesson.id, lesson]));
  const rank = new Map(LESSON_LEVELS.map((level, index) => [level, index]));

  for (const lesson of catalog) {
    for (const [set, key, label] of [
      [ids, lesson.id, "lesson id"],
      [routes, lesson.route, "route"],
      [topicKeys, `${lesson.level}/${lesson.topic.toLocaleLowerCase()}`, "level topic"],
      [sequenceKeys, `${lesson.level}/${lesson.sequence}`, "level sequence"],
    ]) {
      if (set.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
      set.add(key);
    }
    for (const assessment of lesson.assessments) {
      if (!assessmentIds.has(assessment)) throw new Error(`${lesson.id}: unknown assessment relationship ${assessment}`);
    }
    const expectedAssessment = `${lesson.level.toLowerCase()}-exit`;
    if (lesson.status === "ready" && (lesson.assessments.length !== 1 || lesson.assessments[0] !== expectedAssessment)) {
      throw new Error(`${lesson.id}: ready lessons must link exactly once to ${expectedAssessment}`);
    }
    if (lesson.status === "ready" && lesson.level !== "A0" && lesson.prerequisites.length === 0) {
      throw new Error(`${lesson.id}: ready ${lesson.level} lessons must identify at least one earlier prerequisite`);
    }
  }

  for (const level of LESSON_LEVELS) {
    const sequences = catalog.filter((lesson) => lesson.level === level).map((lesson) => lesson.sequence).sort((a, b) => a - b);
    sequences.forEach((sequence, index) => {
      if (sequence !== index + 1) throw new Error(`${level}: sequence must be contiguous from 1; expected ${index + 1}, found ${sequence}`);
    });
  }

  for (const lesson of catalog) {
    for (const field of ["prerequisites", "related"]) {
      if (new Set(lesson[field]).size !== lesson[field].length) {
        throw new Error(`${lesson.id}: ${field} contains duplicate lesson relationships`);
      }
      for (const reference of lesson[field]) {
        if (!ids.has(reference)) throw new Error(`${lesson.id}: ${field} references unknown lesson ${reference}`);
        if (reference === lesson.id) throw new Error(`${lesson.id}: ${field} cannot reference itself`);
      }
    }
    for (const reference of lesson.prerequisites) {
      const prerequisite = byId.get(reference);
      if (lesson.status === "ready" && prerequisite.status !== "ready") {
        throw new Error(`${lesson.id}: ready lesson cannot depend on planned prerequisite ${reference}`);
      }
      const earlierLevel = rank.get(prerequisite.level) < rank.get(lesson.level);
      const earlierInLevel = prerequisite.level === lesson.level && prerequisite.sequence < lesson.sequence;
      if (!earlierLevel && !earlierInLevel) {
        throw new Error(`${lesson.id}: prerequisite ${reference} must occur earlier in the curriculum path`);
      }
    }
  }

  validatePrerequisiteCycles(catalog, byId);
}

function validatePrerequisiteCycles(catalog, byId) {
  const state = new Map();
  const visit = (lesson, path = []) => {
    const currentState = state.get(lesson.id);
    if (currentState === "done") return;
    if (currentState === "visiting") {
      throw new Error(`Prerequisite cycle detected: ${[...path, lesson.id].join(" → ")}`);
    }
    state.set(lesson.id, "visiting");
    for (const reference of lesson.prerequisites) visit(byId.get(reference), [...path, lesson.id]);
    state.set(lesson.id, "done");
  };
  catalog.forEach((lesson) => visit(lesson));
}

async function findLessonSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findLessonSources(target));
    else if (entry.name.endsWith(".astro")) files.push(target);
  }
  return files.sort();
}
