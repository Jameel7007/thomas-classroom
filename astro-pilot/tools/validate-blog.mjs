import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentRoot = path.join(root, "src/content/blog");
const outputRoot = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const postFiles = existsSync(contentRoot)
  ? readdirSync(contentRoot).filter((file) => file.endsWith(".mdx")).sort()
  : [];
const postIds = postFiles.map((file) => file.replace(/\.mdx$/, ""));

validateSource();
if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nBlog validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(sourceOnly
  ? `Blog source contracts passed for ${postFiles.length} validated MDX field notes with complete metadata, substantial editorial content, internal learning paths, and generated routing.`
  : `Blog validation passed: ${postFiles.length} index cards, ${postFiles.length} direct-refresh article routes, article metadata, BlogPosting schemas, related reading, and sitemap URLs are complete.`);

function validateSource() {
  const contracts = [
    ["src/content.config.ts", /defineCollection/],
    ["src/content.config.ts", /src\/content\/blog/],
    ["src/content.config.ts", /\.strict\(\)/],
    ["src/pages/blog.astro", /getCollection\("blog"\)/],
    ["src/pages/blog.astro", /"@type": "ItemList"/],
    ["src/pages/blog.astro", /data-blog-index/],
    ["src/pages/blog/[slug].astro", /getStaticPaths/],
    ["src/pages/blog/[slug].astro", /await render\(post\)/],
    ["src/pages/blog/[slug].astro", /"@type": "BlogPosting"/],
    ["src/pages/blog/[slug].astro", /socialType="article"/],
    ["src/styles/site.css", /\.blog-article-body/],
  ];

  for (const [relative, contract] of contracts) {
    const target = path.join(root, relative);
    if (!existsSync(target)) {
      errors.push(`${relative}: required blog source file is missing`);
      continue;
    }
    if (!contract.test(readFileSync(target, "utf8"))) errors.push(`${relative}: required blog source contract is missing`);
  }

  if (postFiles.length !== 3) errors.push(`src/content/blog: expected the three-post first editorial release, found ${postFiles.length}`);
  const contentHashes = new Map();
  const titles = new Set();

  for (const file of postFiles) {
    const id = file.replace(/\.mdx$/, "");
    const source = readFileSync(path.join(contentRoot, file), "utf8");
    const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)?.[1];
    const body = source.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
    if (!frontmatter) {
      errors.push(`${id}: frontmatter is missing`);
      continue;
    }

    for (const field of ["title", "description", "published", "category", "audience", "minutes", "featured"]) {
      if (!new RegExp(`^${field}:\\s*\\S`, "m").test(frontmatter)) errors.push(`${id}: ${field} metadata is missing`);
    }
    const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.trim();
    if (!title) errors.push(`${id}: title is empty`);
    else if (titles.has(title)) errors.push(`${id}: duplicate article title ${title}`);
    else titles.add(title);

    const words = wordCount(body);
    const h2s = (body.match(/^##\s+\S.+$/gm) || []).length;
    const internalLinks = (body.match(/\]\(\/(?!\/)[^)]+\)/g) || []).length;
    if (words < 1100) errors.push(`${id}: article is too thin at ${words} words; expected at least 1100`);
    if (h2s < 6) errors.push(`${id}: expected at least 6 substantial sections, found ${h2s}`);
    if (internalLinks < 3) errors.push(`${id}: expected at least 3 internal learning-path links, found ${internalLinks}`);
    if (/\b(?:lorem ipsum|coming soon|draft lane|placeholder|todo)\b/i.test(body)) errors.push(`${id}: draft or placeholder language remains`);

    const hash = createHash("sha256").update(normalize(body)).digest("hex");
    if (contentHashes.has(hash)) errors.push(`${id}: duplicates ${contentHashes.get(hash)}`);
    else contentHashes.set(hash, id);
  }
}

function validateOutput() {
  if (!existsSync(outputRoot)) {
    errors.push("dist: production output is missing; run the Astro build first");
    return;
  }

  const indexPath = path.join(outputRoot, "blog/index.html");
  if (!existsSync(indexPath)) {
    errors.push("/blog/: generated index is missing");
    return;
  }
  const index = readFileSync(indexPath, "utf8");
  const cards = [...index.matchAll(/\bdata-blog-card="([^"]+)"/g)].map((match) => match[1]);
  if (cards.length !== postIds.length || new Set(cards).size !== postIds.length) {
    errors.push(`/blog/: expected ${postIds.length} unique article cards, found ${cards.length}`);
  }
  for (const id of postIds) {
    if (!cards.includes(id)) errors.push(`/blog/: article card ${id} is missing`);
    if (!index.includes(`href="/blog/${id}/"`)) errors.push(`/blog/: article link /blog/${id}/ is missing`);
  }
  const indexList = nodeOfType(structuredDataNodes(index, "/blog/"), "ItemList");
  if (indexList?.numberOfItems !== postIds.length || indexList?.itemListElement?.length !== postIds.length) {
    errors.push(`/blog/: ItemList must describe all ${postIds.length} field notes`);
  }

  for (const id of postIds) {
    const route = `/blog/${id}/`;
    const output = path.join(outputRoot, "blog", id, "index.html");
    if (!existsSync(output)) {
      errors.push(`${route}: direct-refresh output is missing`);
      continue;
    }
    const html = readFileSync(output, "utf8");
    if (!html.includes(`data-blog-post="${id}"`)) errors.push(`${route}: article marker is missing`);
    if (!/<meta\b[^>]*property="og:type"[^>]*content="article"/i.test(html)) errors.push(`${route}: article Open Graph type is missing`);
    if (!/<meta\b[^>]*property="article:published_time"[^>]*content="[^"]+"/i.test(html)) errors.push(`${route}: published-time social metadata is missing`);
    if (!/class="blog-next-step"/.test(html)) errors.push(`${route}: practical next-step panel is missing`);

    const body = html.match(/<div class="blog-article-body">([\s\S]*?)<\/div>/i)?.[1] || "";
    const visibleWords = wordCount(textContent(body));
    const sections = (body.match(/<h2\b/gi) || []).length;
    const internalLinks = (body.match(/href="\/(?!\/)[^"]+"/gi) || []).length;
    if (visibleWords < 1100) errors.push(`${route}: rendered article is too thin at ${visibleWords} visible words`);
    if (sections < 6) errors.push(`${route}: rendered article has only ${sections} main sections`);
    if (internalLinks < 3) errors.push(`${route}: rendered article has only ${internalLinks} internal learning-path links`);
    if ((html.match(/class="blog-related-grid"[\s\S]*?<\/section>/i)?.[0].match(/href="\/blog\//g) || []).length !== 2) {
      errors.push(`${route}: expected two related field-note links`);
    }

    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
    const posting = nodeOfType(structuredDataNodes(html, route), "BlogPosting");
    if (!posting) {
      errors.push(`${route}: BlogPosting structured data is missing`);
    } else {
      if (posting.url !== canonical) errors.push(`${route}: BlogPosting URL does not match the canonical URL`);
      if (!posting.headline || !posting.description || !posting.datePublished || !posting.articleSection) errors.push(`${route}: BlogPosting core metadata is incomplete`);
      if (!posting.author?.["@id"]?.endsWith("#tutor")) errors.push(`${route}: BlogPosting author relationship is missing`);
      if (!posting.publisher?.["@id"]?.endsWith("#website")) errors.push(`${route}: BlogPosting publisher relationship is missing`);
      if (posting.mainEntityOfPage?.["@id"] !== `${canonical}#webpage`) errors.push(`${route}: BlogPosting main-page relationship is incorrect`);
    }
  }

  const sitemapPath = path.join(outputRoot, "sitemap-0.xml");
  if (!existsSync(sitemapPath)) {
    errors.push("sitemap-0.xml: blog sitemap validation cannot run");
  } else {
    const sitemap = readFileSync(sitemapPath, "utf8");
    for (const id of postIds) {
      if (!new RegExp(`<loc>[^<]*/blog/${escapeRegExp(id)}/</loc>`).test(sitemap)) errors.push(`sitemap: /blog/${id}/ is missing`);
    }
  }
}

function structuredDataNodes(html, route) {
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  return scripts.flatMap((match) => {
    try {
      const data = JSON.parse(match[1]);
      return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    } catch (error) {
      errors.push(`${route}: structured data is invalid JSON (${error.message})`);
      return [];
    }
  });
}

function nodeOfType(nodes, type) {
  return nodes.find((node) => Array.isArray(node["@type"])
    ? node["@type"].includes(type)
    : node["@type"] === type);
}

function textContent(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(value) {
  return String(value).match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length || 0;
}

function normalize(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
