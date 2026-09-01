import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRANSFER_CATEGORIES, transferCounts, transferLanguages } from "../src/data/language-transfer.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const counts = transferCounts();
const patterns = transferLanguages.flatMap((language) => language.patterns.map((pattern) => ({ language, pattern })));
const relationshipCount = patterns.reduce((total, item) => total + item.pattern.lessons.length, 0);

validateSource();
if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nLanguage-transfer validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(sourceOnly
  ? `Language-transfer source contracts passed: ${counts.languages} first-language guides, ${counts.patterns} validated patterns, ${counts.helpfulWords} helpful cognates or loanwords, ${counts.wordTraps} false friends or translation traps, ${counts.lessons} ready lesson destinations, tutor prompts, and no learner profiling or stored progress.`
  : `Language-transfer guide validated: ${counts.languages} languages, ${counts.patterns} contrastive patterns, ${counts.helpfulWords} helpful cognates or loanwords, ${counts.wordTraps} word traps, ${relationshipCount} targeted practice links, native disclosures, A0–B2 coverage, ItemList schema, and direct-refresh output.`);

function validateSource() {
  const contracts = [
    ["src/data/language-transfer.mjs", /defineTransferLanguages/],
    ["src/data/language-transfer.mjs", /getLesson\(lessonId\)/],
    ["src/data/language-transfer.mjs", /getTransferPatternsForLesson/],
    ["src/data/language-transfer.mjs", /at least eight patterns are required/],
    ["src/data/language-transfer.mjs", /at least five helpful cognates or loanwords are required/],
    ["src/data/language-transfer.mjs", /at least five false friends or translation traps are required/],
    ["src/components/languages/LanguageTransferGuide.astro", /Test a pattern\. Do not label a learner\./],
    ["src/components/languages/LanguageTransferGuide.astro", /data-transfer-pattern/],
    ["src/components/languages/LanguageTransferGuide.astro", /transfer-tutor-move/],
    ["src/components/languages/LanguageTransferGuide.astro", /Practice the decision/],
    ["src/components/languages/LanguageTransferGuide.astro", /data-lexical-bridge/],
    ["src/components/languages/LanguageTransferGuide.astro", /Cognates, loanwords, and false friends/],
    ["src/components/tutor/TransferLens.astro", /getTransferPatternsForLesson/],
    ["src/components/tutor/TransferLens.astro", /data-transfer-lens-select/],
    ["src/components/tutor/TransferLens.astro", /Quick correction drill/],
    ["src/components/tutor/TransferLens.astro", /Test a pattern\. Do not label a learner\./],
    ["src/pages/languages.astro", /"@type": "ItemList"/],
    ["src/styles/languages.css", /\.transfer-pattern>summary:focus-visible/],
    ["src/styles/languages.css", /prefers-reduced-motion:reduce/],
  ];
  for (const [relative, contract] of contracts) {
    const file = path.join(root, relative);
    if (!existsSync(file)) {
      errors.push(`${relative}: required source file is missing`);
      continue;
    }
    if (!contract.test(readFileSync(file, "utf8"))) errors.push(`${relative}: required language-transfer contract is missing`);
  }

  if (existsSync(path.join(root, "src/data/site-content.ts"))) errors.push("src/data/site-content.ts: obsolete transfer registry must remain removed");
  if (counts.languages < 7) errors.push(`only ${counts.languages} first-language guides are available; expected the seven priority languages`);
  if (counts.patterns < 59) errors.push(`only ${counts.patterns} contrastive patterns are available; expected at least 59`);
  if (counts.lessons < 25) errors.push(`only ${counts.lessons} ready lesson destinations are represented; expected at least 25`);
  if (counts.helpfulWords < counts.languages * 5) errors.push(`only ${counts.helpfulWords} helpful cognates or loanwords are available; expected at least five per language`);
  if (counts.wordTraps < counts.languages * 5) errors.push(`only ${counts.wordTraps} false friends or translation traps are available; expected at least five per language`);
  if (TRANSFER_CATEGORIES.length < 6) errors.push("transfer patterns do not cover enough decision types");

  const representedLevels = new Set(patterns.map(({ pattern }) => pattern.level));
  for (const level of ["A0", "A1", "A2", "B1", "B2"]) {
    if (!representedLevels.has(level)) errors.push(`no transfer pattern covers ${level}`);
  }
  for (const language of transferLanguages) {
    if (language.patterns.length < 8) errors.push(`${language.name}: fewer than eight transfer patterns`);
    if (!language.patterns.some((pattern) => pattern.level === "A0")) errors.push(`${language.name}: no foundation pattern`);
    if (!language.patterns.some((pattern) => ["B1", "B2"].includes(pattern.level))) errors.push(`${language.name}: no independent-user pattern`);
    if (language.lexicalBridge.helpful.length < 5) errors.push(`${language.name}: fewer than five helpful cognates or loanwords`);
    if (language.lexicalBridge.traps.length < 5) errors.push(`${language.name}: fewer than five false friends or translation traps`);
  }
  for (const name of ["Russian", "Ukrainian", "Czech", "Turkish", "Mandarin Chinese", "Spanish", "Brazilian Portuguese"]) {
    if (!transferLanguages.some((language) => language.name === name)) errors.push(`priority first-language guide is missing: ${name}`);
  }

  const component = readFileSync(path.join(root, "src/components/languages/LanguageTransferGuide.astro"), "utf8");
  if (/<script\b|\b(?:localStorage|sessionStorage|indexedDB)\b/.test(component)) errors.push("Language-transfer guide must remain native, static, and free of stored learner state");
  if (/type=["']checkbox["']|data-credit|progress/i.test(component)) errors.push("Language-transfer guide must not become learner progress tracking");
  const lens = readFileSync(path.join(root, "src/components/tutor/TransferLens.astro"), "utf8");
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(lens)) errors.push("Tutor transfer lens must not store or profile a learner’s first language");
}

function validateOutput() {
  const output = path.join(dist, "languages/index.html");
  if (!existsSync(output)) {
    errors.push("/languages/: direct-refresh output is missing");
    return;
  }
  const html = readFileSync(output, "utf8");
  const languageSections = [...html.matchAll(/\bdata-transfer-language="([^"]+)"/g)].map((match) => match[1]);
  const patternIds = [...html.matchAll(/\bdata-transfer-pattern="([^"]+)"/g)].map((match) => match[1]);
  const details = [...html.matchAll(/<details\b[^>]*class="transfer-pattern"[^>]*>/g)].map((match) => match[0]);
  const practiceLinks = [...html.matchAll(/<a\b[^>]*href="(\/lessons\/[^"]+\/)"[^>]*>/g)].map((match) => match[1]);
  const lexicalBridges = [...html.matchAll(/\bdata-lexical-bridge="([^"]+)"/g)].map((match) => match[1]);
  const helpfulWords = [...html.matchAll(/class="helpful-word-list"/g)].length;
  const wordTrapLists = [...html.matchAll(/class="word-trap-list"/g)].length;

  if (languageSections.length !== counts.languages) errors.push(`/languages/: expected ${counts.languages} language sections, found ${languageSections.length}`);
  if (new Set(languageSections).size !== counts.languages) errors.push("/languages/: language section identifiers are missing or duplicated");
  if (patternIds.length !== counts.patterns) errors.push(`/languages/: expected ${counts.patterns} patterns, found ${patternIds.length}`);
  if (new Set(patternIds).size !== counts.patterns) errors.push("/languages/: pattern identifiers are missing or duplicated");
  if (details.length !== counts.patterns) errors.push(`/languages/: expected ${counts.patterns} native disclosures, found ${details.length}`);
  if (details.filter((detail) => /\sopen(?:\s|>)/.test(detail)).length !== counts.languages) errors.push("/languages/: each language should open one representative pattern by default");
  if (practiceLinks.length !== relationshipCount) errors.push(`/languages/: expected ${relationshipCount} practice links, found ${practiceLinks.length}`);
  if (lexicalBridges.length !== counts.languages || new Set(lexicalBridges).size !== counts.languages) errors.push(`/languages/: expected one stable lexical bridge per language`);
  if (helpfulWords !== counts.languages) errors.push(`/languages/: expected ${counts.languages} helpful-word lists, found ${helpfulWords}`);
  if (wordTrapLists !== counts.languages) errors.push(`/languages/: expected ${counts.languages} word-trap lists, found ${wordTrapLists}`);
  if (!html.includes("Test a pattern. Do not label a learner.")) errors.push("/languages/: responsible-use framing is missing");
  if ((html.match(/class="transfer-tutor-move"/g) || []).length !== counts.patterns) errors.push("/languages/: every pattern must include a tutor move");

  for (const { pattern } of patterns) {
    for (const lesson of pattern.lessons) {
      if (!practiceLinks.includes(lesson.route)) errors.push(`/languages/: missing practice link ${lesson.route}`);
    }
  }

  const list = structuredDataNodes(html).find((node) => node["@type"] === "ItemList" && node["@id"]?.endsWith("#language-transfer-guide"));
  if (!list) errors.push("/languages/: language-transfer ItemList structured data is missing");
  else if (list.numberOfItems !== counts.languages || list.itemListElement?.length !== counts.languages) errors.push("/languages/: ItemList does not represent every language guide");

  const sitemapPath = path.join(dist, "sitemap-0.xml");
  if (!existsSync(sitemapPath) || !/<loc>[^<]*\/languages\/<\/loc>/.test(readFileSync(sitemapPath, "utf8"))) errors.push("sitemap: /languages/ is missing");
}

function structuredDataNodes(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    try {
      const data = JSON.parse(match[1]);
      return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    } catch (error) {
      errors.push(`/languages/: structured data is invalid JSON (${error.message})`);
      return [];
    }
  });
}
