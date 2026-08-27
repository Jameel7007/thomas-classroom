import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hostingRedirectEntries,
  hostingRedirectsOutputPath,
  renderHostingRedirects,
} from "./generate-hosting-redirects.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = path.join(projectRoot, "public/_headers");
const outputPath = path.join(projectRoot, "dist/_headers");
const sourceOnly = process.argv.includes("--source");
const errors = [];

const nodeVersionPath = path.join(projectRoot, ".node-version");
if (!existsSync(nodeVersionPath) || !/^24\.16\.0\s*$/.test(readFileSync(nodeVersionPath, "utf8"))) {
  errors.push(".node-version: Cloudflare build runtime must remain pinned to Node 24.16.0");
}
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
if (packageJson.engines?.node !== ">=22.12.0 <25") {
  errors.push("package.json: Node engine must match Astro 7 support and the pinned Node 24 build line");
}
if (packageJson.scripts?.["release:status"] !== "node tools/validate-production.mjs --inputs") {
  errors.push("package.json: release:status must run the production-input preflight");
}
if (!packageJson.scripts?.["build:production"]?.startsWith("node tools/validate-production.mjs --inputs &&")) {
  errors.push("package.json: build:production must fail fast through the production-input preflight");
}

const homepageSource = readFileSync(path.join(projectRoot, "src/pages/index.astro"), "utf8");
if (/process\.env\.BOOKING_URL/.test(homepageSource)) {
  errors.push("src/pages/index.astro: deployment environment must not override the approved booking destination");
}
const productionValidatorSource = readFileSync(path.join(projectRoot, "tools/validate-production.mjs"), "utf8");
for (const contract of [
  /mode === "--inputs"\) validateAudioFiles\(publicRoot, "public"\)/,
  /isLocalOrPlaceholderHost/,
  /BOOKING_URL must match the approved destination/,
]) {
  if (!contract.test(productionValidatorSource)) {
    errors.push("tools/validate-production.mjs: production preflight contract is incomplete");
    break;
  }
}

let expectedRedirects = "";
try {
  expectedRedirects = renderHostingRedirects();
  validateRedirects(expectedRedirects, "generated hosting redirect policy");
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (!existsSync(sourcePath)) {
  errors.push("public/_headers: production hosting policy is missing");
} else {
  validateHeaders(readFileSync(sourcePath, "utf8"), "public/_headers");
}

if (!sourceOnly) {
  if (!existsSync(outputPath)) {
    errors.push("dist/_headers: generated hosting policy is missing");
  } else {
    const source = readFileSync(sourcePath, "utf8");
    const output = readFileSync(outputPath, "utf8");
    if (output !== source) errors.push("dist/_headers: generated policy does not match public/_headers");
    validateHeaders(output, "dist/_headers");
  }

  if (!existsSync(hostingRedirectsOutputPath)) {
    errors.push("dist/_redirects: generated permanent redirect policy is missing");
  } else {
    const redirects = readFileSync(hostingRedirectsOutputPath, "utf8");
    if (redirects !== expectedRedirects) {
      errors.push("dist/_redirects: generated policy is stale or does not match canonical route data");
    }
    validateRedirects(redirects, "dist/_redirects");
  }
}

if (errors.length) {
  console.error(`Hosting validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(sourceOnly
  ? `Hosting source policy verified: security headers, cache tiers, and ${hostingRedirectEntries().length} canonical permanent redirects are configured.`
  : `Hosting output verified: security and caching policy plus ${hostingRedirectEntries().length} generated permanent redirects are present.`);

function validateRedirects(value, label) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const expectedCount = hostingRedirectEntries().length;
  if (lines.length !== expectedCount) errors.push(`${label}: expected ${expectedCount} redirect rules, found ${lines.length}`);

  const sources = new Set();
  const destinations = new Set();
  for (const [index, line] of lines.entries()) {
    const parts = line.split(/\s+/);
    if (parts.length !== 3) {
      errors.push(`${label}: rule ${index + 1} must contain source, destination, and status`);
      continue;
    }
    const [source, destination, status] = parts;
    if (!source.startsWith("/") || !destination.startsWith("/")) errors.push(`${label}: rule ${index + 1} must remain on-site`);
    if (status !== "301") errors.push(`${label}: rule ${index + 1} must use permanent status 301`);
    if (sources.has(source)) errors.push(`${label}: duplicate source ${source}`);
    sources.add(source);
    destinations.add(destination);
  }

  for (const destination of destinations) {
    if (sources.has(destination)) errors.push(`${label}: redirect chain begins at ${destination}`);
  }
}

function validateHeaders(value, label) {
  const rules = parseRules(value);
  const root = rules.get("/*");
  if (!root) {
    errors.push(`${label}: /* policy is missing`);
    return;
  }

  requireHeader(root, "Cache-Control", /max-age=0.*must-revalidate/, label, "HTML revalidation policy");
  requireHeader(root, "Referrer-Policy", /^strict-origin-when-cross-origin$/, label, "referrer policy");
  requireHeader(root, "Strict-Transport-Security", /max-age=31536000/, label, "HTTPS transport policy");
  requireHeader(root, "X-Content-Type-Options", /^nosniff$/, label, "MIME-sniffing protection");
  requireHeader(root, "X-Frame-Options", /^SAMEORIGIN$/, label, "frame protection");
  requireHeader(root, "Permissions-Policy", /camera=\(\).*microphone=\(\).*payment=\(\)/, label, "browser permissions policy");

  const csp = root.get("content-security-policy") || "";
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ]) {
    if (!csp.includes(directive)) errors.push(`${label}: Content-Security-Policy is missing ${directive}`);
  }
  if (/fonts\.(?:googleapis|gstatic)\.com/.test(csp)) errors.push(`${label}: Content-Security-Policy must not allow external Google Fonts origins`);

  const hashed = rules.get("/_astro/*");
  requireHeader(hashed, "Cache-Control", /max-age=31536000.*immutable/, label, "immutable hashed-bundle cache policy");
  const fonts = rules.get("/fonts/*");
  requireHeader(fonts, "Cache-Control", /max-age=31536000.*immutable/, label, "immutable self-hosted font cache policy");
  for (const route of ["/assets/*", "/audio/*"]) {
    const cache = rules.get(route)?.get("cache-control") || "";
    if (!/max-age=86400.*stale-while-revalidate=604800/.test(cache)) errors.push(`${label}: ${route} replaceable-asset cache policy is missing`);
    if (/immutable/.test(cache)) errors.push(`${label}: ${route} must remain replaceable and cannot be immutable`);
  }
  for (const route of ["/robots.txt", "/sitemap-*.xml"]) {
    requireHeader(rules.get(route), "Cache-Control", /max-age=3600.*must-revalidate/, label, `${route} crawler cache policy`);
  }

  if (/(?:ELEVENLABS|API[_-]?KEY|Bearer\s+[A-Za-z0-9._-]+)/i.test(value)) errors.push(`${label}: secret-like text must never appear in public headers`);
}

function requireHeader(rule, name, expected, label, purpose) {
  const value = rule?.get(name.toLowerCase()) || "";
  if (!expected.test(value)) errors.push(`${label}: ${purpose} is missing or invalid`);
}

function parseRules(value) {
  const rules = new Map();
  let current;
  for (const rawLine of value.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    if (!/^\s/.test(rawLine)) {
      current = rawLine.trim();
      rules.set(current, new Map());
      continue;
    }
    if (!current) continue;
    const separator = rawLine.indexOf(":");
    if (separator < 0) continue;
    const name = rawLine.slice(0, separator).trim().toLowerCase();
    const headerValue = rawLine.slice(separator + 1).trim();
    rules.get(current).set(name, headerValue);
  }
  return rules;
}
