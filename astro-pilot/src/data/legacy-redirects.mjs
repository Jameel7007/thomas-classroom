import { readyAssessmentRoutes } from "./assessment-routes.mjs";
import { readyLessons } from "./lesson-catalog.mjs";

const redirects = {
  "/English Curriculum Map.html": "/curriculum/",
  "/English Curriculum Map-print.html": "/curriculum/print/",
};

for (const lesson of readyLessons) {
  redirects[`/lessons/${lesson.level.toLowerCase()}/${lesson.slug}.html`] = lesson.route;
}

// Preserve the one historical filename that predates the canonical lesson slug.
redirects["/lessons/a1/some-any-with-countable-uncountable-nouns.html"] =
  "/lessons/a1/some-any-with-countable-and-uncountable-nouns/";

for (const assessment of readyAssessmentRoutes) {
  redirects[`/assessments/${assessment.slug}.html`] = assessment.route;
}

export const legacyRedirects = Object.freeze(redirects);
