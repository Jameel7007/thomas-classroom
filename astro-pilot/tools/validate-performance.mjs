import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const errors = [];

if (!existsSync(dist)) {
  console.error("Performance validation failed: dist is missing");
  process.exit(1);
}

const files = walk(dist).map((file) => ({ file, bytes: statSync(file).size }));
const bundles = files.filter(({ file }) => file.startsWith(path.join(dist, "_astro") + path.sep));
const scripts = bundles.filter(({ file }) => file.endsWith(".js"));
const styles = bundles.filter(({ file }) => file.endsWith(".css"));
const html = files.filter(({ file }) => file.endsWith(".html"));
const publicAssets = files.filter(({ file }) => file.startsWith(path.join(dist, "assets") + path.sep));
const fonts = files.filter(({ file }) => file.startsWith(path.join(dist, "fonts") + path.sep) && /\.(?:ttf|woff2?)$/.test(file));

for (const asset of scripts) {
  if (asset.bytes > 35 * 1024) errors.push(`${relative(asset.file)} is ${kb(asset.bytes)} KB; individual JavaScript budget is 35 KB`);
}
for (const asset of styles) {
  if (asset.bytes > 45 * 1024) errors.push(`${relative(asset.file)} is ${kb(asset.bytes)} KB; individual CSS budget is 45 KB`);
}
for (const page of html) {
  if (page.bytes > 300 * 1024) errors.push(`${relative(page.file)} is ${kb(page.bytes)} KB; generated HTML budget is 300 KB`);
}
for (const asset of publicAssets) {
  if (asset.bytes > 80 * 1024) errors.push(`${relative(asset.file)} is ${kb(asset.bytes)} KB; individual public-asset budget is 80 KB`);
}
for (const font of fonts) {
  if (font.bytes > 600 * 1024) errors.push(`${relative(font.file)} is ${kb(font.bytes)} KB; individual font budget is 600 KB`);
}

const scriptBytes = total(scripts);
const styleBytes = total(styles);
const bundleBytes = scriptBytes + styleBytes;
const bundleBudget = 200 * 1024;
const bundleHeadroom = bundleBudget - bundleBytes;
const fontBytes = total(fonts);
const publicAssetBytes = total(publicAssets);
const htmlBytes = total(html);
const averageHtmlBytes = html.length ? htmlBytes / html.length : 0;
const distBytes = total(files);
const nonHtmlBytes = distBytes - htmlBytes;
// A static curriculum archive should grow when it gains lessons, tutor plans,
// redirects, and field notes. Keep transfer-sensitive budgets strict and make
// the archive gate scale with its generated page count instead of enforcing a
// fixed raw ceiling that eventually penalizes substantive learner content.
const averageHtmlBudget = 40 * 1024;
const nonHtmlBudget = 5 * 1024 * 1024;
const publicAssetBudget = 3 * 1024 * 1024;
if (bundleBytes > bundleBudget) errors.push(`combined CSS and JavaScript is ${kb(bundleBytes)} KB; bundle budget is 200 KB`);
if (fontBytes > 3 * 1024 * 1024) errors.push(`self-hosted fonts are ${mb(fontBytes)} MB; font budget is 3 MB`);
if (publicAssetBytes > publicAssetBudget) errors.push(`public assets are ${mb(publicAssetBytes)} MB; shared asset budget is ${mb(publicAssetBudget)} MB`);
if (averageHtmlBytes > averageHtmlBudget) errors.push(`average generated HTML is ${kb(averageHtmlBytes)} KB; average page budget is ${kb(averageHtmlBudget)} KB`);
if (nonHtmlBytes > nonHtmlBudget) errors.push(`non-HTML output is ${mb(nonHtmlBytes)} MB; shared output budget is ${mb(nonHtmlBudget)} MB`);

if (errors.length) {
  console.error(`Performance validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

const largestPage = [...html].sort((a, b) => b.bytes - a.bytes)[0];
console.log(`Performance budgets verified: ${kb(scriptBytes)} KB JS, ${kb(styleBytes)} KB CSS, ${kb(bundleHeadroom)} KB bundle headroom, ${mb(fontBytes)} MB self-hosted fonts, ${mb(publicAssetBytes)} MB public assets, ${kb(averageHtmlBytes)} KB average HTML, ${mb(nonHtmlBytes)} MB shared non-HTML output, ${mb(distBytes)} MB total archive, largest page ${relative(largestPage.file)} at ${kb(largestPage.bytes)} KB.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

function total(entries) {
  return entries.reduce((sum, entry) => sum + entry.bytes, 0);
}

function relative(file) {
  return path.relative(dist, file).split(path.sep).join("/");
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}
