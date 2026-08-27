import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLesson } from "../src/data/lesson-catalog.mjs";
import { assertLessonMetadata } from "../src/data/lesson-schema.mjs";
import { buildTutorBrief } from "../src/lib/tutor-plan.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceOnly = process.argv.includes("--source");
const outputOnly = process.argv.includes("--output");
const errors = [];
const lesson = getLesson("a1/present-simple");

if (!lesson) {
  errors.push("a1/present-simple: canonical lesson record is missing");
} else {
  validateSource();
  if (!sourceOnly) validateOutput();
}

if (errors.length) {
  console.error(`\nPresent Simple QA validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(outputOnly
  ? "Present Simple QA output passed: the learner route, retrieval anchor, tutor review evidence, core timing, and extension route render correctly."
  : sourceOnly
    ? "Present Simple QA source passed: 43 scored items have contextual help, review claims remain evidence-based, and core plus retrieval paths are registered."
    : "Present Simple QA passed in source and rendered output.");

function validateSource() {
  if (lesson.route !== "/lessons/a1/present-simple/") errors.push("clean learner route changed");
  if (lesson.legacyRoute !== "/lessons/a1/present-simple.html") errors.push("historical .html route changed");
  if (lesson.status !== "ready" || lesson.sequence !== 1) errors.push("availability or A1 sequence changed");
  if (lesson.tutorReviewRequired !== true) errors.push("generated editorial work must remain marked for tutor review");

  const review = lesson.qualityReview;
  if (!review) errors.push("canonical qualityReview evidence is missing");
  else {
    if (review.status !== "editorial-review") errors.push(`expected editorial-review status, found ${review.status}`);
    if (review.generatedPedagogy !== true) errors.push("generatedPedagogy must remain explicit");
    if (review.learnerPilotCount !== 0) errors.push("learnerPilotCount must stay at zero until real pilot evidence is recorded");
    if (review.reviewedBy || review.reviewedOn) errors.push("the lesson cannot carry tutor sign-off before the learner pilots");
  }
  validateReviewClaimGuards();

  const source = readFileSync(path.join(root, lesson.source), "utf8");
  for (const [description, fragment] of [
    ["core duration", 'data-core-duration="45–55 min"'],
    ["optional extension duration", 'data-extension-duration="10–15 min"'],
    ["next-day retrieval anchor", 'id="next-day-retrieval"'],
    ["next-use link", 'href="#next-day-retrieval"'],
    ["contextual first quiz item", "This is my regular schedule"],
    ["contextual short-answer item", "Do you work on Mondays?"],
    ["contextual question-form item", "Nina’s normal Saturday schedule"],
  ]) {
    if (!source.includes(fragment)) errors.push(`${description} is missing`);
  }
  if (/data-answer="work"[^>]*>\s*<p[^>]*>1\. I ___ from home on Mondays\./.test(source)) {
    errors.push("the old context-free first quiz item returned");
  }

  const tagContracts = [
    {
      label: "choice gaps",
      pattern: /<button\b(?=[^>]*\bdata-choice-gap(?:\s|=|>))[^>]*>/gi,
      expected: 20,
      attributes: ["data-answer", "data-hint", "data-fix"],
    },
    {
      label: "typed answers",
      pattern: /<input\b(?=[^>]*\bdata-answer=)[^>]*>/gi,
      expected: 6,
      attributes: ["data-answer", "data-hint", "data-fix", "aria-label"],
    },
    {
      label: "matching slots",
      pattern: /<button\b(?=[^>]*\bdata-slot=)[^>]*>/gi,
      expected: 4,
      attributes: ["data-slot", "data-hint", "data-fix"],
    },
    {
      label: "sentence builders",
      pattern: /<div\b(?=[^>]*\bdata-tile-builder(?:\s|=|>))[^>]*>/gi,
      expected: 2,
      attributes: ["data-answer", "data-hint", "data-fix"],
    },
    {
      label: "error repairs",
      pattern: /<div\b(?=[^>]*\bdata-spot-error(?:\s|=|>))[^>]*>/gi,
      expected: 3,
      attributes: ["data-answer", "data-hint", "data-fix", "data-why"],
    },
    {
      label: "final quiz items",
      pattern: /<div\b(?=[^>]*\bdata-quiz-item(?:\s|=|>))[^>]*>/gi,
      expected: 8,
      attributes: ["data-answer", "data-hint", "data-fix"],
    },
  ];

  for (const contract of tagContracts) {
    const tags = [...source.matchAll(contract.pattern)].map((match) => match[0]);
    if (tags.length !== contract.expected) {
      errors.push(`${contract.label}: expected ${contract.expected}, found ${tags.length}`);
    }
    tags.forEach((tag, index) => {
      for (const attribute of contract.attributes) {
        if (!new RegExp(`\\b${attribute}="[^"]+"`).test(tag)) {
          errors.push(`${contract.label} item ${index + 1}: ${attribute} is missing or empty`);
        }
      }
    });
  }

  const scoredItemCount = tagContracts.reduce((total, contract) => total + contract.expected, 0);
  if (scoredItemCount !== 43) errors.push(`regression fixture expected 43 scored items, found ${scoredItemCount}`);

  const brief = buildTutorBrief(lesson);
  if (brief.coreDuration !== "45–55 min") errors.push(`tutor core duration is ${brief.coreDuration || "missing"}`);
  if (brief.extensionDuration !== "10–15 min") errors.push(`tutor extension duration is ${brief.extensionDuration || "missing"}`);
  if (!brief.extensionTitles.includes("Spelling reference for third-person forms")) errors.push("spelling extension is missing from the tutor brief");
  if (!brief.extensionTitles.includes("Five-minute next-day retrieval")) errors.push("retrieval extension is missing from the tutor brief");
  if (!/Return tomorrow without rereading/i.test(brief.nextUse)) errors.push("lesson-specific next-use retrieval is not derived into the tutor brief");
}

function validateReviewClaimGuards() {
  const metadata = Object.fromEntries([
    "title",
    "slug",
    "level",
    "topic",
    "category",
    "contentType",
    "status",
    "description",
    "sequence",
    "prerequisites",
    "related",
    "assessments",
  ].map((key) => [key, lesson[key]]));
  const signedReview = {
    status: "reviewed",
    generatedPedagogy: true,
    learnerPilotCount: 2,
    scoredItemCount: 43,
    revisionSummary: "Fixture proving that review evidence cannot be promoted too early.",
    reviewedBy: "Tutor fixture",
    reviewedOn: "2026-07-16",
  };

  expectMetadataFailure(
    { ...metadata, tutorReviewRequired: false, qualityReview: signedReview },
    /at least three learner pilots/,
    "review status accepted fewer than three learner pilots",
  );
  expectMetadataFailure(
    { ...metadata, tutorReviewRequired: true, qualityReview: { ...signedReview, learnerPilotCount: 3 } },
    /cannot still require tutor review/,
    "review status accepted an unresolved tutor-review requirement",
  );
}

function expectMetadataFailure(metadata, expected, message) {
  try {
    assertLessonMetadata(metadata, "present-simple-review-fixture");
    errors.push(message);
  } catch (error) {
    if (!expected.test(error.message)) errors.push(`${message}: unexpected error ${error.message}`);
  }
}

function validateOutput() {
  const learnerPath = path.join(root, "dist/lessons/a1/present-simple/index.html");
  const tutorPath = path.join(root, "dist/tutor/plans/a1/present-simple/index.html");
  if (!existsSync(learnerPath)) {
    errors.push("generated learner route is missing");
  } else {
    const html = readFileSync(learnerPath, "utf8");
    for (const fragment of [
      'id="next-day-retrieval"',
      'data-core-duration="45–55 min"',
      'data-extension-duration="10–15 min"',
      "This is my regular schedule",
    ]) {
      if (!html.includes(fragment)) errors.push(`learner output is missing ${fragment}`);
    }
  }
  if (!existsSync(tutorPath)) {
    errors.push("generated tutor plan is missing");
  } else {
    const html = readFileSync(tutorPath, "utf8");
    for (const fragment of [
      'data-tutor-review-required="true"',
      'data-quality-review-status="editorial-review"',
      'data-learner-pilot-count="0"',
      "45–55 min core",
      "Five-minute next-day retrieval",
    ]) {
      if (!html.includes(fragment)) errors.push(`tutor output is missing ${fragment}`);
    }
  }
}
