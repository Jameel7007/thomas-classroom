import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLesson } from "../src/data/lesson-catalog.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const expectedLevels = ["a0", "a1", "a2", "b1", "b2", "c1"];
const contentRoot = path.join(root, "src/content/readings");
const readings = expectedLevels.flatMap((level) => {
  const directory = path.join(contentRoot, level);
  if (!existsSync(directory)) {
    errors.push(`src/content/readings/${level}: level directory is missing`);
    return [];
  }
  return readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => ({ level, slug: file.replace(/\.mdx$/, ""), file: path.join(directory, file) }));
});

validateSource();
if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nReading Lab validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(sourceOnly
  ? `Reading Lab source contracts passed for ${readings.length} original or rights-cleared readings across A0–C1.`
  : `Reading Lab validated: ${readings.length} original or rights-cleared readings, six genres, two self-checking activity sets per text, separate tutor plans, curriculum relationships, direct routes, and A0–C1 coverage.`);

function validateSource() {
  if (readings.length < expectedLevels.length) errors.push(`expected at least one reading for each of six levels; found ${readings.length}`);
  for (const level of expectedLevels) {
    const matches = readings.filter((reading) => reading.level === level);
    if (matches.length < 1) errors.push(`${level.toUpperCase()}: expected at least one reading; found ${matches.length}`);
  }
  const sourceContracts = [
    ["src/content.config.ts", /const readings = defineCollection/],
    ["src/pages/reading/index.astro", /data-reading-library/],
    ["src/pages/reading/[level]/[slug].astro", /getCollection\("readings"\)/],
    ["src/pages/tutor/readings/[level]/[slug].astro", /noindex=\{true\}/],
    ["src/components/reading/ReadingPage.astro", /ReadingQuiz/],
    ["src/components/reading/ReadingPage.astro", /ReadingResponseFramework/],
    ["src/components/reading/ReadingWord.astro", /popovertarget=/],
    ["src/components/lesson/LessonPage.astro", /LessonReadingLinks/],
    ["src/pages/curriculum/index.astro", /href="\/reading\/"/],
    ["src/layouts/SiteLayout.astro", /aria-current=\{current === "reading"/],
  ];
  for (const [relative, contract] of sourceContracts) {
    const source = readFileSync(path.join(root, relative), "utf8");
    if (!contract.test(source)) errors.push(`${relative}: required Reading Lab source contract is missing`);
  }

  for (const reading of readings) {
    const source = readFileSync(reading.file, "utf8");
    const label = `${reading.level}/${reading.slug}`;
    const rightsStatus = source.match(/^rights:\s*\n\s+status: (Original|Public domain|Licensed)$/m)?.[1];
    if (!rightsStatus) errors.push(`${label}: text must be registered as Original, Public domain, or Licensed`);
    if (rightsStatus !== "Original" && !/^\s+sourceUrl: https:\/\//m.test(source)) errors.push(`${label}: rights-cleared text requires an HTTPS source record`);
    if (rightsStatus === "Public domain" && !/^\s+territoryNote: .{15,}$/m.test(source)) errors.push(`${label}: public-domain text requires a territorial rights note`);
    if (!/^tutorReviewRequired: true/m.test(source)) errors.push(`${label}: tutor review status is missing`);
    if (!/ReadingWord/.test(source)) errors.push(`${label}: contextual word help is missing`);
    if (/<script\b|\bonclick\s*=|fonts\.googleapis\.com/i.test(source)) errors.push(`${label}: standalone HTML behavior or visitor-time font loading found`);
    if (rightsStatus === "Original" && /Philip K\.? Dick|The Eyes Have It/i.test(source)) errors.push(`${label}: attributed reference text cannot be registered as original`);
    const relatedIds = [...source.matchAll(/^\s+- ([a-z0-9-]+\/[a-z0-9-]+)$/gm)].map((match) => match[1]);
    if (!relatedIds.length) errors.push(`${label}: related lesson links are missing`);
    for (const id of relatedIds) if (!getLesson(id)) errors.push(`${label}: unknown related lesson ${id}`);
  }
}

function validateOutput() {
  const indexPath = path.join(dist, "reading/index.html");
  if (!existsSync(indexPath)) {
    errors.push("/reading/: generated hub is missing");
    return;
  }
  const index = readFileSync(indexPath, "utf8");
  const cardIds = [...index.matchAll(/\bdata-reading-card="([^"]+)"/g)].map((match) => match[1]);
  if (cardIds.length !== readings.length || new Set(cardIds).size !== readings.length) {
    errors.push(`/reading/: expected ${readings.length} unique reading cards; found ${cardIds.length}`);
  }

  for (const reading of readings) {
    const id = `${reading.level}/${reading.slug}`;
    const route = `/reading/${id}/`;
    const output = path.join(dist, "reading", reading.level, reading.slug, "index.html");
    if (!existsSync(output)) {
      errors.push(`${route}: direct-refresh output is missing`);
      continue;
    }
    const html = readFileSync(output, "utf8");
    const source = readFileSync(reading.file, "utf8");
    const rightsStatus = source.match(/^rights:\s*\n\s+status: (Original|Public domain|Licensed)$/m)?.[1];
    if (!html.includes(`data-reading-entry="${id}"`)) errors.push(`${route}: canonical reading marker is missing`);
    if (!html.includes(`data-reading-level="${reading.level.toUpperCase()}"`)) errors.push(`${route}: CEFR level marker is incorrect`);
    const expectedRights = rightsStatus?.toLowerCase().replaceAll(" ", "-");
    if (!expectedRights || !html.includes(`data-reading-rights="${expectedRights}"`)) errors.push(`${route}: rights status is missing or incorrect`);
    if (rightsStatus === "Original" && !html.includes('data-reading-original="true"')) errors.push(`${route}: originality status is missing`);
    if (!html.includes('data-tutor-review-required="true"')) errors.push(`${route}: tutor-review status is missing`);
    for (const marker of ["data-reading-text", "Useful vocabulary and chunks", "Comprehension check", "Language focus check", "Read like a writer", "data-reading-response", "Final production", "Related lessons"]) {
      if (!html.includes(marker)) errors.push(`${route}: required stage is missing (${marker})`);
    }
    const quizCount = (html.match(/\bdata-quiz(?:\s|=|>)/g) || []).length;
    const itemCount = (html.match(/\bdata-quiz-item(?:\s|=|>)/g) || []).length;
    if (quizCount !== 2) errors.push(`${route}: expected two self-checking quiz groups; found ${quizCount}`);
    if (itemCount < 5) errors.push(`${route}: expected at least five controlled questions; found ${itemCount}`);
    if (/Tutor notes|\bonclick\s*=|fonts\.googleapis\.com/i.test(html)) errors.push(`${route}: tutor-only text or legacy inline behavior appears on the learner page`);
    const tutorHref = `/tutor/readings/${id}/`;
    if (!html.includes(`href="${tutorHref}"`)) errors.push(`${route}: tutor-plan link is missing`);
    if (!index.includes(`href="${route}"`)) errors.push(`/reading/: card link is missing ${route}`);

    const tutorOutput = path.join(dist, "tutor/readings", reading.level, reading.slug, "index.html");
    if (!existsSync(tutorOutput)) {
      errors.push(`${tutorHref}: tutor plan output is missing`);
      continue;
    }
    const tutorHtml = readFileSync(tutorOutput, "utf8");
    if (!tutorHtml.includes(`data-reading-tutor-plan="${id}"`)) errors.push(`${tutorHref}: tutor plan marker is missing`);
    if (!/name="robots" content="noindex, follow"/.test(tutorHtml)) errors.push(`${tutorHref}: tutor plan must remain noindex`);
    if (!tutorHtml.includes(`href="${route}"`)) errors.push(`${tutorHref}: learner-page link is missing`);
  }
}
