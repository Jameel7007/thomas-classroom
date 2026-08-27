import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteSettings } from "../src/data/site-settings.mjs";
import { hasMp3Signature } from "./audio-generation.mjs";
import { hostingRedirectsOutputPath, renderHostingRedirects } from "./generate-hosting-redirects.mjs";
import { isLocalOrPlaceholderHost } from "./release-policy.mjs";

const mode = process.argv[2] || "--output";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const publicRoot = path.join(root, "public");
const errors = [];

let site;
try {
  site = new URL(process.env.SITE_URL || "");
  if (site.protocol !== "https:") errors.push("SITE_URL must use HTTPS");
  if (isLocalOrPlaceholderHost(site.hostname)) errors.push("SITE_URL must use the final public production hostname, not a local or placeholder domain");
  if (site.pathname !== "/" || site.search || site.hash || site.username || site.password) {
    errors.push("SITE_URL must be the site origin without credentials, a path, query, or fragment");
  }
} catch {
  errors.push("SITE_URL must be a valid public HTTPS origin");
}

const bookingUrl = process.env.BOOKING_URL?.trim() || siteSettings.bookingUrl;
if (bookingUrl !== siteSettings.bookingUrl) {
  errors.push(`BOOKING_URL must match the approved destination ${siteSettings.bookingUrl}`);
}
if (!siteSettings.publicClaimsConfirmed) errors.push("The public homepage claims are not marked as approved in src/data/site-settings.mjs");
if (!/^\d+(?:\.\d+)?$/.test(siteSettings.ratingValue)) errors.push("The approved rating value is invalid in src/data/site-settings.mjs");
if (!Number.isInteger(siteSettings.reviewCount) || siteSettings.reviewCount < 1) errors.push("The approved review count is invalid in src/data/site-settings.mjs");

const clips = JSON.parse(readFileSync(path.join(root, "private/voice-scripts.json"), "utf8"));
if (mode === "--inputs") validateAudioFiles(publicRoot, "public");

if (mode === "--output" && errors.length === 0) {
  if (!existsSync(dist)) {
    errors.push("dist is missing; run the production build first");
  } else {
    const origin = site.origin;
    const htmlFiles = walk(dist).filter((file) => file.endsWith(".html"));
    for (const file of htmlFiles) {
      const html = readFileSync(file, "utf8");
      if (/http-equiv="refresh"/i.test(html)) continue;
      const route = "/" + path.relative(dist, file).split(path.sep).join("/").replace(/(?:^|\/)index\.html$/, "");
      const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
      if (!canonical?.startsWith(`${origin}/`)) errors.push(`${route}: canonical URL does not use ${origin}`);
      const openGraphUrl = html.match(/<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/i)?.[1];
      if (!openGraphUrl?.startsWith(`${origin}/`)) errors.push(`${route}: Open Graph URL does not use ${origin}`);
      const openGraphImage = html.match(/<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];
      const twitterImage = html.match(/<meta\b[^>]*name="twitter:image"[^>]*content="([^"]+)"/i)?.[1];
      if (openGraphImage !== `${origin}/assets/social-card.png`) errors.push(`${route}: Open Graph image does not use the production origin`);
      if (twitterImage !== openGraphImage) errors.push(`${route}: Twitter image does not use the production origin`);
      if (/(?:Draft lane|first local collection|drop a photo in the slot|planned assessment scope)/i.test(html)) {
        errors.push(`${route}: public draft language remains`);
      }
      if (/<!--[\s\S]*?(?:Thomas:|Want a photo|edit this bio)[\s\S]*?-->/i.test(html)) {
        errors.push(`${route}: author-only editing notes remain in public HTML comments`);
      }
    }

    const home = readFileSync(path.join(dist, "index.html"), "utf8");
    const escapedBookingUrl = bookingUrl.replaceAll("&", "&amp;");
    for (const position of ["hero", "closing"]) {
      const bookingPattern = new RegExp(`<a\\b(?=[^>]*href="${escapeRegExp(escapedBookingUrl)}")(?=[^>]*data-booking-link)(?=[^>]*data-booking-position="${position}")[^>]*>`);
      if (!bookingPattern.test(home)) errors.push(`homepage: the approved BOOKING_URL was not generated into the ${position} call to action`);
    }
    for (const [label, claim] of [
      ["lessons-taught", siteSettings.lessonsTaughtClaim],
      ["rating", `${siteSettings.ratingValue}★ rating`],
      ["review", `${siteSettings.reviewCount} reviews`],
    ]) {
      if (!home.includes(claim)) errors.push(`homepage: the approved ${label} claim is missing`);
    }

    if (!existsSync(hostingRedirectsOutputPath)) {
      errors.push("dist/_redirects: production HTTP redirect policy is missing");
    } else if (readFileSync(hostingRedirectsOutputPath, "utf8") !== renderHostingRedirects()) {
      errors.push("dist/_redirects: production HTTP redirect policy is stale");
    }

    validateAudioFiles(dist, "dist");

    const robots = readFileSync(path.join(dist, "robots.txt"), "utf8");
    if (!robots.includes(`Sitemap: ${origin}/sitemap-index.xml`)) errors.push("robots.txt: production sitemap URL is incorrect");

    const sitemapIndex = readFileSync(path.join(dist, "sitemap-index.xml"), "utf8");
    const sitemap = readFileSync(path.join(dist, "sitemap-0.xml"), "utf8");
    if (sitemapIndex.includes("localhost") || sitemap.includes("localhost")) errors.push("sitemap: localhost URLs remain");
    if (!sitemapIndex.includes(`${origin}/sitemap-0.xml`) || !sitemap.includes(`${origin}/`)) errors.push("sitemap: production origin is missing");
    if (/(?:\/404\/|\/404\.html|\/curriculum\/print\/)<\/loc>/.test(sitemap)) errors.push("sitemap: 404 and print-only pages must not be indexed");
  }
}

if (!["--inputs", "--output"].includes(mode)) errors.push(`unknown validation mode: ${mode}`);

if (errors.length) {
  console.error(`Production readiness failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(mode === "--inputs"
  ? `Production inputs verified: final public HTTPS origin, approved booking destination and claims, and ${Object.keys(clips).length} static MP3 files.`
  : "Production output verified: canonical origin, booking destination, static audio, permanent redirects, robots, sitemap, social URLs, social images, and public copy.");

function validateAudioFiles(directory, label) {
  const rootPath = path.resolve(directory);
  for (const [clipId, clip] of Object.entries(clips)) {
    const audioFile = path.resolve(rootPath, clip.path);
    if (audioFile !== rootPath && !audioFile.startsWith(`${rootPath}${path.sep}`)) {
      errors.push(`${clipId}: production static MP3 path escapes ${label}`);
      continue;
    }
    if (!existsSync(audioFile)) {
      errors.push(`${clipId}: production static MP3 is missing at ${label}/${clip.path}`);
      continue;
    }
    const bytes = readFileSync(audioFile);
    if (bytes.byteLength < 1000) errors.push(`${clipId}: production static MP3 is unexpectedly small at ${label}/${clip.path}`);
    else if (!hasMp3Signature(bytes)) errors.push(`${clipId}: production static file does not contain an MP3 signature at ${label}/${clip.path}`);
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
