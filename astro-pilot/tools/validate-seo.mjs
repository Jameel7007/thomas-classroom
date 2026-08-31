import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readyLessons } from "../src/data/lesson-catalog.mjs";
import { dictionaryEntries } from "../src/data/dictionary.mjs";
import { transferLanguages } from "../src/data/language-transfer.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const blogPostIds = readdirSync(path.join(projectRoot, "src/content/blog"))
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.replace(/\.mdx$/, ""))
  .sort();
const readingIds = readdirSync(path.join(projectRoot, "src/content/readings"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => readdirSync(path.join(projectRoot, "src/content/readings", entry.name))
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => `${entry.name}/${file.replace(/\.mdx$/, "")}`))
  .sort();

validateSourceContracts();

let pageCount = 0;
let schemaNodeCount = 0;
let sitemapCount = 0;
let titleCount = 0;

if (!sourceOnly) validateBuiltOutput();

if (errors.length) {
  console.error(`\nSEO validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

if (sourceOnly) {
  console.log("SEO source contracts are valid: learning-resource, assessment, site-identity, curriculum-list, BlogPosting, field-note-list, DefinedTermSet, language-transfer list, and noindex templates are present.");
} else {
  console.log(`SEO validation passed for ${pageCount} indexable pages, ${titleCount} canonical page titles, ${schemaNodeCount} structured-data nodes, ${readyLessons.length} listed lessons, and ${sitemapCount} sitemap URLs.`);
}

function validateSourceContracts() {
  const contracts = [
    ["src/components/StructuredData.astro", /application\/ld\+json/],
    ["src/lib/structured-data.mjs", /"@type": "WebSite"/],
    ["src/lib/structured-data.mjs", /"@type": "Quiz"/],
    ["src/lib/page-title.mjs", /export function formatPageTitle/],
    ["src/components/lesson/LessonPage.astro", /"@type": "LearningResource"/],
    ["src/components/lesson/LessonPage.astro", /"@type": "Course"/],
    ["src/components/lesson/LessonPage.astro", /competencyRequired/],
    ["src/components/lesson/LessonPage.astro", /formatPageTitle\(lesson\.title\)/],
    ["src/components/assessment/AssessmentPage.astro", /formatPageTitle\(page\.title\)/],
    ["src/components/assessment/QuickCheckPage.astro", /formatPageTitle\(page\.title\)/],
    ["src/layouts/SiteLayout.astro", /<StructuredData\s+nodes=/],
    ["src/pages/curriculum/index.astro", /"@type": "ItemList"/],
    ["src/pages/blog.astro", /"@type": "ItemList"/],
    ["src/pages/blog/[slug].astro", /"@type": "BlogPosting"/],
    ["src/pages/reading/index.astro", /"@type": "ItemList"/],
    ["src/pages/reading/[level]/[slug].astro", /"@type": "LearningResource"/],
    ["src/pages/dictionary.astro", /"@type": "DefinedTermSet"/],
    ["src/pages/languages.astro", /"@type": "ItemList"/],
    ["src/pages/curriculum/print.astro", /name="robots"\s+content="noindex, follow"/],
    ["astro.config.mjs", /endsWith\("\/curriculum\/print\/"\)/],
    ["astro.config.mjs", /includes\("\/tutor\/plans\/"\)/],
    ["astro.config.mjs", /includes\("\/tutor\/readings\/"\)/],
    ["astro.config.mjs", /endsWith\("\/tutor\/review-builder\/"\)/],
  ];
  for (const [relative, contract] of contracts) {
    const source = readFileSync(path.join(projectRoot, relative), "utf8");
    if (!contract.test(source)) errors.push(`${relative}: required SEO contract is missing`);
  }

  for (const lesson of readyLessons) {
    validateLessonSourceTitle(lesson);
    validateDescription(`${lesson.source}: canonical description`, lesson.description);
  }
}

function validateBuiltOutput() {
  if (!existsSync(outputRoot)) {
    errors.push("dist: production output is missing; run the Astro build first");
    return;
  }

  const indexableCanonicals = new Map();
  const indexableTitles = new Map();
  const allHtml = walk(outputRoot).filter((file) => file.endsWith(".html"));

  for (const file of allHtml) {
    const html = readFileSync(file, "utf8");
    if (/http-equiv=["']refresh["']/i.test(html)) continue;
    const route = routeFor(file);
    const documentTitle = getDocumentTitle(html);
    const metaDescription = getMetaDescription(html);
    if (!metaDescription) errors.push(`${route}: meta description is missing`);
    else validateDescription(`${route}: meta description`, metaDescription);
    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
    const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html);
    validateDocumentTitle({ route, html, documentTitle, noindex, indexableTitles });

    if (!canonical) {
      errors.push(`${route}: canonical URL is missing`);
      continue;
    }

    if (noindex) {
      if (!["/404.html", "/curriculum/print/", "/tutor/review-builder/"].includes(route) && !route.startsWith("/tutor/plans/") && !route.startsWith("/tutor/readings/")) errors.push(`${route}: unexpected noindex directive`);
      if (route === "/curriculum/print/" && !canonical.endsWith("/curriculum/")) {
        errors.push(`${route}: print view must canonicalize to /curriculum/`);
      }
      continue;
    }

    pageCount += 1;
    if (indexableCanonicals.has(canonical)) errors.push(`${route}: duplicates canonical ${canonical} used by ${indexableCanonicals.get(canonical)}`);
    indexableCanonicals.set(canonical, route);

    const nodes = structuredDataNodes(html, route);
    schemaNodeCount += nodes.length;
    const ids = nodes.map((node) => node["@id"]).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length) errors.push(`${route}: duplicate structured-data @id values: ${duplicateIds.join(", ")}`);

    for (const required of ["Person", "WebSite"]) {
      if (!hasType(nodes, required)) errors.push(`${route}: ${required} structured data is missing`);
    }
    if (!nodes.some((node) => ["WebPage", "CollectionPage", "ProfilePage"].some((type) => nodeHasType(node, type)))) {
      errors.push(`${route}: page-level structured data is missing`);
    }

    if (route === "/") {
      const website = nodeOfType(nodes, "WebSite");
      if (website?.potentialAction?.["@type"] !== "SearchAction") errors.push("/: WebSite search action is missing");
    }

    if (route.startsWith("/lessons/")) validateLessonSchema(route, canonical, nodes);
    if (route.startsWith("/assessments/") && route !== "/assessments/") validateAssessmentSchema(route, canonical, nodes);
    if (route === "/curriculum/") validateCurriculumSchema(canonical, nodes);
    if (route === "/blog/") validateBlogIndexSchema(canonical, nodes);
    if (route.startsWith("/blog/") && route !== "/blog/") validateBlogPostSchema(route, canonical, nodes);
    if (route === "/reading/") validateReadingIndexSchema(canonical, nodes);
    if (route.startsWith("/reading/") && route !== "/reading/") validateReadingSchema(route, canonical, nodes);
    if (route === "/dictionary/") validateDictionarySchema(canonical, nodes);
    if (route === "/languages/") validateLanguageTransferSchema(canonical, nodes);
  }

  validateSitemap(indexableCanonicals);
}

function validateLessonSchema(route, canonical, nodes) {
  for (const required of ["BreadcrumbList", "Course", "LearningResource"]) {
    if (!hasType(nodes, required)) errors.push(`${route}: ${required} structured data is missing`);
  }
  const lesson = nodeOfType(nodes, "LearningResource");
  const expectedLevel = route.split("/")[2]?.toUpperCase();
  const record = readyLessons.find((item) => item.route === route);
  if (lesson?.url !== canonical) errors.push(`${route}: LearningResource URL does not match the canonical URL`);
  if (lesson?.educationalLevel !== expectedLevel) errors.push(`${route}: LearningResource educational level must be ${expectedLevel}`);
  if (!lesson?.name || !lesson?.description || !lesson?.teaches) errors.push(`${route}: LearningResource name, description, or teaching objective is missing`);
  if (lesson?.isAccessibleForFree !== true) errors.push(`${route}: LearningResource must declare free access`);
  if (!record) {
    errors.push(`${route}: canonical lesson record is missing during structured-data validation`);
  } else {
    const expectedPrerequisites = record.prerequisites
      .map((id) => readyLessons.find((item) => item.id === id)?.topic)
      .filter(Boolean);
    const actualPrerequisites = Array.isArray(lesson?.competencyRequired) ? lesson.competencyRequired : [];
    if (actualPrerequisites.length !== expectedPrerequisites.length ||
      expectedPrerequisites.some((topic) => !actualPrerequisites.includes(topic))) {
      errors.push(`${route}: LearningResource prerequisite competencies do not match the canonical lesson graph`);
    }
  }
}

function validateAssessmentSchema(route, canonical, nodes) {
  const quiz = nodeOfType(nodes, "Quiz");
  if (!quiz) {
    errors.push(`${route}: Quiz structured data is missing`);
    return;
  }
  if (quiz.url !== canonical) errors.push(`${route}: Quiz URL does not match the canonical URL`);
  if (!quiz.name || !quiz.description || !quiz.educationalLevel || !quiz.assesses) errors.push(`${route}: Quiz name, description, level, or assessed ability is missing`);
  if (!Number.isInteger(quiz.numberOfQuestions) || quiz.numberOfQuestions < 1) errors.push(`${route}: Quiz question count is missing or invalid`);
}

function validateCurriculumSchema(canonical, nodes) {
  const list = nodeOfType(nodes, "ItemList");
  if (!list) {
    errors.push("/curriculum/: ItemList structured data is missing");
    return;
  }
  if (list.numberOfItems !== readyLessons.length || list.itemListElement?.length !== readyLessons.length) {
    errors.push(`/curriculum/: ItemList must contain all ${readyLessons.length} ready lessons`);
  }
  const listed = new Set((list.itemListElement || []).map((item) => item.url));
  for (const lesson of readyLessons) {
    const expected = new URL(lesson.route, canonical).href;
    if (!listed.has(expected)) errors.push(`/curriculum/: ItemList is missing ${lesson.route}`);
  }
}

function validateBlogIndexSchema(canonical, nodes) {
  const list = nodeOfType(nodes, "ItemList");
  if (!list) {
    errors.push("/blog/: ItemList structured data is missing");
    return;
  }
  if (list.numberOfItems !== blogPostIds.length || list.itemListElement?.length !== blogPostIds.length) {
    errors.push(`/blog/: ItemList must contain all ${blogPostIds.length} published field notes`);
  }
  const listed = new Set((list.itemListElement || []).map((item) => item.url));
  for (const id of blogPostIds) {
    const expected = new URL(`/blog/${id}/`, canonical).href;
    if (!listed.has(expected)) errors.push(`/blog/: ItemList is missing ${expected}`);
  }
}

function validateBlogPostSchema(route, canonical, nodes) {
  const post = nodeOfType(nodes, "BlogPosting");
  if (!post) {
    errors.push(`${route}: BlogPosting structured data is missing`);
    return;
  }
  if (post.url !== canonical) errors.push(`${route}: BlogPosting URL does not match the canonical URL`);
  if (!post.headline || !post.description || !post.datePublished || !post.articleSection) {
    errors.push(`${route}: BlogPosting headline, description, date, or article section is missing`);
  }
  if (!post.author?.["@id"]?.endsWith("#tutor")) errors.push(`${route}: BlogPosting author relationship is missing`);
  if (!post.publisher?.["@id"]?.endsWith("#website")) errors.push(`${route}: BlogPosting publisher relationship is missing`);
  if (post.mainEntityOfPage?.["@id"] !== `${canonical}#webpage`) errors.push(`${route}: BlogPosting main-page relationship is incorrect`);
}

function validateReadingIndexSchema(canonical, nodes) {
  const list = nodeOfType(nodes, "ItemList");
  if (!list) {
    errors.push("/reading/: ItemList structured data is missing");
    return;
  }
  if (list.numberOfItems !== readingIds.length || list.itemListElement?.length !== readingIds.length) {
    errors.push(`/reading/: ItemList must contain all ${readingIds.length} reading lessons`);
  }
  const listed = new Set((list.itemListElement || []).map((item) => item.url));
  for (const id of readingIds) {
    const expected = new URL(`/reading/${id}/`, canonical).href;
    if (!listed.has(expected)) errors.push(`/reading/: ItemList is missing ${expected}`);
  }
}

function validateReadingSchema(route, canonical, nodes) {
  const resource = nodeOfType(nodes, "LearningResource");
  if (!resource) {
    errors.push(`${route}: LearningResource structured data is missing`);
    return;
  }
  if (resource.url !== canonical) errors.push(`${route}: LearningResource URL does not match the canonical URL`);
  const expectedLevel = route.split("/")[2]?.toUpperCase();
  if (resource.educationalLevel !== expectedLevel) errors.push(`${route}: reading level must be ${expectedLevel}`);
  if (resource.learningResourceType !== "Reading lesson") errors.push(`${route}: reading resource type is incorrect`);
  if (!resource.author?.["@id"]?.endsWith("#tutor")) errors.push(`${route}: reading author relationship is missing`);
}

function validateDictionarySchema(canonical, nodes) {
  const termSet = nodeOfType(nodes, "DefinedTermSet");
  if (!termSet) {
    errors.push("/dictionary/: DefinedTermSet structured data is missing");
    return;
  }
  if (termSet.url !== canonical || !termSet.name || !termSet.description) errors.push("/dictionary/: DefinedTermSet URL, name, or description is incomplete");
  if (termSet.hasDefinedTerm?.length !== dictionaryEntries.length) {
    errors.push(`/dictionary/: DefinedTermSet must include all ${dictionaryEntries.length} headwords`);
  }
  const terms = new Set((termSet.hasDefinedTerm || []).map((term) => term.name));
  for (const entry of dictionaryEntries) {
    if (!terms.has(entry.word)) errors.push(`/dictionary/: DefinedTermSet is missing ${entry.word}`);
  }
}

function validateLanguageTransferSchema(canonical, nodes) {
  const list = nodes.find((node) => nodeHasType(node, "ItemList") && node["@id"] === `${canonical}#language-transfer-guide`);
  if (!list) {
    errors.push("/languages/: language-transfer ItemList structured data is missing");
    return;
  }
  if (list.numberOfItems !== transferLanguages.length || list.itemListElement?.length !== transferLanguages.length) {
    errors.push(`/languages/: ItemList must contain all ${transferLanguages.length} first-language guides`);
  }
  const listed = new Set((list.itemListElement || []).map((item) => item.url));
  for (const language of transferLanguages) {
    const expected = `${canonical}#transfer-${language.slug}`;
    if (!listed.has(expected)) errors.push(`/languages/: ItemList is missing ${expected}`);
  }
}

function validateSitemap(indexableCanonicals) {
  const sitemapPath = path.join(outputRoot, "sitemap-0.xml");
  const sitemapIndexPath = path.join(outputRoot, "sitemap-index.xml");
  const robotsPath = path.join(outputRoot, "robots.txt");
  for (const file of [sitemapPath, sitemapIndexPath, robotsPath]) {
    if (!existsSync(file)) errors.push(`${path.basename(file)}: output is missing`);
  }
  if (![sitemapPath, sitemapIndexPath, robotsPath].every(existsSync)) return;

  const sitemap = readFileSync(sitemapPath, "utf8");
  const sitemapIndex = readFileSync(sitemapIndexPath, "utf8");
  const robots = readFileSync(robotsPath, "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]));
  const locationSet = new Set(locations);
  sitemapCount = locations.length;
  if (locationSet.size !== locations.length) errors.push("sitemap: duplicate URLs are present");
  for (const canonical of indexableCanonicals.keys()) {
    if (!locationSet.has(canonical)) errors.push(`sitemap: missing indexable canonical ${canonical}`);
  }
  for (const location of locations) {
    if (!indexableCanonicals.has(location)) errors.push(`sitemap: non-indexable or unknown URL ${location}`);
    if (/\.html(?:$|[?#])/.test(location)) errors.push(`sitemap: historical HTML redirect must not be listed (${location})`);
  }
  if (locations.some((location) => /\/curriculum\/print\/$|\/404(?:\.html|\/)$|\/tutor\/plans\//.test(location))) {
    errors.push("sitemap: print-only, tutor-plan, or 404 URL must not be indexed");
  }
  const sitemapUrl = sitemapIndex.match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (!sitemapUrl) {
    errors.push("sitemap-index.xml: child sitemap URL is missing");
  } else {
    const decodedSitemapUrl = decodeXml(sitemapUrl);
    const sitemapIndexUrl = new URL("/sitemap-index.xml", decodedSitemapUrl).href;
    if (!robots.includes(`Sitemap: ${sitemapIndexUrl}`)) errors.push("robots.txt: sitemap index URL does not match the generated sitemap index");
  }
}

function structuredDataNodes(html, route) {
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) {
    errors.push(`${route}: structured data is missing`);
    return [];
  }
  return scripts.flatMap((match) => {
    try {
      const data = JSON.parse(match[1]);
      return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    } catch (error) {
      errors.push(`${route}: structured data is not valid JSON (${error.message})`);
      return [];
    }
  });
}

function hasType(nodes, type) {
  return nodes.some((node) => nodeHasType(node, type));
}

function nodeOfType(nodes, type) {
  return nodes.find((node) => nodeHasType(node, type));
}

function nodeHasType(node, type) {
  return Array.isArray(node["@type"]) ? node["@type"].includes(type) : node["@type"] === type;
}

function routeFor(file) {
  const relative = path.relative(outputRoot, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative === "404.html") return "/404.html";
  return `/${relative.replace(/index\.html$/, "")}`;
}

function decodeXml(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function getMetaDescription(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = getAttribute(match[0], "name");
    if (name?.toLowerCase() === "description") return decodeHtml(getAttribute(match[0], "content") || "");
  }
  return "";
}

function getDocumentTitle(html) {
  const value = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtml(value).replace(/<[^>]+>/g, "").trim();
}

function getMetaContent(html, attributeName, attributeValue) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (getAttribute(match[0], attributeName)?.toLowerCase() === attributeValue.toLowerCase()) {
      return decodeHtml(getAttribute(match[0], "content") || "");
    }
  }
  return "";
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
  return match?.[2];
}

function validateLessonSourceTitle(lesson) {
  const title = String(lesson.title || "").trim();
  const length = [...title].length;
  const contentLabel = lesson.contentType === "grammar" ? "Grammar" : "Vocabulary";
  if (length < 15 || length > 70) {
    errors.push(`${lesson.source}: canonical title must be 15–70 characters; found ${length}`);
  }
  if (/Curriculum Map|Thomas[’']s Classroom/u.test(title)) {
    errors.push(`${lesson.source}: canonical title must be unbranded`);
  }
  if (/^\p{Ll}/u.test(title)) {
    errors.push(`${lesson.source}: canonical title must begin with an uppercase letter`);
  }
  if (!title.endsWith(` · ${lesson.level} ${contentLabel}`)) {
    errors.push(`${lesson.source}: canonical title must end with " · ${lesson.level} ${contentLabel}"`);
  }
  if (/\s{2,}/u.test(title)) {
    errors.push(`${lesson.source}: canonical title contains repeated whitespace`);
  }
}

function validateDocumentTitle({ route, html, documentTitle, noindex, indexableTitles }) {
  if (!documentTitle) {
    errors.push(`${route}: document title is missing`);
    return;
  }

  titleCount += 1;
  const length = [...documentTitle].length;
  const minimum = noindex ? 20 : 30;
  const maximum = noindex ? 90 : 70;
  if (length < minimum || length > maximum) {
    errors.push(`${route}: document title must be ${minimum}–${maximum} characters; found ${length}`);
  }
  if (/\s{2,}/u.test(documentTitle)) errors.push(`${route}: document title contains repeated whitespace`);
  if (/^\s*[·|—:-]|[·|—:-]\s*$/u.test(documentTitle)) errors.push(`${route}: document title has a dangling separator`);
  if (/https?:\/\/|\.html(?:\b|$)/iu.test(documentTitle)) errors.push(`${route}: document title contains a URL or historical file extension`);
  if (route.startsWith("/lessons/") && /Curriculum Map/u.test(documentTitle)) {
    errors.push(`${route}: lesson title contains the obsolete Curriculum Map suffix`);
  }

  const socialTitles = [
    ["Open Graph", getMetaContent(html, "property", "og:title")],
    ["Twitter", getMetaContent(html, "name", "twitter:title")],
  ];
  for (const [label, title] of socialTitles) {
    if (!title) errors.push(`${route}: ${label} title is missing`);
    else if (title !== documentTitle) errors.push(`${route}: ${label} title does not match the document title`);
  }

  if (!noindex) {
    const key = documentTitle.toLocaleLowerCase("en-US");
    if (indexableTitles.has(key)) {
      errors.push(`${route}: duplicates document title used by ${indexableTitles.get(key)}`);
    }
    indexableTitles.set(key, route);
  }
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function validateDescription(label, description) {
  const value = String(description || "").trim();
  const length = [...value].length;
  if (length < 80 || length > 180) {
    errors.push(`${label} must be 80–180 characters; found ${length}`);
  }
  if (value && !/[.!?…]$/u.test(value)) {
    errors.push(`${label} must end with sentence punctuation`);
  }
  if (/\s+[,.!?;:]/u.test(value)) {
    errors.push(`${label} contains a space before punctuation`);
  }
  if (/\s{2,}/u.test(value)) {
    errors.push(`${label} contains repeated whitespace`);
  }
  if (value.includes("\uFFFD")) {
    errors.push(`${label} contains an invalid replacement character`);
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
