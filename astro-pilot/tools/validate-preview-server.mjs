import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHandler } from "../../server.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const dist = path.join(projectRoot, "dist");
const errors = [];
const checks = [];
const handler = await createStaticHandler({ publicRoot: dist });

class MemoryResponse {
  constructor() {
    this.status = 0;
    this.headers = {};
    this.body = Buffer.alloc(0);
  }

  writeHead(status, headers = {}) {
    this.status = status;
    this.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)]));
  }

  end(content) {
    if (content === undefined) return;
    this.body = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  }
}

await expect("/", {
  status: 200,
  contentType: "text/html",
  bodyIncludes: "Thomas",
  cache: /max-age=0.*must-revalidate/,
});
await expect("/curriculum/", {
  status: 200,
  contentType: "text/html",
  bodyIncludes: "Curriculum",
});
await expect("/lessons/a1/present-simple.html", {
  status: 301,
  location: "/lessons/a1/present-simple/",
});
await expect("/lessons/c1/advanced-tense-and-aspect-review/", {
  status: 200,
  contentType: "text/html",
  bodyIncludes: "Advanced tense and aspect review",
});
await expect("/lessons/c1/advanced-tense-and-aspect-review.html", {
  status: 301,
  location: "/lessons/c1/advanced-tense-and-aspect-review/",
});
await expect("/assessments/c1-exit/", {
  status: 200,
  contentType: "text/html",
  bodyIncludes: "C1 End-of-Level Diagnostic",
});
await expect("/assessments/c1-exit.html", {
  status: 301,
  location: "/assessments/c1-exit/",
});
await expect("/English%20Curriculum%20Map.html", {
  status: 301,
  location: "/curriculum/",
});
await expect("/robots.txt", {
  status: 200,
  contentType: "text/plain",
  cache: /max-age=3600.*must-revalidate/,
});
await expect("/sitemap-index.xml", {
  status: 200,
  contentType: "application/xml",
  cache: /max-age=3600.*must-revalidate/,
});
await expect("/fonts/fraunces/fraunces-variable.ttf", {
  status: 200,
  contentType: "font/ttf",
  cache: /max-age=31536000.*immutable/,
  head: true,
  emptyBody: true,
});
await expect("/assets/social-card.png", {
  status: 200,
  contentType: "image/png",
  cache: /max-age=86400.*stale-while-revalidate=604800/,
  head: true,
  emptyBody: true,
});
await expect("/__preview-missing__/", {
  status: 404,
  contentType: "text/html",
  bodyIncludes: "Page not found",
});
await expect("/api/tts", {
  status: 404,
  contentType: "text/html",
  bodyIncludes: "Page not found",
});
await expect("/", {
  method: "POST",
  status: 405,
  contentType: "application/json",
  bodyIncludes: "Method not allowed",
});

const serverSource = readFileSync(path.join(repositoryRoot, "server.mjs"), "utf8");
if (/(?:api\.elevenlabs\.io|ELEVENLABS_API_KEY|\/api\/(?:tts|voice|speak))/i.test(serverSource)) {
  errors.push("server.mjs: local preview must not contain an ElevenLabs endpoint, credential, or speech proxy");
}
if (!/createStaticHandler/.test(serverSource) || !/loadRedirects/.test(serverSource) || !/sendNotFound/.test(serverSource)) {
  errors.push("server.mjs: importable static handler, redirects, or branded 404 behavior is missing");
}

if (errors.length) {
  console.error(`Preview-server validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Preview server verified without opening a socket: ${checks.join("; ")}; static-only behavior and no ElevenLabs proxy.`);

async function expect(route, expected) {
  const response = new MemoryResponse();
  await handler({
    method: expected.method || (expected.head ? "HEAD" : "GET"),
    url: route,
    headers: { host: "localhost" },
  }, response);

  if (response.status !== expected.status) errors.push(`${route}: expected ${expected.status}, received ${response.status}`);
  const contentType = response.headers["content-type"] || "";
  if (expected.contentType && !contentType.includes(expected.contentType)) {
    errors.push(`${route}: expected Content-Type ${expected.contentType}, received ${contentType || "nothing"}`);
  }
  if (expected.location && response.headers.location !== expected.location) {
    errors.push(`${route}: expected redirect to ${expected.location}, received ${response.headers.location || "nothing"}`);
  }
  if (expected.cache && !expected.cache.test(response.headers["cache-control"] || "")) {
    errors.push(`${route}: Cache-Control is ${response.headers["cache-control"] || "missing"}`);
  }
  const body = response.body.toString("utf8");
  if (expected.bodyIncludes && !body.includes(expected.bodyIncludes)) {
    errors.push(`${route}: response body does not include "${expected.bodyIncludes}"`);
  }
  if (expected.emptyBody && response.body.length) errors.push(`${route}: HEAD response unexpectedly contains a body`);
  if (response.headers["x-content-type-options"] !== "nosniff" && expected.status !== 301) {
    errors.push(`${route}: X-Content-Type-Options is missing`);
  }
  checks.push(`${expected.method || (expected.head ? "HEAD" : "GET")} ${route} ${expected.status}`);
}
