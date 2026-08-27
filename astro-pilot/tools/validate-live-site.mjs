import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyAssessmentRoutes } from "../src/data/assessment-routes.mjs";
import { legacyRedirects } from "../src/data/legacy-redirects.mjs";
import { readyLessons } from "../src/data/lesson-catalog.mjs";
import { siteSettings } from "../src/data/site-settings.mjs";
import { hasMp3Signature } from "./audio-generation.mjs";
import { isLocalOrPlaceholderHost } from "./release-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const allowHttp = args.includes("--allow-http");
const suppliedOrigin = args.find((value) => !value.startsWith("--")) || process.env.SITE_URL;
const errors = [];
const checks = [];

let site;
try {
  site = new URL(suppliedOrigin || "");
  if (!allowHttp && site.protocol !== "https:") throw new Error("the live site must use HTTPS");
  if (allowHttp && !["http:", "https:"].includes(site.protocol)) throw new Error("the site must use HTTP or HTTPS");
  if (!allowHttp && isLocalOrPlaceholderHost(site.hostname)) throw new Error("use the final public hostname, not a local or placeholder domain");
  if (site.pathname !== "/" || site.search || site.hash) throw new Error("use the origin only, without a path, query, or fragment");
} catch (error) {
  console.error(`Live-site validation needs a public origin.\nUsage: npm run live:validate -- https://www.example.com\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const origin = site.origin;
const blogRoutes = readdirSync(path.join(root, "src/content/blog"))
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => `/blog/${file.replace(/\.mdx$/, "")}/`);
const tutorPlanRoutes = readyLessons.map((lesson) => `/tutor/plans/${lesson.level.toLowerCase()}/${lesson.slug}/`);
const canonicalRoutes = [
  "/",
  "/curriculum/",
  "/curriculum/print/",
  "/about/",
  "/languages/",
  "/blog/",
  ...blogRoutes,
  "/dictionary/",
  "/tutor/",
  ...tutorPlanRoutes,
  ...readyLessons.map((lesson) => lesson.route),
  ...readyAssessmentRoutes.map((assessment) => assessment.route),
];
const uniqueCanonicalRoutes = [...new Set(canonicalRoutes)];
const indexableRoutes = uniqueCanonicalRoutes.filter((route) =>
  route !== "/curriculum/print/" && !route.startsWith("/tutor/plans/"));
const voiceScripts = JSON.parse(readFileSync(path.join(root, "private/voice-scripts.json"), "utf8"));
const htmlByRoute = new Map();

await parallel(uniqueCanonicalRoutes, 8, async (route) => {
  const response = await request(route);
  if (response.status !== 200) {
    errors.push(`${route}: expected 200, received ${response.status}`);
    return;
  }
  if (!response.headers.get("content-type")?.includes("text/html")) {
    errors.push(`${route}: response is not HTML`);
    return;
  }
  const html = await response.text();
  htmlByRoute.set(route, html);
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if (canonical !== new URL(route, origin).href) errors.push(`${route}: canonical is ${canonical || "missing"}`);
  if (/localhost|127\.0\.0\.1/i.test(html)) errors.push(`${route}: local-development origin leaked into public HTML`);
  if (/(?:api\.elevenlabs\.io|\/api\/(?:tts|voice)|ELEVENLABS_API_KEY)/i.test(html)) {
    errors.push(`${route}: learner-time ElevenLabs or secret-like reference remains in HTML`);
  }
});
checks.push(`${uniqueCanonicalRoutes.length} canonical routes`);

const homepage = htmlByRoute.get("/") || "";
if (!homepage.includes(siteSettings.lessonsTaughtClaim)) errors.push(`/: approved claim “${siteSettings.lessonsTaughtClaim}” is missing`);
if (!homepage.includes(`${siteSettings.ratingValue}★ rating`)) errors.push("/: approved rating claim is missing");
if (!homepage.includes(`${siteSettings.reviewCount} reviews`)) errors.push("/: approved review-count claim is missing");
if (!homepage.includes(`href="${siteSettings.bookingUrl}"`)) errors.push("/: approved booking destination is missing");

const homeResponse = await request("/");
validateSecurityHeaders(homeResponse.headers);
checks.push("live security headers");

const missingResponse = await request("/__thomas-classroom-launch-check-missing__");
if (missingResponse.status !== 404) errors.push(`/missing route: expected 404, received ${missingResponse.status}`);
else if (!(await missingResponse.text()).includes("Page not found")) errors.push("/missing route: branded recovery page was not served");
checks.push("custom 404 response");

const robotsResponse = await request("/robots.txt");
const robots = await expectText(robotsResponse, "/robots.txt", "text/plain");
if (!robots.includes(`Sitemap: ${origin}/sitemap-index.xml`)) errors.push("/robots.txt: public sitemap origin is incorrect");

const sitemapIndexResponse = await request("/sitemap-index.xml");
const sitemapIndex = await expectText(sitemapIndexResponse, "/sitemap-index.xml", "xml");
if (!sitemapIndex.includes(`${origin}/sitemap-0.xml`)) errors.push("/sitemap-index.xml: production sitemap URL is missing");
const sitemapResponse = await request("/sitemap-0.xml");
const sitemap = await expectText(sitemapResponse, "/sitemap-0.xml", "xml");
if (sitemap.includes("localhost") || sitemap.includes("127.0.0.1")) errors.push("/sitemap-0.xml: local origin remains");
for (const route of indexableRoutes) {
  if (!sitemap.includes(`<loc>${new URL(route, origin).href}</loc>`)) errors.push(`/sitemap-0.xml: ${route} is missing`);
}
checks.push("robots and sitemap discovery");

await parallel(Object.entries(legacyRedirects), 8, async ([source, destination]) => {
  const response = await request(source, { redirect: "manual" });
  if (response.status !== 301) {
    errors.push(`${source}: expected HTTP 301, received ${response.status}`);
    return;
  }
  const location = response.headers.get("location");
  if (!location || new URL(location, origin).href !== new URL(destination, origin).href) {
    errors.push(`${source}: redirects to ${location || "nowhere"}, expected ${destination}`);
  }
});
checks.push(`${Object.keys(legacyRedirects).length} permanent historical redirects`);

await parallel(Object.entries(voiceScripts), 4, async ([clipId, clip]) => {
  const response = await request(`/${clip.path}`, { headers: { Range: "bytes=0-2" } });
  if (![200, 206].includes(response.status)) {
    errors.push(`${clipId}: static MP3 returned ${response.status}`);
    return;
  }
  if (!response.headers.get("content-type")?.includes("audio/mpeg")) errors.push(`${clipId}: static file is not served as audio/mpeg`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!hasMp3Signature(bytes)) errors.push(`${clipId}: static response does not begin with an MP3 signature`);
});
checks.push(`${Object.keys(voiceScripts).length} static audio files`);

await validateCachePolicy(homepage);
checks.push("hashed bundle, font, and audio cache policy");

if (errors.length) {
  console.error(`\nLive-site validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`Live site verified at ${origin}: ${checks.join("; ")}.`);

async function validateCachePolicy(html) {
  const bundlePath = html.match(/(?:src|href)="(\/_astro\/[^"]+)"/)?.[1];
  const fontPath = html.match(/url\(["']?(\/fonts\/[^"')]+)/)?.[1] || "/fonts/fraunces/fraunces-variable.ttf";
  const audioPath = `/${Object.values(voiceScripts)[0].path}`;

  for (const [label, assetPath, pattern] of [
    ["hashed bundle", bundlePath, /max-age=31536000.*immutable/i],
    ["font", fontPath, /max-age=31536000.*immutable/i],
    ["audio", audioPath, /max-age=86400.*stale-while-revalidate=604800/i],
  ]) {
    if (!assetPath) {
      errors.push(`${label}: no asset URL was found on the homepage`);
      continue;
    }
    const response = await request(assetPath, { method: "HEAD" });
    if (response.status !== 200) errors.push(`${label}: ${assetPath} returned ${response.status}`);
    const cache = response.headers.get("cache-control") || "";
    if (!pattern.test(cache)) errors.push(`${label}: live Cache-Control is incorrect (${cache || "missing"})`);
  }
}

function validateSecurityHeaders(headers) {
  const expected = [
    ["content-security-policy", /default-src 'self'.*object-src 'none'.*frame-ancestors 'self'/],
    ["strict-transport-security", /max-age=31536000/],
    ["x-content-type-options", /^nosniff$/],
    ["x-frame-options", /^SAMEORIGIN$/],
    ["referrer-policy", /^strict-origin-when-cross-origin$/],
    ["permissions-policy", /camera=\(\).*microphone=\(\).*payment=\(\)/],
  ];
  for (const [name, pattern] of expected) {
    const value = headers.get(name) || "";
    if (!pattern.test(value)) errors.push(`/: live ${name} header is missing or incorrect`);
  }
}

async function expectText(response, route, contentType) {
  if (response.status !== 200) errors.push(`${route}: expected 200, received ${response.status}`);
  if (!response.headers.get("content-type")?.includes(contentType)) errors.push(`${route}: unexpected Content-Type`);
  return response.text();
}

async function request(route, options = {}) {
  const url = new URL(route, origin);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(url, {
        redirect: "follow",
        ...options,
        headers: { "User-Agent": "Thomas-Classroom-Launch-Validator/1.0", ...(options.headers || {}) },
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  errors.push(`${url.pathname}: request failed (${lastError instanceof Error ? lastError.message : lastError})`);
  return new Response("", { status: 599 });
}

async function parallel(items, concurrency, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}
