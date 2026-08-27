import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];

validateSourceContracts();

let pageCount = 0;
let controlCount = 0;
let ariaReferenceCount = 0;
let skipLinkCount = 0;
let redundantImageCount = 0;
let namedLinkCount = 0;
let navigationLandmarkCount = 0;
let headingCount = 0;

if (!sourceOnly) {
  if (!existsSync(outputRoot)) {
    errors.push("dist: production output is missing; run the Astro build first");
  } else {
    for (const file of walk(outputRoot).filter((candidate) => candidate.endsWith(".html"))) {
      const html = readFileSync(file, "utf8");
      if (/http-equiv=["']refresh["']/i.test(html)) continue;
      validatePage(file, html);
    }
  }
}

if (errors.length) {
  console.error(`\nAccessibility validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

if (sourceOnly) {
  console.log("Accessibility source contracts are valid: skip navigation, focus styles, live feedback, keyboard radio behavior, reduced motion, and homepage no-JavaScript fallbacks are present.");
} else {
  console.log(`Accessibility validation passed for ${pageCount} canonical pages, ${controlCount} labeled form controls, ${namedLinkCount} named links, ${navigationLandmarkCount} navigation landmarks, ${headingCount} ordered headings, ${ariaReferenceCount} valid ARIA references, ${skipLinkCount} skip links, and ${redundantImageCount} empty-alt illustrations paired with visible labels.`);
}

function validateSourceContracts() {
  const requiredSource = [
    ["src/layouts/SiteLayout.astro", /<SkipLink\s+target=["']main-content["']/],
    ["src/pages/index.astro", /<SkipLink\s+target=["']main-content["']/],
    ["src/pages/index.astro", /<html\s+lang=["']en["']\s+class=["']no-js["']/],
    ["src/pages/index.astro", /document\.documentElement\.classList\.replace\(["']no-js["'],\s*["']js["']\)/],
    ["src/pages/index.astro", /data-count=["']4\.9["']>4\.9</],
    ["src/components/SkipLink.astro", /event\.key === ["']Enter["']/],
    ["src/components/lesson/LessonPage.astro", /<SkipLink\s+target=["']lesson-content["']/],
    ["src/components/assessment/AssessmentPage.astro", /<SkipLink\s+target=["']assessment-content["']/],
    ["src/components/assessment/QuickCheckPage.astro", /<SkipLink\s+target=["']quick-check-content["']/],
    ["src/scripts/assessment.js", /resultRegion\.ariaLabel\s*=\s*["']Assessment results["']/],
    ["src/scripts/assessment.js", /resultRegion\.tabIndex\s*=\s*-1/],
    ["src/scripts/assessment.js", /if\s*\(resultRegion\)\s*resultRegion\.focus\(\)/],
    ["src/styles/tokens.css", /\.page-skip:focus/],
    ["src/styles/site.css", /\.skip-link:focus/],
    ["src/styles/home.css", /\.home-skip:focus/],
    ["src/styles/home.css", /\.js #loader\{[^}]*loader-failsafe/],
    ["src/styles/home.css", /\.js \.reveal\{opacity:0/],
    ["src/styles/home.css", /\.no-js \.pin-stage \.annotation/],
    ["src/scripts/home.js", /!reduced && ["']IntersectionObserver["'] in window/],
    ["src/scripts/home.js", /countTargets\.forEach\(function\(el\)\{ el\.textContent = ["']0["']; \}\)/],
  ];

  for (const [relative, contract] of requiredSource) {
    const source = readFileSync(path.join(projectRoot, relative), "utf8");
    if (!contract.test(source)) errors.push(`${relative}: required accessibility contract is missing`);
  }

  const quickCheck = readFileSync(path.join(projectRoot, "src/scripts/quick-level-check.js"), "utf8");
  for (const contract of [
    'role="radiogroup"',
    'role="radio"',
    'aria-checked',
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
    'event.key === "Home"',
    'event.key === "End"',
    'prefers-reduced-motion: reduce',
  ]) {
    if (!quickCheck.includes(contract)) errors.push(`src/scripts/quick-level-check.js: missing ${contract} accessibility behavior`);
  }
}

function validatePage(file, html) {
  const route = routeFor(file);
  const document = parse(html);
  const elements = [];
  collectElements(document, elements, null);
  const ids = new Map(elements.filter((element) => attribute(element, "id")).map((element) => [attribute(element, "id"), element]));
  const labelsByControl = new Map(
    elements
      .filter((element) => element.tagName === "label" && attribute(element, "for"))
      .map((element) => [attribute(element, "for"), element]),
  );

  pageCount += 1;

  if (route === "/") validateHomepageFallback(html, elements);

  const mains = elements.filter((element) => element.tagName === "main");
  if (mains.length !== 1) errors.push(`${route}: expected exactly one main landmark, found ${mains.length}`);

  validateHeadingOrder(route, elements);
  validateNavigationLandmarks(route, elements, ids);

  if (!isPrintRoute(route)) {
    const skipLinks = elements.filter((element) => {
      if (element.tagName !== "a") return false;
      const href = attribute(element, "href");
      return href.startsWith("#") && /^skip\b/i.test(accessibleText(element));
    });
    if (skipLinks.length !== 1) {
      errors.push(`${route}: expected exactly one skip link, found ${skipLinks.length}`);
    } else {
      skipLinkCount += 1;
      const targetId = attribute(skipLinks[0], "href").slice(1);
      const target = ids.get(targetId);
      if (!target) errors.push(`${route}: skip-link target #${targetId} does not exist`);
      else if (target.tagName !== "main" && !containsTag(target, "main")) {
        errors.push(`${route}: skip-link target #${targetId} does not contain the main landmark`);
      }
      if (target && attribute(target, "tabindex") !== "-1") {
        errors.push(`${route}: skip-link target #${targetId} must be programmatically focusable`);
      }
    }
  }

  for (const element of elements) {
    const tag = element.tagName;

    for (const referenceAttribute of ["aria-labelledby", "aria-describedby", "aria-controls"]) {
      const value = attribute(element, referenceAttribute);
      if (!value) continue;
      for (const id of value.trim().split(/\s+/)) {
        ariaReferenceCount += 1;
        if (!ids.has(id)) errors.push(`${route}: ${referenceAttribute} references missing #${id}`);
      }
    }

    const tabIndex = attribute(element, "tabindex");
    if (tabIndex && Number(tabIndex) > 0) errors.push(`${route}: positive tabindex ${tabIndex} creates an unsafe focus order`);

    const live = attribute(element, "aria-live");
    if (live && !["off", "polite", "assertive"].includes(live)) errors.push(`${route}: invalid aria-live value "${live}"`);

    if (attribute(element, "role") === "radio" && !["true", "false"].includes(attribute(element, "aria-checked"))) {
      errors.push(`${route}: radio is missing a valid aria-checked state`);
    }
    if (attribute(element, "role") === "radiogroup" && !hasAccessibleName(element, ids)) {
      errors.push(`${route}: radiogroup is missing an accessible name`);
    }

    if (tag === "details" && !element.childNodes?.some((child) => child.tagName === "summary")) {
      errors.push(`${route}: details disclosure is missing a summary`);
    }

    if (tag === "a" && attribute(element, "href")) {
      namedLinkCount += 1;
      if (!hasAccessibleName(element, ids) && !accessibleText(element)) {
        errors.push(`${route}: link to ${attribute(element, "href")} is missing an accessible name`);
      }
    }

    if (isInteractiveElement(element) && hasAriaHiddenAncestor(element)) {
      errors.push(`${route}: interactive ${tag} is inside aria-hidden content`);
    }

    if (tag === "audio" && attribute(element, "controls") !== undefined && !hasAccessibleName(element, ids)) {
      errors.push(`${route}: audio control is missing an accessible name`);
    }

    if (tag === "img") validateImageAlternative(route, element);

    if (!isFormControl(element)) continue;
    controlCount += 1;
    if (!controlHasLabel(element, ids, labelsByControl)) {
      const id = attribute(element, "id");
      const type = attribute(element, "type");
      errors.push(`${route}: ${tag}${type ? `[type=${type}]` : ""}${id ? `#${id}` : ""} is missing an accessible label`);
    }
  }
}

function validateHeadingOrder(route, elements) {
  const headings = elements.filter((element) => /^h[1-6]$/.test(element.tagName));
  let previousLevel = 0;
  for (const heading of headings) {
    headingCount += 1;
    const level = Number(heading.tagName.slice(1));
    if (previousLevel && level > previousLevel + 1) {
      errors.push(`${route}: heading order jumps from h${previousLevel} to h${level} at “${accessibleText(heading).slice(0, 100)}”`);
    }
    previousLevel = level;
  }
}

function validateNavigationLandmarks(route, elements, ids) {
  const navigations = elements.filter((element) => element.tagName === "nav");
  navigationLandmarkCount += navigations.length;
  if (navigations.length < 2) return;

  const names = navigations.map((navigation) => {
    if (attribute(navigation, "aria-label").trim()) return attribute(navigation, "aria-label").trim();
    return attribute(navigation, "aria-labelledby")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => ids.has(id) ? accessibleText(ids.get(id)) : "")
      .join(" ")
      .trim();
  });
  names.forEach((name, index) => {
    if (!name) errors.push(`${route}: navigation landmark ${index + 1} of ${navigations.length} needs an accessible name`);
  });
  const duplicates = [...new Set(names.filter((name, index) => name && names.indexOf(name) !== index))];
  if (duplicates.length) errors.push(`${route}: navigation landmark names must be unique (${duplicates.join(", ")})`);
}

function validateImageAlternative(route, image) {
  const hasAlt = image.attrs?.some((item) => item.name === "alt");
  if (!hasAlt) {
    errors.push(`${route}: image is missing an alt attribute`);
    return;
  }

  const alt = attribute(image, "alt").trim();
  if (alt) {
    if (/^(?:image|photo|picture|illustration|graphic)$/i.test(alt)) {
      errors.push(`${route}: image alternative text “${alt}” is too generic`);
    }
    if (/(?:^|\/)[^/]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(alt)) {
      errors.push(`${route}: image alternative text exposes a filename instead of meaning`);
    }
    return;
  }

  const figure = closestAncestor(image, (element) => hasClass(element, "figure"));
  const label = figure && findDescendant(figure, (element) => hasClass(element, "nm"));
  if (!figure || !label || attribute(label, "aria-hidden") === "true" || !accessibleText(label)) {
    errors.push(`${route}: empty-alt image must be redundant with a visible label in the same vocabulary figure`);
    return;
  }
  redundantImageCount += 1;
}

function validateHomepageFallback(html, elements) {
  if (!/<html\b[^>]*class="[^"]*\bno-js\b[^"]*"/i.test(html)) {
    errors.push("/: the static document must identify its no-JavaScript state");
  }
  if (/<!--[\s\S]*?(?:Thomas:|Want a photo|edit this bio)[\s\S]*?-->/i.test(html)) {
    errors.push("/: author-only editing notes must not ship in public HTML comments");
  }

  const counters = elements.filter((element) => attribute(element, "data-count"));
  if (!counters.length) errors.push("/: expected rating counters were not rendered");
  for (const counter of counters) {
    const target = attribute(counter, "data-count");
    if (accessibleText(counter) !== target) {
      errors.push(`/: rating ${target} must be truthful before JavaScript enhancement`);
    }
  }
}

function isFormControl(element) {
  if (!["input", "select", "textarea"].includes(element.tagName)) return false;
  if (element.tagName !== "input") return true;
  return !["hidden", "button", "submit", "reset", "image"].includes(attribute(element, "type").toLowerCase());
}

function isInteractiveElement(element) {
  if (["a", "button", "select", "textarea", "audio"].includes(element.tagName)) return true;
  return element.tagName === "input" && attribute(element, "type").toLowerCase() !== "hidden";
}

function hasAriaHiddenAncestor(element) {
  let current = element;
  while (current) {
    if (attribute(current, "aria-hidden") === "true") return true;
    current = current.parentElement;
  }
  return false;
}

function controlHasLabel(element, ids, labelsByControl) {
  if (hasAccessibleName(element, ids)) return true;
  const id = attribute(element, "id");
  if (id && labelsByControl.has(id) && accessibleText(labelsByControl.get(id))) return true;
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === "label" && accessibleText(parent)) return true;
    parent = parent.parentElement;
  }
  return false;
}

function hasAccessibleName(element, ids) {
  if (attribute(element, "aria-label").trim()) return true;
  const labelledBy = attribute(element, "aria-labelledby").trim();
  if (!labelledBy) return false;
  return labelledBy.split(/\s+/).some((id) => ids.has(id) && accessibleText(ids.get(id)));
}

function accessibleText(node) {
  if (!node) return "";
  if (node.tagName && attribute(node, "aria-hidden") === "true") return "";
  if (node.tagName === "img") return attribute(node, "alt");
  const own = node.nodeName === "#text" ? node.value : "";
  const childText = (node.childNodes || [])
    .filter((child) => !["script", "style", "template"].includes(child.tagName))
    .map(accessibleText)
    .join(" ");
  return `${own} ${childText}`.replace(/\s+/g, " ").trim();
}

function attribute(element, name) {
  const match = element.attrs?.find((item) => item.name === name);
  return match ? match.value : "";
}

function collectElements(node, elements, parentElement) {
  const nextParent = node.tagName ? node : parentElement;
  if (node.tagName) {
    node.parentElement = parentElement;
    elements.push(node);
  }
  for (const child of node.childNodes || []) collectElements(child, elements, nextParent);
}

function containsTag(node, tagName) {
  return (node.childNodes || []).some((child) => child.tagName === tagName || containsTag(child, tagName));
}

function hasClass(element, className) {
  return attribute(element, "class").split(/\s+/).includes(className);
}

function closestAncestor(node, predicate) {
  let current = node.parentElement;
  while (current) {
    if (predicate(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

function findDescendant(node, predicate) {
  for (const child of node.childNodes || []) {
    if (child.tagName && predicate(child)) return child;
    const nested = findDescendant(child, predicate);
    if (nested) return nested;
  }
  return undefined;
}

function routeFor(file) {
  const relative = path.relative(outputRoot, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative === "404.html") return "/404.html";
  return `/${relative.replace(/index\.html$/, "")}`;
}

function isPrintRoute(route) {
  return route === "/curriculum/print/";
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
