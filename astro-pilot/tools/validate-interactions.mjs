import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as parse5 from "parse5";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "dist");
const errors = [];
const counts = {
  assessmentChoices: 0,
  lessonChoices: 0,
  choiceGaps: 0,
  sentenceBuilders: 0,
  tileMatches: 0,
  errorRepairs: 0,
  typedAnswers: 0,
  valueLabelVariants: 0,
};
const responseOrderCounts = {
  randomizedBanks: 0,
  fixedBanks: 0,
};

validateLessonEngineContract();

if (!existsSync(outputRoot)) {
  console.error("Interaction validation failed:\n- dist is missing; run the Astro build first");
  process.exit(1);
}

for (const file of walk(outputRoot).filter((entry) => entry.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  if (/http-equiv="refresh"/i.test(html)) continue;

  const route = "/" + slash(path.relative(outputRoot, file)).replace(/(?:^|\/)index\.html$/, "");
  const document = parse5.parse(html);
  const nodes = descendants(document);

  for (const [attributeName, label] of [
    ["data-option", "assessment option"],
    ["data-quiz-option", "lesson quiz option"],
    ["data-choice-option", "choice-gap option"],
  ]) {
    for (const option of nodesWithAttribute(nodes, attributeName)) {
      validateValueLabel(route, option, attributeName, label);
    }
  }

  for (const item of nodesWithAttribute(nodes, "data-assessment-item")) {
    const answer = attribute(item, "data-answer");
    const options = descendantsWithAttribute(item, "data-option");
    if (answer !== undefined && options.length) {
      validateResponseGroups(route, item, "data-option", "assessment option bank");
      counts.assessmentChoices += 1;
      validateChoiceSet({
        route,
        label: "assessment choice",
        answer,
        options: options.map((option) => attribute(option, "data-option")),
        normalize: assessmentNorm,
      });
    }
  }

  for (const item of nodesWithAttribute(nodes, "data-quiz-item")) {
    const answer = attribute(item, "data-answer");
    const options = descendantsWithAttribute(item, "data-quiz-option");
    if (answer !== undefined && options.length) {
      validateResponseGroups(route, item, "data-quiz-option", "lesson quiz option bank");
      counts.lessonChoices += 1;
      validateChoiceSet({
        route,
        label: "lesson quiz choice",
        answer,
        options: options.map((option) => attribute(option, "data-quiz-option")),
        normalize: selectableLessonNorm,
      });
    }
  }

  for (const drill of nodesWithAttribute(nodes, "data-choice-gap-drill")) {
    validateResponseGroups(route, drill, "data-choice-option", "choice-gap bank");
    const options = descendantsWithAttribute(drill, "data-choice-option")
      .map((option) => selectableLessonNorm(attribute(option, "data-choice-option")));
    validateUniqueValues(route, "choice-gap option", options);

    for (const gap of descendantsWithAttribute(drill, "data-choice-gap")) {
      const answer = attribute(gap, "data-answer");
      if (answer === undefined) {
        errors.push(`${route}: choice gap is missing data-answer`);
        continue;
      }
      counts.choiceGaps += 1;
      const accepted = answer.split("|").map(selectableLessonNorm).filter(Boolean);
      if (!accepted.length) errors.push(`${route}: choice gap has an empty answer`);
      for (const value of accepted) {
        if (!options.includes(value)) {
          errors.push(`${route}: choice-gap answer "${value}" is not available in its option bank`);
        }
      }
    }
  }

  for (const builder of nodesWithAttribute(nodes, "data-tile-builder")) {
    validateResponseGroups(route, builder, "data-build-tile", "sentence-builder bank");
    counts.sentenceBuilders += 1;
    const answer = attribute(builder, "data-answer");
    const tiles = descendantsWithAttribute(builder, "data-build-tile")
      .map((tile) => attribute(tile, "data-build-tile"));
    if (!answer) {
      errors.push(`${route}: sentence builder is missing a non-empty data-answer`);
    } else if (!tiles.length) {
      errors.push(`${route}: sentence builder has no selectable tiles`);
    } else if (!canBuildAnswer(answer, tiles)) {
      errors.push(`${route}: sentence-builder answer "${answer}" cannot be assembled exactly from [${tiles.join(" · ")}]`);
    }
  }

  for (const game of nodesWithAttribute(nodes, "data-tile-game")) {
    validateResponseGroups(route, game, "data-tile", "matching-tile bank");
    counts.tileMatches += 1;
    const tiles = descendantsWithAttribute(game, "data-tile")
      .map((tile) => lessonNorm(attribute(tile, "data-tile"))).sort();
    const slots = descendantsWithAttribute(game, "data-slot")
      .map((slot) => lessonNorm(attribute(slot, "data-slot"))).sort();
    if (!tiles.length || !slots.length) {
      errors.push(`${route}: tile-matching game must contain both tiles and slots`);
    } else if (tiles.join("|") !== slots.join("|")) {
      errors.push(`${route}: tile-matching values do not match their target slots`);
    }
  }

  for (const repair of nodesWithAttribute(nodes, "data-spot-error")) {
    counts.errorRepairs += 1;
    const answer = lessonNorm(attribute(repair, "data-answer"));
    const choices = descendantsWithAttribute(repair, "data-error-choice")
      .map((choice) => lessonNorm(attribute(choice, "data-error-choice")));
    validateUniqueValues(route, "error-repair choice", choices);
    if (!answer) {
      errors.push(`${route}: error-repair interaction is missing a non-empty data-answer`);
    } else if (!choices.includes(answer)) {
      errors.push(`${route}: error-repair answer "${answer}" is not one of its selectable words`);
    }
  }

  for (const input of nodesWithAttribute(nodes, "data-answer")) {
    if (input.nodeName !== "input" && input.nodeName !== "textarea") continue;
    counts.typedAnswers += 1;
    const accepted = attribute(input, "data-answer").split("|").map(lessonNorm).filter(Boolean);
    if (!accepted.length) errors.push(`${route}: typed-answer input has no accepted answer`);
    if (new Set(accepted).size !== accepted.length) errors.push(`${route}: typed-answer input repeats an accepted answer`);
  }
}

if (errors.length) {
  console.error(`\nInteraction integrity failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
console.log(
  `Interaction integrity passed for ${total - counts.valueLabelVariants} answer contracts: ` +
  `${counts.assessmentChoices} assessment choices, ${counts.lessonChoices} lesson choices, ` +
  `${counts.choiceGaps} choice gaps, ${counts.sentenceBuilders} sentence builders, ` +
  `${counts.tileMatches} tile games, ${counts.errorRepairs} error repairs, and ` +
  `${counts.typedAnswers} typed answers; ${counts.valueLabelVariants} intentional value/label variants. ` +
  `${responseOrderCounts.randomizedBanks} response banks randomize per load; ${responseOrderCounts.fixedBanks} documented fixed-order exceptions.`,
);

function validateChoiceSet({ route, label, answer, options, normalize }) {
  const normalizedAnswer = normalize(answer);
  const normalizedOptions = options.map(normalize);
  validateUniqueValues(route, label, normalizedOptions);
  if (!normalizedAnswer) {
    errors.push(`${route}: ${label} has an empty answer`);
    return;
  }
  const matches = normalizedOptions.filter((option) => option === normalizedAnswer).length;
  if (matches !== 1) {
    errors.push(`${route}: ${label} answer "${answer}" matches ${matches} selectable options; expected exactly one`);
  }
}

function validateValueLabel(route, option, attributeName, label) {
  const value = attribute(option, attributeName);
  const visibleLabel = textContent(option);
  const variant = attribute(option, "data-value-label-variant");
  if (variant !== undefined) {
    counts.valueLabelVariants += 1;
    if (!["case", "semantic", "token"].includes(variant)) {
      errors.push(`${route}: ${label} uses unknown data-value-label-variant="${variant}"`);
    }
    const normalizedValue = valueLabelNorm(value);
    const normalizedLabel = valueLabelNorm(visibleLabel);
    if (normalizedValue === normalizedLabel) {
      errors.push(`${route}: ${label} marks a value/label variant even though "${visibleLabel}" already matches its value`);
    }
    if (variant === "case" && normalizedValue.toLocaleLowerCase() !== normalizedLabel.toLocaleLowerCase()) {
      errors.push(`${route}: ${label} marks a case-only variant but "${value}" and "${visibleLabel}" differ by more than case`);
    }
    return;
  }
  if (valueLabelNorm(value) !== valueLabelNorm(visibleLabel)) {
    errors.push(`${route}: ${label} value "${value}" does not match its visible label "${visibleLabel}"`);
  }
}

function validateLessonEngineContract() {
  const source = readFileSync(path.join(projectRoot, "src/scripts/lesson.js"), "utf8");
  const assessmentSource = readFileSync(path.join(projectRoot, "src/scripts/assessment.js"), "utf8");
  const randomizer = readFileSync(path.join(projectRoot, "src/scripts/randomize-responses.js"), "utf8");
  const choiceNormalizer = source.match(/function choiceNorm\(value\)\{[\s\S]*?\n  \}/)?.[0] || "";
  if (!choiceNormalizer || /toLowerCase/.test(choiceNormalizer)) {
    errors.push("src/scripts/lesson.js: selectable-answer normalization must preserve intentional capitalization");
  }
  if (!/function norm\(value\)\{[\s\S]*?toLowerCase\(\)/.test(source)) {
    errors.push("src/scripts/lesson.js: typed-answer normalization must remain case-insensitive");
  }
  for (const [label, pattern] of [
    ["choice-gap answer", /gap\.dataset\.answer\.split\("\|"\)\.map\(choiceNorm\)/],
    ["choice-gap attempt", /choiceNorm\(gap\.dataset\.value\)/],
    ["lesson-quiz answer", /const answer = choiceNorm\(item\.dataset\.answer\)/],
    ["lesson-quiz option", /choiceNorm\(option\.dataset\.quizOption\) === answer/],
    ["lesson-quiz attempt", /choiceNorm\(item\.dataset\.value\) === answer/],
  ]) {
    if (!pattern.test(source)) errors.push(`src/scripts/lesson.js: ${label} does not use the selectable-answer normalization contract`);
  }
  for (const [file, label, target, pattern] of [
    [source, "choice-gap banks", "src/scripts/lesson.js", /randomizeResponseGroups\(root, "\[data-choice-option\]"\)/],
    [source, "matching-tile banks", "src/scripts/lesson.js", /randomizeResponseGroups\(root, "\[data-tile\]"\)/],
    [source, "sentence-builder banks", "src/scripts/lesson.js", /randomizeResponseGroups\(bank, "\[data-build-tile\]"\)/],
    [source, "lesson quiz options", "src/scripts/lesson.js", /randomizeResponseGroups\(item, "\[data-quiz-option\]"\)/],
    [assessmentSource, "assessment option banks", "src/scripts/assessment.js", /randomizeResponseGroups\(item, "\[data-option\]"\)/],
  ]) {
    if (!pattern.test(file)) errors.push(`${target}: ${label} do not use the shared per-load randomization contract`);
  }
  for (const [label, pattern] of [
    ["Fisher-Yates swapping", /for \(let index = shuffled\.length - 1; index > 0; index -= 1\)/],
    ["browser entropy with a fallback", /window\.crypto[\s\S]*Math\.random/],
    ["explicit fixed-order opt-out", /closest\("\[data-fixed-order\]"\)/],
    ["runtime response-order evidence", /dataset\.responseOrder = "randomized"/],
  ]) {
    if (!pattern.test(randomizer)) errors.push(`src/scripts/randomize-responses.js: missing ${label}`);
  }
}

function validateResponseGroups(route, owner, attributeName, label) {
  const groups = new Map();
  for (const option of descendantsWithAttribute(owner, attributeName)) {
    const group = option.parentNode;
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(option);
  }
  for (const [group, options] of groups) {
    if (options.length < 2) {
      errors.push(`${route}: ${label} has ${options.length} response; expected at least two`);
      continue;
    }
    const fixed = fixedOrderAncestor(group, owner);
    if (!fixed) {
      responseOrderCounts.randomizedBanks += 1;
      continue;
    }
    responseOrderCounts.fixedBanks += 1;
    const reason = attribute(fixed, "data-fixed-order-reason");
    if (!reason || reason.trim().length < 12) {
      errors.push(`${route}: ${label} opts out of randomization without a specific data-fixed-order-reason`);
    }
  }
}

function fixedOrderAncestor(node, owner) {
  let current = node;
  while (current) {
    if (attribute(current, "data-fixed-order") !== undefined) return current;
    if (current === owner) return null;
    current = current.parentNode;
  }
  return null;
}

function validateUniqueValues(route, label, values) {
  if (values.some((value) => !value)) errors.push(`${route}: ${label} contains an empty value`);
  const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  if (duplicates.length) errors.push(`${route}: duplicate ${label} value(s): ${duplicates.join(", ")}`);
}

function canBuildAnswer(answer, tileValues) {
  const target = lessonNorm(answer).split(" ").filter(Boolean);
  const tiles = tileValues.map((value) => lessonNorm(value).split(" ").filter(Boolean));
  if (!target.length || tiles.some((tile) => !tile.length)) return false;

  const failedStates = new Set();
  function search(position, usedMask) {
    if (position === target.length) return usedMask === (1 << tiles.length) - 1;
    const state = `${position}:${usedMask}`;
    if (failedStates.has(state)) return false;

    for (let index = 0; index < tiles.length; index += 1) {
      if (usedMask & (1 << index)) continue;
      const tile = tiles[index];
      if (tile.every((word, offset) => target[position + offset] === word) &&
          search(position + tile.length, usedMask | (1 << index))) {
        return true;
      }
    }
    failedStates.add(state);
    return false;
  }

  if (tiles.length > 30) return false;
  return search(0, 0);
}

function assessmentNorm(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function lessonNorm(value) {
  return selectableLessonNorm(value).toLocaleLowerCase();
}

function selectableLessonNorm(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function valueLabelNorm(value) {
  return String(value || "").trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[|·]/g, " ")
    .replace(/\s+/g, " ");
}

function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value;
}

function nodesWithAttribute(nodes, name) {
  return nodes.filter((node) => attribute(node, name) !== undefined);
}

function descendantsWithAttribute(node, name) {
  return descendants(node).filter((entry) => attribute(entry, name) !== undefined);
}

function descendants(node, result = []) {
  for (const child of node.childNodes || []) {
    result.push(child);
    descendants(child, result);
  }
  return result;
}

function textContent(node) {
  return (node.childNodes || []).map((child) =>
    child.nodeName === "#text" ? child.value : textContent(child)).join("").trim();
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

function slash(value) {
  return value.split(path.sep).join("/");
}
