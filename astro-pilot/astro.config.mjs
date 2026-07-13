import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { assessmentRoutes, lessonRoutes } from "./src/data/native-routes.mjs";

const legacyRedirects = {
  "/English Curriculum Map.html": "/curriculum/",
  "/English Curriculum Map-print.html": "/curriculum/print/",
};

for (const lesson of lessonRoutes) {
  legacyRedirects[`/lessons/${lesson.level.toLowerCase()}/${lesson.slug}.html`] = lesson.route;
}
legacyRedirects["/lessons/a1/some-any-with-countable-uncountable-nouns.html"] = "/lessons/a1/some-any-with-countable-and-uncountable-nouns/";

for (const assessment of assessmentRoutes) {
  legacyRedirects[`/assessments/${assessment.slug}.html`] = assessment.route;
}

export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:4321",
  output: "static",
  integrations: [mdx(), sitemap()],
  redirects: legacyRedirects,
  vite: {
    server: {
      proxy: { "/api/voice": "http://127.0.0.1:8090" },
    },
  },
});
