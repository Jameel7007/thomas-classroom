import { parseFragment, serialize } from "parse5";

const scriptSummaryPattern = /(?:\b(?:teacher|tutor)\b.*\b(?:script|transcript|listening)\b|\breveal the listening evidence\b)/i;
const listeningExtensionPattern = /(?:^|\b)(?:tutor-read|optional tutor-read)\b/i;

export function extractTutorListeningScripts(source) {
  const root = parseFragment(stripFrontmatter(source));
  return extractFromTree(root);
}

export function removeTutorListeningScriptsFromLesson(renderedHtml) {
  const root = parseFragment(String(renderedHtml));
  const internalGroups = extractFromTree(root, { keepContext: true });

  for (const group of internalGroups) redactListeningItems(group);
  for (const detail of findAll(root, isTutorScriptDetails)) removeNode(detail);
  replaceObsoleteLearnerInstructions(root);
  const groups = internalGroups.map(({ context: _context, ...group }) => group);

  return {
    html: serialize(root),
    groups,
    removedDisclosureCount: groups.reduce((total, group) => total + group.disclosureCount, 0),
  };
}

function extractFromTree(root, { keepContext = false } = {}) {
  const groupsByContext = new Map();
  const scriptDetails = findAll(root, isTutorScriptDetails);

  for (const detail of scriptDetails) {
    const context = closest(detail.parentNode, (node) => isElement(node) && (
      getAttribute(node, "data-lesson-extension")
      || hasClass(node, "practice")
      || hasClass(node, "thinking-card")
    )) || detail.parentNode || root;
    const group = getGroup(groupsByContext, context);
    const summary = textContent(findFirst(detail, (node) => node.tagName === "summary"));
    group.disclosureCount += 1;

    if (/reveal the listening evidence/i.test(summary)) {
      group.notes.push(...findAll(detail, (node) => node.tagName === "li").map(textContent));
      continue;
    }

    const detailClips = clipsFromDetails(detail);
    group.clips.push(...detailClips.map((text) => ({ text, supports: [] })));
    group.notes.push(...deliveryNotesFromDetails(detail, detailClips));
  }

  const listeningContexts = findAll(root, (node) => isElement(node)
    && listeningExtensionPattern.test(getAttribute(node, "data-lesson-extension")));
  for (const context of listeningContexts) {
    const group = getGroup(groupsByContext, context);
    if (group.clips.length) continue;
    const items = questionNodes(context);
    for (const item of items) {
      const spoken = inlineTutorLine(textContent(item));
      if (!spoken) continue;
      group.clips.push({ text: spoken, supports: [supportText(item, group.clips.length + 1, [spoken])] });
    }
  }

  const groups = [...groupsByContext.values()].filter((group) => group.clips.length || group.notes.length);
  for (const group of groups) {
    group.clips = uniqueBy(group.clips, (clip) => normalize(clip.text));
    const items = questionNodes(group.context);
    const fallback = fallbackSupport(group.context);
    for (const [index, clip] of group.clips.entries()) {
      if (clip.supports.length) continue;
      if (items.length === group.clips.length) {
        clip.supports = [supportText(items[index], index + 1, group.clips.map((item) => item.text))];
      } else if (items[index]) {
        clip.supports = [supportText(items[index], index + 1, group.clips.map((item) => item.text))];
      } else if (items.length) {
        clip.supports = items.map((item, itemIndex) => supportText(item, itemIndex + 1, group.clips.map((entry) => entry.text)));
      } else {
        clip.supports = [fallback];
      }
      clip.supports = unique(clip.supports);
    }
    group.notes = unique(group.notes);
    if (!keepContext) delete group.context;
  }

  return groups;
}

function getGroup(groups, context) {
  if (!groups.has(context)) {
    groups.set(context, {
      context,
      title: getAttribute(context, "data-lesson-extension") || headingText(context) || "Tutor-read listening",
      clips: [],
      notes: [],
      disclosureCount: 0,
    });
  }
  return groups.get(context);
}

function clipsFromDetails(detail) {
  const listItems = findAll(detail, (node) => node.tagName === "li").map(textContent).filter(Boolean);
  if (listItems.length) return listItems.map(spokenPart).filter(Boolean);

  const paragraphs = findAll(detail, (node) => node.tagName === "p");
  const scriptParagraph = paragraphs.find((node) => /\b(?:read|script|clip|line)\b/i.test(textContent(node)));
  if (!scriptParagraph) return [];
  const text = spokenPart(textContent(scriptParagraph).replace(
    /^(?:tutor|teacher)?\s*(?:read(?: naturally)?(?: without showing the words)?(?: without the clue words first)?(?:, one chunk at a time)?|reads?)\s*:\s*/i,
    "",
  ));
  return splitClipSequence(text);
}

function deliveryNotesFromDetails(detail, clips) {
  const clipKeys = new Set(clips.map(normalize));
  return findAll(detail, (node) => node.tagName === "p")
    .map(textContent)
    .filter((text) => text && !clipKeys.has(normalize(spokenPart(text))))
    .filter((text) => !/^\s*(?:read|tutor|teacher)\s*:/i.test(text));
}

function splitClipSequence(text) {
  const numbered = [...text.matchAll(/(?:^|\s)(\d+)\.\s*([\s\S]*?)(?=(?:\s+\d+\.\s)|$)/g)]
    .map((match) => match[2].trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;
  const divided = text.split(/\s+(?:·|\/|;)\s+|\s*·\s*|\s*;\s*/).map((item) => item.trim()).filter(Boolean);
  return divided.length > 1 ? divided : [text].filter(Boolean);
}

function spokenPart(text) {
  return String(text)
    .split(/\s+Evidence:\s+/i)[0]
    .replace(/\s*\((?:information|yes or no|one|more than one|often rising|falling)[^)]*\)/gi, "")
    .trim();
}

function inlineTutorLine(text) {
  const match = String(text).match(/\bTutor lines?\s*:\s*((?:“[^”]+”\s*)+)/i);
  if (!match) return "";
  return [...match[1].matchAll(/“([^”]+)”/g)].map((item) => item[1].trim()).filter(Boolean).join(" / ");
}

function questionNodes(context) {
  return findAll(context, (node) => isElement(node) && (
    hasClass(node, "q")
    || hasClass(node, "quiz-question")
  )).filter((node) => !closest(node.parentNode, (parent) => parent !== context && hasClass(parent, "q")));
}

function supportText(node, itemNumber, clips) {
  let text = textContent(node)
    .replace(/^\s*\d+\s*\.?\s*/, "")
    .replace(/\bTutor lines?\s*:\s*(?:“[^”]+”\s*)+/gi, `Clip ${itemNumber}. `);
  for (const [index, clip] of clips.entries()) {
    const spoken = spokenPart(clip);
    if (spoken.length < 8) continue;
    text = text.replace(spoken, `Clip ${index + 1}`);
  }
  return text.replace(/\s+/g, " ").trim() || `Listening item ${itemNumber}`;
}

function replaceObsoleteLearnerInstructions(root) {
  for (const node of findAll(root, (candidate) => candidate.nodeName === "#text")) {
    node.value = node.value
      .replace(/\bOpen the script(?: only)? after checking\./gi, "Check your answer before discussing the line with your tutor.")
      .replace(/\bopen the transcript only after checking\b/gi, "check your answer")
      .replace(/\bbefore you open the transcript\b/gi, "before you check your answer")
      .replace(/\bbefore opening the transcript\b/gi, "before checking");
  }
}

function fallbackSupport(context) {
  const heading = headingText(context);
  const instruction = findAll(context, (node) => node.tagName === "p")
    .map(textContent)
    .find((text) => text && !/\b(?:read|script|transcript)\s*:/i.test(text));
  return [heading, instruction].filter(Boolean).join(": ") || "Tutor-read listening task";
}

function redactListeningItems(group) {
  const context = group.context;
  if (!context) return;
  const clips = group.clips.map((clip) => spokenPart(clip.text));
  const items = questionNodes(context);

  for (const [itemIndex, item] of items.entries()) {
    const inline = inlineTutorLine(textContent(item));
    if (inline) {
      for (const node of findAll(item, (candidate) => candidate.nodeName === "#text")) {
        node.value = node.value.replace(/\bTutor lines?\s*:\s*(?:“[^”]+”\s*)+/gi, `Clip ${itemIndex + 1}. `);
      }
    }

    for (const example of findAll(item, (candidate) => hasClass(candidate, "ex"))) {
      const exampleKey = normalize(textContent(example));
      if (exampleKey.length < 12) continue;
      const clipIndex = clips.findIndex((clip) => {
        const clipKey = normalize(clip);
        return clipKey === exampleKey || clipKey.startsWith(exampleKey) || exampleKey.startsWith(clipKey);
      });
      if (clipIndex < 0) continue;
      example.childNodes = [{ nodeName: "#text", value: `Clip ${clipIndex + 1}`, parentNode: example }];
    }
  }
}

function isTutorScriptDetails(node) {
  if (node.tagName !== "details") return false;
  const summary = findFirst(node, (candidate) => candidate.tagName === "summary");
  return scriptSummaryPattern.test(textContent(summary));
}

function headingText(context) {
  return textContent(findFirst(context, (node) => /^h[23]$/.test(node.tagName || "")));
}

function stripFrontmatter(source) {
  return String(source).replace(/^---[\s\S]*?---\s*/, "");
}

function findAll(root, predicate) {
  const found = [];
  walk(root, (node) => { if (predicate(node)) found.push(node); });
  return found;
}

function findFirst(root, predicate) {
  let found;
  walk(root, (node) => {
    if (!found && predicate(node)) found = node;
  });
  return found;
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function closest(node, predicate) {
  for (let current = node; current; current = current.parentNode) {
    if (predicate(current)) return current;
  }
  return undefined;
}

function removeNode(node) {
  const siblings = node.parentNode?.childNodes;
  if (!siblings) return;
  const index = siblings.indexOf(node);
  if (index >= 0) siblings.splice(index, 1);
}

function textContent(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(textContent).join(" ").replace(/\s+/g, " ").trim();
}

function isElement(node) {
  return Boolean(node?.tagName);
}

function getAttribute(node, name) {
  return node?.attrs?.find((attribute) => attribute.name === name)?.value || "";
}

function hasClass(node, name) {
  return getAttribute(node, "class").split(/\s+/).includes(name);
}

function normalize(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[“”"'‘’]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const id = key(value);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
