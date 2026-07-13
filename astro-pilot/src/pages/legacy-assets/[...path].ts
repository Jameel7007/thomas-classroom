import type { APIRoute } from "astro";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputRoot = fileURLToPath(new URL("../../../../outputs", import.meta.url));
const allowedRoots = [
  "tokens.css",
  "lessons/lesson.css",
  "lessons/drills.css",
  "lessons/lesson.js",
  "lessons/img",
  "img/flags",
  "assessments/assessment.css",
  "assessments/assessment.js",
  "assessments/quick-level-check.css",
  "assessments/quick-level-check.js",
];

const assets = allowedRoots.flatMap((relative) => {
  const absolute = path.join(outputRoot, relative);
  return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
}).map((absolute) => ({
  absolute,
  relative: slash(path.relative(outputRoot, absolute)),
}));

export function getStaticPaths() {
  return assets.map((asset) => ({ params: { path: asset.relative }, props: asset }));
}

export const GET: APIRoute = ({ props }) => {
  const asset = props as { absolute: string; relative: string };
  return new Response(readFileSync(asset.absolute), {
    headers: {
      "Content-Type": mimeType(asset.relative),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

function slash(value: string) {
  return value.split(path.sep).join("/");
}

function mimeType(file: string) {
  const extension = path.extname(file).toLowerCase();
  return ({
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
  } as Record<string, string>)[extension] || "application/octet-stream";
}
