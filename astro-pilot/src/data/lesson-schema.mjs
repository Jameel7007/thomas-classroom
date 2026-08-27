export const LESSON_LEVELS = Object.freeze(["A0", "A1", "A2", "B1", "B2", "C1"]);
export const LESSON_CONTENT_TYPES = Object.freeze(["grammar", "vocabulary"]);
export const LESSON_STATUSES = Object.freeze(["planned", "ready"]);
export const LESSON_QUALITY_REVIEW_STATUSES = Object.freeze([
  "unreviewed",
  "editorial-review",
  "learner-pilot",
  "reviewed",
  "revision-due",
]);
export const LESSON_REVIEW_PILOT_TARGET = 3;

const DEFAULT_QUALITY_REVIEW = Object.freeze({
  status: "unreviewed",
  generatedPedagogy: false,
  learnerPilotCount: 0,
  scoredItemCount: 0,
  revisionSummary: "No formal quality review is registered yet.",
});

/**
 * @typedef {"A0" | "A1" | "A2" | "B1" | "B2" | "C1"} LessonLevel
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
 * @property {boolean} [tutorReviewRequired]
 * @property {LessonQualityReview} [qualityReview]
 *
 * @typedef {object} LessonQualityReview
 * @property {"unreviewed" | "editorial-review" | "learner-pilot" | "reviewed" | "revision-due"} status
 * @property {boolean} generatedPedagogy
 * @property {number} learnerPilotCount
 * @property {number} scoredItemCount
 * @property {string} revisionSummary
 * @property {string} [reviewedBy]
 * @property {string} [reviewedOn]
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
 * Supplies an honest review state without forcing every legacy lesson record to
 * claim evidence it does not have. Add `qualityReview` to a lesson only when a
 * real editorial or learner-review record exists.
 * @param {LessonMetadata} metadata
 * @returns {Readonly<LessonQualityReview>}
 */
export function getLessonQualityReview(metadata) {
  return metadata.qualityReview
    ? Object.freeze({ ...metadata.qualityReview })
    : DEFAULT_QUALITY_REVIEW;
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
  const exactKeys = new Set([...requiredStrings, "sequence", "prerequisites", "related", "assessments", "tutorReviewRequired", "qualityReview"]);

  for (const key of requiredStrings) {
    if (typeof record[key] !== "string" || !record[key].trim()) errors.push(`${key} must be a non-empty string`);
  }
  if (typeof record.title === "string") {
    const title = record.title.trim();
    const length = [...title].length;
    const contentLabel = record.contentType === "grammar" ? "Grammar" : "Vocabulary";
    if (length < 15 || length > 70) errors.push(`title must be 15–70 characters`);
    if (/Curriculum Map|Thomas[’']s Classroom/u.test(title)) {
      errors.push(`title must be an unbranded lesson title`);
    }
    if (/\s{2,}/u.test(title)) errors.push(`title cannot contain repeated whitespace`);
    if (/^\p{Ll}/u.test(title)) errors.push(`title must begin with an uppercase letter`);
    if (LESSON_LEVELS.includes(record.level) && LESSON_CONTENT_TYPES.includes(record.contentType) &&
      !title.endsWith(` · ${record.level} ${contentLabel}`)) {
      errors.push(`title must end with " · ${record.level} ${contentLabel}"`);
    }
  }
  if (typeof record.description === "string") {
    const description = record.description.trim();
    const length = [...description].length;
    if (length < 80 || length > 180) errors.push(`description must be 80–180 characters`);
    if (!/[.!?…]$/u.test(description)) errors.push(`description must end with sentence punctuation`);
    if (/\s+[,.!?;:]/u.test(description)) errors.push(`description cannot contain spaces before punctuation`);
    if (/\s{2,}/u.test(description)) errors.push(`description cannot contain repeated whitespace`);
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
  if (record.tutorReviewRequired !== undefined && typeof record.tutorReviewRequired !== "boolean") {
    errors.push(`tutorReviewRequired must be a boolean when provided`);
  }
  validateQualityReview(record, errors);

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

function validateQualityReview(record, errors) {
  if (record.qualityReview === undefined) return;
  if (!record.qualityReview || typeof record.qualityReview !== "object" || Array.isArray(record.qualityReview)) {
    errors.push(`qualityReview must be an object when provided`);
    return;
  }

  const review = record.qualityReview;
  const exactKeys = new Set(["status", "generatedPedagogy", "learnerPilotCount", "scoredItemCount", "revisionSummary", "reviewedBy", "reviewedOn"]);
  for (const key of Object.keys(review)) {
    if (!exactKeys.has(key)) errors.push(`qualityReview contains unknown field ${key}`);
  }
  if (!LESSON_QUALITY_REVIEW_STATUSES.includes(review.status)) {
    errors.push(`qualityReview.status must be one of ${LESSON_QUALITY_REVIEW_STATUSES.join(", ")}`);
  }
  if (typeof review.generatedPedagogy !== "boolean") {
    errors.push(`qualityReview.generatedPedagogy must be a boolean`);
  }
  if (!Number.isInteger(review.learnerPilotCount) || review.learnerPilotCount < 0) {
    errors.push(`qualityReview.learnerPilotCount must be a non-negative integer`);
  }
  if (!Number.isInteger(review.scoredItemCount) || review.scoredItemCount < 1) {
    errors.push(`qualityReview.scoredItemCount must be a positive integer`);
  }
  if (typeof review.revisionSummary !== "string" || review.revisionSummary.trim().length < 20 || review.revisionSummary.trim().length > 240) {
    errors.push(`qualityReview.revisionSummary must be 20–240 characters`);
  }
  if (review.reviewedBy !== undefined && (typeof review.reviewedBy !== "string" || !review.reviewedBy.trim())) {
    errors.push(`qualityReview.reviewedBy must be a non-empty string when provided`);
  }
  if (review.reviewedOn !== undefined && (typeof review.reviewedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedOn))) {
    errors.push(`qualityReview.reviewedOn must use YYYY-MM-DD when provided`);
  }
  if (review.status === "reviewed") {
    if (review.learnerPilotCount < LESSON_REVIEW_PILOT_TARGET) {
      errors.push(`a reviewed lesson must record at least three learner pilots`);
    }
    if (!review.reviewedBy || !review.reviewedOn) errors.push(`a reviewed lesson must record reviewedBy and reviewedOn`);
    if (record.tutorReviewRequired === true) errors.push(`a reviewed lesson cannot still require tutor review`);
  } else if (review.reviewedBy !== undefined || review.reviewedOn !== undefined) {
    errors.push(`reviewedBy and reviewedOn are reserved for status reviewed`);
  }
  if (record.status === "planned" && review.status !== "unreviewed" && review.status !== "editorial-review") {
    errors.push(`a planned lesson cannot claim learner-pilot, reviewed, or revision-due status`);
  }
}
