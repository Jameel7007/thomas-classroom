import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickCheckQuestions, quickCheckResults, quickCheckSpeakingTasks } from "../src/data/quick-level-check.mjs";
import { estimateQuickCheckBand, scoreQuickCheck } from "../src/lib/quick-check-scoring.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputMode = process.argv.includes("--output") || process.env.QUICK_CHECK_VALIDATE_OUTPUT === "true";
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const expectedQuestionBands = { a1: 2, a2: 2, b1: 3, b2: 3 };
const expectedResultBands = ["a0", "a1", "a2", "b1", "b2"];

expect(quickCheckQuestions.length === 10, "the quick check must contain exactly 10 language-use questions");
for (const [band, expected] of Object.entries(expectedQuestionBands)) {
  expect(quickCheckQuestions.filter((question) => question.band === band).length === expected,
    `${band.toUpperCase()} must contain ${expected} evidence question(s)`);
}

quickCheckQuestions.forEach((question, index) => {
  expect(Object.hasOwn(expectedQuestionBands, question.band), `question ${index + 1} has an unknown evidence band`);
  expect(question.prompt?.trim(), `question ${index + 1} is missing its prompt`);
  expect(question.choices?.length === 3, `question ${index + 1} must contain exactly three choices`);
  expect(new Set(question.choices || []).size === 3, `question ${index + 1} contains duplicate choices`);
  expect(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 3,
    `question ${index + 1} has an invalid answer index`);
  expect(question.why?.trim().length >= 30, `question ${index + 1} needs a meaningful answer explanation`);
});

const answerPositions = [0, 1, 2].map((position) => quickCheckQuestions.filter((question) => question.answer === position).length);
expect(Math.max(...answerPositions) - Math.min(...answerPositions) <= 1,
  `correct-answer positions are unbalanced: ${answerPositions.join("/")}`);
expect(Object.keys(quickCheckResults).sort().join("|") === [...expectedResultBands].sort().join("|"),
  "result copy must exist for A0 through the B2 checkpoint");
expect(quickCheckSpeakingTasks.map((task) => task.id).sort().join("|") === [...expectedResultBands].sort().join("|"),
  "adaptive speaking prompts must exist for every possible result");
for (const task of quickCheckSpeakingTasks) {
  expect(task.prompt?.trim().length >= 60, `${task.id}: speaking prompt is too thin`);
  expect(task.followUps?.length === 2, `${task.id}: speaking prompt must contain two follow-up questions`);
}

const correctAnswers = quickCheckQuestions.map((question) => question.answer);
const wrongAnswers = quickCheckQuestions.map((question) => (question.answer + 1) % question.choices.length);
expect(estimate(correctAnswers) === "b2", "all-correct evidence must reach the B2 checkpoint");
expect(estimate(wrongAnswers) === "a0", "all-incorrect evidence must return the A0 / Pre-A1 starting point");
expect(estimate(mixedAnswers([0, 1, 2, 3])) === "a2", "complete A1 and A2 evidence must return A2");
expect(estimate(mixedAnswers([0, 1, 2, 3, 4, 5, 6])) === "b1", "complete evidence through B1 must return B1");
expect(estimate(mixedAnswers([0, 1, 2, 3, 6, 7, 8, 9])) !== "b2",
  "a high total must not reach B2 without two correct B1 items");
expect(estimate(mixedAnswers([0, 1, 2, 4, 5, 6, 7, 8])) === "b2",
  "eight correct answers with two B1 and two B2 items must reach the B2 checkpoint");

const [pageSource, engineSource] = await Promise.all([
  readFile(path.join(root, "src/content/assessments/quick-level-check.astro"), "utf8"),
  readFile(path.join(root, "src/scripts/quick-level-check.js"), "utf8"),
]);
expect(pageSource.includes("10-Minute English Starting-Point Check"), "student-facing title must describe a starting-point check");
expect(pageSource.includes("data-quick-check-config"), "rendered question configuration is missing");
expect(pageSource.includes("data-result-profile"), "level-band evidence profile is missing");
expect(pageSource.includes("Open the speaking rubric"), "teacher speaking rubric is missing");
expect(engineSource.includes("estimateQuickCheckBand"), "level-sensitive scoring is not connected to the browser engine");
expect(engineSource.includes("showSpeakingTask"), "adaptive speaking prompt selection is missing");
expect(!engineSource.includes("level-tag"), "question level labels must not appear before the result");
expect(!/B2 range|rough placement|can handle more complex grammar/i.test(`${pageSource}\n${engineSource}`),
  "obsolete placement claims remain in the quick check");

if (outputMode) {
  const html = await readFile(path.join(root, "dist/assessments/quick-level-check/index.html"), "utf8");
  expect(html.includes("10-Minute English Starting-Point Check"), "built quick-check title is missing");
  expect((html.match(/data-speaking-task=/g) || []).length === 5, "built quick check must contain five adaptive speaking prompts");
  expect(html.includes("B2 checkpoint"), "built quick check is missing honest B2 checkpoint language");
  expect(html.includes("Open the speaking rubric"), "built quick check is missing the speaking rubric");
  expect(!html.includes("class=\"level-tag\""), "built questions expose level tags before completion");
}

if (errors.length) {
  console.error(`Quick-check validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Quick check validated: 10 balanced questions (${Object.entries(expectedQuestionBands).map(([band, count]) => `${band.toUpperCase()} ${count}`).join(", ")}), gated A0–B2 checkpoint scoring, five adaptive speaking prompts, rubric, evidence-based claims${outputMode ? ", and complete rendered output" : ""}.`);

function estimate(answers) {
  return estimateQuickCheckBand(scoreQuickCheck(quickCheckQuestions, answers));
}

function mixedAnswers(correctIndexes) {
  const correct = new Set(correctIndexes);
  return quickCheckQuestions.map((question, index) => correct.has(index) ? question.answer : (question.answer + 1) % question.choices.length);
}
