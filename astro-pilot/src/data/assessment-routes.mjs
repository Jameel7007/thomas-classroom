import { LESSON_LEVELS } from "./lesson-schema.mjs";

const records = [
  { slug: "a0-exit", title: "A0 End-of-Level Diagnostic", route: "/assessments/a0-exit/", kind: "exit", level: "A0", status: "ready" },
  { slug: "a1-exit", title: "A1 End-of-Level Diagnostic", route: "/assessments/a1-exit/", kind: "exit", level: "A1", status: "ready" },
  { slug: "a2-exit", title: "A2 End-of-Level Diagnostic", route: "/assessments/a2-exit/", kind: "exit", level: "A2", status: "ready" },
  { slug: "b1-exit", title: "B1 End-of-Level Diagnostic", route: "/assessments/b1-exit/", kind: "exit", level: "B1", status: "ready" },
  { slug: "b2-exit", title: "B2 End-of-Level Diagnostic", route: "/assessments/b2-exit/", kind: "exit", level: "B2", status: "ready" },
  { slug: "c1-exit", title: "C1 End-of-Level Diagnostic", route: "/assessments/c1-exit/", kind: "exit", level: "C1", status: "planned" },
  {
    slug: "placement-exam",
    title: "English Placement Diagnostic — A0 to B2",
    route: "/assessments/placement-exam/",
    kind: "placement",
    levels: ["A0", "A1", "A2", "B1", "B2"],
    status: "ready",
  },
  {
    slug: "quick-level-check",
    title: "10-Minute English Diagnostic",
    route: "/assessments/quick-level-check/",
    kind: "screening",
    levels: ["A0", "A1", "A2", "B1", "B2"],
    status: "ready",
  },
];

validateAssessmentRoutes(records);

export const assessmentRoutes = Object.freeze(records.map((record) => Object.freeze({
  ...record,
  ...(record.levels ? { levels: Object.freeze([...record.levels]) } : {}),
})));
export const readyAssessmentRoutes = Object.freeze(assessmentRoutes.filter((assessment) => assessment.status === "ready"));

const assessmentBySlug = new Map(assessmentRoutes.map((assessment) => [assessment.slug, assessment]));

export function getAssessment(slug) {
  return assessmentBySlug.get(slug);
}

export function getLevelAssessmentPath(level) {
  if (!LESSON_LEVELS.includes(level)) throw new Error(`Unknown curriculum level: ${level}`);
  const entry = level === "C1"
    ? assessmentRoutes.find((assessment) => assessment.slug === "b2-exit")
    : assessmentRoutes.find((assessment) => assessment.kind === "placement" && assessment.levels.includes(level));
  const exit = assessmentRoutes.find((assessment) => assessment.kind === "exit" && assessment.level === level);
  if (!entry || !exit) throw new Error(`${level}: complete entry and exit assessment relationships are required`);
  return Object.freeze({ entry, exit });
}

function validateAssessmentRoutes(routes) {
  const slugs = new Set();
  const publicRoutes = new Set();
  const allowedKinds = new Set(["exit", "placement", "screening"]);
  const allowedStatuses = new Set(["planned", "ready"]);

  for (const assessment of routes) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assessment.slug)) throw new Error(`Invalid assessment slug: ${assessment.slug}`);
    if (!assessment.title?.trim()) throw new Error(`${assessment.slug}: title is required`);
    if (assessment.route !== `/assessments/${assessment.slug}/`) throw new Error(`${assessment.slug}: route must match its slug`);
    if (!allowedKinds.has(assessment.kind)) throw new Error(`${assessment.slug}: invalid assessment kind ${assessment.kind}`);
    if (!allowedStatuses.has(assessment.status)) throw new Error(`${assessment.slug}: invalid assessment status ${assessment.status}`);
    if (slugs.has(assessment.slug)) throw new Error(`Duplicate assessment slug: ${assessment.slug}`);
    if (publicRoutes.has(assessment.route)) throw new Error(`Duplicate assessment route: ${assessment.route}`);
    slugs.add(assessment.slug);
    publicRoutes.add(assessment.route);

    if (assessment.kind === "exit" && !LESSON_LEVELS.includes(assessment.level)) {
      throw new Error(`${assessment.slug}: exit assessment requires one valid level`);
    }
    if (assessment.kind !== "exit") {
      if (!Array.isArray(assessment.levels) || assessment.levels.length === 0) {
        throw new Error(`${assessment.slug}: cross-level diagnostic must declare at least one level`);
      }
      if (assessment.levels.some((level) => !LESSON_LEVELS.includes(level))) {
        throw new Error(`${assessment.slug}: unknown level relationship`);
      }
      if (new Set(assessment.levels).size !== assessment.levels.length) {
        throw new Error(`${assessment.slug}: duplicate level relationship`);
      }
    }
    if (assessment.status === "planned" && assessment.kind !== "exit") {
      throw new Error(`${assessment.slug}: only level exit assessments may be planned`);
    }
  }

  for (const level of LESSON_LEVELS) {
    if (routes.filter((assessment) => assessment.kind === "exit" && assessment.level === level).length !== 1) {
      throw new Error(`${level}: expected exactly one exit assessment`);
    }
  }
}
