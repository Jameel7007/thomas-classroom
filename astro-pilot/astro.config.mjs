import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const legacyRedirects = {
  "/English Curriculum Map.html": "/curriculum/",
};

for (const level of ["a0", "a1", "a2", "b1", "b2"]) {
  const directory = new URL(`../outputs/lessons/${level}/`, import.meta.url);
  try {
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".html") && !name.startsWith("_"))) {
      const originalSlug = file.replace(/\.html$/, "");
      const targetSlug = originalSlug === "some-any-with-countable-uncountable-nouns"
        ? "some-any-with-countable-and-uncountable-nouns"
        : originalSlug;
      legacyRedirects[`/lessons/${level}/${file}`] = `/lessons/${level}/${targetSlug}/`;
    }
  } catch {
    // Higher levels do not have legacy directories yet.
  }
}

for (const file of readdirSync(new URL("../outputs/assessments/", import.meta.url)).filter((name) => name.endsWith(".html"))) {
  legacyRedirects[`/assessments/${file}`] = `/assessments/${file.replace(/\.html$/, "")}/`;
}

export default defineConfig({
  // Set SITE_URL to the production domain before the first public build.
  site: process.env.SITE_URL || "http://localhost:4321",
  output: "static",
  integrations: [mdx(), sitemap()],
  redirects: legacyRedirects,
  // The pilot deliberately reuses the live legacy styles and interaction
  // engine so visual/behavioral changes are not mixed into the migration.
  vite: {
    server: {
      fs: { allow: [workspaceRoot] },
      // During authoring, run `node ../server.mjs` on port 8090 to retain the
      // existing ElevenLabs proxy while Astro handles pages and hot reload.
      proxy: { "/api/voice": "http://127.0.0.1:8090" },
    },
  },
});
