import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { readyLessons } from "./src/data/lesson-catalog.mjs";
import { legacyRedirects } from "./src/data/legacy-redirects.mjs";

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
  integrations: [nativeLessonRoutes(), mdx(), sitemap({
    filter: (page) => !page.endsWith("/404/")
      && !page.endsWith("/404.html")
      && !page.endsWith("/curriculum/print/")
      && !page.includes("/tutor/plans/")
      && !page.includes("/tutor/readings/")
      && !page.endsWith("/tutor/review-builder/"),
  })],
  redirects: legacyRedirects,
});
