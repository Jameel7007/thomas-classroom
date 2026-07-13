import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lessonCatalog, readyLessons } from "../src/data/lesson-catalog.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fingerprints = JSON.parse(await readFile(path.join(projectRoot, "src/data/migration-fingerprints.json"), "utf8"));
const voiceScripts = JSON.parse(await readFile(path.join(projectRoot, "private/voice-scripts.json"), "utf8"));
const errors = [];
const lessonPages = readyLessons.map((lesson) => ({ ...lesson, ...fingerprints.lessons[lesson.id] }));
const assessmentPages = fingerprints.assessments;

const lessonSources = await sourceFiles(path.join(projectRoot, "src/content/lessons"));
const assessmentSources = await sourceFiles(path.join(projectRoot, "src/content/assessments"));
if (lessonSources.length !== lessonCatalog.length) errors.push(`Expected ${lessonCatalog.length} native lesson records; found ${lessonSources.length}.`);
if (assessmentSources.length !== 7) errors.push(`Expected 7 native assessment sources; found ${assessmentSources.length}.`);

for (const page of [...lessonPages, ...assessmentPages]) {
  if (!page.contentTextHash || !page.interactionCounts || !page.audioClips) {
    errors.push(`${page.route}: preservation fingerprint is missing.`);
    continue;
  }
  const sourcePath = path.join(projectRoot, page.source.replace(/^src\//, "src/"));
  if (!(await exists(sourcePath))) errors.push(`${page.route}: missing native source ${page.source}.`);
  const outputPath = routeOutput(page.route);
  if (!(await exists(outputPath))) {
    errors.push(`${page.route}: direct-refresh output is missing.`);
    continue;
  }
  const html = await readFile(outputPath, "utf8");
  const content = page.route.startsWith("/lessons/")
    ? html.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    : html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!content) {
    errors.push(`${page.route}: learner content container is missing.`);
    continue;
  }
  if (textHash(content) !== page.contentTextHash) errors.push(`${page.route}: learner-visible text does not match its migration fingerprint.`);
  const actualInteractions = dataAttributeCounts(content);
  for (const [name, expected] of Object.entries(page.interactionCounts)) {
    if (actualInteractions[name] !== expected) errors.push(`${page.route}: ${name} count is ${actualInteractions[name] || 0}; expected ${expected}.`);
  }
  for (const clip of page.audioClips) {
    if (!voiceScripts[clip]) errors.push(`${page.route}: audio clip ${clip} is missing from private/voice-scripts.json.`);
  }
}

for (const relative of ["src", "astro.config.mjs"]) {
  const files = relative === "src" ? await sourceFiles(path.join(projectRoot, relative)) : [path.join(projectRoot, relative)];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/<iframe\b/i.test(source)) errors.push(`${path.relative(projectRoot, file)}: iframe found.`);
    if (/LegacyDocument|legacy-pages|legacy-assets/i.test(source)) errors.push(`${path.relative(projectRoot, file)}: compatibility-layer reference found.`);
    if (/import\.meta\.glob\([^)]*\.html|\.html\?raw|outputs\/.+\?raw/i.test(source)) errors.push(`${path.relative(projectRoot, file)}: runtime HTML loader found.`);
    if (/<Fragment\b[^>]*set:html/i.test(source)) errors.push(`${path.relative(projectRoot, file)}: injected document fragment found.`);
  }
}

for (const page of [...lessonPages, ...assessmentPages]) {
  const oldRoute = page.route.replace(/\/$/, ".html");
  const redirectPath = routeOutput(oldRoute);
  if (!(await exists(redirectPath))) errors.push(`${oldRoute}: historical redirect output is missing.`);
}
const aliasRedirect = routeOutput("/lessons/a1/some-any-with-countable-uncountable-nouns.html");
if (!(await exists(aliasRedirect))) errors.push("Historical some/any alias redirect is missing.");

if (errors.length) {
  console.error(`Native migration validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Native migration verified: ${lessonCatalog.length} canonical lesson records (${readyLessons.length} ready), 7 assessment sources, ${lessonPages.reduce((sum, page) => sum + page.audioClips.length, 0) + assessmentPages.reduce((sum, page) => sum + page.audioClips.length, 0)} audio references, exact content fingerprints, interaction counts, clean routes, redirects, and no compatibility layer.`);

function routeOutput(route) {
  const clean = route.replace(/^\//, "").replace(/\/$/, "");
  return path.join(projectRoot, "dist", clean, "index.html");
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (/\.(?:astro|mdx?|[cm]?[jt]sx?|css|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

function textContent(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textHash(value) {
  const visible = textContent(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ""));
  return createHash("sha256").update(visible).digest("hex");
}

function dataAttributeCounts(value) {
  return [...String(value).matchAll(/\b(data-[a-z0-9-]+)(?=[\s=>])/gi)]
    .reduce((counts, match) => {
      const name = match[1].toLowerCase();
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
}
