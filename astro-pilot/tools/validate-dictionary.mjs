import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DICTIONARY_LEVELS, dictionaryCounts, dictionaryEntries } from "../src/data/dictionary.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const counts = dictionaryCounts();

validateSource();
if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nDictionary validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(sourceOnly
  ? `Dictionary source contracts passed: ${counts.words} validated headwords, ${counts.senses} individual meanings, ${counts.chunks} chunks, multi-sense search, URL state, and private in-session clear marks.`
  : `Dictionary validated: ${counts.words} searchable headwords, ${counts.senses} labeled meanings, ${counts.chunks} chunks, ${DICTIONARY_LEVELS.length} levels, progressive filtering, resettable clear marks, DefinedTermSet schema, and direct-refresh output.`);

function validateSource() {
  const contracts = [
    ["src/data/dictionary.mjs", /defineDictionary/],
    ["src/data/dictionary.mjs", /Duplicate dictionary sense/],
    ["src/components/dictionary/DictionaryExplorer.astro", /data-dictionary-query/],
    ["src/components/dictionary/DictionaryExplorer.astro", /data-dictionary-level/],
    ["src/components/dictionary/DictionaryExplorer.astro", /data-dictionary-part/],
    ["src/components/dictionary/DictionaryExplorer.astro", /data-dictionary-cleared-input/],
    ["src/components/dictionary/DictionaryExplorer.astro", /window\.history\.replaceState/],
    ["src/components/dictionary/DictionaryExplorer.astro", /event\.key === "Escape"/],
    ["src/pages/dictionary.astro", /"@type": "DefinedTermSet"/],
    ["src/styles/dictionary.css", /\.dictionary-sense\.is-cleared/],
    ["src/styles/dictionary.css", /\.dictionary-clear-control input:focus-visible/],
  ];
  for (const [relative, contract] of contracts) {
    const target = path.join(root, relative);
    if (!existsSync(target)) {
      errors.push(`${relative}: required source file is missing`);
      continue;
    }
    if (!contract.test(readFileSync(target, "utf8"))) errors.push(`${relative}: required Dictionary contract is missing`);
  }

  if (counts.words < 25) errors.push(`dictionary registry is too small at ${counts.words} words; expected at least 25`);
  if (counts.senses < 70) errors.push(`dictionary registry is too shallow at ${counts.senses} meanings; expected at least 70`);
  if (counts.chunks < 200) errors.push(`dictionary registry has only ${counts.chunks} chunks; expected at least 200`);

  const representedLevels = new Set(dictionaryEntries.flatMap((entry) => entry.senses.map((sense) => sense.level)));
  for (const level of DICTIONARY_LEVELS) {
    if (!representedLevels.has(level)) errors.push(`dictionary registry has no ${level} meaning`);
  }
  const representedParts = new Set(dictionaryEntries.flatMap((entry) => entry.senses.map((sense) => sense.partOfSpeech)));
  for (const part of ["adjective", "adverb", "conjunction", "modal verb", "noun", "preposition", "verb"]) {
    if (!representedParts.has(part)) errors.push(`dictionary registry has no ${part} meaning`);
  }

  const component = readFileSync(path.join(root, "src/components/dictionary/DictionaryExplorer.astro"), "utf8");
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(component)) errors.push("Dictionary clear marks must not store learner state in the browser");
  if (/\b(?:fetch|XMLHttpRequest|EventSource|WebSocket)\s*\(/.test(component)) errors.push("Dictionary must remain static and make no learner-time network requests");
  if (/elevenlabs/i.test(component)) errors.push("Dictionary must not call ElevenLabs");
}

function validateOutput() {
  const output = path.join(dist, "dictionary/index.html");
  if (!existsSync(output)) {
    errors.push("/dictionary/: direct-refresh output is missing");
    return;
  }

  const html = readFileSync(output, "utf8");
  const words = [...html.matchAll(/\bdata-dictionary-entry(?:\s|>)/g)].length;
  const senses = [...html.matchAll(/\bdata-dictionary-sense(?:\s|>)/g)].length;
  const clearInputs = [...html.matchAll(/<input\b[^>]*data-dictionary-cleared-input[^>]*>/g)];
  const senseIds = [...html.matchAll(/\bdata-sense-id="([^"]+)"/g)].map((match) => match[1]);

  if (words !== counts.words) errors.push(`/dictionary/: expected ${counts.words} word entries, found ${words}`);
  if (senses !== counts.senses) errors.push(`/dictionary/: expected ${counts.senses} meanings, found ${senses}`);
  if (clearInputs.length !== counts.senses) errors.push(`/dictionary/: expected ${counts.senses} clear controls, found ${clearInputs.length}`);
  if (new Set(senseIds).size !== counts.senses) errors.push("/dictionary/: meaning identifiers are missing or duplicated");
  if (!/data-dictionary-status[^>]*aria-live="polite"/.test(html)) errors.push("/dictionary/: result summary is not announced accessibly");
  if (!/data-dictionary-cleared[^>]*aria-live="polite"/.test(html)) errors.push("/dictionary/: clear-mark summary is not announced accessibly");
  if ((html.match(/<details\b[^>]*class="dictionary-origin"/g) || []).length !== counts.words) errors.push("/dictionary/: every headword must include a word story disclosure");
  if ((html.match(/<li><b>[^<]+<\/b><span>/g) || []).length < 4) errors.push("/dictionary/: four-step word-clearing method is incomplete");
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(html)) errors.push("/dictionary/: rendered page must not persist learner clear marks");

  const nodes = structuredDataNodes(html);
  const termSet = nodes.find((node) => node["@type"] === "DefinedTermSet");
  if (!termSet) {
    errors.push("/dictionary/: DefinedTermSet structured data is missing");
  } else if (termSet.hasDefinedTerm?.length !== counts.words) {
    errors.push(`/dictionary/: DefinedTermSet must contain all ${counts.words} headwords`);
  }

  const sitemapPath = path.join(dist, "sitemap-0.xml");
  if (!existsSync(sitemapPath) || !/<loc>[^<]*\/dictionary\/<\/loc>/.test(readFileSync(sitemapPath, "utf8"))) {
    errors.push("sitemap: /dictionary/ is missing");
  }
}

function structuredDataNodes(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    try {
      const data = JSON.parse(match[1]);
      return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    } catch (error) {
      errors.push(`/dictionary/: structured data is invalid JSON (${error.message})`);
      return [];
    }
  });
}
