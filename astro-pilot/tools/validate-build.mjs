import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist", import.meta.url));
const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const errors = [];
let checkedReferences = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const inspectableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const route = "/" + slash(path.relative(root, file)).replace(/(?:^|\/)index\.html$/, "");
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${route}: missing title`);
  if (!/<meta\b[^>]*name="description"/i.test(html) && !/http-equiv="refresh"/i.test(html)) {
    errors.push(`${route}: missing meta description`);
  }

  for (const match of inspectableHtml.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    const reference = match[1];
    if (!reference || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(reference)) continue;
    const clean = decodeURIComponent(reference.split("#")[0].split("?")[0]);
    if (!clean) continue;
    checkedReferences += 1;
    const target = resolveBuiltReference(file, clean);
    if (!target) errors.push(`${route}: broken reference ${reference}`);
  }
}

const lessonRoutes = htmlFiles.filter((file) => /[/\\]lessons[/\\](?:a0|a1|a2|b1|b2)[/\\][^./\\]+[/\\]index\.html$/.test(file));
const assessmentRoutes = htmlFiles.filter((file) => /[/\\]assessments[/\\][^./\\]+[/\\]index\.html$/.test(file));
if (lessonRoutes.length !== 54) errors.push(`expected 54 canonical lesson routes, found ${lessonRoutes.length}`);
if (assessmentRoutes.length !== 7) errors.push(`expected 7 canonical assessment routes, found ${assessmentRoutes.length}`);

if (errors.length) {
  console.error(`\nAstro build validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 80) console.error(`- …and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(`\nValidated ${htmlFiles.length} HTML outputs, ${lessonRoutes.length} lessons, ${assessmentRoutes.length} assessments, and ${checkedReferences} local references.`);

function resolveBuiltReference(fromFile, reference) {
  let candidate = reference.startsWith("/")
    ? path.join(root, reference.replace(/^\/+/, ""))
    : path.resolve(path.dirname(fromFile), reference);
  if (existsSync(candidate) && !isDirectory(candidate)) return candidate;
  if (existsSync(candidate) && isDirectory(candidate) && existsSync(path.join(candidate, "index.html"))) return path.join(candidate, "index.html");
  if (!path.extname(candidate) && existsSync(path.join(candidate, "index.html"))) return path.join(candidate, "index.html");
  if (!path.extname(candidate) && existsSync(candidate + ".html")) return candidate + ".html";
  return null;
}

function isDirectory(target) {
  try { return readdirSync(target) && true; } catch { return false; }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

function slash(value) {
  return value.split(path.sep).join("/");
}
