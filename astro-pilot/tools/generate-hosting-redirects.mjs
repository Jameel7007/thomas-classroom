import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { legacyRedirects } from "../src/data/legacy-redirects.mjs";

export const projectRoot = fileURLToPath(new URL("..", import.meta.url));
export const hostingRedirectsOutputPath = path.join(projectRoot, "dist/_redirects");

export function hostingRedirectEntries() {
  return Object.entries(legacyRedirects).map(([source, destination]) => ({
    source,
    hostingSource: encodeURI(source),
    destination,
    status: 301,
  }));
}

export function renderHostingRedirects() {
  const entries = hostingRedirectEntries();
  const errors = [];
  const sources = new Set();

  for (const entry of entries) {
    if (!entry.source.startsWith("/") || !entry.destination.startsWith("/")) {
      errors.push(`${entry.source}: redirects must stay on the current site`);
    }
    if (/\s/.test(entry.hostingSource) || /\s/.test(entry.destination)) {
      errors.push(`${entry.source}: hosting redirect paths cannot contain literal whitespace`);
    }
    if (entry.source === entry.destination) errors.push(`${entry.source}: redirect cannot point to itself`);
    if (sources.has(entry.hostingSource)) errors.push(`${entry.source}: duplicate hosting redirect source`);
    sources.add(entry.hostingSource);
  }

  if (errors.length) throw new Error(`Hosting redirects are invalid:\n- ${errors.join("\n- ")}`);

  return [
    "# Generated from src/data/legacy-redirects.mjs. Do not edit dist/_redirects by hand.",
    "# Cloudflare Pages applies these before static files, producing permanent HTTP redirects.",
    ...entries.map(({ hostingSource, destination, status }) => `${hostingSource} ${destination} ${status}`),
    "",
  ].join("\n");
}

export function generateHostingRedirects() {
  const output = renderHostingRedirects();
  mkdirSync(path.dirname(hostingRedirectsOutputPath), { recursive: true });
  writeFileSync(hostingRedirectsOutputPath, output, "utf8");
  return hostingRedirectEntries().length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const count = generateHostingRedirects();
  console.log(`Hosting redirects generated: ${count} permanent rules derived from canonical route data.`);
}
