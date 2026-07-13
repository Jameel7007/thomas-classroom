import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { readyLessons } from "./src/data/lesson-catalog.mjs";
import { assessmentRoutes } from "./src/data/assessment-routes.mjs";

const legacyRedirects = {
  "/English Curriculum Map.html": "/curriculum/",
  "/English Curriculum Map-print.html": "/curriculum/print/",
};

for (const lesson of readyLessons) {
  legacyRedirects[`/lessons/${lesson.level.toLowerCase()}/${lesson.slug}.html`] = lesson.route;
}
legacyRedirects["/lessons/a1/some-any-with-countable-uncountable-nouns.html"] = "/lessons/a1/some-any-with-countable-and-uncountable-nouns/";

for (const assessment of assessmentRoutes) {
  legacyRedirects[`/assessments/${assessment.slug}.html`] = assessment.route;
}

function nativeLessonRoutes() {
  return {
    name: "thomas-classroom:lesson-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute, addWatchFile }) => {
        addWatchFile(new URL("./src/content/lessons/", import.meta.url));
        for (const lesson of readyLessons) {
          const entrypoint = new URL(`./${lesson.source}`, import.meta.url);
          addWatchFile(entrypoint);
          injectRoute({ pattern: lesson.route.replace(/\/$/, ""), entrypoint, prerender: true });
        }
      },
    },
  };
}

export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:4321",
  output: "static",
  integrations: [nativeLessonRoutes(), mdx(), sitemap()],
  redirects: legacyRedirects,
  vite: {
    server: {
      proxy: { "/api/voice": "http://127.0.0.1:8090" },
    },
  },
});
