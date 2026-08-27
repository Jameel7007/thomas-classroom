import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const base = normalizeBase(argument("--base") || process.env.GITHUB_PAGES_BASE || "");
const origin = normalizeOrigin(argument("--origin") || process.env.GITHUB_PAGES_ORIGIN || "");

if (!base) throw new Error("A project base such as /thomas-classroom is required.");
if (!origin) throw new Error("A public origin such as https://jameel7007.github.io is required.");
if (!(await exists(path.join(dist, "index.html")))) throw new Error("dist/index.html is missing. Run npm run build first.");

const files = await sourceFiles(dist);
let changedFiles = 0;
let prefixedReferences = 0;

for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  if (![".html", ".css", ".xml", ".txt"].includes(extension)) continue;
  const original = await readFile(file, "utf8");
  let output = prefixPublicOrigin(original);

  if (extension === ".html") output = prefixHtml(output);
  if (extension === ".css") output = prefixCss(output);

  if (output !== original) {
    await writeFile(file, output, "utf8");
    changedFiles += 1;
  }
}

await writeFile(path.join(dist, ".nojekyll"), "", "utf8");
await validatePreparedOutput();

console.log(`GitHub Pages artifact prepared: ${changedFiles} files updated, ${prefixedReferences} root references prefixed with ${base}, canonical origin ${origin}${base}/.`);

function prefixHtml(value) {
  const baseSegment = escapeRegExp(base.slice(1));
  const rootAttribute = new RegExp(`\\b(href|src|action|poster|data-audio-src)=(["'])\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "gi");
  const refreshUrl = new RegExp(`(\\burl=)\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "gi");
  const srcset = /\bsrcset=(["'])([^"']+)\1/gi;

  value = value.replace(rootAttribute, (_match, name, quote) => {
    prefixedReferences += 1;
    return `${name}=${quote}${base}/`;
  });
  value = value.replace(refreshUrl, (_match, prefix) => {
    prefixedReferences += 1;
    return `${prefix}${base}/`;
  });
  return value.replace(srcset, (_match, quote, candidates) => {
    const prefixed = candidates.replace(/(^|,\s*)\/(?!\/)/g, (_candidate, separator) => {
      prefixedReferences += 1;
      return `${separator}${base}/`;
    });
    return `srcset=${quote}${prefixed}${quote}`;
  });
}

function prefixCss(value) {
  const baseSegment = escapeRegExp(base.slice(1));
  const rootUrl = new RegExp(`url\\((["']?)\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "gi");
  return value.replace(rootUrl, (_match, quote) => {
    prefixedReferences += 1;
    return `url(${quote}${base}/`;
  });
}

function prefixPublicOrigin(value) {
  const baseSegment = escapeRegExp(base.slice(1));
  const rootOrigin = new RegExp(`${escapeRegExp(origin)}\\/(?!${baseSegment}(?:\\/|$))`, "g");
  return value.replace(rootOrigin, `${origin}${base}/`);
}

async function validatePreparedOutput() {
  const errors = [];
  const baseSegment = escapeRegExp(base.slice(1));
  const unprefixedHtml = new RegExp(`\\b(?:href|src|action|poster|data-audio-src)=(["'])\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "i");
  const unprefixedRefresh = new RegExp(`\\burl=\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "i");
  const unprefixedCss = new RegExp(`url\\((["']?)\\/(?!\\/|${baseSegment}(?:\\/|["']))`, "i");

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (![".html", ".css", ".xml", ".txt"].includes(extension)) continue;
    const value = await readFile(file, "utf8");
    const relative = path.relative(dist, file);
    if (extension === ".html" && (unprefixedHtml.test(value) || unprefixedRefresh.test(value))) {
      errors.push(`${relative}: unprefixed root-relative HTML reference remains`);
    }
    if (extension === ".css" && unprefixedCss.test(value)) {
      errors.push(`${relative}: unprefixed root-relative CSS reference remains`);
    }
  }

  const homepage = await readFile(path.join(dist, "index.html"), "utf8");
  const notFound = await readFile(path.join(dist, "404.html"), "utf8");
  const sitemap = await readFile(path.join(dist, "sitemap-index.xml"), "utf8");
  if (!homepage.includes(`href="${base}/curriculum/"`)) errors.push("homepage curriculum link was not prefixed");
  if (!homepage.includes(`${origin}${base}/`)) errors.push("homepage canonical metadata does not use the project URL");
  if (!notFound.includes(`href="${base}/curriculum/"`)) errors.push("custom 404 recovery links were not prefixed");
  if (!sitemap.includes(`${origin}${base}/sitemap-0.xml`)) errors.push("sitemap index does not use the project URL");
  if (errors.length) throw new Error(`GitHub Pages artifact validation failed:\n- ${errors.join("\n- ")}`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeBase(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function normalizeOrigin(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const url = new URL(trimmed);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("GitHub Pages origin must be an HTTPS origin without a path, query, or fragment.");
  }
  return url.origin;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(full));
    else output.push(full);
  }
  return output;
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}
