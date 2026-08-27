import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lessonCatalog } from "../src/data/lesson-catalog.mjs";
import { LESSON_LEVELS } from "../src/data/lesson-schema.mjs";
import { getLevelAssessmentPath } from "../src/data/assessment-routes.mjs";
import { productionStatus } from "../src/lib/assessment-readiness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const voiceScripts = JSON.parse(await readFile(path.join(root, "private/voice-scripts.json"), "utf8"));
const assessmentScript = await readFile(path.join(root, "src/scripts/assessment.js"), "utf8");
const readinessSource = await readFile(path.join(root, "src/lib/assessment-readiness.mjs"), "utf8");
const errors = [];
const completeLevels = LESSON_LEVELS.filter((level) => {
  const lessons = lessonCatalog.filter((lesson) => lesson.level === level);
  return lessons.length > 0 && lessons.every((lesson) => lesson.status === "ready");
});
const requiredSkills = ["Grammar", "Reading", "Listening", "Speaking", "Writing"];

for (const level of completeLevels) {
  const slug = `${level.toLowerCase()}-exit`;
  const sourcePath = path.join(root, "src/content/assessments", `${slug}.astro`);
  const source = await readFile(sourcePath, "utf8");
  const count = (attribute) => (source.match(new RegExp(`\\b${attribute}(?=[\\s=>])`, "g")) || []).length;
  const itemCount = count("data-assessment-item");
  const optionCount = count("data-option");
  const creditCount = count("data-credit");
  const audioControls = [...source.matchAll(/<AudioControl\b([^>]*)\/>/g)];
  const clipIds = audioControls.map((match) => match[1].match(/\bclip="([^"]+)"/)?.[1]).filter(Boolean);

  if (!/"engine": "assessment"/.test(source)) errors.push(`${slug}: shared assessment engine is not enabled`);
  if (/class="placeholder"|Next build|coming soon/i.test(source)) errors.push(`${slug}: placeholder assessment content remains`);
  if (itemCount < 20) errors.push(`${slug}: ${itemCount} scored items; expected at least 20`);
  if (optionCount < 45 || optionCount % 3 !== 0) errors.push(`${slug}: ${optionCount} answer options; expected complete three-option questions`);
  if (creditCount < 6) errors.push(`${slug}: ${creditCount} teacher evidence criteria; expected at least 6`);
  if (clipIds.length < 2) errors.push(`${slug}: ${clipIds.length} listening clips; expected at least 2`);
  if (!/import AudioControl from/.test(source)) errors.push(`${slug}: shared static AudioControl is not imported`);
  for (const clipId of clipIds) {
    const clip = voiceScripts[clipId];
    if (!clip) errors.push(`${slug}: listening clip ${clipId} is missing from private/voice-scripts.json`);
    else {
      if (!source.includes(`src="/${clip.path}"`)) errors.push(`${slug}: listening clip ${clipId} has the wrong static MP3 path`);
      if (!source.includes(`text="${clip.text}"`)) errors.push(`${slug}: listening clip ${clipId} is missing its approved speech fallback`);
    }
  }
  for (const skill of requiredSkills) {
    if (!source.includes(`data-skill="${skill}"`)) errors.push(`${slug}: ${skill} evidence is missing`);
  }
  if (!/\bdata-production-min="60"/.test(source) || !/\bdata-listening-min="50"/.test(source)) {
    errors.push(`${slug}: live evidence thresholds must require 60% speaking, 60% writing, and 50% listening`);
  }
  for (const contract of [
    "data-assessment",
    "data-pass",
    "data-strong",
    "data-require-live-evidence",
    "data-evidence-label",
    "data-evidence-feedback",
    "data-score-text",
    "data-skill-summary",
    "data-check-assessment",
    "data-reset-assessment",
    "data-print-assessment",
    "data-feedback",
  ]) {
    if (count(contract) !== 1) errors.push(`${slug}: expected one ${contract} contract; found ${count(contract)}`);
  }
}

for (const logic of [
  "hasLiveEvidence(results, null",
  "root.dataset.evidenceLabel",
  "root.dataset.evidenceFeedback",
  "hasLiveEvidence(results, \"B2\")",
  "hasLiveEvidence(results, \"B1\")",
]) {
  if (!assessmentScript.includes(logic)) errors.push(`src/scripts/assessment.js: cross-skill readiness logic is missing ${logic}`);
}
for (const logic of [
  "speaking >= productionMinimum",
  "writing >= productionMinimum",
  "listening >= listeningMinimum",
]) {
  if (!readinessSource.includes(logic)) errors.push(`src/lib/assessment-readiness.mjs: cross-skill threshold logic is missing ${logic}`);
}
if (/hasLiveEvidence\(teacherEvidence/.test(assessmentScript)) {
  errors.push("src/scripts/assessment.js: placement readiness must include recognition-based listening evidence, not teacher checkboxes alone");
}
validateReadinessScenarios();

await validatePlacementExam();

for (const level of completeLevels) {
  const assessmentPath = getLevelAssessmentPath(level);
  if (assessmentPath.entry.slug !== "placement-exam" || assessmentPath.entry.kind !== "placement") {
    errors.push(`${level}: the curriculum entry check must resolve to the comprehensive placement exam`);
  }
  if (assessmentPath.exit.slug !== `${level.toLowerCase()}-exit` || assessmentPath.exit.kind !== "exit") {
    errors.push(`${level}: the curriculum exit check does not resolve to its level diagnostic`);
  }
}

const assessmentCss = await readFile(path.join(root, "src/styles/assessment.css"), "utf8");
for (const selector of [".choice-btn:focus-visible", ".listen-btn:focus-visible", ".assessment-btn:focus-visible", ".back:focus-visible"]) {
  if (!assessmentCss.includes(selector)) errors.push(`assessment styles: visible keyboard focus is missing for ${selector}`);
}

if (errors.length) {
  console.error(`Level assessment validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Assessment path verified for every complete level: comprehensive placement entry plus ${completeLevels.join(", ")} exit diagnostics.`);

async function validatePlacementExam() {
  const slug = "placement-exam";
  const source = await readFile(path.join(root, "src/content/assessments/placement-exam.astro"), "utf8");
  const count = (attribute) => (source.match(new RegExp(`\\b${attribute}(?=[\\s=>])`, "g")) || []).length;
  const countValue = (attribute, value) => (source.match(new RegExp(`\\b${attribute}="${escapeRegExp(value)}"`, "g")) || []).length;

  if (!/"engine": "assessment"/.test(source) || count("data-placement") !== 1) {
    errors.push(`${slug}: shared placement assessment engine is not enabled`);
  }
  if (count("data-assessment-item") < 55) errors.push(`${slug}: comprehensive diagnostic needs at least 55 scored evidence items`);
  if (count("data-option") < 150) errors.push(`${slug}: progressive recognition evidence is too thin`);
  if (count("data-credit") < 30) errors.push(`${slug}: teacher-scored production evidence is too thin`);
  if ((source.match(/class="teacher-read-box/g) || []).length < 4) errors.push(`${slug}: progressive live listening scripts are incomplete`);
  if ((source.match(/class="reading-text/g) || []).length < 4 || !/\blong-reading\b/.test(source)) {
    errors.push(`${slug}: progressive connected reading evidence is incomplete`);
  }

  const levelMinimums = { A0: 3, A1: 8, A2: 10, B1: 12, B2: 12 };
  for (const [level, minimum] of Object.entries(levelMinimums)) {
    const actual = countValue("data-level", level);
    if (actual < minimum) errors.push(`${slug}: ${level} has ${actual} evidence items; expected at least ${minimum}`);
  }

  const skillMinimums = {
    Grammar: 15,
    Vocabulary: 3,
    Reading: 10,
    Listening: 5,
    Speaking: 3,
    Writing: 3,
    "Function / Interaction": 5,
  };
  for (const [skill, minimum] of Object.entries(skillMinimums)) {
    const actual = countValue("data-skill", skill);
    if (actual < minimum) errors.push(`${slug}: ${skill} has ${actual} evidence items; expected at least ${minimum}`);
  }

  for (const contract of [
    "data-assessment",
    "data-placement-level",
    "data-placement-analysis",
    "data-level-summary",
    "data-placement-skills",
    "data-score-text",
    "data-skill-summary",
    "data-check-assessment",
    "data-reset-assessment",
    "data-print-assessment",
    "data-feedback",
  ]) {
    if (count(contract) !== 1) errors.push(`${slug}: expected one ${contract} contract; found ${count(contract)}`);
  }

  for (const phrase of [
    "not an official CEFR certificate exam",
    "Recommended starting point for lessons",
    "Level ladder from A0 to B2",
    "teacher confirms the best starting point",
  ]) {
    if (!source.toLowerCase().includes(phrase.toLowerCase())) errors.push(`${slug}: required learner-facing qualification is missing: ${phrase}`);
  }

  for (const logic of [
    "minimumFoundation",
    "enoughEvidence",
    "placementReady",
    "estimatePlacement",
    "hasLiveEvidence",
    "recommendedStart",
  ]) {
    if (!assessmentScript.includes(logic)) errors.push(`src/scripts/assessment.js: placement logic is missing ${logic}`);
  }

  if (/class="placeholder"|Next build|coming soon/i.test(source)) errors.push(`${slug}: placeholder diagnostic content remains`);
}

function validateReadinessScenarios() {
  const weakLiveEvidence = productionStatus([
    evidence("Listening", 2, 2, true),
    evidence("Speaking", 1, 5, true),
    evidence("Writing", 0, 5, false),
  ]);
  if (weakLiveEvidence.supportive ||
    weakLiveEvidence.listeningPercent !== 100 ||
    weakLiveEvidence.speakingPercent !== 20 ||
    weakLiveEvidence.writingPercent !== 0) {
    errors.push("assessment readiness: aggregate recognition cannot substitute for weak or missing production evidence");
  }

  const completeLiveEvidence = productionStatus([
    evidence("Listening", 1, 2, true),
    evidence("Speaking", 3, 5, true),
    evidence("Writing", 3, 5, true),
  ]);
  if (!completeLiveEvidence.complete || !completeLiveEvidence.supportive) {
    errors.push("assessment readiness: sufficient listening, speaking, and writing evidence should confirm the live-evidence gate");
  }

  const b2WithB1Listening = productionStatus([
    evidence("Listening", 1, 2, true, "B1"),
    evidence("Speaking", 3, 5, true, "B2"),
    evidence("Writing", 3, 5, true, "B2"),
  ], "B2");
  if (!b2WithB1Listening.supportive) {
    errors.push("placement readiness: B2 production must be able to combine with the diagnostic's B1/B2 listening evidence");
  }
}

function evidence(skill, score, points, attempted, level = "") {
  return { skill, score, points, attempted, level };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
