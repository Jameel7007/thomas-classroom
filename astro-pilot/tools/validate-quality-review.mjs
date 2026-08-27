import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";
import { buildTutorBrief } from "../src/lib/tutor-plan.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceOnly = process.argv.includes("--source");
const errors = [];
const reviewedLessons = readyLessons.filter((lesson) => lesson.qualityReview);

if (!reviewedLessons.length) errors.push("no canonical lesson quality-review records were found");

for (const lesson of reviewedLessons) {
  const source = readFileSync(path.join(root, lesson.source), "utf8");
  validateMetadata(lesson);
  validateNativeLesson(lesson, source);
  if (!sourceOnly) validateOutput(lesson, source);
}

if (errors.length) {
  console.error(`\nQuality-review validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

const itemTotal = reviewedLessons.reduce((sum, lesson) => sum + lesson.qualityReview.scoredItemCount, 0);
console.log(sourceOnly
  ? `Quality-review source contracts passed for ${reviewedLessons.length} lesson(s) and ${itemTotal} scored items: canonical evidence, hints, fixes, correct-answer explanations, timing, and retrieval are present.`
  : `Quality-review output passed for ${reviewedLessons.length} lesson(s) and ${itemTotal} scored items: learner routes, retrieval anchors, tutor evidence, and core/extension paths render correctly.`);

function validateMetadata(lesson) {
  const review = lesson.qualityReview;
  if (review.status === "unreviewed") errors.push(`${lesson.id}: an explicit qualityReview cannot claim unreviewed status`);
  if (review.generatedPedagogy && review.status !== "reviewed" && lesson.tutorReviewRequired !== true) {
    errors.push(`${lesson.id}: generated pedagogy must keep tutorReviewRequired until reviewed`);
  }
  if (review.status === "reviewed" && lesson.tutorReviewRequired) {
    errors.push(`${lesson.id}: reviewed content still requires tutor review`);
  }
}

function validateNativeLesson(lesson, source) {
  if (!/<LessonPage\b/.test(source)) {
    errors.push(`${lesson.id}: audited ready lesson must render LessonPage`);
    return;
  }
  const main = source.match(/<main\b([^>]*)>/i)?.[1] || "";
  for (const attribute of ["data-core-duration", "data-extension-duration"]) {
    if (!hasAttribute(main, attribute)) errors.push(`${lesson.id}: ${attribute} is missing from the core lesson source`);
  }
  if (!/\bdata-lesson-extension="[^"]+"/.test(source)) errors.push(`${lesson.id}: no named optional extension is registered`);

  const retrievalLink = source.match(/\bhref="#([^"]*retrieval[^"]*)"/i)?.[1];
  if (!retrievalLink) errors.push(`${lesson.id}: next-use guidance does not link to a retrieval section`);
  else if (!new RegExp(`\\bid="${escapeRegExp(retrievalLink)}"`).test(source)) {
    errors.push(`${lesson.id}: retrieval link #${retrievalLink} has no matching section id`);
  }

  const itemContracts = [
    ["choice gap", /<button\b(?=[^>]*\bdata-choice-gap(?:\s|=|>))[^>]*>/gi, ["data-answer", "data-hint", "data-fix"]],
    ["typed answer", /<input\b(?=[^>]*\bdata-answer=)[^>]*>/gi, ["data-answer", "data-hint", "data-fix", "aria-label"]],
    ["matching slot", /<button\b(?=[^>]*\bdata-slot=)[^>]*>/gi, ["data-slot", "data-hint", "data-fix"]],
    ["sentence builder", /<div\b(?=[^>]*\bdata-tile-builder(?:\s|=|>))[^>]*>/gi, ["data-answer", "data-hint", "data-fix"]],
    ["error repair", /<div\b(?=[^>]*\bdata-spot-error(?:\s|=|>))[^>]*>/gi, ["data-answer", "data-hint", "data-fix", "data-why"]],
    ["quiz item", /<div\b(?=[^>]*\bdata-quiz-item(?:\s|=|>))[^>]*>/gi, ["data-answer", "data-hint", "data-fix"]],
  ];

  let itemCount = 0;
  for (const [label, pattern, attributes] of itemContracts) {
    const tags = [...source.matchAll(pattern)].map((match) => match[0]);
    itemCount += tags.length;
    tags.forEach((tag, index) => {
      for (const attribute of attributes) {
        if (!hasAttribute(tag, attribute)) errors.push(`${lesson.id}: ${label} ${index + 1} is missing ${attribute}`);
      }
    });
  }
  if (itemCount !== lesson.qualityReview.scoredItemCount) {
    errors.push(`${lesson.id}: qualityReview records ${lesson.qualityReview.scoredItemCount} scored items, but source contains ${itemCount}`);
  }

  const successRoots = [
    ["choice-gap drill", /<div\b(?=[^>]*\bdata-choice-gap-drill(?:\s|=|>))[^>]*>/gi],
    ["typed-answer drill", /<div\b(?=[^>]*\bdata-answer-drill(?:\s|=|>))[^>]*>/gi],
    ["matching drill", /<div\b(?=[^>]*\bdata-tile-game(?:\s|=|>))[^>]*>/gi],
    ["sentence builder", /<div\b(?=[^>]*\bdata-tile-builder(?:\s|=|>))[^>]*>/gi],
    ["quiz", /<div\b(?=[^>]*\bdata-quiz(?:\s|=|>))[^>]*>/gi],
  ];
  for (const [label, pattern] of successRoots) {
    const tags = [...source.matchAll(pattern)].map((match) => match[0]);
    tags.forEach((tag, index) => {
      const message = attribute(tag, "data-success-message");
      if (message.length < 35) errors.push(`${lesson.id}: ${label} ${index + 1} needs a concept-specific correct-answer explanation`);
    });
  }

  if (["A0", "A1", "A2"].includes(lesson.level)) {
    const brief = buildTutorBrief(lesson);
    if (!brief.coreDuration || !brief.extensionDuration || brief.extensionTitles.length < 1) {
      errors.push(`${lesson.id}: tutor brief does not derive a complete core/extension path`);
    }
    if (!/return|come back|next lesson|tomorrow/i.test(brief.nextUse)) {
      errors.push(`${lesson.id}: tutor brief does not derive a concrete later-retrieval action`);
    }
  }
}

function validateOutput(lesson, source) {
  const learnerPath = path.join(root, "dist", lesson.route.replace(/^\//, ""), "index.html");
  const tutorPath = path.join(root, "dist/tutor/plans", lesson.id, "index.html");
  if (!existsSync(learnerPath)) {
    errors.push(`${lesson.id}: generated learner route is missing`);
  } else {
    const html = readFileSync(learnerPath, "utf8");
    const retrievalId = source.match(/\bhref="#([^"]*retrieval[^"]*)"/i)?.[1];
    if (retrievalId && !html.includes(`id="${retrievalId}"`)) errors.push(`${lesson.id}: rendered retrieval anchor is missing`);
    if (!html.includes(`data-core-duration=`) || !html.includes(`data-extension-duration=`)) {
      errors.push(`${lesson.id}: rendered core/extension timing is missing`);
    }
  }
  if (!existsSync(tutorPath)) {
    errors.push(`${lesson.id}: generated tutor plan is missing`);
  } else {
    const html = readFileSync(tutorPath, "utf8");
    for (const fragment of [
      `data-quality-review-status="${lesson.qualityReview.status}"`,
      `data-learner-pilot-count="${lesson.qualityReview.learnerPilotCount}"`,
      "data-tutor-extension-path",
    ]) {
      if (!html.includes(fragment)) errors.push(`${lesson.id}: tutor plan is missing ${fragment}`);
    }
  }
}

function hasAttribute(tag, name) {
  return new RegExp(`\\b${name}="[^"]+"`).test(tag);
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]?.trim() || "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
