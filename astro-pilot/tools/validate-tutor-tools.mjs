import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLessonNavigation, readyLessons } from "../src/data/lesson-catalog.mjs";
import { getLessonQualityReview, LESSON_REVIEW_PILOT_TARGET } from "../src/data/lesson-schema.mjs";
import { buildTutorBrief } from "../src/lib/tutor-plan.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const sourceOnly = process.argv.includes("--source");
const errors = [];

const sourceContracts = [
  ["src/pages/tutor/index.astro", /getLessonsForLevel/],
  ["src/pages/tutor/index.astro", /data-tutor-guide/],
  ["src/pages/tutor/index.astro", /data-tutor-finder/],
  ["src/pages/tutor/index.astro", /data-tutor-review-queue/],
  ["src/pages/tutor/index.astro", /data-review-queue-item/],
  ["src/pages/tutor/index.astro", /href="\/tutor\/review-builder\/"/],
  ["src/pages/tutor/review-builder.astro", /buildQuickReviewItem/],
  ["src/pages/tutor/review-builder.astro", /data-review-builder/],
  ["src/pages/tutor/review-builder.astro", /data-review-present/],
  ["src/pages/tutor/review-builder.astro", /data-review-remix/],
  ["src/pages/tutor/review-builder.astro", /noindex=\{true\}/],
  ["src/lib/quick-review.mjs", /buildTutorBrief/],
  ["src/lib/quick-review.mjs", /buildQuickReviewItem/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /getStaticPaths/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /readyLessons\.map/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /noindex=\{true\}/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /window\.print\(\)/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /getLessonNavigation/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /buildTutorBrief/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /import\.meta\.glob/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-brief-source/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-repairs/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-production/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-next-use/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /TransferLens/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-guided-discovery/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-correction-timing/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-route-options/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /data-tutor-follow-up/],
  ["src/components/tutor/TransferLens.astro", /getTransferPatternsForLesson/],
  ["src/pages/tutor/plans/[level]/[slug].astro", /PilotEvidenceWorksheet/],
  ["src/components/tutor/PilotEvidenceWorksheet.astro", /data-pilot-evidence-worksheet/],
  ["src/components/tutor/PilotEvidenceWorksheet.astro", /data-pilot-privacy/],
  ["src/components/tutor/PilotEvidenceWorksheet.astro", /never submitted or stored/],
  ["src/layouts/SiteLayout.astro", /href="\/tutor\/"/],
  ["astro.config.mjs", /page\.includes\("\/tutor\/plans\/"\)/],
];

for (const [relative, contract] of sourceContracts) {
  const source = readFileSync(path.join(root, relative), "utf8");
  if (!contract.test(source)) errors.push(`${relative}: tutor-planning source contract is missing`);
}

validateNativeBriefSources();
if (!sourceOnly) validateOutput();

if (errors.length) {
  console.error(`\nTutor tools validation failed with ${errors.length} error(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 100) console.error(`- …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(sourceOnly
  ? "Tutor tools source contracts passed: canonical catalog input, lesson-derived teaching briefs, progressive finder, generated plans, sequencing, print behavior, and discoverability are present."
  : `Tutor tools validated: one searchable guide and ${readyLessons.length} lesson-specific printable plans with outcomes, principles, repairs, practice routes, production, next use, relationships, and sequencing.`);

function validateNativeBriefSources() {
  for (const lesson of readyLessons) {
    const source = readFileSync(path.join(root, lesson.source), "utf8");
    if (/^export const lesson\s*=/m.test(source)) continue;

    let brief;
    try {
      brief = buildTutorBrief(lesson);
    } catch (error) {
      errors.push(`${lesson.id}: tutor brief could not be derived (${error.message})`);
      continue;
    }
    if (brief.source !== "native") errors.push(`${lesson.id}: native tutor brief has the wrong source type`);
    if (brief.outcome.length < 45) errors.push(`${lesson.id}: tutor outcome is too thin`);
    if (brief.principle.length < 45) errors.push(`${lesson.id}: tutor principle is too thin`);
    if (brief.practiceTitles.length < 4) errors.push(`${lesson.id}: expected at least four lesson-specific practice titles`);
    if (brief.errors.length < 2) errors.push(`${lesson.id}: expected at least two lesson-specific error repairs`);
    if (brief.production.setup.length < 60) errors.push(`${lesson.id}: final production guidance is too thin`);
    if (brief.nextUse.length < 35) errors.push(`${lesson.id}: next-use retrieval guidance is too thin`);
  }
}

function validateOutput() {
  const indexPath = path.join(dist, "tutor/index.html");
  if (!existsSync(indexPath)) {
    errors.push("/tutor/: generated guide is missing");
    return;
  }

  const index = readFileSync(indexPath, "utf8");
  if (!/\bdata-tutor-guide\b/.test(index)) errors.push("/tutor/: tutor guide marker is missing");
  if (/name="robots"[^>]*noindex/i.test(index)) errors.push("/tutor/: guide must remain indexable");
  if (!index.includes('href="/tutor/review-builder/"')) errors.push("/tutor/: quick review builder is not discoverable");
  const listedIds = [...index.matchAll(/\bdata-tutor-lesson="([^"]+)"/g)].map((match) => match[1]);
  if (listedIds.length !== readyLessons.length || new Set(listedIds).size !== readyLessons.length) {
    errors.push(`/tutor/: expected ${readyLessons.length} unique lesson cards, found ${listedIds.length}`);
  }

  const reviewQueue = readyLessons.filter(needsHumanReview);
  if (!index.includes(`data-review-queue-count="${reviewQueue.length}"`)) {
    errors.push(`/tutor/: expected a ${reviewQueue.length}-lesson human review queue`);
  }
  if (!/Record no names or identifying details/.test(index)) {
    errors.push(`/tutor/: review queue privacy guidance is missing`);
  }
  const queuedIds = [...index.matchAll(/\bdata-review-queue-item="([^"]+)"/g)].map((match) => match[1]);
  if (queuedIds.length !== reviewQueue.length || new Set(queuedIds).size !== reviewQueue.length) {
    errors.push(`/tutor/: expected ${reviewQueue.length} unique review-queue items, found ${queuedIds.length}`);
  }
  for (const lesson of reviewQueue) {
    if (!queuedIds.includes(lesson.id)) errors.push(`/tutor/: review queue is missing ${lesson.id}`);
    if (!index.includes(`href="/tutor/plans/${lesson.id}/#pilot-evidence"`)) {
      errors.push(`/tutor/: review queue link for ${lesson.id} does not open its evidence worksheet`);
    }
  }

  const briefFingerprints = new Set();
  for (const lesson of readyLessons) {
    const planRoute = `/tutor/plans/${lesson.id}/`;
    if (!listedIds.includes(lesson.id)) errors.push(`/tutor/: missing lesson card ${lesson.id}`);
    if (!index.includes(`href="${planRoute}"`)) errors.push(`/tutor/: missing plan link ${planRoute}`);

    const output = path.join(dist, planRoute.replace(/^\//, ""), "index.html");
    if (!existsSync(output)) {
      errors.push(`${planRoute}: direct-refresh output is missing`);
      continue;
    }

    const html = readFileSync(output, "utf8");
    if (!html.includes(`data-tutor-plan="${lesson.id}"`)) errors.push(`${planRoute}: canonical lesson relationship is missing`);
    if (!/<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(html)) errors.push(`${planRoute}: printable plan must be noindex, follow`);
    if (!html.includes(`href="${lesson.route}" data-learner-lesson`)) errors.push(`${planRoute}: learner lesson link is missing`);
    if (!html.includes(`/tutor/review-builder/?lessons=${lesson.id}`)) errors.push(`${planRoute}: quick-review handoff is missing`);
    if (!/data-print-plan/.test(html) || !/window\.print/.test(html)) errors.push(`${planRoute}: print control or behavior is missing`);
    if (/localStorage|sessionStorage|indexedDB/.test(html)) errors.push(`${planRoute}: tutor notes must not be stored in the learner browser`);
    const lessonSource = readFileSync(path.join(root, lesson.source), "utf8");
    const expectedBriefSource = /^export const lesson\s*=/m.test(lessonSource) ? "structured" : "native";
    if (!html.includes(`data-tutor-brief-source="${expectedBriefSource}"`)) {
      errors.push(`${planRoute}: lesson-specific brief source is incorrect`);
    }
    for (const marker of ["data-tutor-outcome", "data-tutor-principle", "data-tutor-repairs", "data-tutor-practice", "data-tutor-production", "data-tutor-next-use"]) {
      if (!html.includes(marker)) errors.push(`${planRoute}: ${marker} is missing`);
    }
    for (const marker of ["data-tutor-guided-discovery", "data-tutor-correction-timing", "data-tutor-route-options", "data-tutor-follow-up"]) {
      if (!html.includes(marker)) errors.push(`${planRoute}: operational tutor marker ${marker} is missing`);
    }
    const brief = html.match(/<section\b[^>]*data-tutor-brief-source="[^"]+"[^>]*>([\s\S]*?)<\/section>/i)?.[1] || "";
    if (!brief) {
      errors.push(`${planRoute}: rendered lesson-specific teaching brief is missing`);
    } else {
      briefFingerprints.add(textContent(brief));
      const repairs = (brief.match(/\btutor-repair-item\b/g) || []).length;
      const practiceItems = (brief.match(/\bdata-tutor-practice-item\b/g) || []).length;
      if (repairs < 2) errors.push(`${planRoute}: expected at least two rendered error repairs, found ${repairs}`);
      if (practiceItems < 3) errors.push(`${planRoute}: expected at least three rendered practice or retrieval items, found ${practiceItems}`);
      if (textContent(brief).length < 650) errors.push(`${planRoute}: lesson-specific teaching brief is too thin`);
    }

    const assessment = lesson.assessments[0];
    if (assessment && !html.includes(`href="/assessments/${assessment}/" data-plan-assessment`)) {
      errors.push(`${planRoute}: linked level diagnostic is missing`);
    }
    if (lesson.tutorReviewRequired && !html.includes("data-tutor-review-required")) {
      errors.push(`${planRoute}: tutor-review requirement is missing`);
    }

    const review = getLessonQualityReview(lesson);
    const worksheet = html.match(/<section\b[^>]*\bdata-pilot-evidence-worksheet\b[^>]*>[\s\S]*?<\/section>/i)?.[0] || "";
    if (needsHumanReview(lesson)) {
      if (!worksheet) {
        errors.push(`${planRoute}: anonymous learner-pilot worksheet is missing`);
      } else {
        if (!worksheet.includes(`data-pilot-lesson-id="${lesson.id}"`)) errors.push(`${planRoute}: worksheet lesson relationship is incorrect`);
        if (!worksheet.includes(`data-pilot-recorded="${review.learnerPilotCount}"`)) errors.push(`${planRoute}: worksheet pilot count is not canonical`);
        if (!worksheet.includes(`data-pilot-target="${LESSON_REVIEW_PILOT_TARGET}"`)) errors.push(`${planRoute}: worksheet pilot target is incorrect`);
        if (!/Do not record a learner(?:’|&#39;|&apos;)s name/.test(worksheet) || !/never submitted or stored/.test(worksheet)) {
          errors.push(`${planRoute}: worksheet privacy and no-storage language is incomplete`);
        }
        if (/<(?:form|input|textarea)\b/i.test(worksheet)) errors.push(`${planRoute}: printable worksheet must not collect browser form data`);
        if (!textContent(worksheet).includes(review.revisionSummary)) errors.push(`${planRoute}: worksheet review focus is not derived from canonical metadata`);
      }
    } else if (worksheet) {
      errors.push(`${planRoute}: completed review must not remain in the pending pilot workflow`);
    }

    for (const reference of [...lesson.prerequisites, ...lesson.related]) {
      const relatedLesson = readyLessons.find((item) => item.id === reference);
      if (relatedLesson) {
        if (!html.includes(`href="/tutor/plans/${reference}/"`)) errors.push(`${planRoute}: linked planning relationship ${reference} is missing`);
      } else if (!html.includes("data-plan-related-planned")) {
        errors.push(`${planRoute}: planned relationship ${reference} is not identified without a link`);
      } else if (html.includes(`href="/tutor/plans/${reference}/"`)) {
        errors.push(`${planRoute}: planned relationship ${reference} must not create a dead plan link`);
      }
    }

    const navigation = getLessonNavigation(lesson.id);
    if (navigation.previous && !html.includes(`rel="prev" href="/tutor/plans/${navigation.previous.id}/"`)) {
      errors.push(`${planRoute}: previous tutor plan is incorrect`);
    }
    if (navigation.next && !html.includes(`rel="next" href="/tutor/plans/${navigation.next.id}/"`)) {
      errors.push(`${planRoute}: next tutor plan is incorrect`);
    }
  }
  if (briefFingerprints.size !== readyLessons.length) {
    errors.push(`/tutor/plans/: expected ${readyLessons.length} distinct lesson-specific briefs, found ${briefFingerprints.size}`);
  }

  validateQuickReviewOutput();

  const sitemapPath = path.join(dist, "sitemap-0.xml");
  if (!existsSync(sitemapPath)) {
    errors.push("sitemap-0.xml: tutor sitemap validation cannot run");
  } else {
    const sitemap = readFileSync(sitemapPath, "utf8");
    if (!/<loc>[^<]*\/tutor\/<\/loc>/.test(sitemap)) errors.push("sitemap: indexable tutor guide is missing");
    if (/\/tutor\/plans\//.test(sitemap)) errors.push("sitemap: noindex printable tutor plans must be excluded");
    if (/\/tutor\/review-builder\//.test(sitemap)) errors.push("sitemap: noindex quick review builder must be excluded");
  }
}

function validateQuickReviewOutput() {
  const route = "/tutor/review-builder/";
  const output = path.join(dist, "tutor/review-builder/index.html");
  if (!existsSync(output)) {
    errors.push(`${route}: direct-refresh output is missing`);
    return;
  }
  const html = readFileSync(output, "utf8");
  if (!html.includes(`data-review-item-count="${readyLessons.length}"`)) errors.push(`${route}: canonical lesson count is incorrect`);
  if (!/<meta\b[^>]*name="robots"[^>]*content="noindex, follow"/i.test(html)) errors.push(`${route}: tutor-only builder must be noindex, follow`);
  if ((html.match(/<select\b[^>]*\bdata-review-choice\b/g) || []).length !== 3) errors.push(`${route}: expected exactly three lesson selectors`);
  for (const marker of ["data-review-form", "data-review-output", "data-review-remix", "data-review-present", "data-review-previous", "data-review-next", "data-review-copy"]) {
    if (!html.includes(marker)) errors.push(`${route}: ${marker} is missing`);
  }
  if (/localStorage|sessionStorage|indexedDB/.test(html)) errors.push(`${route}: review state must remain temporary and URL-driven`);
  const payload = html.match(/<script\b[^>]*id="quick-review-data"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!payload) {
    errors.push(`${route}: lesson-derived review payload is missing`);
    return;
  }
  let items = [];
  try {
    items = JSON.parse(payload);
  } catch (error) {
    errors.push(`${route}: review payload is not valid JSON (${error.message})`);
    return;
  }
  const ids = new Set(items.map((item) => item.id));
  if (items.length !== readyLessons.length || ids.size !== readyLessons.length) {
    errors.push(`${route}: expected ${readyLessons.length} unique lesson-derived review items, found ${items.length}`);
  }
  for (const lesson of readyLessons) {
    const item = items.find((candidate) => candidate.id === lesson.id);
    if (!item) {
      errors.push(`${route}: review data is missing ${lesson.id}`);
      continue;
    }
    if (item.route !== lesson.route || item.planRoute !== `/tutor/plans/${lesson.id}/`) errors.push(`${lesson.id}: quick-review route relationship is incorrect`);
    for (const [label, value, minimum] of [
      ["retrieval prompt", item.retrieval?.prompt, 8], ["retrieval answer", item.retrieval?.answer, 2],
      ["contrast prompt", item.contrast?.prompt, 12], ["contrast answer", item.contrast?.answer, 12],
      ["repair prompt", item.repair?.prompt, 8], ["repair answer", item.repair?.answer, 2],
      ["repair explanation", item.repair?.why, 12], ["production prompt", item.production?.prompt, 20],
    ]) {
      if (typeof value !== "string" || value.trim().length < minimum) errors.push(`${lesson.id}: quick-review ${label} is too thin`);
    }
  }
}

function needsHumanReview(lesson) {
  return Boolean(lesson.tutorReviewRequired || (lesson.qualityReview && lesson.qualityReview.status !== "reviewed"));
}

function textContent(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
