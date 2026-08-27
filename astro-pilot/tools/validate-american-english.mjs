import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
let sourceFilesChecked = 0;
let renderedPagesChecked = 0;

const conventions = [
  [/\bcolours?\b/giu, "color / colors"],
  [/\bfavourites?\b/giu, "favorite / favorites"],
  [/\bbehaviours?\b/giu, "behavior / behaviors"],
  [/\bneighbours?\b/giu, "neighbor / neighbors"],
  [/\bhonours?\b/giu, "honor / honors"],
  [/\bhumours?\b/giu, "humor / humors"],
  [/\brumours?\b/giu, "rumor / rumors"],
  [/\bcentres?\b/giu, "center / centers"],
  [/\btheatres?\b/giu, "theater / theaters"],
  [/\bprogrammes?\b/giu, "program / programs"],
  [/\btravell(?:ed|er|ers|ing)\b/giu, "traveled / traveler / traveling"],
  [/\bcancell(?:ed|ing)\b/giu, "canceled / canceling"],
  [/\blabell(?:ed|ing)\b/giu, "labeled / labeling"],
  [/\bmodell(?:ed|ing)\b/giu, "modeled / modeling"],
  [/\borganis(?:e|ed|es|ing|ation|ations)\b/giu, "organize / organization"],
  [/\brecognis(?:e|ed|es|ing)\b/giu, "recognize"],
  [/\brealis(?:e|ed|es|ing)\b/giu, "realize"],
  [/\banalys(?:e|ed|es|ing)\b/giu, "analyze"],
  [/\bapologis(?:e|ed|es|ing)\b/giu, "apologize"],
  [/\bcustomis(?:e|ed|es|ing)\b/giu, "customize"],
  [/\bprioritis(?:e|ed|es|ing)\b/giu, "prioritize"],
  [/\bsummaris(?:e|ed|es|ing)\b/giu, "summarize"],
  [/\bemphasis(?:e|ed|es|ing)\b/giu, "emphasize"],
  [/\bspecialis(?:e|ed|es|ing)\b/giu, "specialize"],
  [/\bmaximis(?:e|ed|es|ing)\b/giu, "maximize"],
  [/\bminimis(?:e|ed|es|ing)\b/giu, "minimize"],
  [/\boptimis(?:e|ed|es|ing)\b/giu, "optimize"],
  [/\blicences?\b/giu, "license / licenses"],
  [/\bdefences?\b/giu, "defense / defenses"],
  [/\boffences?\b/giu, "offense / offenses"],
  [/\bburgl(?:e|ed|es|ing)\b/giu, "burglarize or break into"],
  [/\bgreys?\b/giu, "gray / grays"],
  [/\blearnt\b/giu, "learned"],
  [/\bwhilst\b/giu, "while"],
  [/\bamongst\b/giu, "among"],
  [/\bmaths\b/giu, "math"],
  [/\bcatalogues?\b/giu, "catalog / catalogs"],
  [/\bfulfil(?:s|led|ling|ment)?\b/giu, "fulfill / fulfillment"],
  [/\benrol(?:s|ment)?\b/giu, "enroll / enrollment"],
  [/\bjewellery\b/giu, "jewelry"],
  [/\bpyjamas?\b/giu, "pajamas"],
  [/\baeroplanes?\b/giu, "airplane / airplanes"],
  [/\bcheques?\b/giu, "check / checks"],
  [/\btyres?\b/giu, "tire / tires"],
  [/\bkerbs?\b/giu, "curb / curbs"],
  [/\baluminium\b/giu, "aluminum"],
];

for (const lesson of readyLessons) {
  validateText(`${lesson.source}: title`, lesson.title);
  validateText(`${lesson.source}: topic`, lesson.topic);
  validateText(`${lesson.source}: description`, lesson.description);
}

const sourceRoot = path.join(root, "src");
for (const file of walk(sourceRoot).filter(isLearnerSource)) {
  sourceFilesChecked += 1;
  const relative = path.relative(root, file).split(path.sep).join("/");
  const source = sanitizeSource(readFileSync(file, "utf8"));
  validateText(relative, source);
}

if (!sourceOnly) {
  if (!existsSync(outputRoot)) {
    errors.push("dist: production output is missing; run the Astro build first");
  } else {
    for (const file of walk(outputRoot).filter((entry) => entry.endsWith(".html"))) {
      const html = readFileSync(file, "utf8");
      if (/http-equiv=["']refresh["']/i.test(html)) continue;
      renderedPagesChecked += 1;
      const route = routeFor(file);
      validateText(`${route}: learner-visible text`, visibleText(html));
    }
  }
}

if (errors.length) {
  console.error(`\nAmerican English validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(sourceOnly
  ? `American English source conventions verified across ${sourceFilesChecked} learner-facing source files and ${readyLessons.length} canonical lesson records.`
  : `American English conventions verified across ${sourceFilesChecked} learner-facing source files, ${readyLessons.length} canonical lesson records, and ${renderedPagesChecked} rendered pages.`);

function validateText(label, value) {
  for (const [pattern, replacement] of conventions) {
    pattern.lastIndex = 0;
    const match = pattern.exec(String(value));
    if (!match) continue;
    errors.push(`${label}: use ${replacement} instead of “${match[0]}”${context(value, match.index, match[0].length)}`);
  }
}

function sanitizeSource(value) {
  return String(value)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/"slug"\s*:\s*"[^"]*"/g, " ")
    .replace(/\b(?:a0|a1|a2|b1|b2|c1)\/[a-z0-9]+(?:-[a-z0-9]+)*\b/gi, " ")
    .replace(/\b(?:href|src)=["'][^"']*["']/gi, " ");
}

function visibleText(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function context(value, start, length) {
  const text = String(value).replace(/\s+/g, " ");
  const before = text.slice(Math.max(0, start - 35), start);
  const after = text.slice(start + length, start + length + 35);
  return ` near “…${before}${text.slice(start, start + length)}${after}…”`;
}

function isLearnerSource(file) {
  const relative = path.relative(sourceRoot, file).split(path.sep).join("/");
  if (relative === "data/migration-fingerprints.json" || relative === "data/legacy-redirects.mjs") return false;
  return /\.(?:astro|mdx|ts|mjs|js|json)$/.test(file);
}

function routeFor(file) {
  const relative = path.relative(outputRoot, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative === "404.html") return "/404.html";
  return `/${relative.replace(/index\.html$/, "")}`;
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
