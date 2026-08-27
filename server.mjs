import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const defaultPublicRoot = process.env.STATIC_ROOT
  ? resolve(projectRoot, process.env.STATIC_ROOT)
  : resolve(projectRoot, "astro-pilot", "dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

export async function createStaticHandler({ publicRoot = defaultPublicRoot } = {}) {
  const root = resolve(publicRoot);
  const redirects = await loadRedirects(root);

  return async function handleStaticRequest(request, response) {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (request.method !== "GET" && request.method !== "HEAD") {
        return sendJson(response, 405, { error: "Method not allowed." });
      }

      const redirect = redirects.get(url.pathname);
      if (redirect) return sendRedirect(response, redirect.destination, redirect.status);

      return serveStatic({
        response,
        publicRoot: root,
        pathname: url.pathname,
        headOnly: request.method === "HEAD",
      });
    } catch (error) {
      console.error(error);
      return sendJson(response, 500, { error: "The local lesson server could not complete this request." });
    }
  };
}

async function serveStatic({ response, publicRoot, pathname, headOnly }) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(response, 400, { error: "Invalid URL encoding." });
  }

  let relativePath = decodedPath.replace(/^\/+/, "");
  if (!relativePath) relativePath = "index.html";

  let filePath = resolve(publicRoot, relativePath);
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
    return sendJson(response, 403, { error: "Forbidden." });
  }

  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.isDirectory()) filePath = resolve(filePath, "index.html");
    return sendFile(response, filePath, pathname, 200, headOnly);
  } catch {
    return sendNotFound(response, publicRoot, headOnly);
  }
}

async function sendFile(response, filePath, pathname, status, headOnly) {
  const content = await readFile(filePath);
  response.writeHead(status, {
    "Cache-Control": cachePolicy(pathname),
    "Content-Length": String(content.byteLength),
    "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(headOnly ? undefined : content);
}

async function sendNotFound(response, publicRoot, headOnly) {
  const customPage = resolve(publicRoot, "404.html");
  try {
    return await sendFile(response, customPage, "/404.html", 404, headOnly);
  } catch {
    return sendJson(response, 404, { error: "File not found." });
  }
}

function sendRedirect(response, destination, status) {
  response.writeHead(status, {
    "Cache-Control": "no-cache",
    "Location": destination,
  });
  response.end();
}

function sendJson(response, status, body) {
  const content = JSON.stringify(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": String(Buffer.byteLength(content)),
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(content);
}

function cachePolicy(pathname) {
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/fonts/")) {
    return "public, max-age=31536000, immutable";
  }
  if (pathname.startsWith("/assets/") || pathname.startsWith("/audio/")) {
    return "public, max-age=86400, stale-while-revalidate=604800";
  }
  if (pathname === "/robots.txt" || /^\/sitemap-.+\.xml$/.test(pathname)) {
    return "public, max-age=3600, must-revalidate";
  }
  return "public, max-age=0, must-revalidate";
}

async function loadRedirects(publicRoot) {
  const redirects = new Map();
  try {
    const source = await readFile(resolve(publicRoot, "_redirects"), "utf8");
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [from, destination, rawStatus] = line.split(/\s+/);
      const status = Number(rawStatus);
      if (!from || !destination || ![301, 302, 307, 308].includes(status)) continue;
      redirects.set(from, { destination, status });
    }
  } catch {
    // Astro can still be previewed before redirects are generated, but the
    // validation command requires the complete production artifact.
  }
  return redirects;
}

async function startServer() {
  const port = Number(process.env.PORT || 8090);
  const host = process.env.HOST || "127.0.0.1";
  const handler = await createStaticHandler();
  const server = createServer(handler);

  server.on("error", (error) => {
    console.error(`Thomas's Classroom preview could not start: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Thomas's Classroom: http://localhost:${port}/`);
    console.log(`Curriculum map:     http://localhost:${port}/curriculum/`);
    console.log(`Static build:       ${defaultPublicRoot}`);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) await startServer();
