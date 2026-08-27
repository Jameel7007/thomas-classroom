import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLevelAssessmentPath } from "../src/data/assessment-routes.mjs";
import { getLessonNavigation, getLessonsForLevel } from "../src/data/lesson-catalog.mjs";
import { LESSON_LEVELS } from "../src/data/lesson-schema.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const validateOutput = process.argv.includes("--output");
const errors = [];
const expectedTopics = [
  "Advanced tense and aspect review",
  "Narrative tenses and viewpoint",
  "Mixed and implied conditionals",
  "Inversion after negative expressions",
  "Advanced modal meaning and stance",
  "Participle clauses",
  "Reduced relative clauses",
  "Nominalization and information density",
  "Advanced emphasis and cleft structures",
  "Advanced discourse markers and cohesion",
  "Hedging and cautious language",
  "Register, tone, and formality",
  "Concession, contrast, and counterargument",
  "Referencing and avoiding repetition",
  "Organizing complex spoken arguments",
  "Collocation and lexical precision",
  "Connotation, nuance, and implied meaning",
  "Idiomatic language and fixed expressions",
  "Phrasal verbs in formal and informal contexts",
];

const c1 = getLessonsForLevel("C1");
const ready = c1.filter((lesson) => lesson.status === "ready");
const planned = c1.filter((lesson) => lesson.status === "planned");
const curriculumSource = readFileSync(path.join(root, "src/data/curriculum-data.ts"), "utf8");
const assessmentPath = getLevelAssessmentPath("C1");

if (LESSON_LEVELS.at(-1) !== "C1") errors.push("C1 must be the final canonical curriculum level");
if (!/"code": "C1"/.test(curriculumSource)) errors.push("C1 curriculum definition is missing");
if (!/"gse": "76–84"/.test(curriculumSource)) errors.push("C1 GSE range must be 76–84");
if (c1.length !== expectedTopics.length) errors.push(`C1 has ${c1.length} records; expected ${expectedTopics.length}`);
for (const [index, topic] of expectedTopics.entries()) {
  const lesson = c1[index];
  if (!lesson) continue;
  if (lesson.sequence !== index + 1) errors.push(`${lesson.id}: expected sequence ${index + 1}`);
  if (lesson.topic !== topic) errors.push(`C1 sequence ${index + 1}: expected “${topic}”, found “${lesson.topic}”`);
  if (lesson.assessments.length !== 1 || lesson.assessments[0] !== "c1-exit") {
    errors.push(`${lesson.id}: expected one c1-exit assessment relationship`);
  }
}
if (ready.length !== 3) errors.push(`C1 has ${ready.length} ready lessons; expected 3`);
if (planned.length !== 16) errors.push(`C1 has ${planned.length} planned lessons; expected 16`);
if (ready.some((lesson) => lesson.sequence > 3)) errors.push("Only the first three C1 lessons may be ready in this batch");
if (planned.some((lesson) => lesson.sequence < 4)) errors.push("One of the first three C1 lessons is still planned");
if (ready.some((lesson) => lesson.tutorReviewRequired !== true)) {
  errors.push("Every authored C1 pilot lesson must require tutor review");
}
if (assessmentPath.entry.slug !== "b2-exit" || assessmentPath.entry.status !== "ready") {
  errors.push("C1 entry evidence must use the ready B2 exit diagnostic");
}
if (assessmentPath.exit.slug !== "c1-exit" || assessmentPath.exit.status !== "planned") {
  errors.push("C1 exit evidence must resolve to the planned c1-exit diagnostic");
}

for (const lesson of ready) {
  const source = readFileSync(path.join(root, lesson.source), "utf8");
  if (source.includes("—")) errors.push(`${lesson.id}: student-facing C1 source contains an em dash`);
  for (const contract of ["<StructuredLesson", "notice:", "discover:", "build:", "context:", "repairs:", "communicate:", "reflect:"]) {
    if (!source.includes(contract)) errors.push(`${lesson.id}: structured pedagogy contract ${contract} is missing`);
  }
}
for (const lesson of planned) {
  const source = readFileSync(path.join(root, lesson.source), "utf8");
  if (/<LessonPage\b/.test(source)) errors.push(`${lesson.id}: planned lesson renders a learner page`);
}

const firstNavigation = getLessonNavigation(ready[0]?.id);
const secondNavigation = getLessonNavigation(ready[1]?.id);
const thirdNavigation = getLessonNavigation(ready[2]?.id);
if (firstNavigation.previous || firstNavigation.next?.id !== ready[1]?.id) errors.push("C1 lesson 1 navigation is incorrect");
if (secondNavigation.previous?.id !== ready[0]?.id || secondNavigation.next?.id !== ready[2]?.id) errors.push("C1 lesson 2 navigation is incorrect");
if (thirdNavigation.previous?.id !== ready[1]?.id || thirdNavigation.next || thirdNavigation.isCourseEnd) {
  errors.push("C1 lesson 3 must stop before the planned fourth lesson without marking C1 complete");
}

if (validateOutput) validateBuiltOutput();

if (errors.length) {
  console.error(`C1 curriculum validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(validateOutput
  ? "C1 curriculum verified: 19 sequenced records, 3 reviewed-pilot routes, 16 planned topics, B2 entry evidence, planned C1 exit evidence, direct outputs, search controls, print coverage, tutor flags, sitemap status, and generated navigation."
  : "C1 source architecture verified: canonical level definition, 19 sequenced records, 3 tutor-review pilots, 16 planned topics, assessment relationships, and generated navigation.");

function validateBuiltOutput() {
  const dist = path.join(root, "dist");
  const curriculumHtml = read("curriculum/index.html");
  const diagnosticsHtml = read("assessments/index.html");
  const printHtml = read("curriculum/print/index.html");
  const sitemap = read("sitemap-0.xml");

  if (!curriculumHtml.includes('value="C1" data-finder-level')) errors.push("curriculum: C1 level filter is missing");
  if (!curriculumHtml.includes('data-curriculum-level="C1"')) errors.push("curriculum: C1 level section is missing");
  if (!diagnosticsHtml.includes('data-diagnostic-route="c1-exit"') || !diagnosticsHtml.includes('data-diagnostic-status="planned"')) errors.push("diagnostics: planned C1 exit diagnostic is not labeled");
  if (curriculumHtml.includes('href="/assessments/c1-exit/"')) errors.push("curriculum: planned C1 exit diagnostic is linked as available");
  if (diagnosticsHtml.includes('href="/assessments/c1-exit/"')) errors.push("diagnostics: planned C1 exit diagnostic is linked as available");
  if (!printHtml.includes(">C1<") || !printHtml.includes("Effective Operational Proficiency")) {
    errors.push("print curriculum: C1 section is missing");
  }

  for (const lesson of ready) {
    const output = path.join(dist, lesson.route.replace(/^\//, ""), "index.html");
    if (!existsSync(output)) {
      errors.push(`${lesson.route}: direct-refresh output is missing`);
      continue;
    }
    const html = readFileSync(output, "utf8");
    if (!html.includes('data-tutor-review-required="true"')) errors.push(`${lesson.route}: tutor-review metadata is missing`);
    if (!html.includes('"educationalLevel":"C1"')) errors.push(`${lesson.route}: C1 LearningResource metadata is missing`);
    if (!sitemap.includes(lesson.route)) errors.push(`${lesson.route}: ready C1 lesson is missing from the sitemap`);
  }
  for (const lesson of planned) {
    const output = path.join(dist, lesson.route.replace(/^\//, ""), "index.html");
    if (existsSync(output)) errors.push(`${lesson.route}: planned lesson unexpectedly has a public route`);
    if (sitemap.includes(lesson.route)) errors.push(`${lesson.route}: planned lesson unexpectedly appears in the sitemap`);
  }
  if (existsSync(path.join(dist, "assessments/c1-exit/index.html"))) errors.push("/assessments/c1-exit/: planned diagnostic unexpectedly has a public route");
  if (sitemap.includes("/assessments/c1-exit/")) errors.push("/assessments/c1-exit/: planned diagnostic unexpectedly appears in the sitemap");

  function read(relative) {
    const target = path.join(dist, relative);
    if (!existsSync(target)) {
      errors.push(`${relative}: required built output is missing`);
      return "";
    }
    return readFileSync(target, "utf8");
  }
}
