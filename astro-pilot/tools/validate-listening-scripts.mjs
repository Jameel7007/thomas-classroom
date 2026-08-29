import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";
import { readyLessons } from "../src/data/lesson-catalog.mjs";
import { extractTutorListeningScripts } from "../src/lib/listening-scripts.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];
const lessonsWithScripts = [];
let clipCount = 0;
let disclosureCount = 0;

for (const lesson of readyLessons) {
  const source = readFileSync(path.join(root, lesson.source), "utf8");
  const groups = extractTutorListeningScripts(source);
  const hasMarkedListening = /data-lesson-extension="(?:Tutor-read|Optional tutor-read)/i.test(source);
  if (hasMarkedListening && !groups.length) {
    errors.push(`${lesson.source}: marked tutor-read section has no extractable tutor script`);
  }
  if (!groups.length) continue;

  lessonsWithScripts.push({ lesson, groups });
  for (const group of groups) {
    if (!group.title) errors.push(`${lesson.source}: tutor listening group has no title`);
    if (!group.clips.length) errors.push(`${lesson.source}: ${group.title || "listening group"} has no clips`);
    disclosureCount += group.disclosureCount;
    for (const [index, clip] of group.clips.entries()) {
      clipCount += 1;
      if (!clip.text.trim()) errors.push(`${lesson.source}: clip ${index + 1} has no script text`);
      if (!clip.supports.length || clip.supports.some((item) => !item.trim())) {
        errors.push(`${lesson.source}: clip ${index + 1} does not identify the learner item it supports`);
      }
    }
  }
}

if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nListening-script validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(sourceOnly
  ? `Listening-script source validation passed: ${clipCount} clips from ${lessonsWithScripts.length} lessons are derived for tutor plans.`
  : `Listening scripts validated: ${clipCount} clips from ${lessonsWithScripts.length} lessons appear in tutor plans and no tutor-script disclosure or full clip remains in a learner listening prompt (${disclosureCount} source disclosures checked).`);

function validateOutput() {
  for (const { lesson, groups } of lessonsWithScripts) {
    const learnerPath = path.join(dist, lesson.route.replace(/^\//, ""), "index.html");
    const planPath = path.join(dist, "tutor", "plans", lesson.id, "index.html");
    if (!existsSync(learnerPath)) {
      errors.push(`${lesson.route}: learner output is missing`);
      continue;
    }
    if (!existsSync(planPath)) {
      errors.push(`/tutor/plans/${lesson.id}/: tutor-plan output is missing`);
      continue;
    }

    const learnerDocument = parse(readFileSync(learnerPath, "utf8"));
    const learnerContent = findFirst(learnerDocument, (node) => attribute(node, "id") === "lesson-content");
    const planDocument = parse(readFileSync(planPath, "utf8"));
    const planScripts = findFirst(planDocument, (node) => hasAttribute(node, "data-tutor-listening-scripts"));
    if (!learnerContent) {
      errors.push(`${lesson.route}: learner content root is missing`);
      continue;
    }
    if (!planScripts) {
      errors.push(`/tutor/plans/${lesson.id}/: tutor listening-script section is missing`);
      continue;
    }

    const learnerSummaries = findAll(learnerContent, (node) => node.tagName === "summary");
    for (const summary of learnerSummaries) {
      if (/(?:\b(?:teacher|tutor)\b.*\b(?:script|transcript|listening)\b|\breveal the listening evidence\b)/i.test(textContent(summary))) {
        errors.push(`${lesson.route}: tutor-script disclosure remains on the learner page`);
      }
    }
    if (/\bTutor lines?\s*:\s*[“"]/i.test(textContent(learnerContent))) {
      errors.push(`${lesson.route}: an inline tutor script remains on the learner page`);
    }

    const renderedClips = findAll(planScripts, (node) => hasAttribute(node, "data-tutor-listening-clip"));
    const expectedClips = groups.flatMap((group) => group.clips);
    if (renderedClips.length !== expectedClips.length) {
      errors.push(`/tutor/plans/${lesson.id}/: expected ${expectedClips.length} rendered clips, found ${renderedClips.length}`);
    }

    const planText = normalize(textContent(planScripts));
    for (const [index, clip] of expectedClips.entries()) {
      const clipText = normalize(clip.text);
      if (!planText.includes(clipText)) {
        errors.push(`/tutor/plans/${lesson.id}/: clip ${index + 1} script text is missing`);
      }
      const renderedClip = renderedClips[index];
      if (renderedClip && !/\bSupports:\s*\S/i.test(textContent(renderedClip))) {
        errors.push(`/tutor/plans/${lesson.id}/: clip ${index + 1} does not name its supported item`);
      }
    }

    for (const group of groups) {
      const learnerGroups = findAll(learnerContent, (node) => attribute(node, "data-lesson-extension") === group.title);
      const learnerPrompts = learnerGroups.flatMap((context) => findAll(context, (node) =>
        hasClass(node, "q") || hasClass(node, "quiz-question")));
      for (const [index, clip] of group.clips.entries()) {
        const scriptText = normalize(clip.text);
        if (scriptText.length < 18 || scriptText.split(" ").length < 4) continue;
        if (learnerPrompts.some((prompt) => normalize(textContent(prompt)).includes(scriptText))) {
          errors.push(`${lesson.route}: clip ${index + 1} script text remains in its learner listening prompt`);
        }
      }
    }
  }
}

function findAll(rootNode, predicate) {
  const found = [];
  walk(rootNode, (node) => { if (predicate(node)) found.push(node); });
  return found;
}

function findFirst(rootNode, predicate) {
  let found;
  walk(rootNode, (node) => { if (!found && predicate(node)) found = node; });
  return found;
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function textContent(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(textContent).join(" ").replace(/\s+/g, " ").trim();
}

function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value || "";
}

function hasAttribute(node, name) {
  return Boolean(node?.attrs?.some((item) => item.name === name));
}

function hasClass(node, name) {
  return attribute(node, "class").split(/\s+/).includes(name);
}

function normalize(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[“”"'‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}
