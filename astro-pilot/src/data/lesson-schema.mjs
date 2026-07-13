export const LESSON_LEVELS = Object.freeze(["A0", "A1", "A2", "B1", "B2"]);
export const LESSON_CONTENT_TYPES = Object.freeze(["grammar", "vocabulary"]);
export const LESSON_STATUSES = Object.freeze(["planned", "ready"]);

/**
 * @typedef {"A0" | "A1" | "A2" | "B1" | "B2"} LessonLevel
 * @typedef {"grammar" | "vocabulary"} LessonContentType
 * @typedef {"planned" | "ready"} LessonStatus
 * @typedef {object} LessonMetadata
 * @property {string} title
 * @property {string} slug
 * @property {LessonLevel} level
 * @property {string} topic
 * @property {"Grammar" | "Vocabulary & Topics"} category
 * @property {LessonContentType} contentType
 * @property {LessonStatus} status
 * @property {string} description
 * @property {number} sequence
 * @property {string[]} prerequisites
 * @property {string[]} related
 * @property {string[]} assessments
 */

/**
 * Gives lesson metadata a single typed authoring boundary inside `.astro` files.
 * Full cross-file validation runs when the catalog is loaded and during builds.
 * @param {LessonMetadata} metadata
 * @returns {LessonMetadata}
 */
export function defineLesson(metadata) {
  return Object.freeze(metadata);
}

/**
 * @param {unknown} value
 * @param {string} source
 * @returns {asserts value is LessonMetadata}
 */
export function assertLessonMetadata(value, source) {
  const errors = [];
  const record = value && typeof value === "object" ? value : {};
  const requiredStrings = ["title", "slug", "level", "topic", "category", "contentType", "status", "description"];
  const exactKeys = new Set([...requiredStrings, "sequence", "prerequisites", "related", "assessments"]);

  for (const key of requiredStrings) {
    if (typeof record[key] !== "string" || !record[key].trim()) errors.push(`${key} must be a non-empty string`);
  }
  if (!LESSON_LEVELS.includes(record.level)) errors.push(`level must be one of ${LESSON_LEVELS.join(", ")}`);
  if (!LESSON_CONTENT_TYPES.includes(record.contentType)) errors.push(`contentType must be grammar or vocabulary`);
  if (!LESSON_STATUSES.includes(record.status)) errors.push(`status must be planned or ready`);
  if (record.category !== (record.contentType === "grammar" ? "Grammar" : "Vocabulary & Topics")) {
    errors.push(`category must match contentType`);
  }
  if (typeof record.slug === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)) {
    errors.push(`slug must contain lowercase words separated by hyphens`);
  }
  if (!Number.isInteger(record.sequence) || record.sequence < 1) errors.push(`sequence must be a positive integer`);

  for (const key of ["prerequisites", "related", "assessments"]) {
    if (!Array.isArray(record[key]) || record[key].some((item) => typeof item !== "string" || !item.trim())) {
      errors.push(`${key} must be an array of non-empty strings`);
    }
  }
  for (const key of Object.keys(record)) {
    if (!exactKeys.has(key)) errors.push(`unknown metadata field ${key}`);
  }
  if (errors.length) throw new Error(`${source}: invalid lesson metadata\n- ${errors.join("\n- ")}`);
}
