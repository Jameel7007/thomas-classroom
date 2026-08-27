import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";
import { getLessonNavigation, readyLessons } from "../src/data/lesson-catalog.mjs";
import { readyAssessmentRoutes as assessmentRouteInventory } from "../src/data/assessment-routes.mjs";
import { siteSettings } from "../src/data/site-settings.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../dist", import.meta.url));
const configuredAudioPaths = new Set(Object.values(
  JSON.parse(readFileSync(path.join(projectRoot, "private/voice-scripts.json"), "utf8")),
).map((clip) => `/${clip.path}`));
const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const errors = [];
let checkedReferences = 0;
let checkedImages = 0;
let checkedButtons = 0;
let checkedAudio = 0;
let pendingAudioReferences = 0;
let checkedSocialMetadata = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const inspectableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const route = "/" + slash(path.relative(root, file)).replace(/(?:^|\/)index\.html$/, "");
  const isRedirect = /http-equiv="refresh"/i.test(html);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${route}: missing title`);
  if (!/<meta\b[^>]*name="description"/i.test(html) && !isRedirect) {
    errors.push(`${route}: missing meta description`);
  }

  if (!isRedirect) {
    if (!/<html\b[^>]*lang="en"/i.test(html)) errors.push(`${route}: missing English document language`);
    if (!/<meta\b[^>]*name="viewport"/i.test(html)) errors.push(`${route}: missing viewport metadata`);
    if (!/<link\b[^>]*rel="canonical"/i.test(html)) errors.push(`${route}: missing canonical URL`);
    if (!/<link\b(?=[^>]*rel="icon")(?=[^>]*href="\/favicon\.svg")(?=[^>]*type="image\/svg\+xml")[^>]*>/i.test(html)) {
      errors.push(`${route}: shared SVG favicon is missing or incorrect`);
    }
    if (!/<meta\b(?=[^>]*name="theme-color")(?=[^>]*content="#111111")[^>]*>/i.test(html)) {
      errors.push(`${route}: stable browser theme color is missing`);
    }
    if (!/<main\b/i.test(html)) errors.push(`${route}: main content landmark is missing`);
    if (/(?:Draft lane|first local collection|drop a photo in the slot|planned assessment scope)/i.test(inspectableHtml)) {
      errors.push(`${route}: public draft language remains`);
    }
    if (!/<meta\b[^>]*property="og:title"/i.test(html) || !/<meta\b[^>]*name="twitter:card"/i.test(html)) {
      errors.push(`${route}: social sharing metadata is incomplete`);
    }
    const openGraphImage = html.match(/<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];
    const twitterImage = html.match(/<meta\b[^>]*name="twitter:image"[^>]*content="([^"]+)"/i)?.[1];
    if (!openGraphImage?.endsWith("/assets/social-card.png")) errors.push(`${route}: Open Graph image is missing or incorrect`);
    if (twitterImage !== openGraphImage) errors.push(`${route}: Twitter image does not match the Open Graph image`);
    if (!/<meta\b[^>]*name="twitter:card"[^>]*content="summary_large_image"/i.test(html)) errors.push(`${route}: large Twitter card metadata is missing`);
    if (!/<meta\b[^>]*property="og:image:width"[^>]*content="1200"/i.test(html) || !/<meta\b[^>]*property="og:image:height"[^>]*content="630"/i.test(html)) {
      errors.push(`${route}: social image dimensions are missing or incorrect`);
    }
    if (!/<meta\b[^>]*property="og:image:alt"[^>]*content="[^"]+"/i.test(html) || !/<meta\b[^>]*name="twitter:image:alt"[^>]*content="[^"]+"/i.test(html)) {
      errors.push(`${route}: social image alternative text is incomplete`);
    }
    checkedSocialMetadata += 1;

    const h1Count = (inspectableHtml.match(/<h1\b/gi) || []).length;
    if (h1Count !== 1) errors.push(`${route}: expected one h1, found ${h1Count}`);

    const ids = [...inspectableHtml.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length) errors.push(`${route}: duplicate id(s): ${duplicateIds.join(", ")}`);

    for (const match of inspectableHtml.matchAll(/<img\b([^>]*)>/gi)) {
      checkedImages += 1;
      const attributes = match[1];
      if (!/\balt="[^"]*"/i.test(attributes)) errors.push(`${route}: image is missing alt text`);
      if (!/\bwidth="\d+"/i.test(attributes) || !/\bheight="\d+"/i.test(attributes)) {
        errors.push(`${route}: image is missing intrinsic width or height`);
      }
      if (route.startsWith("/lessons/") && (!/\bloading="lazy"/i.test(attributes) || !/\bdecoding="async"/i.test(attributes))) {
        errors.push(`${route}: lesson image must use lazy loading and asynchronous decoding`);
      }
    }

    for (const match of inspectableHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      checkedButtons += 1;
      const attributes = match[1];
      const text = match[2].replace(/<[^>]+>/g, "").replace(/&(?:nbsp|#160);/gi, " ").trim();
      if (!text && !/\baria-label="[^"]+"/i.test(attributes)) errors.push(`${route}: button is missing an accessible name`);
    }

    for (const match of inspectableHtml.matchAll(/<audio\b([^>]*)>/gi)) {
      const attributes = match[1];
      if (!/\bdata-voice-clip="[^"]+"/i.test(attributes)) continue;
      checkedAudio += 1;
      if (!/\bcontrols(?:\s|=|$)/i.test(attributes)) errors.push(`${route}: static lesson audio is missing native controls`);
      if (!/\bpreload="none"/i.test(attributes)) errors.push(`${route}: static lesson audio must avoid eager loading`);
      const staticPath = attributes.match(/\bdata-audio-src="(\/audio\/(?:lessons|assessments)\/[^"]+\.mp3)"/i)?.[1];
      const nativePath = attributes.match(/\bsrc="(\/audio\/(?:lessons|assessments)\/[^"]+\.mp3)"/i)?.[1];
      if (!staticPath) errors.push(`${route}: static lesson audio path is missing or invalid`);
      if (!nativePath) errors.push(`${route}: native audio src is missing, so playback would depend on JavaScript`);
      if (staticPath && nativePath && staticPath !== nativePath) errors.push(`${route}: native audio src does not match its validated static path`);
      if (!/\bdata-speak="[^"]+"/i.test(attributes)) errors.push(`${route}: static lesson audio is missing its browser-speech fallback`);
    }

    for (const match of inspectableHtml.matchAll(/<a\b([^>]*)>/gi)) {
      const attributes = match[1];
      if (/\btarget="_blank"/i.test(attributes) && !/\brel="[^"]*\bnoopener\b/i.test(attributes)) {
        errors.push(`${route}: external new-tab link is missing rel=noopener`);
      }
    }
  }

  for (const match of inspectableHtml.matchAll(/(?<![-\w])(?:href|src)="([^"]+)"/gi)) {
    const reference = match[1];
    if (!reference || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(reference)) continue;
    const clean = decodeURIComponent(reference.split("#")[0].split("?")[0]);
    if (!clean) continue;
    checkedReferences += 1;
    const target = resolveBuiltReference(file, clean);
    if (!target && configuredAudioPaths.has(clean)) {
      pendingAudioReferences += 1;
      continue;
    }
    if (!target) errors.push(`${route}: broken reference ${reference}`);
  }
}

for (const lesson of readyLessons) {
  const output = path.join(root, lesson.route.replace(/^\//, ""), "index.html");
  if (!existsSync(output)) {
    errors.push(`${lesson.route}: direct-refresh output is missing`);
    continue;
  }
  const html = readFileSync(output, "utf8");
  const navigation = getLessonNavigation(lesson.id);
  if (!/data-generated-lesson-navigation/.test(html)) errors.push(`${lesson.route}: generated sequence navigation is missing`);
  if (navigation.previous && !html.includes(`rel="prev" href="${navigation.previous.route}"`)) {
    errors.push(`${lesson.route}: generated previous link is incorrect`);
  }
  if (navigation.next && !html.includes(`rel="next" href="${navigation.next.route}"`)) {
    errors.push(`${lesson.route}: generated next link is incorrect`);
  }
  if (!navigation.next && navigation.isCourseEnd && lesson.assessments[0] && !html.includes(`href="/assessments/${lesson.assessments[0]}/"`)) {
    errors.push(`${lesson.route}: final assessment relationship is missing from navigation`);
  }
  if (!navigation.isCourseEnd && lesson.assessments[0] && html.includes(`href="/assessments/${lesson.assessments[0]}/"`)) {
    errors.push(`${lesson.route}: assessment link appears before the full planned sequence ends`);
  }
}

const homeOutput = path.join(root, "index.html");
const homeHtml = readFileSync(homeOutput, "utf8");
const homeDocument = parse(homeHtml);
const approvedBookingUrl = siteSettings.bookingUrl.replaceAll("&", "&amp;");
const requiredHomeDestinations = ["about", "method", "students", "numbers", "faq"];
const expectedNoticingSentence = "Yesterday I go to my first lesson, and it change everything.";
const canonicalNoticingSentences = findElements(homeDocument, (node) =>
  hasAttribute(node, "data-present-perfect-noticing-sentence"));
if (canonicalNoticingSentences.length !== 1) {
  errors.push(`homepage: expected one canonical Present Perfect noticing sentence, found ${canonicalNoticingSentences.length}`);
} else if (textContent(canonicalNoticingSentences[0]) !== expectedNoticingSentence) {
  errors.push(`homepage: Present Perfect noticing sentence textContent must equal “${expectedNoticingSentence}”`);
}
const tokenizedExamples = findElements(homeDocument, (node) => hasAttribute(node, "data-tokenized-example"));
if (tokenizedExamples.length !== 1) {
  errors.push(`homepage: expected one tokenized Present Perfect pilot sentence, found ${tokenizedExamples.length}`);
}
for (const example of tokenizedExamples) {
  const renderedText = normalizeSentenceText(textContent(example, { excludedClass: "fix" }));
  if (renderedText !== expectedNoticingSentence) {
    errors.push(`homepage: tokenized example ${attribute(example, "data-tokenized-example") || "(unnamed)"} renders as “${renderedText}”`);
  }
}
const expectedPublicProof = new Map([
  ["lessons-taught-hero", siteSettings.lessonsTaughtClaim],
  ["rating-hero", `${siteSettings.ratingValue} ★ rating`],
  ["reviews-hero", `${siteSettings.reviewCount} reviews`],
  ["lessons-taught-about", siteSettings.lessonsTaughtClaim],
  ["rating-about", `${siteSettings.ratingValue}★ rating`],
  ["results-summary", `${siteSettings.lessonsTaughtClaim} · ${siteSettings.ratingValue}★ overall · ${siteSettings.reviewCount} five-star reviews`],
]);
for (const [marker, expected] of expectedPublicProof) {
  const matches = findElements(homeDocument, (node) => attribute(node, "data-public-proof") === marker);
  if (matches.length !== 1) {
    errors.push(`homepage: expected one ${marker} public-proof marker, found ${matches.length}`);
  } else if (normalizeClaimText(textContent(matches[0])) !== expected) {
    errors.push(`homepage: ${marker} claim must equal “${expected}”`);
  }
}
const homeBody = findElements(homeDocument, (node) => node.tagName === "body")[0];
if (attribute(homeBody, "data-public-review-count") !== String(siteSettings.reviewCount)) {
  errors.push("homepage: client-side review count does not match canonical site settings");
}
if (!/<header\b[^>]*id="nav"/.test(homeHtml)) errors.push("homepage: primary header is missing");
if (!/class="desktop-nav"[^>]*aria-label="Primary navigation"/.test(homeHtml)) errors.push("homepage: labeled desktop navigation is missing");
if (!/data-mobile-nav/.test(homeHtml) || !/data-mobile-nav-toggle/.test(homeHtml)) errors.push("homepage: mobile navigation controls are missing");
if (!/aria-controls="mobileNavPanel"/.test(homeHtml)) errors.push("homepage: mobile menu control relationship is missing");
if (!/id="mobileNavPanel"[^>]*aria-label="Mobile navigation"/.test(homeHtml)) errors.push("homepage: labeled mobile navigation panel is missing");
if (!/class="home-skip"[^>]*href="#main-content"/.test(homeHtml) || !/<main\b[^>]*id="main-content"/.test(homeHtml)) {
  errors.push("homepage: skip link or main landmark is missing");
}
for (const position of ["hero", "closing"]) {
  const bookingPattern = new RegExp(`<a\\b(?=[^>]*href="${escapeRegExp(approvedBookingUrl)}")(?=[^>]*data-booking-link)(?=[^>]*data-booking-position="${position}")[^>]*>`);
  if (!bookingPattern.test(homeHtml)) errors.push(`homepage: approved ${position} booking call to action is missing`);
}
const heroMarkup = homeHtml.match(/<header\b[^>]*class="[^"]*\bhero\b[^"]*"[\s\S]*?<\/header>/i)?.[0] || "";
if (!heroMarkup.includes('href="/curriculum/"')) errors.push("homepage: curriculum access is missing beside the primary hero booking action");
if (!homeHtml.includes(siteSettings.lessonsTaughtClaim)) errors.push(`homepage: approved claim \"${siteSettings.lessonsTaughtClaim}\" is missing`);
if (/(?:data-theme|themeBtn|theme-wipe|blackout)/.test(homeHtml)) errors.push("homepage: obsolete theme-toggle output remains");
if (/(?:Draft lane|first local collection|drop a photo in the slot|planned assessment scope)/i.test(homeHtml)) errors.push("homepage: public draft copy remains");
for (const destination of requiredHomeDestinations) {
  const linkCount = (homeHtml.match(new RegExp(`href="#${destination}"`, "g")) || []).length;
  if (linkCount < 2) errors.push(`homepage: #${destination} is not available in both desktop and mobile navigation`);
  if (!new RegExp(`id="${destination}"`).test(homeHtml)) errors.push(`homepage: #${destination} target is missing`);
}

const lessonRoutes = htmlFiles.filter((file) => /[/\\]lessons[/\\](?:a0|a1|a2|b1|b2|c1)[/\\][^./\\]+[/\\]index\.html$/.test(file));
const assessmentOutputs = htmlFiles.filter((file) => /[/\\]assessments[/\\][^./\\]+[/\\]index\.html$/.test(file));
if (lessonRoutes.length !== readyLessons.length) errors.push(`expected ${readyLessons.length} canonical lesson routes, found ${lessonRoutes.length}`);
if (assessmentOutputs.length !== assessmentRouteInventory.length) errors.push(`expected ${assessmentRouteInventory.length} canonical assessment routes, found ${assessmentOutputs.length}`);

const notFoundOutput = path.join(root, "404.html");
if (!existsSync(notFoundOutput)) {
  errors.push("404: static error page is missing");
} else {
  const notFoundHtml = readFileSync(notFoundOutput, "utf8");
  if (!/<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(notFoundHtml)) errors.push("404: noindex directive is missing");
  for (const recoveryRoute of ["/", "/curriculum/", "/assessments/quick-level-check/"]) {
    if (!notFoundHtml.includes(`href="${recoveryRoute}"`)) errors.push(`404: recovery link ${recoveryRoute} is missing`);
  }
}

const robotsOutput = path.join(root, "robots.txt");
if (!existsSync(robotsOutput)) {
  errors.push("robots.txt: output is missing");
} else {
  const robots = readFileSync(robotsOutput, "utf8");
  if (!/^User-agent: \*$/m.test(robots) || !/^Allow: \/$/m.test(robots) || !/^Sitemap: https?:\/\//m.test(robots)) {
    errors.push("robots.txt: crawler or sitemap directives are incomplete");
  }
}

const socialCardOutput = path.join(root, "assets/social-card.png");
if (!existsSync(socialCardOutput)) {
  errors.push("social sharing image: assets/social-card.png is missing");
} else {
  const image = readFileSync(socialCardOutput);
  const isPng = image.subarray(1, 4).toString("ascii") === "PNG";
  const width = isPng && image.length >= 24 ? image.readUInt32BE(16) : 0;
  const height = isPng && image.length >= 24 ? image.readUInt32BE(20) : 0;
  if (!isPng || width !== 1200 || height !== 630) errors.push(`social sharing image: expected a 1200×630 PNG; found ${width}×${height}`);
}

const faviconOutput = path.join(root, "favicon.svg");
if (!existsSync(faviconOutput)) {
  errors.push("browser identity: favicon.svg is missing");
} else {
  const favicon = readFileSync(faviconOutput, "utf8");
  if (!/<svg\b[^>]*viewBox="0 0 32 32"/i.test(favicon) || !/<title>Thomas’s Classroom<\/title>/.test(favicon)) {
    errors.push("browser identity: favicon.svg is missing its 32×32 view box or title");
  }
}

if (errors.length) {
  console.error(`\nAstro build validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 80) console.error(`- …and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(`\nValidated ${htmlFiles.length} HTML outputs, ${lessonRoutes.length} lessons, ${assessmentOutputs.length} assessments, ${checkedReferences} local references (${pendingAudioReferences} approved audio files pending), ${checkedImages} dimensioned images, ${checkedButtons} named buttons, ${checkedAudio} static audio controls, and ${checkedSocialMetadata} complete social metadata sets.`);

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findElements(node, predicate) {
  const matches = [];
  if (node?.tagName && predicate(node)) matches.push(node);
  for (const child of node?.childNodes || []) matches.push(...findElements(child, predicate));
  return matches;
}

function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value;
}

function hasAttribute(node, name) {
  return attribute(node, name) !== undefined;
}

function hasClass(node, className) {
  return (attribute(node, "class") || "").split(/\s+/).includes(className);
}

function textContent(node, { excludedClass } = {}) {
  if (node?.nodeName === "#text") return node.value;
  if (excludedClass && hasClass(node, excludedClass)) return "";
  return (node?.childNodes || []).map((child) => textContent(child, { excludedClass })).join("");
}

function normalizeSentenceText(value) {
  return value
    .replaceAll("\u00a0", " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^["“]\s*/u, "")
    .replace(/\s*["”]$/u, "");
}

function normalizeClaimText(value) {
  return value.replace(/\s+/gu, " ").trim();
}
