import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const distRoot = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];

const fonts = [
  ["fonts/albert-sans/albert-sans-variable.ttf", "8fe5d4cf5822d7096d4d17ad781c90f97c745ac13a22be619db74966fba45fda"],
  ["fonts/fraunces/fraunces-variable-italic.ttf", "b24448c43702fac4ee856781d461a0dfba8d8e594b6e8e190234b75fed2c0e01"],
  ["fonts/fraunces/fraunces-variable.ttf", "177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb"],
  ["fonts/ibm-plex-mono/ibm-plex-mono-medium.ttf", "a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755"],
  ["fonts/ibm-plex-mono/ibm-plex-mono-regular.ttf", "6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46"],
  ["fonts/ibm-plex-sans/ibm-plex-sans-variable.ttf", "3b031aa4216174205bd8471f88a49b91f093169e9e87bd5262242bc5967fe2e3"],
  ["fonts/newsreader/newsreader-variable-italic.ttf", "796668611f80b64d5adf182fde3b6f29ed83b4e7cbec7b96937e84ac01364792"],
  ["fonts/newsreader/newsreader-variable.ttf", "8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1"],
];

const cssPath = path.join(root, "src/styles/fonts.css");
if (!existsSync(cssPath)) {
  errors.push("src/styles/fonts.css: shared self-hosted font declarations are missing");
} else {
  const css = readFileSync(cssPath, "utf8");
  const faces = css.match(/@font-face\s*\{[^}]+\}/g) || [];
  if (faces.length !== fonts.length) errors.push(`src/styles/fonts.css: expected ${fonts.length} font faces, found ${faces.length}`);
  for (const face of faces) {
    if (!/font-display\s*:\s*swap/.test(face)) errors.push("src/styles/fonts.css: every font face must use font-display: swap");
    if (!/src\s*:\s*url\("\/fonts\/.+\.ttf"\)\s*format\("truetype"\)/.test(face)) errors.push("src/styles/fonts.css: every font face must reference a local TrueType file");
  }
  for (const [relative] of fonts) {
    if (!css.includes(`/${relative}`)) errors.push(`src/styles/fonts.css: /${relative} is not registered`);
  }
  for (const family of ["Fraunces", "Albert Sans", "Newsreader", "IBM Plex Sans", "IBM Plex Mono"]) {
    if (!css.includes(`font-family:\"${family}\"`)) errors.push(`src/styles/fonts.css: ${family} is not registered`);
  }
}

const fontStylesComponentPath = path.join(root, "src/components/FontStyles.astro");
if (!existsSync(fontStylesComponentPath)) {
  errors.push("src/components/FontStyles.astro: shared font stylesheet link is missing");
} else {
  const component = readFileSync(fontStylesComponentPath, "utf8");
  if (!/fonts\.css\?url/.test(component) || !/<link\s+rel="stylesheet"\s+href=\{stylesheet\}/.test(component)) {
    errors.push("src/components/FontStyles.astro: fonts.css must be emitted once as a linked Astro asset");
  }
}

for (const file of walk(path.join(root, "src/styles")).filter((entry) =>
  entry.endsWith(".css") && entry !== cssPath)) {
  if (/[@]import[^;]*fonts\.css/.test(readFileSync(file, "utf8"))) {
    errors.push(`${path.relative(root, file)}: fonts.css must not be duplicated through CSS imports`);
  }
}

for (const relative of [
  "src/layouts/SiteLayout.astro",
  "src/components/lesson/LessonPage.astro",
  "src/components/assessment/AssessmentPage.astro",
  "src/components/assessment/QuickCheckPage.astro",
  "src/pages/index.astro",
  "src/pages/curriculum/print.astro",
]) {
  const source = readFileSync(path.join(root, relative), "utf8");
  if (!/import FontStyles from/.test(source) || !/<FontStyles\s*\/>/.test(source)) {
    errors.push(`${relative}: shared FontStyles link is missing`);
  }
}

for (const license of ["fonts/OFL-1.1.txt", "fonts/NOTICE.md"]) {
  if (!existsSync(path.join(publicRoot, license))) errors.push(`public/${license}: font licensing notice is missing`);
}

validateFontCopies(publicRoot, "public");
rejectExternalFontRequests([path.join(root, "src"), publicRoot], "source");

if (!sourceOnly) {
  if (!existsSync(distRoot)) {
    errors.push("dist: production output is missing");
  } else {
    validateFontCopies(distRoot, "dist");
    rejectExternalFontRequests([distRoot], "output");
    if (existsSync(path.join(distRoot, "font-source-staging.html"))) errors.push("dist/font-source-staging.html: temporary acquisition page must not ship");
    const generatedCssFiles = walk(distRoot).filter((file) => file.endsWith(".css"));
    const generatedCss = generatedCssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const [relative] of fonts) {
      if (!generatedCss.includes(`/${relative}`)) errors.push(`generated CSS does not reference /${relative}`);
    }
    const emittedFontStylesheets = generatedCssFiles.filter((file) =>
      readFileSync(file, "utf8").includes("/fonts/fraunces/fraunces-variable.ttf"));
    if (emittedFontStylesheets.length !== 1) {
      errors.push(`generated output must contain one shared font stylesheet; found ${emittedFontStylesheets.length}`);
    } else {
      const fontHref = `/${path.relative(distRoot, emittedFontStylesheets[0]).split(path.sep).join("/")}`;
      for (const file of walk(distRoot).filter((entry) => entry.endsWith(".html"))) {
        const html = readFileSync(file, "utf8");
        if (/http-equiv=["']refresh["']/i.test(html)) continue;
        if (!html.includes(`href="${fontHref}"`)) {
          errors.push(`${path.relative(distRoot, file)}: shared font stylesheet link is missing`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`Font validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(sourceOnly
  ? "Self-hosted font source verified: 5 families, 8 licensed local files, no Google Fonts runtime requests."
  : "Self-hosted font output verified: 5 families, 8 immutable local files, local CSS references, and no external font requests.");

function validateFontCopies(base, label) {
  for (const [relative, expectedHash] of fonts) {
    const file = path.join(base, relative);
    if (!existsSync(file)) {
      errors.push(`${label}/${relative}: font file is missing`);
      continue;
    }
    if (statSync(file).size < 100_000) errors.push(`${label}/${relative}: font file is unexpectedly small`);
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (hash !== expectedHash) errors.push(`${label}/${relative}: font checksum does not match the approved source`);
  }
}

function rejectExternalFontRequests(roots, label) {
  const textExtensions = new Set([".astro", ".css", ".html", ".js", ".mjs", ".md", ".txt"]);
  for (const directory of roots) {
    if (!existsSync(directory)) continue;
    for (const file of walk(directory)) {
      if (!textExtensions.has(path.extname(file))) continue;
      const value = readFileSync(file, "utf8");
      if (/fonts\.(?:googleapis|gstatic)\.com/.test(value)) errors.push(`${path.relative(root, file)}: ${label} still contains an external Google Fonts request`);
    }
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
