import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { platform, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lessonCounts, readyLessons } from "../src/data/lesson-catalog.mjs";
import { LESSON_REVIEW_PILOT_TARGET } from "../src/data/lesson-schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const environment = globalThis.process?.env || {};
const currentPlatform = platform();
const curriculumTopicCount = lessonCounts().total;
const reviewQueueLessons = readyLessons.filter((lesson) =>
  lesson.tutorReviewRequired || (lesson.qualityReview && lesson.qualityReview.status !== "reviewed"));
const reviewQueuePilotCount = reviewQueueLessons.reduce((total, lesson) => total + (lesson.qualityReview?.learnerPilotCount ?? 0), 0);
const failures = [];
const checks = [];
const consoleProblems = [];
let preview;
let chrome;
let chromeOutput = "";
let profile;
let cdp;
let cleaningUp = false;

async function run() {
if (!existsSync(path.join(dist, "index.html"))) {
  fail("dist is missing; run npm run build before the browser smoke test");
  finish();
}

try {
  const browser = findBrowser();
  if (!browser) throw new Error("No Chromium browser found. Set BROWSER_BIN to Chrome, Chromium, Edge, or another Chromium executable.");

  const configuredOrigin = (environment.BROWSER_QA_URL || globalThis.BROWSER_QA_URL)?.trim();
  const previewPort = configuredOrigin ? undefined : await freePort();
  const origin = configuredOrigin ? normalizedLocalOrigin(configuredOrigin) : `http://127.0.0.1:${previewPort}`;
  if (previewPort) preview = startPreview(previewPort);
  await waitForHttp(origin);

  profile = mkdtempSync(path.join(tmpdir(), "thomas-browser-qa-"));
  const debuggingPort = await startChrome(browser, profile);
  const target = await fetchJson(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(origin)}`, { method: "PUT" });
  cdp = new DevToolsClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("Log.enable"),
  ]);

  cdp.on("Runtime.exceptionThrown", (event) => {
    consoleProblems.push(`uncaught exception: ${event.exceptionDetails?.text || "unknown browser exception"}`);
  });
  cdp.on("Runtime.consoleAPICalled", (event) => {
    if (event.type !== "error" && event.type !== "assert") return;
    const message = (event.args || []).map((item) => item.value ?? item.description ?? "").join(" ");
    consoleProblems.push(`console.${event.type}: ${message}`);
  });
  cdp.on("Log.entryAdded", (event) => {
    if (event.entry?.level === "error") consoleProblems.push(`browser log: ${event.entry.text}`);
  });

  await testHomepage(origin);
  await testSelfHostedFonts(origin);
  await testCurriculum(origin);
  await testLesson(origin);
  await testAllLessonResponseRandomization(origin);
  await testQuickCheck(origin);
  await testLevelAssessment(origin);
  await testDictionary(origin);
  await testLanguageTransfer(origin);
  await testTutorWorkflow(origin);

  for (const problem of [...new Set(consoleProblems)]) fail(problem);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

finish();
}

async function testAllLessonResponseRandomization(origin) {
  const issues = [];
  let responseBankCount = 0;

  for (const lesson of readyLessons) {
    await navigate(`${origin}${lesson.route}`, 375, 900);
    const state = await evaluate(`(() => {
      const options = [...document.querySelectorAll([
        '[data-choice-option]',
        '[data-tile]',
        '[data-build-tile]',
        '[data-quiz-option]'
      ].join(','))];
      const groups = [...new Set(options.map((option) => option.parentElement).filter(Boolean))];
      return {
        total: groups.length,
        unrandomized: groups.filter((group) => group.dataset.responseOrder !== 'randomized').map((group) => ({
          order: group.dataset.responseOrder || 'missing',
          className: group.className || group.tagName.toLowerCase(),
          optionCount: group.querySelectorAll('[data-choice-option], [data-tile], [data-build-tile], [data-quiz-option]').length
        }))
      };
    })()`);
    responseBankCount += state.total;
    if (!state.total) issues.push(`${lesson.route}: no randomizable response banks found`);
    if (state.unrandomized.length) {
      issues.push(`${lesson.route}: ${JSON.stringify(state.unrandomized)}`);
    }
  }

  check(
    issues.length === 0 && responseBankCount >= readyLessons.length,
    `all ${responseBankCount} response banks across ${readyLessons.length} published lessons initialize through the shared runtime randomizer${issues.length ? `; issues: ${issues.join(' | ')}` : ''}`
  );
}

async function testHomepage(origin) {
  for (const width of [320, 375, 768, 819, 821, 1440]) {
    await navigate(`${origin}/`, width, 900);
    const state = await evaluate(`({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      headings: document.querySelectorAll('h1').length,
      desktopVisible: getComputedStyle(document.querySelector('.desktop-nav')).display !== 'none',
      mobileVisible: getComputedStyle(document.querySelector('[data-mobile-nav]')).display !== 'none',
      bookingLinks: document.querySelectorAll('[data-booking-link]').length,
      curriculumLink: Boolean(document.querySelector('a[href="/curriculum/"]'))
    })`);
    check(!state.overflow, `homepage has no horizontal overflow at ${width}px`);
    check(state.headings === 1, `homepage has one primary heading at ${width}px`);
    check(width <= 820 ? state.mobileVisible && !state.desktopVisible : state.desktopVisible && !state.mobileVisible,
      `homepage navigation switches correctly at ${width}px`);
    check(state.bookingLinks >= 3 && state.curriculumLink, `homepage primary actions remain available at ${width}px`);
  }

  await navigate(`${origin}/`, 375, 850);
  await evaluate(`document.querySelector('[data-mobile-nav-toggle]').click()`);
  await waitFor(`document.querySelector('[data-mobile-nav]').open === true`);
  check(await evaluate(`document.querySelector('[data-mobile-nav-toggle]').getAttribute('aria-expanded') === 'true'`),
    "mobile navigation exposes its expanded state");

  await evaluate(`document.querySelector('[data-mobile-nav-toggle]').focus()`);
  await press("Escape", "Escape", 27);
  await waitFor(`document.querySelector('[data-mobile-nav]').open === false`);
  check(await evaluate(`document.activeElement === document.querySelector('[data-mobile-nav-toggle]') && document.querySelector('[data-mobile-nav-toggle]').getAttribute('aria-expanded') === 'false'`),
    "Escape closes the mobile menu and returns focus");

  await evaluate(`document.querySelector('[data-mobile-nav-toggle]').click(); document.querySelector('.mobile-nav-link[href="#about"]').click()`);
  await waitFor(`location.hash === '#about' && document.querySelector('[data-mobile-nav]').open === false`);
  check(true, "selecting a mobile link closes the menu and preserves the destination");
}

async function testSelfHostedFonts(origin) {
  await navigate(`${origin}/`, 1440, 900);
  await waitFor(`document.fonts?.status === 'loaded'`);
  const homepage = await evaluate(`({
    fraunces: document.fonts.check('48px "Fraunces"'),
    albert: document.fonts.check('16px "Albert Sans"'),
    mono: document.fonts.check('12px "IBM Plex Mono"'),
    external: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => /fonts\\.(?:googleapis|gstatic)\\.com/.test(url)),
    local: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => /\\/fonts\\/.+\\.(?:ttf|woff2?)$/.test(url))
  })`);
  check(homepage.fraunces && homepage.albert && homepage.mono,
    "homepage display, body, and label typefaces load from self-hosted files");
  check(homepage.external.length === 0 && homepage.local.length >= 3 && homepage.local.every((url) => url.startsWith(`${origin}/fonts/`)),
    "homepage makes no Google Fonts request and loads only local font resources");

  await navigate(`${origin}/lessons/a0/the-verb-to-be/`, 375, 900);
  await waitFor(`document.fonts?.status === 'loaded'`);
  const lessonVariant = await evaluate(`({
    newsreader: document.fonts.check('48px "Newsreader"'),
    newsreaderItalic: document.fonts.check('italic 16px "Newsreader"'),
    plex: document.fonts.check('16px "IBM Plex Sans"'),
    external: performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => /fonts\\.(?:googleapis|gstatic)\\.com/.test(url))
  })`);
  check(lessonVariant.newsreader && lessonVariant.newsreaderItalic && lessonVariant.plex,
    "the Newsreader and IBM Plex lesson typography variant remains available");
  check(lessonVariant.external.length === 0,
    "the lesson typography variant makes no external font request");
}

async function testCurriculum(origin) {
  await navigate(`${origin}/curriculum/?level=A2`, 375, 900);
  const initial = await evaluate(`({
    selected: document.querySelector('[data-finder-level][value="A2"]').checked,
    visibleLevels: [...document.querySelectorAll('[data-curriculum-level]')].filter((node) => !node.hidden).map((node) => node.dataset.curriculumLevel),
    visibleTopics: [...document.querySelectorAll('[data-curriculum-topic]')].filter((node) => !node.hidden).length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    finderVisible: !document.querySelector('[data-curriculum-finder]').hidden,
    hasAssessmentBand: Boolean(document.querySelector('[data-curriculum-level="A2"] .assessment-band')),
    sequences: [...document.querySelectorAll('[data-curriculum-level="A2"] [data-lesson-sequence]')].map((node) => Number(node.dataset.lessonSequence)),
    clickableLessons: document.querySelectorAll('[data-curriculum-level="A2"] a[data-curriculum-topic]').length
  })`);
  check(initial.selected && initial.visibleLevels.join(",") === "A2" && initial.visibleTopics === 19,
    "a direct A2 curriculum URL initializes the selected level and 19 topics");
  check(initial.finderVisible && !initial.overflow, "curriculum finder is enhanced without mobile overflow");
  check(!initial.hasAssessmentBand && initial.clickableLessons === 19 && initial.sequences.length === 19 && initial.sequences.every((value, index) => value === index + 1),
    "the visible level is a canonical ordered lesson path without embedded diagnostics");

  await evaluate(`(() => {
    const input = document.querySelector('[data-finder-query]');
    input.value = 'present perfect';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(`new URL(location.href).searchParams.get('q') === 'present perfect'`);
  const searched = await evaluate(`({
    visible: [...document.querySelectorAll('[data-curriculum-topic]')].filter((node) => !node.hidden).length,
    status: document.querySelector('[data-finder-status]').textContent,
    live: document.querySelector('[data-finder-status]').getAttribute('aria-live')
  })`);
  check(searched.visible === 1 && searched.status.includes("1 topic") && searched.live === "polite",
    "curriculum search updates results, URL state, and live feedback");

  await evaluate(`(() => {
    const select = document.querySelector('[data-finder-availability]');
    select.value = 'planned';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.querySelector('[data-curriculum-map]').hasAttribute('data-no-results')`);
  check(await evaluate(`document.querySelector('[data-finder-status]').textContent.startsWith('0 topics')`),
    "the planned-only curriculum state reports an honest empty result");

  await evaluate(`document.querySelector('[data-finder-reset]').click()`);
  await waitFor(`location.search === '' && document.querySelector('[data-finder-status]').textContent.startsWith('${curriculumTopicCount} topics')`);
  check(await evaluate(`document.activeElement === document.querySelector('[data-finder-query]') && [...document.querySelectorAll('[data-curriculum-level]')].every((node) => !node.hidden)`),
    "clearing curriculum filters restores all levels and moves focus to search");

  await navigate(`${origin}/curriculum/?level=C1&availability=planned`, 375, 900);
  const c1 = await evaluate(`({
    selected: document.querySelector('[data-finder-level][value="C1"]').checked,
    visibleLevels: [...document.querySelectorAll('[data-curriculum-level]')].filter((node) => !node.hidden).map((node) => node.dataset.curriculumLevel),
    visibleTopics: [...document.querySelectorAll('[data-curriculum-topic]')].filter((node) => !node.hidden).length,
    allPlanned: [...document.querySelectorAll('[data-curriculum-topic]')].filter((node) => !node.hidden).every((node) => node.dataset.topicAvailability === 'planned'),
    hasAssessmentBand: Boolean(document.querySelector('[data-curriculum-level="C1"] .assessment-band')),
    sequences: [...document.querySelectorAll('[data-curriculum-level="C1"] [data-lesson-sequence]')].map((node) => Number(node.dataset.lessonSequence))
  })`);
  check(c1.selected && c1.visibleLevels.join(",") === "C1" && c1.visibleTopics === 16 && c1.allPlanned,
    "a direct C1 planned URL initializes the selected level and 16 planned topics");
  check(!c1.hasAssessmentBand && c1.sequences.length === 19 && c1.sequences.every((value, index) => value === index + 1),
    "C1 keeps all 19 canonical sequence positions in the lesson path without embedded diagnostics");

  await navigate(`${origin}/assessments/`, 375, 900);
  const diagnostics = await evaluate(`({
    heading: document.querySelector('h1')?.textContent.trim(),
    ready: document.querySelectorAll('[data-diagnostic-status="ready"]').length,
    planned: document.querySelectorAll('[data-diagnostic-status="planned"]').length,
    placement: document.querySelector('[data-diagnostic-route="placement-exam"]')?.getAttribute('href'),
    quick: document.querySelector('[data-diagnostic-route="quick-level-check"]')?.getAttribute('href'),
    c1Tag: document.querySelector('[data-diagnostic-route="c1-exit"]')?.tagName,
    c1Href: document.querySelector('[data-diagnostic-route="c1-exit"]')?.getAttribute('href'),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  })`);
  check(diagnostics.heading === "English Diagnostics" && diagnostics.ready === 7 && diagnostics.planned === 1 && !diagnostics.overflow,
    "the dedicated diagnostics hub renders every assessment status without mobile overflow");
  check(diagnostics.placement === "/assessments/placement-exam/" && diagnostics.quick === "/assessments/quick-level-check/" && diagnostics.c1Tag === "ARTICLE" && !diagnostics.c1Href,
    "the diagnostics hub links ready checks and keeps the planned C1 diagnostic unavailable");
}

async function testLesson(origin) {
  await navigate(`${origin}/lessons/a1/present-simple/`, 375, 900);
  const base = await evaluate(`({
    heading: document.querySelector('h1')?.textContent.trim(),
    feedbackLive: document.querySelector('[data-choice-gap-drill] [data-feedback]')?.getAttribute('aria-live'),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  })`);
  check(base.heading.startsWith("Present simple") && !base.overflow, "representative A1 lesson loads directly without mobile overflow");
  check(base.feedbackLive === "polite", "lesson drill feedback is announced politely");

  const result = await evaluate(`(() => {
    const drill = document.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      const answer = String(gap.dataset.answer).toLowerCase();
      options.find((option) => String(option.dataset.choiceOption).toLowerCase() === answer)?.click();
    }
    drill.querySelector('[data-check-choices]').click();
    return {
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      correct: [...drill.querySelectorAll('[data-choice-gap]')].every((gap) => gap.classList.contains('is-correct'))
    };
  })()`);
  check(result.success && result.correct && /Good retrieval/i.test(result.feedback),
    "a lesson exercise accepts correct answers and explains the decisive relationship");

  const retrievalFeedback = await evaluate(`(() => {
    const section = document.querySelector('#next-day-retrieval');
    const drill = section.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'Does' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return {
      anchor: section.id,
      first,
      second,
      error: drill.querySelector('[data-feedback]').classList.contains('is-error')
    };
  })()`);
  check(retrievalFeedback.anchor === "next-day-retrieval" && retrievalFeedback.error &&
    /Camila means she/i.test(retrievalFeedback.first) && /Use works/i.test(retrievalFeedback.second),
    "next-day retrieval gives a contextual hint before revealing the explicit repair");

  const nav = await evaluate(`({
    previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || '',
    next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || ''
  })`);
  check(nav.previous === "" && nav.next === "/lessons/a1/present-continuous/",
    "the first A1 lesson exposes the next generated course destination without a false previous link");

  await navigate(`${origin}/lessons/a1/present-continuous/`, 375, 900);
  const continuousDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      viewpoint: body.includes('open situation viewed from inside') &&
        body.includes('Must her pen be moving at this exact second? Not always.'),
      spelling: body.includes('final syllable is unstressed') && body.includes('visiting · opening · snowing · fixing') &&
        body.includes('be → being') && body.includes('see → seeing'),
      futureBoundary: body.includes('A nearby future with an arrangement') &&
        body.includes('people have organized it') && body.includes('meeting is on the calendar'),
      stateAction: body.includes('State or action? Meaning comes first') &&
        body.includes('I have a car') && body.includes("I'm having lunch") &&
        body.includes('I think the plan is good') && body.includes("I'm thinking about the plan"),
      privacy: body.includes('You never need to show your camera, room, street, screen, location, schedule'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read present-simple and present-continuous listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(continuousDecision.firstGap === "am" && continuousDecision.success &&
    /subject-matched form of be/i.test(continuousDecision.feedback) && continuousDecision.viewpoint &&
    continuousDecision.spelling && continuousDecision.futureBoundary && continuousDecision.stateAction &&
    continuousDecision.privacy && continuousDecision.listeningScript && continuousDecision.typedLabels &&
    continuousDecision.retrieval === "#next-day-retrieval" &&
    continuousDecision.previous === "/lessons/a1/present-simple/" &&
    continuousDecision.next === "/lessons/a1/there-is-there-are/" && !continuousDecision.overflow,
    "Present continuous preserves open-viewpoint meaning, spelling and state boundaries, future use, listening, sequencing, accessibility, retrieval, and mobile fit");

  const continuousRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'works' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(continuousRetrieval.error && /But today marks a temporary change/i.test(continuousRetrieval.first) &&
    /Today Maya is working from home/i.test(continuousRetrieval.second),
    "Present-continuous retrieval gives the temporary-context cue before revealing the repaired tense choice");

  await navigate(`${origin}/lessons/a1/there-is-there-are/`, 375, 900);
  const existenceDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      introduction: body.includes('introduce something into the scene') &&
        body.includes('There’s a pharmacy on Oak Street. It’s beside the bank.'),
      knownInformation: body.includes('New thing or known thing?') &&
        body.includes('The first sentence introduces the pharmacy') &&
        body.includes('The next two sentences talk about that known pharmacy'),
      quantityBoundary: body.includes('There aren’t any seats') && body.includes('There are no seats') &&
        body.includes('Do not combine the two negative patterns'),
      spokenForm: body.includes('There’s is a common spoken and written contraction') &&
        body.includes('English normally writes there are as two words'),
      privacy: body.includes('You never need to describe your actual home, neighborhood, workplace, location, schedule, or finances'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read there is and there are listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(existenceDecision.firstGap === "is" && existenceDecision.success &&
    /Is introduces one thing or an uncountable amount/i.test(existenceDecision.feedback) &&
    existenceDecision.introduction && existenceDecision.knownInformation && existenceDecision.quantityBoundary &&
    existenceDecision.spokenForm && existenceDecision.privacy && existenceDecision.listeningScript &&
    existenceDecision.typedLabels && existenceDecision.retrieval === "#next-day-retrieval" &&
    existenceDecision.previous === "/lessons/a1/present-continuous/" &&
    existenceDecision.next === "/lessons/a1/have-got/" && !existenceDecision.overflow,
    "There-is/there-are preserves introduction meaning, agreement and quantity boundaries, spoken form, listening, sequencing, accessibility, retrieval, and mobile fit");

  const existenceRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'There are' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(existenceRetrieval.error && /one new countable thing/i.test(existenceRetrieval.first) &&
    /There is a pharmacy on Cedar Street/i.test(existenceRetrieval.second),
    "There-is/there-are retrieval gives the singular first-mention cue before revealing the repaired introduction");

  await navigate(`${origin}/lessons/a1/have-got/`, 375, 900);
  const possessionDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      presentConnection: body.includes('Have got describes a connection that is true now') &&
        body.includes('The whole chunk means “I have a bicycle now.”'),
      usDefault: body.includes('ordinary have is usually the clearest default') &&
        body.includes('Have you got a car?') && body.includes('Do you have a car?'),
      activityBoundary: body.includes('Possession is not an activity') &&
        body.includes("I've got lunch at one can instead suggest that a lunch appointment is on your schedule") &&
        body.includes('I have lunch at one every day'),
      tenseBoundary: body.includes('Present possession, past possession, and U.S. gotten') &&
        body.includes('I had a car last year') && body.includes('have gotten is a different, later pattern'),
      spokenForm: body.includes("I've-got a charger") && body.includes("D'you-have a charger?"),
      privacy: body.includes('You never need to disclose your possessions, money, health, family, home, workplace, schedule, documents, or travel plans'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read have got and ordinary have listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(possessionDecision.firstGap === "have" && possessionDecision.success &&
    /Have matches I, you, and we/i.test(possessionDecision.feedback) &&
    possessionDecision.presentConnection && possessionDecision.usDefault && possessionDecision.activityBoundary &&
    possessionDecision.tenseBoundary && possessionDecision.spokenForm && possessionDecision.privacy &&
    possessionDecision.listeningScript && possessionDecision.typedLabels &&
    possessionDecision.retrieval === "#next-day-retrieval" &&
    possessionDecision.previous === "/lessons/a1/there-is-there-are/" &&
    possessionDecision.next === "/lessons/a1/can-for-ability-and-permission/" && !possessionDecision.overflow,
    "Have-got preserves present-connection meaning, neutral U.S. alternatives, activity and tense boundaries, spoken form, listening, sequencing, accessibility, retrieval, and mobile fit");

  const possessionRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'have' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(possessionRetrieval.error && /Maya uses she/i.test(possessionRetrieval.first) &&
    /She's got a laptop/i.test(possessionRetrieval.second),
    "Have-got retrieval gives the subject-agreement cue before revealing the repaired possession chunk");

  await navigate(`${origin}/lessons/a1/can-for-ability-and-permission/`, 375, 900);
  const canDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      coreMeaning: body.includes('the speaker presents the action as possible now') &&
        body.includes('present possibility'),
      situationBoundary: body.includes('Ability or this situation?') &&
        body.includes('I can’t drive you today because my car is at the repair shop'),
      timeBoundary: body.includes('Keep the time boundary clear') &&
        body.includes('I could swim when I was five') && body.includes('future be able to'),
      socialResponse: body.includes('Sure. / Sorry, this seat is taken.') &&
        body.includes('Yes, I can answers an ability question'),
      spokenForm: body.includes('Sound natural: can or can’t in U.S. English?') &&
        body.includes('weak and quick, like kuhn') && body.includes('final t may be light or unreleased'),
      privacy: body.includes('You never need to disclose your real skills, health, family, workplace, schedule, location, or access needs'),
      production: body.includes('Final production: run a fictional community-center help desk'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read can meaning and spoken-contrast listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(canDecision.firstGap === "can" && canDecision.success &&
    /Can marks a possible skill or allowed action/i.test(canDecision.feedback) &&
    canDecision.coreMeaning && canDecision.situationBoundary && canDecision.timeBoundary &&
    canDecision.socialResponse && canDecision.spokenForm && canDecision.privacy &&
    canDecision.production && canDecision.listeningScript && canDecision.typedLabels &&
    canDecision.retrieval === "#next-day-retrieval" &&
    canDecision.previous === "/lessons/a1/have-got/" &&
    canDecision.next === "/lessons/a1/adverbs-of-frequency/" && !canDecision.overflow,
    "Can preserves possible-now meaning, ability and situation boundaries, social responses, U.S. spoken form, listening, sequencing, accessibility, retrieval, and mobile fit");

  const canRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'can’t' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(canRetrieval.error && /positive evidence of ability/i.test(canRetrieval.first) &&
    /Noor can repair bicycles/i.test(canRetrieval.second),
    "Can retrieval gives the positive-ability cue before revealing the repaired can sentence");

  await navigate(`${origin}/lessons/a1/adverbs-of-frequency/`, 375, 900);
  const frequencyDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      evidenceMeaning: body.includes('pattern across repeated occasions') &&
        body.includes('percentages are memory aids, not measurements'),
      placementSystem: body.includes('the adverb stays near the verb') &&
        body.includes('She can always help.') && body.includes('I don’t usually work Sundays.'),
      flexibleSometimes: body.includes('Front, middle, and end positions are natural') &&
        body.includes('I work late sometimes'),
      negativeBoundary: body.includes('Not always is not never') &&
        body.includes('I don’t always drive') && body.includes('I never drive'),
      questionSystem: body.includes('Do you usually cook?') &&
        body.includes('Is she often late?') && body.includes('How often do you cook?'),
      spokenForm: body.includes('YOO-zhuh-lee') && body.includes('RARE-lee') &&
        body.includes('with and without the t'),
      privacy: body.includes('You never need to disclose your real routine, family, workplace, schedule, diet, health, religion, finances, or location'),
      production: body.includes('Final production: present a fictional weekly service report'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read frequency placement and spoken-rhythm listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(frequencyDecision.firstGap === "always" && frequencyDecision.success &&
    /Every occasion supports always/i.test(frequencyDecision.feedback) &&
    frequencyDecision.evidenceMeaning && frequencyDecision.placementSystem &&
    frequencyDecision.flexibleSometimes && frequencyDecision.negativeBoundary &&
    frequencyDecision.questionSystem && frequencyDecision.spokenForm && frequencyDecision.privacy &&
    frequencyDecision.production && frequencyDecision.listeningScript && frequencyDecision.typedLabels &&
    frequencyDecision.retrieval === "#next-day-retrieval" &&
    frequencyDecision.previous === "/lessons/a1/can-for-ability-and-permission/" &&
    frequencyDecision.next === "/lessons/a1/prepositions-of-time-and-place/" && !frequencyDecision.overflow,
    "Adverbs of frequency preserves evidence-based meaning, four placement patterns, negative and question boundaries, U.S. spoken form, listening, sequencing, accessibility, retrieval, and mobile fit");

  const frequencyRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'is usually' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(frequencyRetrieval.error && /Every report supports always/i.test(frequencyRetrieval.first) &&
    /The manager always checks the door/i.test(frequencyRetrieval.second),
    "Adverbs-of-frequency retrieval gives the evidence and ordinary-verb position cue before revealing the repaired routine");

  await navigate(`${origin}/lessons/a1/prepositions-of-time-and-place/`, 375, 900);
  const prepositionDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      frameModel: body.includes('useful starting rule, but English also has conventional chunks') &&
        body.includes('thinking tool, not a complete law'),
      zeroPreposition: body.includes('Use no time preposition before') &&
        body.includes('today, tonight, tomorrow, yesterday'),
      addressBoundary: body.includes('Street line or exact address?') &&
        body.includes('The café is on Oak Street') && body.includes('The café is at 245 Oak Street'),
      transportBoundary: body.includes('Transportation chunks in U.S. English') &&
        body.includes('on a bus, on a train, on a plane') && body.includes('in a car, in a taxi'),
      closeContrasts: body.includes('Same noun, different picture') &&
        body.includes('at school / in school') && body.includes('in bed / on the bed') &&
        body.includes('on time / in time'),
      spokenForm: body.includes('at-eight') && body.includes('on-Oak Street') &&
        body.includes('in-August') && body.includes('approximately uht'),
      privacy: body.includes('You never need to disclose your real address, home, belongings, schedule, workplace, school, travel, family, or live location'),
      production: body.includes('Final production: plan a fictional community event'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read time, address, and transportation listening check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(prepositionDecision.firstGap === "at" && prepositionDecision.success &&
    /Clock points take at/i.test(prepositionDecision.feedback) &&
    prepositionDecision.frameModel && prepositionDecision.zeroPreposition &&
    prepositionDecision.addressBoundary && prepositionDecision.transportBoundary &&
    prepositionDecision.closeContrasts && prepositionDecision.spokenForm &&
    prepositionDecision.privacy && prepositionDecision.production &&
    prepositionDecision.listeningScript && prepositionDecision.typedLabels &&
    prepositionDecision.retrieval === "#next-day-retrieval" &&
    prepositionDecision.previous === "/lessons/a1/adverbs-of-frequency/" &&
    prepositionDecision.next === "/lessons/a1/some-any-with-countable-and-uncountable-nouns/" &&
    !prepositionDecision.overflow,
    "Prepositions of time and place preserves the frame model, zero-preposition, U.S. address, transport and close-noun boundaries, spoken linking, listening, sequencing, accessibility, retrieval, and mobile fit");

  const prepositionRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'on' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(prepositionRetrieval.error && /exact clock time is a point/i.test(prepositionRetrieval.first) &&
    /The train leaves at 6:20/i.test(prepositionRetrieval.second),
    "Prepositions retrieval gives the clock-point cue before revealing the repaired exact-time phrase");

  await navigate(`${origin}/lessons/a1/some-any-with-countable-and-uncountable-nouns/`, 375, 900);
  const someAnyDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      viewpoint: body.includes('Countability is not only about the real object') &&
        body.includes('One countable thing needs a singular marker'),
      meaningSystem: body.includes('speaker’s orientation') &&
        body.includes('presents a quantity as existing or expected') &&
        body.includes('leaves existence open, or says zero in a negative'),
      questionBoundary: body.includes('The polite exception: offers and requests') &&
        body.includes('Is there any coffee?'),
      zeroAndChoice: body.includes('There isn’t any milk') && body.includes('There is no milk') &&
        body.includes('Any seat is fine'),
      spokenForm: body.includes('suhm') && body.includes('/səm/') && body.includes('/ˈeni/') &&
        body.includes('some-rice'),
      privacy: body.includes('You never need to disclose your real home, belongings, shopping habits, money, food, workplace, or location'),
      production: body.includes('Final production: prepare a fictional community workshop'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read some and any meaning and rhythm check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(someAnyDecision.firstGap === "some" && someAnyDecision.success &&
    /Some presents an existing quantity/i.test(someAnyDecision.feedback) &&
    someAnyDecision.viewpoint && someAnyDecision.meaningSystem &&
    someAnyDecision.questionBoundary && someAnyDecision.zeroAndChoice &&
    someAnyDecision.spokenForm && someAnyDecision.privacy && someAnyDecision.production &&
    someAnyDecision.listeningScript && someAnyDecision.typedLabels &&
    someAnyDecision.retrieval === "#next-day-retrieval" &&
    someAnyDecision.previous === "/lessons/a1/prepositions-of-time-and-place/" &&
    someAnyDecision.next === "/lessons/a1/object-pronouns/" && !someAnyDecision.overflow,
    "Some and any preserves countability and quantity meaning, offer, zero and free-choice boundaries, spoken form, listening, sequencing, accessibility, retrieval, privacy, production, and mobile fit");

  const someAnyRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'any' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(someAnyRetrieval.error && /positive statement presents an existing quantity of plural chairs/i.test(someAnyRetrieval.first) &&
    /We have some chairs for the guests/i.test(someAnyRetrieval.second),
    "Some-and-any retrieval gives the existing-quantity cue before revealing the repaired plural quantity");

  await navigate(`${origin}/lessons/a1/object-pronouns/`, 375, 900);
  const objectPronounDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      roleSystem: body.includes('roles inside the sentence') &&
        body.includes('object of a verb') && body.includes('object of a preposition'),
      singularThem: body.includes('They / them can refer to several people or to one person') &&
        body.includes('A customer left a message. Please call them back.'),
      herBoundary: body.includes('Same spelling, different job: her') &&
        body.includes('The manager called her') && body.includes('She called her manager'),
      referencePolicy: body.includes('Do not guess a pronoun from a person’s name or appearance') &&
        body.includes('Repeat a name or noun to make the intended person unmistakable'),
      reflexiveBoundary: body.includes('Different person or the same person?') &&
        body.includes('Maya called herself'),
      placement: body.includes('Send it to her') && body.includes('Send her it'),
      spokenForm: body.includes('CALL-im') && body.includes('ASK-er') && body.includes('TELL-em') &&
        body.includes('listening approximations, not new spellings'),
      privacy: body.includes('You never need to disclose your real family, contacts, messages, phone use, workplace, relationships, schedule, or location'),
      production: body.includes('Final production: coordinate a fictional community event'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read object-pronoun role, reference, and linking check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(objectPronounDecision.firstGap === "him" && objectPronounDecision.success &&
    /matched each object form/i.test(objectPronounDecision.feedback) &&
    objectPronounDecision.roleSystem && objectPronounDecision.singularThem &&
    objectPronounDecision.herBoundary && objectPronounDecision.referencePolicy &&
    objectPronounDecision.reflexiveBoundary && objectPronounDecision.placement &&
    objectPronounDecision.spokenForm && objectPronounDecision.privacy &&
    objectPronounDecision.production && objectPronounDecision.listeningScript &&
    objectPronounDecision.typedLabels && objectPronounDecision.retrieval === "#next-day-retrieval" &&
    objectPronounDecision.previous === "/lessons/a1/some-any-with-countable-and-uncountable-nouns/" &&
    objectPronounDecision.next === "/lessons/a1/imperatives/" && !objectPronounDecision.overflow,
    "Object pronouns preserves role and reference, singular them, her and reflexive boundaries, pronoun placement, spoken linking, listening, sequencing, accessibility, retrieval, privacy, production, and mobile fit");

  const objectPronounRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'me' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(objectPronounRetrieval.error && /After the verb call/i.test(objectPronounRetrieval.first) &&
    /Please call her after lunch/i.test(objectPronounRetrieval.second),
    "Object-pronoun retrieval gives the verb-object role cue before revealing the repaired pronoun");

  await navigate(`${origin}/lessons/a1/imperatives/`, 375, 900);
  const imperativeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      baseSystem: body.includes('ordinary imperative starts with the base verb') &&
        body.includes('ordinary imperative addresses you'),
      addresseeBoundary: body.includes('When you is spoken') &&
        body.includes('You wait here; Marco, come with me.'),
      doBoundary: body.includes('Do not enter') && body.includes('Do come in') &&
        body.includes('Do be careful'),
      socialChoice: body.includes('Grammar is simple; social meaning is not') &&
        body.includes('does not automatically make every command appropriate') &&
        body.includes('Can you…? often gives a request more room'),
      spokenForm: body.includes('compact beat /doʊnt/') && body.includes('light or unreleased') &&
        body.includes('Let’s sounds /lets/'),
      letsBoundary: body.includes('The apostrophe matters') &&
        body.includes('The app lets us change the language') && body.includes('Let’s not be late'),
      letMe: body.includes('Let me help you') && body.includes('Let me try'),
      sequencing: body.includes('first, next, then, after that, finally'),
      privacy: body.includes('You never need to disclose your real home, route, cooking, devices, contacts, schedule, workplace, health, or travel plans'),
      production: body.includes('Final production: orient a fictional conference visitor'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read imperative purpose, politeness, and intonation check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(imperativeDecision.firstGap === "Turn" && imperativeDecision.success &&
    /route and contact reasons/i.test(imperativeDecision.feedback) &&
    imperativeDecision.baseSystem && imperativeDecision.addresseeBoundary &&
    imperativeDecision.doBoundary && imperativeDecision.socialChoice &&
    imperativeDecision.spokenForm && imperativeDecision.letsBoundary && imperativeDecision.letMe &&
    imperativeDecision.sequencing && imperativeDecision.privacy && imperativeDecision.production &&
    imperativeDecision.listeningScript && imperativeDecision.typedLabels &&
    imperativeDecision.retrieval === "#next-day-retrieval" &&
    imperativeDecision.previous === "/lessons/a1/object-pronouns/" &&
    imperativeDecision.next === "/lessons/a1/was-were/" && !imperativeDecision.overflow,
    "Imperatives preserves base and negative form, addressee and do boundaries, social-action choices, let's, let me, sequencing, U.S. spoken form, listening, accessibility, navigation, retrieval, privacy, production, and mobile fit");

  const imperativeRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'Don’t' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(imperativeRetrieval.error && /neutral positive instruction begins directly with the base verb Open/i.test(imperativeRetrieval.first) &&
    /Open the Settings menu/i.test(imperativeRetrieval.second),
    "Imperative retrieval gives the positive-interface cue before revealing the repaired base-verb instruction");

  await navigate(`${origin}/lessons/a1/was-were/`, 375, 900);
  const wasWereDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    const typedLabels = [...document.querySelectorAll('[data-answer-drill] input[aria-label]')]
      .map((input) => input.getAttribute('aria-label'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      agreement: body.includes('Pronouns and noun subjects') &&
        body.includes('You always takes were') && body.includes('Maya and Luis were early'),
      shortAnswers: body.includes('Short answers repeat the matching past form') &&
        body.includes('Use a full positive form after yes'),
      questionSystem: body.includes('Questions: move was or were before the subject') &&
        body.includes('Did she work yesterday?') && body.includes('Was she at work yesterday?'),
      existenceAndBorn: body.includes('There wasn’t') && body.includes('There weren’t') &&
        body.includes('was/were born') && body.includes('Where were you born?'),
      spokenForm: body.includes('/wəz/') && body.includes('/wɚ/') &&
        body.includes('/wʌzənt/') && body.includes('/wɝnt/') && body.includes('Was-he…?'),
      privacy: body.includes('You never need to disclose your real location, schedule, workplace, travel, age, or childhood'),
      production: body.includes('Final production: report the fictional skills fair for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read was and were agreement, polarity, and reduction check"] details')),
      typedLabels: typedLabels.length === 6 && typedLabels.every((label) => label.length > 20 && !/^answer\s+\d+$/i.test(label)),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(wasWereDecision.firstGap === "was" && wasWereDecision.success &&
    /Subject agreement and the stated evidence/i.test(wasWereDecision.feedback) &&
    wasWereDecision.agreement && wasWereDecision.shortAnswers &&
    wasWereDecision.questionSystem && wasWereDecision.existenceAndBorn &&
    wasWereDecision.spokenForm && wasWereDecision.privacy && wasWereDecision.production &&
    wasWereDecision.listeningScript && wasWereDecision.typedLabels &&
    wasWereDecision.retrieval === "#next-day-retrieval" &&
    wasWereDecision.previous === "/lessons/a1/imperatives/" &&
    wasWereDecision.next === "/lessons/a1/daily-routines-and-telling-the-time/" && !wasWereDecision.overflow,
    "Was / were preserves agreement, questions, short answers, action and existence boundaries, born, U.S. reductions, listening, accessibility, navigation, retrieval, privacy, production, and mobile fit");

  const wasWereRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'were' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(wasWereRetrieval.error && /singular main hall takes was/i.test(wasWereRetrieval.first) &&
    /The main hall was crowded/i.test(wasWereRetrieval.second),
    "Was / were retrieval gives the singular-agreement cue before revealing the repaired event statement");

  await navigate(`${origin}/lessons/a1/daily-routines-and-telling-the-time/`, 375, 900);
  const routineTimeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      clockStyles: body.includes('two ways to read the clock') &&
        body.includes('common number style') && body.includes('eight forty-five') &&
        body.includes('past/to style') && body.includes('eight oh five'),
      clockBoundaries: body.includes('Use o’clock only with an exact hour') &&
        body.includes('Avoid the redundant combination nine o’clock a.m.') &&
        body.includes('noon') && body.includes('midnight'),
      routineMeaning: body.includes('A routine is a repeated pattern') &&
        body.includes('wake up / get up') &&
        body.includes('I wake up at 6:30, but I get up at 6:45'),
      chunkBoundaries: body.includes('go home and get home with no to') &&
        body.includes('have breakfast, have lunch, have dinner') &&
        body.includes('Alex checks their phone'),
      questions: body.includes('What time do + I/you/we/they + base verb?') &&
        body.includes('What time does + he/she/it + base verb?') &&
        body.includes('does Maya starts'),
      spokenForm: body.includes('usually unstressed /tə/') && body.includes('gets ends /s/') &&
        body.includes('goes and has end /z/') && body.includes('finishes adds a final syllable /ɪz/'),
      privacy: body.includes('You never need to disclose your real sleep, meals, commute, workplace, schedule, contacts, or home life'),
      production: body.includes('Final production: present Maya’s two-day routine for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read routine time, person, and connected-speech check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(routineTimeDecision.firstGap === "o'clock" && routineTimeDecision.success &&
    /matched each digital clock/i.test(routineTimeDecision.feedback) &&
    routineTimeDecision.clockStyles && routineTimeDecision.clockBoundaries &&
    routineTimeDecision.routineMeaning && routineTimeDecision.chunkBoundaries &&
    routineTimeDecision.questions && routineTimeDecision.spokenForm &&
    routineTimeDecision.privacy && routineTimeDecision.production &&
    routineTimeDecision.listeningScript && routineTimeDecision.retrieval === "#next-day-retrieval" &&
    routineTimeDecision.previous === "/lessons/a1/was-were/" &&
    routineTimeDecision.next === "/lessons/a1/jobs-and-workplaces/" && !routineTimeDecision.overflow,
    "Daily routines and time preserves U.S. clock styles, routine and chunk contrasts, question and spoken forms, listening, sequencing, navigation, retrieval, privacy, production, and mobile fit");

  const routineTimeRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'gets up' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(routineTimeRetrieval.error && /Ending sleep is wake up; with she/i.test(routineTimeRetrieval.first) &&
    /She wakes up at 6:30 and gets up at 6:45/i.test(routineTimeRetrieval.second),
    "Daily-routine retrieval gives the wake-versus-get meaning cue before revealing the repaired schedule statement");

  await navigate(`${origin}/lessons/a1/jobs-and-workplaces/`, 375, 900);
  const jobsDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      informationSystem: body.includes('four kinds of work information') &&
        body.includes('What do you do?') && body.includes('Where do you work?') &&
        body.includes('Who do you work for?') && body.includes('What do you do at work?'),
      patternBoundaries: body.includes('At and in can overlap') &&
        body.includes('work in + setting, department, or field') &&
        body.includes('work for + employer or client') && body.includes('work from home'),
      articlesAndRoles: body.includes('a university student') && body.includes('an engineer') &&
        body.includes('A singular role needs a marker') && body.includes('cook') && body.includes('chef'),
      spokenForm: body.includes('uh-COUNT-uhnt') && body.includes('ih-lek-TRISH-uhn') &&
        body.includes('works ends with /s/') && body.includes('teaches adds a final syllable /ɪz/'),
      privacy: body.includes('You never need to disclose your real job, employer, workplace, income, schedule, coworkers, or employment status'),
      production: body.includes('Final production: introduce a fictional community-center team for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read role, workplace, employer, department, and remote-work listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(jobsDecision.firstGap === "a" && jobsDecision.success &&
    /first spoken sound/i.test(jobsDecision.feedback) && jobsDecision.informationSystem &&
    jobsDecision.patternBoundaries && jobsDecision.articlesAndRoles && jobsDecision.spokenForm &&
    jobsDecision.privacy && jobsDecision.production && jobsDecision.listeningScript &&
    jobsDecision.retrieval === "#next-day-retrieval" &&
    jobsDecision.previous === "/lessons/a1/daily-routines-and-telling-the-time/" &&
    jobsDecision.next === "/lessons/a1/food-and-drink/" && !jobsDecision.overflow,
    "Jobs and workplaces preserves information types, article and preposition boundaries, U.S. spoken form, listening, navigation, retrieval, privacy, production, and mobile fit");

  const jobsRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'at' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(jobsRetrieval.error && /A role after work takes as/i.test(jobsRetrieval.first) &&
    /She works as an electrician/i.test(jobsRetrieval.second),
    "Jobs-and-workplaces retrieval gives the role cue before revealing the repaired as plus role sentence");

  await navigate(`${origin}/lessons/a1/food-and-drink/`, 375, 900);
  const foodDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      viewpoint: body.includes('countability is a language viewpoint') &&
        body.includes('The same food can enter different frames') &&
        body.includes('some coffee') && body.includes('a coffee') && body.includes('a cup of coffee'),
      portions: body.includes('Useful portions and containers') &&
        body.includes('Pluralize the unit, not the amount noun') && body.includes('two slices of bread'),
      socialMeaning: body.includes('I like + food') && body.includes('I’d like + order') &&
        body.includes('I’d = I would') && body.includes('For here or to go?'),
      spokenForm: body.includes('one syllable /aɪd/') && body.includes('wouldja') &&
        body.includes('sandwiches adds a final syllable /ɪz/'),
      privacy: body.includes('You never need to disclose your real diet, meals, health, allergies, religion, finances, shopping, refrigerator, home, or body'),
      production: body.includes('Final production: run a fictional lunch-counter exchange for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read preference, order, portion, amount, and U.S. service-choice listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(foodDecision.firstGap === "a" && foodDecision.success &&
    /item, amount, or menu serving/i.test(foodDecision.feedback) && foodDecision.viewpoint &&
    foodDecision.portions && foodDecision.socialMeaning && foodDecision.spokenForm &&
    foodDecision.privacy && foodDecision.production && foodDecision.listeningScript &&
    foodDecision.retrieval === "#next-day-retrieval" &&
    foodDecision.previous === "/lessons/a1/jobs-and-workplaces/" &&
    foodDecision.next === "/lessons/a1/rooms-and-furniture/" && !foodDecision.overflow,
    "Food and drink preserves viewpoint-based countability, portions, preference and order meaning, U.S. service and spoken forms, listening, navigation, retrieval, privacy, production, and mobile fit");

  const foodRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'like' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(foodRetrieval.error && /A present polite order uses I’d like/i.test(foodRetrieval.first) &&
    /I’d like a salad, please/i.test(foodRetrieval.second),
    "Food-and-drink retrieval gives the request-meaning cue before revealing the repaired I’d-like order");

  await navigate(`${origin}/lessons/a1/rooms-and-furniture/`, 375, 900);
  const roomsDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      categories: body.includes('Furniture is one category, not every thing in a room') &&
        body.includes('Furniture is uncountable') && body.includes('appliance') && body.includes('fixture'),
      informationChain: body.includes('four kinds of room information') &&
        body.includes('There is a lamp in the room') && body.includes('It is on the desk') &&
        body.includes('The room has a large window'),
      placeBoundaries: body.includes('next to / beside') && body.includes('near') &&
        body.includes('On the wall') && body.includes('above the sofa') &&
        body.includes('In the front of the room'),
      usVocabulary: body.includes('bathroom / restroom') && body.includes('closet / wardrobe') &&
        body.includes('ri-FRIJ-uh-ray-ter'),
      spokenForm: body.includes('there’s-a') && body.includes('next-tuh') &&
        body.includes('couches adds a final syllable /ɪz/'),
      privacy: body.includes('You never need to disclose your real home, address, bedroom, possessions, finances, family, neighborhood, work setup, location, or photos'),
      production: body.includes('Final production: present a fictional guest studio for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read room category, new-information, known-location, and place-relation listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(roomsDecision.firstGap === "is" && roomsDecision.success &&
    /number, countability, new information, known information, and room features/i.test(roomsDecision.feedback) &&
    roomsDecision.categories && roomsDecision.informationChain && roomsDecision.placeBoundaries &&
    roomsDecision.usVocabulary && roomsDecision.spokenForm && roomsDecision.privacy &&
    roomsDecision.production && roomsDecision.listeningScript && roomsDecision.retrieval === "#next-day-retrieval" &&
    roomsDecision.previous === "/lessons/a1/food-and-drink/" &&
    roomsDecision.next === "/lessons/a1/hobbies-and-free-time/" && !roomsDecision.overflow,
    "Rooms and furniture preserves object categories, information flow, U.S. vocabulary, precise location boundaries, spoken form, listening, navigation, retrieval, privacy, production, and mobile fit");

  const roomsRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'a' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(roomsRetrieval.error && /Furniture is uncountable, so use some rather than a/i.test(roomsRetrieval.first) &&
    /There is some furniture in the studio/i.test(roomsRetrieval.second),
    "Rooms-and-furniture retrieval gives the uncountable-category cue before revealing the repaired some-furniture sentence");

  await navigate(`${origin}/lessons/a1/hobbies-and-free-time/`, 375, 900);
  const hobbiesDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const questionBuilder = [...document.querySelectorAll('[data-tile-builder]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('ask about activities'));
    questionBuilder.dataset.answer.split(' ').forEach((token) => {
      [...questionBuilder.querySelectorAll('[data-build-tile]')]
        .find((tile) => tile.dataset.buildTile === token && !tile.disabled).click();
    });
    questionBuilder.querySelector('[data-check-build]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      chunks: body.includes('learn the whole activity chunk') &&
        body.includes('Go plus -ing is not a general rule for every -ing word') &&
        body.includes('read books') && body.includes('listen to music') && body.includes('take photos'),
      usUsage: body.includes('play the guitar') && body.includes('watch TV') &&
        body.includes('normally avoids bare do exercise') && body.includes('on weekends') &&
        body.includes('no preposition before this weekend'),
      meaningSystem: body.includes('One activity, five different messages') &&
        body.includes('routine or fact') && body.includes('experienced enjoyment') &&
        body.includes('present wish or polite interest') && body.includes('Enjoy is different') &&
        body.includes('Would like is not the same as ordinary like'),
      questionPurposes: body.includes('Ask the question that matches your purpose') &&
        body.includes('What do you do in your free time?') && body.includes('Are you free this Saturday?') &&
        body.includes('asks whether someone is available'),
      questionBuilder: questionBuilder.querySelector('[data-feedback]').classList.contains('is-success') &&
        questionBuilder.querySelector('[data-feedback]').textContent.includes('which activities form the listener’s free time'),
      spokenForm: body.includes('whaddaya') && body.includes('pho-TOG-ra-phy') &&
        body.includes('watches adds a final syllable /ɪz/'),
      privacy: body.includes('You never need to disclose your real interests, abilities, body, health, schedule, work, family, friends, location, finances, religion, devices, travel, or weekend plans'),
      production: body.includes('Final production: recommend two fictional community-center activities for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read routine, preference, ability, present-interest, question-purpose, and availability listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(hobbiesDecision.firstGap === "plays" && hobbiesDecision.success &&
    /fixed activity chunks and forms from routine, experience, and present-interest meanings/i.test(hobbiesDecision.feedback) &&
    hobbiesDecision.chunks && hobbiesDecision.usUsage && hobbiesDecision.meaningSystem &&
    hobbiesDecision.questionPurposes && hobbiesDecision.questionBuilder && hobbiesDecision.spokenForm && hobbiesDecision.privacy &&
    hobbiesDecision.production && hobbiesDecision.listeningScript && hobbiesDecision.retrieval === "#next-day-retrieval" &&
    hobbiesDecision.previous === "/lessons/a1/rooms-and-furniture/" &&
    hobbiesDecision.next === "/lessons/a1/clothes-and-shopping/" && !hobbiesDecision.overflow,
    "Hobbies and free time preserves fixed and independent chunks, verb-form meanings, U.S. usage, question purposes, spoken form, listening, navigation, retrieval, privacy, production, and mobile fit");

  const hobbiesRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'go' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(hobbiesRetrieval.error && /Reading uses its own verb; go plus -ing is not a general activity rule/i.test(hobbiesRetrieval.first) &&
    /Participants read books during the quiet hour/i.test(hobbiesRetrieval.second),
    "Hobbies-and-free-time retrieval gives the independent-verb cue before revealing the repaired reading sentence");

  await navigate(`${origin}/lessons/a1/clothes-and-shopping/`, 375, 900);
  const clothesDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      nounSystem: body.includes('Clothes is a plural word') && body.includes('Clothing is uncountable') &&
        body.includes('Two kinds of plural are not the same') && body.includes('This pair of jeans is'),
      agreementChain: body.includes('Get to the root: the noun controls the chain') &&
        body.includes('this / that / these / those') && body.includes('Can I try it on?') && body.includes('Can I try them on?'),
      actions: body.includes('Four clothing actions') && body.includes('wear') &&
        body.includes('put on') && body.includes('take off') && body.includes('try on'),
      fitAndSale: body.includes('Size, fit, and sale do different jobs') &&
        body.includes('too tight') && body.includes('too loose') &&
        body.includes('on sale usually means the price is reduced') && body.includes('For sale means available to buy'),
      pronounPlacement: body.includes('A short pronoun must go in the middle') &&
        body.includes('try on it') && body.includes('try on them'),
      usUsage: body.includes('U.S. clothing words') && body.includes('British English commonly uses trousers') &&
        body.includes('British jumper') && body.includes('twenty-four ninety-nine'),
      spokenForm: body.includes('Clothes is normally one syllable') &&
        body.includes('sizes adds a final syllable /ɪz/') && body.includes('Can-I try-it-ON'),
      privacy: body.includes('You never need to disclose your real clothes, body, size, purchases, budget, brands, work, religion, health, mobility, travel, home, family, gender, or appearance'),
      production: body.includes('Final production: help a fictional customer compare two items for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read item number, distance, try-on pronoun, and sale-meaning listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(clothesDecision.firstGap === "is" && clothesDecision.success &&
    /ordinary singulars, plural nouns, uncountable clothing, and the number of pair/i.test(clothesDecision.feedback) &&
    clothesDecision.nounSystem && clothesDecision.agreementChain && clothesDecision.actions &&
    clothesDecision.fitAndSale && clothesDecision.pronounPlacement && clothesDecision.usUsage &&
    clothesDecision.spokenForm && clothesDecision.privacy && clothesDecision.production &&
    clothesDecision.listeningScript && clothesDecision.retrieval === "#next-day-retrieval" &&
    clothesDecision.previous === "/lessons/a1/hobbies-and-free-time/" &&
    clothesDecision.next === "/lessons/a1/weather-and-seasons/" && !clothesDecision.overflow,
    "Clothes and shopping preserves noun systems, pair agreement, demonstratives, pronouns, shopping actions, fit, sale meaning, U.S. usage, speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const clothesRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'is' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(clothesRetrieval.error && /Clothes is plural, even though it is not a countable noun/i.test(clothesRetrieval.first) &&
    /These clothes are ready for the display/i.test(clothesRetrieval.second),
    "Clothes-and-shopping retrieval gives the plural clothes cue before revealing the repaired agreement sentence");

  await navigate(`${origin}/lessons/a1/weather-and-seasons/`, 375, 900);
  const weatherDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      weatherClimate: body.includes('Weather describes conditions over a short time') &&
        body.includes('Climate describes patterns observed over many years'),
      viewpoint: body.includes('A forecast and a live camera') &&
        body.includes('A broader condition often uses an adjective') &&
        body.includes('an event in progress uses be plus -ing'),
      wordFamilies: body.includes('Get to the root: noun, adjective, or event') &&
        body.includes('Do not add -ing to every weather noun') && body.includes('The sun is shining') &&
        body.includes('The wind is blowing') && body.includes('some lightning and thunder'),
      weatherIt: body.includes('It in a weather sentence does not point to an object') &&
        body.includes('It does not refer back to a thing'),
      questions: body.includes('Ask for the information you need') &&
        body.includes('What’s X like? asks for a description') &&
        body.includes('What’s the temperature?') && body.includes('What’s the forecast for Friday?'),
      temperature: body.includes('Always make the unit clear across countries') &&
        body.includes('72 degrees Fahrenheit') && body.includes('22 degrees Celsius') &&
        body.includes('High is the warmest temperature expected'),
      probability: body.includes('A chance is not a promise') &&
        body.includes('It means rain is possible, not certain') &&
        body.includes('does not simply mean rain for 60 percent of the day'),
      seasons: body.includes('Seasons depend on place and system') &&
        body.includes('Northern Hemisphere') && body.includes('Southern Hemisphere') &&
        body.includes('wet and dry seasons') && body.includes('It opens next spring'),
      usUsage: body.includes('American English commonly uses fall') && body.includes('British English'),
      spokenForm: body.includes('What’s-the WEATHer-like') && body.includes('TEM-pruh-cher') &&
        body.includes('FAIR-en-height') && body.includes('SEL-see-us') && body.includes('RAIN-y') && body.includes('RAIN-ing'),
      privacy: body.includes('You never need to disclose your real location, weather, climate, home conditions, clothing, health, mobility, work, travel, schedule, plans, finances, family, or access needs'),
      production: body.includes('Final production: give a fictional community weather bulletin for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read condition, event, forecast-label, probability, and hemisphere listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(weatherDecision.firstGap === "rainy" && weatherDecision.success &&
    /broad weather descriptions from rain and snow events happening at an exact moment/i.test(weatherDecision.feedback) &&
    weatherDecision.weatherClimate && weatherDecision.viewpoint && weatherDecision.wordFamilies &&
    weatherDecision.weatherIt && weatherDecision.questions && weatherDecision.temperature &&
    weatherDecision.probability && weatherDecision.seasons && weatherDecision.usUsage &&
    weatherDecision.spokenForm && weatherDecision.privacy && weatherDecision.production &&
    weatherDecision.listeningScript && weatherDecision.retrieval === "#next-day-retrieval" &&
    weatherDecision.previous === "/lessons/a1/clothes-and-shopping/" &&
    weatherDecision.next === "/lessons/a1/common-verbs-and-adjectives/" && !weatherDecision.overflow,
    "Weather and seasons preserves weather and climate scope, word families, event viewpoint, forecast meanings, units, probability, global season systems, U.S. usage, speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const weatherRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'rainy' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(weatherRetrieval.error && /An event visibly in progress uses the -ing form/i.test(weatherRetrieval.first) &&
    /It’s raining at this exact moment/i.test(weatherRetrieval.second),
    "Weather-and-seasons retrieval gives the live-event cue before revealing the repaired raining sentence");

  await navigate(`${origin}/lessons/a1/common-verbs-and-adjectives/`, 375, 900);
  const commonWordDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      wholeChunks: body.includes('A common word is not automatically an easy word') &&
        body.includes('listen to an update') && body.includes('work on a project'),
      lightVerbs: body.includes('Get to the root: light verbs carry the grammar') &&
        body.includes('rough tendency, not a law') && body.includes('make coffee') && body.includes('have coffee'),
      usUsage: body.includes('Take the bus') && body.includes('ride the bus') && body.includes('Go by bus') &&
        body.includes('Take a shower') && body.includes('Avoid using bare do exercise'),
      complements: body.includes('Ordinary verbs need the right complement') &&
        body.includes('listen to the announcement') && body.includes('speak English') &&
        body.includes('speak to the coordinator') && body.includes('call the office') &&
        body.includes('buy a ticket') && body.includes('pay for the ticket'),
      presentSimple: body.includes('Keep the present-simple form around the chunk') &&
        body.includes('Does she make dinner?') && body.includes('She doesn’t make dinner'),
      adjectiveForm: body.includes('Adjectives need a position and a viewpoint') &&
        body.includes('two expensive tickets') && body.includes('It does not change for plural number or gender') &&
        body.includes('Is the ticket expensive?'),
      adjectiveMeaning: body.includes('Common adjective meanings are not automatic labels') &&
        body.includes('Cheap means low-priced but can also suggest low quality') &&
        body.includes('Inexpensive is the more neutral price word') && body.includes('The workshop is free') &&
        body.includes('Maya is free at three') && body.includes('Thing or person: boring / bored') &&
        body.includes('Very and too are not the same'),
      spokenForm: body.includes('make-a plan') && body.includes('DUZ-unt') && body.includes('BOR-ing'),
      privacy: body.includes('You never need to disclose your real routine, work, study, homework, chores, meals, purchases, budget, transport, home, family, relationships, schedule, opinions, emotions, body, health, abilities, or access needs'),
      production: body.includes('Final production: give a fictional community-center shift briefing for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read light-verb viewpoint, free meaning, and thing-person adjective listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(commonWordDecision.firstGap === "make" && commonWordDecision.success &&
    /six established light-verb chunks, including two different viewpoints on coffee/i.test(commonWordDecision.feedback) &&
    commonWordDecision.wholeChunks && commonWordDecision.lightVerbs && commonWordDecision.usUsage &&
    commonWordDecision.complements && commonWordDecision.presentSimple && commonWordDecision.adjectiveForm &&
    commonWordDecision.adjectiveMeaning && commonWordDecision.spokenForm && commonWordDecision.privacy &&
    commonWordDecision.production && commonWordDecision.listeningScript &&
    commonWordDecision.retrieval === "#next-day-retrieval" &&
    commonWordDecision.previous === "/lessons/a1/weather-and-seasons/" &&
    !commonWordDecision.next && !commonWordDecision.overflow,
    "Common verbs and adjectives preserves whole chunks, complement patterns, present-simple form, adjective nuance, U.S. usage, speech, listening, final navigation, retrieval, privacy, production, and mobile fit");

  const commonWordRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'do' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(commonWordRetrieval.error && /A decision uses make in this light-verb collocation/i.test(commonWordRetrieval.first) &&
    /They need to make a decision/i.test(commonWordRetrieval.second),
    "Common-verbs-and-adjectives retrieval gives the collocation cue before revealing the repaired make-a-decision sentence");

  await navigate(`${origin}/lessons/a2/past-simple/`, 375, 900);
  const pastSimpleDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can report a finished event, connect its main actions in order, say what did not happen, and ask for missing details'),
      viewpoint: body.includes('Get to the root: locate the situation in finished past time') &&
        body.includes('part of a finished past time') && body.includes('looks at it as a complete fact') &&
        body.includes('a completed sequence') && body.includes('repetition inside a finished period'),
      discourseTime: body.includes('Context, not a magic time word beside every verb, makes the time clear') &&
        body.includes('A time period does not have to be over for one event inside it to be finished') &&
        body.includes('I called at nine this morning'),
      spelling: body.includes('Regular spelling: the precise pattern') &&
        body.includes('short stressed vowel + final consonant') && body.includes('opened, not openned') &&
        body.includes('snowed, fixed, played'),
      irregular: body.includes('Frequent irregular forms') && body.includes('go → went') &&
        body.includes('buy → bought') && body.includes('leave → left'),
      didSystem: body.includes('Get to the root: did carries one past marker') &&
        body.includes('Rina didn’t make the list') && body.includes('Why did Rina make the list?') &&
        body.includes('Yes, she did. No, she didn’t.'),
      beSystem: body.includes('Be keeps its own past system') && body.includes('Was the room quiet?') &&
        body.includes('The doors weren’t open'),
      questionRoles: body.includes('Who called Rina?') && body.includes('Who did Rina call?') &&
        body.includes('asks for the subject') && body.includes('asks for the object'),
      spokenForm: body.includes('The final sound of the base verb selects the ending') &&
        body.includes('after a voiceless sound other than /t/') &&
        body.includes('after a vowel or voiced sound other than /d/') &&
        body.includes('after /t/ or /d/') && body.includes('didja'),
      privacy: body.includes('You never need to disclose your real work, study, travel, routine, home, location, family, relationships, finances, purchases, schedule, health, body, legal history, or difficult experiences'),
      production: body.includes('Final production: give a fictional community-event report for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read past form, polarity, be, and -ed listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pastSimpleDecision.firstGap === "opens" && pastSimpleDecision.success &&
    /routine frame for repeated Fridays and the past frame for one finished Friday/i.test(pastSimpleDecision.feedback) &&
    pastSimpleDecision.outcome && pastSimpleDecision.viewpoint && pastSimpleDecision.discourseTime &&
    pastSimpleDecision.spelling && pastSimpleDecision.irregular && pastSimpleDecision.didSystem &&
    pastSimpleDecision.beSystem && pastSimpleDecision.questionRoles && pastSimpleDecision.spokenForm &&
    pastSimpleDecision.privacy && pastSimpleDecision.production && pastSimpleDecision.listeningScript &&
    pastSimpleDecision.retrieval === "#next-day-retrieval" && !pastSimpleDecision.previous &&
    pastSimpleDecision.next === "/lessons/a2/past-continuous/" && !pastSimpleDecision.overflow,
    "Past simple preserves finished-past viewpoint, discourse time, precise spelling, irregular forms, did and be systems, question roles, sound-based pronunciation, listening, navigation, retrieval, privacy, production, and mobile fit");

  const pastSimpleRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'planed' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pastSimpleRetrieval.error && /Plan doubles final n before the regular -ed ending/i.test(pastSimpleRetrieval.first) &&
    /The team planned the event yesterday/i.test(pastSimpleRetrieval.second),
    "Past-simple retrieval gives the precise doubling cue before revealing the repaired planned sentence");

  await navigate(`${origin}/lessons/a2/past-continuous/`, 375, 900);
  const pastContinuousDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can describe what was in progress at a past reference point, report the completed events around it, and ask for a missing scene detail'),
      viewpoint: body.includes('Get to the root: open the past scene at a reference point') &&
        body.includes('This is an open viewpoint') &&
        body.includes('does not promise that the situation finished later'),
      duration: body.includes('Duration does not choose the tense') &&
        body.includes('Maya worked at the center for ten years') &&
        body.includes('the warning light was flashing') && body.includes('not always an interruption'),
      form: body.includes('Build the form: was or were plus verb-ing') &&
        body.includes('Were they working?') && body.includes('Did they were working?') &&
        body.includes('No, they weren’t.'),
      spelling: body.includes('Retrieve verb-ing spelling precisely') && body.includes('make → making') &&
        body.includes('sit → sitting') && body.includes('open → opening') && body.includes('lie → lying') &&
        body.includes('traveling'),
      connectors: body.includes('Choose viewpoint before choosing a connector') &&
        body.includes('While most naturally introduces an ongoing clause') &&
        body.includes('When can introduce a bounded event or an ongoing situation') &&
        body.includes('During is followed by a noun phrase') &&
        body.includes('does not select a tense automatically'),
      stateMeaning: body.includes('State or activity? Meaning comes first') &&
        body.includes('Rina had a key') && body.includes('Lee knew the code') &&
        body.includes('Rina was having lunch') && body.includes('Lee was thinking about the problem'),
      spokenForm: body.includes('Sound natural: keep the scene light and the event clear') &&
        body.includes('/wəz/') && body.includes('/wɚ/') && body.includes('What-were-you DOing'),
      privacy: body.includes('You never need to disclose your real work, study, home, location, schedule, travel, family, relationships, finances, devices, health, emergencies, or difficult experiences'),
      production: body.includes('Final production: give a fictional power-outage report for 45–60 seconds'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read open-scene, bounded-event, polarity, question, state, and parallel-action listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pastContinuousDecision.firstGap === "were finishing" && pastContinuousDecision.success &&
    /open 6:00 scene from the bounded events that moved the report forward/i.test(pastContinuousDecision.feedback) &&
    pastContinuousDecision.outcome && pastContinuousDecision.viewpoint && pastContinuousDecision.duration &&
    pastContinuousDecision.form && pastContinuousDecision.spelling && pastContinuousDecision.connectors &&
    pastContinuousDecision.stateMeaning && pastContinuousDecision.spokenForm && pastContinuousDecision.privacy &&
    pastContinuousDecision.production && pastContinuousDecision.listeningScript &&
    pastContinuousDecision.retrieval === "#next-day-retrieval" &&
    pastContinuousDecision.previous === "/lessons/a2/past-simple/" &&
    pastContinuousDecision.next === "/lessons/a2/be-going-to-for-plans/" && !pastContinuousDecision.overflow,
    "Past continuous preserves open viewpoint, duration boundaries, form, spelling, connectors, state meanings, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const pastContinuousRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'checked' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pastContinuousRetrieval.error && /The activity is open at the reference point/i.test(pastContinuousRetrieval.first) &&
    /At six, Rina was checking the figures/i.test(pastContinuousRetrieval.second),
    "Past-continuous retrieval gives the open-viewpoint cue before revealing the repaired scene sentence");

  await navigate(`${origin}/lessons/a2/be-going-to-for-plans/`, 375, 900);
  const goingToDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can report a prior intention, predict a result from present evidence, form statements and questions, and explain why a nearby future form fits a different context'),
      basis: body.includes('Get to the root: a present basis for a future idea') &&
        body.includes('That basis can be a person’s prior intention or present evidence') &&
        body.includes('The form does not make the future certain'),
      timeBoundary: body.includes('A future-time expression does not choose the form') &&
        body.includes('Tomorrow can appear with going to, the present continuous, will, or another future expression'),
      form: body.includes('Build the form: be + going to + base verb') &&
        body.includes('Do not add do or does') && body.includes('Yes, they are.'),
      nearbyFutures: body.includes('Choose meaning, not just a future time') &&
        body.includes('organized arrangement with a concrete detail') &&
        body.includes('decision at the moment of speaking'),
      goingToGo: body.includes('Going to go is grammatical') &&
        body.includes('We’re going to go to the center after lunch'),
      spokenForm: body.includes('Sound natural: contractions, stress, and gonna') &&
        body.includes('It cannot replace movement followed only by a place') &&
        body.includes('I’m going to the center'),
      privacy: body.includes('You never need to disclose your real work, study, home, location, schedule, travel, family, relationships, finances, devices, health, or future plans'),
      production: body.includes('Final production: give a 45–60 second planning update'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read intention, arrangement, now-decision, evidence, negative, and movement listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(goingToDecision.firstGap === "prior intention" && goingToDecision.success &&
    /prior intention, present evidence, polarity, or question purpose/i.test(goingToDecision.feedback) &&
    goingToDecision.outcome && goingToDecision.basis && goingToDecision.timeBoundary &&
    goingToDecision.form && goingToDecision.nearbyFutures && goingToDecision.goingToGo &&
    goingToDecision.spokenForm && goingToDecision.privacy && goingToDecision.production &&
    goingToDecision.listeningScript && goingToDecision.retrieval === "#next-day-retrieval" &&
    goingToDecision.previous === "/lessons/a2/past-continuous/" &&
    goingToDecision.next === "/lessons/a2/will-for-predictions-and-offers/" && !goingToDecision.overflow,
    "Be going to preserves prior intention, evidence prediction, form, future boundaries, grammatical going-to-go, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const goingToRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'invited' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(goingToRetrieval.error && /A decision that existed before today is a prior intention/i.test(goingToRetrieval.first) &&
    /They are going to invite twelve neighbors/i.test(goingToRetrieval.second),
    "Be-going-to retrieval gives the prior-intention cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/will-for-predictions-and-offers/`, 375, 900);
  const willDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can make a neutral future prediction, announce a decision made now, volunteer help, make a commitment, and recognize when Will you...? is a request'),
      stance: body.includes('Get to the root: the speaker’s present stance') &&
        body.includes('It shows how the speaker relates to that future event now') &&
        body.includes('Not every idea with will begins at the moment of speaking'),
      form: body.includes('Build the form: will or won’t + base verb') &&
        body.includes('Do not add do, to, or third-person -s') && body.includes('Yes, I will'),
      roles: body.includes('Offer, request, decision, or prediction?') &&
        body.includes('Will you carry this box? normally asks the listener to act') &&
        body.includes('it is a request, not an offer') && body.includes('Accept an offer with Thanks or Yes, please'),
      futureBoundary: body.includes('useful A2 contrast, not a law that makes every other choice impossible') &&
        body.includes('That loose sign is going to fall') && body.includes('I think the event will become popular'),
      spokenForm: body.includes('Sound natural: weak ’ll, clear won’t, and sentence stress') &&
        body.includes('/woʊnt/') && body.includes('It does not sound like want') &&
        body.includes('It will probably be busy') && body.includes('Maybe more people will come'),
      privacy: body.includes('You never need to disclose your real work, study, home, location, schedule, travel, family, relationships, finances, devices, health, promises, or future plans'),
      production: body.includes('Final production: give a 45–60 second event-day response'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read prediction, immediate decision, offer, promise, request, and evidence-based future listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(willDecision.firstGap === "prediction" && willDecision.success &&
    /prediction, immediate decision, offer, promise, invariant modal, and base verb/i.test(willDecision.feedback) &&
    willDecision.outcome && willDecision.stance && willDecision.form && willDecision.roles &&
    willDecision.futureBoundary && willDecision.spokenForm && willDecision.privacy &&
    willDecision.production && willDecision.listeningScript &&
    willDecision.retrieval === "#next-day-retrieval" &&
    willDecision.previous === "/lessons/a2/be-going-to-for-plans/" &&
    willDecision.next === "/lessons/a2/comparatives-and-superlatives/" && !willDecision.overflow,
    "Will preserves modal stance, form, offer-request roles, future boundaries, probability order, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const willRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'probably will being' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(willRetrieval.error && /probably normally follows will and precedes the base verb be/i.test(willRetrieval.first) &&
    /The afternoon will probably be busy/i.test(willRetrieval.second),
    "Will retrieval gives the probability-word cue before revealing the repaired forecast");

  await navigate(`${origin}/lessons/a2/comparatives-and-superlatives/`, 375, 900);
  const comparisonDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can compare two values, identify an extreme within a defined set, express equal or unequal degree, and justify a recommendation with exact evidence'),
      logic: body.includes('Get to the root: choose a scale, reference, and set') &&
        body.includes('A comparative does not require exactly two physical things') &&
        body.includes('A superlative locates an extreme inside a defined set') &&
        body.includes('A superlative does not guarantee one unique winner'),
      form: body.includes('Build the form without a false syllable shortcut') &&
        body.includes('Two-syllable adjectives do not follow one perfect mechanical rule') &&
        body.includes('Precise spelling conditions') && body.includes('Do not double final w, x, or y'),
      irregulars: body.includes('farther / further') &&
        body.includes('both farther and further for physical distance') &&
        body.includes('further information'),
      frames: body.includes('our largest room, not our the largest room') &&
        body.includes('Equal, unequal, and measured differences') &&
        body.includes('The delay was not as bad as yesterday’s') &&
        body.includes('Cedar is $15 more expensive than Pine') && body.includes('Do not say very bigger'),
      spokenForm: body.includes('Sound natural: stress the scale, lighten the frame') &&
        body.includes('/ðən/') && body.includes('the quick flap heard in U.S. water'),
      privacy: body.includes('You never need to disclose your real home, work, school, location, commute, purchases, finances, family, relationships, body, health, preferences, or living conditions'),
      production: body.includes('Final production: give a 45–60 second room recommendation'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read comparative reference, superlative set, equality, unequal degree, exact difference, and tied-extreme listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(comparisonDecision.firstGap === "larger" && comparisonDecision.success &&
    /comparative, superlative, equality frame, reference word, article, and defined set/i.test(comparisonDecision.feedback) &&
    comparisonDecision.outcome && comparisonDecision.logic && comparisonDecision.form &&
    comparisonDecision.irregulars && comparisonDecision.frames && comparisonDecision.spokenForm &&
    comparisonDecision.privacy && comparisonDecision.production && comparisonDecision.listeningScript &&
    comparisonDecision.retrieval === "#next-day-retrieval" &&
    comparisonDecision.previous === "/lessons/a2/will-for-predictions-and-offers/" &&
    comparisonDecision.next === "/lessons/a2/present-perfect/" && !comparisonDecision.overflow,
    "Comparatives preserve scale and set logic, form variation, spelling, irregulars, equality, degree, articles, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const comparisonRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'more quieter than' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(comparisonRetrieval.error && /Use one comparative marker and introduce the reference with than/i.test(comparisonRetrieval.first) &&
    /Cedar is quieter than Maple/i.test(comparisonRetrieval.second),
    "Comparative retrieval gives the one-marker reference cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/present-perfect/`, 375, 900);
  const presentPerfectDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can report a current result, describe experience up to now, show that a state continues, summarize an unfinished period, and switch to past simple for a closed event-time detail'),
      connection: body.includes('Get to the root: view before-now time from now') &&
        body.includes('The rule is not simply “no time stated.”') &&
        body.includes('current result') && body.includes('experience') &&
        body.includes('continuing state') && body.includes('unfinished period'),
      form: body.includes('Build the form: have or has + past participle') &&
        body.includes('Past form and past participle are not always the same') &&
        body.includes('go') && body.includes('went') && body.includes('gone'),
      timeBoundary: body.includes('Choose the time viewpoint before the tense') &&
        body.includes('A calendar word does not choose automatically') &&
        body.includes('A definite closed event-time'),
      usUsage: body.includes('Natural U.S. English with just, already, and yet') &&
        body.includes('I just sent it') && body.includes('Did you eat yet?') &&
        body.includes('do not treat the common U.S. simple-past alternatives as errors'),
      status: body.includes('Been to, gone to, and been at'),
      spokenForm: body.includes('Sound natural: weaken the helper, stress the result') &&
        body.includes('/bɪn/') && body.includes('She’s finished alone can be ambiguous without context'),
      privacy: body.includes('You never need to disclose your real work, study, home, location, schedule, travel, family, relationships, finances, food, health, history, achievements, or future plans'),
      production: body.includes('Final production: give a 45–60 second fictional event-status briefing'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read current result, closed event detail, continuing state, unfinished total, been-gone status, and U.S. recent-event listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(presentPerfectDecision.firstGap === "current result" && presentPerfectDecision.success &&
    /current result, experience, continuing state, unfinished-period total, closed event detail, and present-perfect structure/i.test(presentPerfectDecision.feedback) &&
    presentPerfectDecision.outcome && presentPerfectDecision.connection && presentPerfectDecision.form &&
    presentPerfectDecision.timeBoundary && presentPerfectDecision.usUsage && presentPerfectDecision.status &&
    presentPerfectDecision.spokenForm && presentPerfectDecision.privacy && presentPerfectDecision.production &&
    presentPerfectDecision.listeningScript && presentPerfectDecision.retrieval === "#next-day-retrieval" &&
    presentPerfectDecision.previous === "/lessons/a2/comparatives-and-superlatives/" &&
    presentPerfectDecision.next === "/lessons/a2/modals-should-must-have-to/" && !presentPerfectDecision.overflow,
    "Present perfect preserves four present connections, participles, time viewpoint, U.S. usage, been-gone status, spoken form, listening, navigation, retrieval, privacy, production, and mobile fit");

  const presentPerfectRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'printed at eight yesterday' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(presentPerfectRetrieval.error && /The completed action explains the present ready result/i.test(presentPerfectRetrieval.first) &&
    /Rina has printed the signs, so they are ready now/i.test(presentPerfectRetrieval.second),
    "Present-perfect retrieval gives the present-result cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/modals-should-must-have-to/`, 375, 900);
  const modalObligationDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can recommend an action, state an ordinary or firm requirement, prohibit an action, show that an action is optional, ask about a rule, and move an obligation into past or future time'),
      meaning: body.includes('Get to the root: choose the meaning before the form') &&
        body.includes('Do not treat these forms as three fixed steps on one strength ladder') &&
        body.includes('Must and have to overlap') &&
        body.includes('Context and register matter more than a memorized “inside versus outside authority” rule'),
      form: body.includes('Build two form systems') &&
        body.includes('She should call, not she shoulds call, she should to call, or does she should call') &&
        body.includes('Does she have to call?') && body.includes('does she has to call?'),
      negatives: body.includes('Keep recommendation, prohibition, and choice apart') &&
        body.includes('Must not and its contraction mustn’t mean “do not do it.”') &&
        body.includes('Don’t have to means “it is not necessary,”'),
      time: body.includes('Move requirements through time with have to') &&
        body.includes('Do not say musted or will must') && body.includes('had to') &&
        body.includes('will have to') && body.includes('Didn’t have to says an action was unnecessary'),
      usUsage: body.includes('Must I...? is grammatical') &&
        body.includes('uncommon in ordinary U.S. conversation') &&
        body.includes('can’t and not allowed to are also common ways to express prohibition'),
      spokenForm: body.includes('Sound natural: reduce the frame and stress the action') &&
        body.includes('/ʃəd/') && body.includes('/ˈhæftə/') && body.includes('/ˈhæstə/') &&
        body.includes('Strong stress can change the stance, not the grammar'),
      privacy: body.includes('You never need to disclose your real work, school, home, location, schedule, travel, family, relationships, finances, health, legal status, rules, passwords, or future plans'),
      production: body.includes('Final production: give a 45–60 second fictional event-team briefing') &&
        body.includes('Register switch:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read recommendation, ordinary requirement, prohibition, optional action, past requirement, and rule-question listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(modalObligationDecision.firstGap === "recommendation" && modalObligationDecision.success &&
    /recommendation, ordinary requirement, formal firm requirement, prohibition, optional action, and register framing/i.test(modalObligationDecision.feedback) &&
    modalObligationDecision.outcome && modalObligationDecision.meaning && modalObligationDecision.form &&
    modalObligationDecision.negatives && modalObligationDecision.time && modalObligationDecision.usUsage &&
    modalObligationDecision.spokenForm && modalObligationDecision.privacy && modalObligationDecision.production &&
    modalObligationDecision.listeningScript && modalObligationDecision.retrieval === "#next-day-retrieval" &&
    modalObligationDecision.previous === "/lessons/a2/present-perfect/" &&
    modalObligationDecision.next === "/lessons/a2/quantifiers-much-many-a-lot-of/" && !modalObligationDecision.overflow,
    "Modal obligation preserves meaning-first choice, obligation overlap, form, negative meaning, time, U.S. register, spoken form, listening, navigation, retrieval, privacy, production, and mobile fit");

  const modalObligationRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'must to move' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(modalObligationRetrieval.error && /The recommendation uses should plus the base verb move/i.test(modalObligationRetrieval.first) &&
    /You should move the map beside the entrance/i.test(modalObligationRetrieval.second),
    "Modal-obligation retrieval gives the recommendation-form cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/quantifiers-much-many-a-lot-of/`, 375, 900);
  const quantifierDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can ask about an amount or number, switch between a substance and its countable unit, describe large, small, zero, and excessive quantities, choose a natural spoken or written form, and make the verb agree with the noun'),
      packaging: body.includes('Get to the root: grammar packages the quantity') &&
        body.includes('Countability is not simply a physical property of an object') &&
        body.includes('A unit phrase changes the grammatical package') &&
        body.includes('much advice') && body.includes('many pieces of advice'),
      noncount: body.includes('general noncount meanings in this lesson') &&
        body.includes('information, advice, equipment, and furniture') &&
        body.includes('not informations, advices, equipments, or furnitures'),
      senses: body.includes('One noun can change its package and meaning') &&
        body.includes('We don’t have much coffee') && body.includes('two coffees means two servings or cups'),
      register: body.includes('Choose quantity, sentence environment, and register') &&
        body.includes('Positive many is normal') && body.includes('These are tendencies, not sentence-type laws') &&
        body.includes('A lot of also appears in questions and negatives') &&
        body.includes('too much noise, so much work, as much time as we need') &&
        body.includes('A lot of before a noun; a lot without one'),
      scale: body.includes('Place the quantity on a useful scale') &&
        body.includes('A few and a little mean “some, more than zero”') &&
        body.includes('Bare few and little emphasize a shortage') &&
        body.includes('Too many and too much do not simply mean “a large quantity.”'),
      agreement: body.includes('Let the noun control agreement') &&
        body.includes('A lot of chairs are ready') && body.includes('A lot of equipment is ready'),
      spokenForm: body.includes('Sound natural: link the frame, stress the quantity or noun') &&
        body.includes('/ə ˈlɑɾəv/') && body.includes('/ˈlɑtsəv/') &&
        body.includes('Drop it only when the noun is absent'),
      privacy: body.includes('You never need to disclose your real food, drinks, home, work, school, schedule, location, money, purchases, health, body, family, relationships, travel, belongings, or habits'),
      production: body.includes('Final production: give a 45–60 second fictional supply briefing') &&
        body.includes('Repackage the quantity:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read count question, amount question, large quantity, useful small count, shortage, and countable-serving listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(quantifierDecision.firstGap === "plural count noun" && quantifierDecision.success &&
    /count noun, noncount noun, countable unit, large-quantity phrase, nounless short answer, and written many pattern/i.test(quantifierDecision.feedback) &&
    quantifierDecision.outcome && quantifierDecision.packaging && quantifierDecision.noncount &&
    quantifierDecision.senses && quantifierDecision.register && quantifierDecision.scale &&
    quantifierDecision.agreement && quantifierDecision.spokenForm && quantifierDecision.privacy &&
    quantifierDecision.production && quantifierDecision.listeningScript &&
    quantifierDecision.retrieval === "#next-day-retrieval" &&
    quantifierDecision.previous === "/lessons/a2/modals-should-must-have-to/" &&
    quantifierDecision.next === "/lessons/a2/first-conditional/" && !quantifierDecision.overflow,
    "Quantifiers preserve noun-meaning countability, units, noncount forms, sense shifts, register tendencies, quantity scale, agreement, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const quantifierRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'much bottles of water' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(quantifierRetrieval.error && /Bottles is the plural countable unit, so use many/i.test(quantifierRetrieval.first) &&
    /How many bottles of water do we need/i.test(quantifierRetrieval.second),
    "Quantifier retrieval gives the countable-unit cue before revealing the repaired question");

  await navigate(`${origin}/lessons/a2/first-conditional/`, 375, 900);
  const firstConditionalDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can state an open future condition, choose a prediction, plan, possibility, permission, or instruction as its result, order and punctuate both clauses, distinguish if from expected-time when, and use unless for an exception'),
      meaning: body.includes('Get to the root: one situation activates another') &&
        body.includes('future condition as open and relevant') &&
        body.includes('An open condition is not automatically unlikely') &&
        body.includes('does not promise that its result is objectively “likely.”'),
      form: body.includes('Build the core future pattern without a false absolute') &&
        body.includes('same basic condition-result relationship') &&
        body.includes('information flow and emphasis') &&
        body.includes('Do not put will in the condition clause merely to mark future time') &&
        body.includes('special meanings such as willingness'),
      results: body.includes('Choose a result that matches the speaker’s purpose') &&
        body.includes('may / might') && body.includes('permission or available possibility') &&
        body.includes('imperative'),
      markers: body.includes('Frame the future with if, when, or unless') &&
        body.includes('does not guarantee the event in the real world') &&
        body.includes('same future can be framed differently') && body.includes('Do not add another negative'),
      spokenForm: body.includes('Sound natural: make the condition and response one path') &&
        body.includes('/ɪf jə/') && body.includes('/wil/') && body.includes('/wəl/') &&
        body.includes('second syllable') && body.includes('/ənˈlɛs/'),
      privacy: body.includes('You never need to disclose your real work, school, home, location, schedule, travel, health, finances, family, relationships, safety plans, passwords, weather risks, or future plans'),
      production: body.includes('Final production: give a 45–60 second fictional contingency briefing') &&
        body.includes('Reframe one event:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read open condition, expected time, exception, predicted plan, weaker possibility, and imperative-result listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(firstConditionalDecision.firstGap === "open condition" && firstConditionalDecision.success &&
    /open condition, predicted plan, permission, instruction, expected time event, and exception/i.test(firstConditionalDecision.feedback) &&
    firstConditionalDecision.outcome && firstConditionalDecision.meaning && firstConditionalDecision.form &&
    firstConditionalDecision.results && firstConditionalDecision.markers &&
    firstConditionalDecision.spokenForm && firstConditionalDecision.privacy &&
    firstConditionalDecision.production && firstConditionalDecision.listeningScript &&
    firstConditionalDecision.retrieval === "#next-day-retrieval" &&
    firstConditionalDecision.previous === "/lessons/a2/quantifiers-much-many-a-lot-of/" &&
    firstConditionalDecision.next === "/lessons/a2/adverbs-of-manner/" && !firstConditionalDecision.overflow,
    "First Conditional preserves open condition-result logic, scoped future form, result range, information flow, if-when-unless framing, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit");

  const firstConditionalRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'will start' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(firstConditionalRetrieval.error && /Use present starts in the core future condition/i.test(firstConditionalRetrieval.first) &&
    /If the rain starts, we’ll move inside/i.test(firstConditionalRetrieval.second),
    "First-conditional retrieval gives the future-reference present cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/adverbs-of-manner/`, 375, 900);
  const mannerDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can choose whether a description belongs to a person, thing, state, or action; form common manner adverbs; distinguish well, fast, hard, late, hardly, and lately; place a manner adverb naturally; and use sentence stress to make the intended contrast clear'),
      target: body.includes('Get to the root: choose the target before the form') &&
        body.includes('manner adverb describes how an action is performed') &&
        body.includes('adjective after a linking meaning') && body.includes('Do not decide from the verb alone') &&
        body.includes('The fabric feels soft') && body.includes('Maya felt the edge carefully'),
      form: body.includes('Build common manner forms accurately') &&
        body.includes('consonant + y') && body.includes('consonant + le') &&
        body.includes('many forms ending in -ic') && body.includes('true → truly') && body.includes('full → fully'),
      meaning: body.includes('Keep changed forms and changed meanings apart') &&
        body.includes('flat adverbs') && body.toLowerCase().includes('hardly means almost not') &&
        body.toLowerCase().includes('lately means recently'),
      placement: body.includes('Place the manner without breaking the action') &&
        body.includes('safest neutral pattern') && body.includes('can also appear before the main verb') &&
        body.includes('Do not turn a useful core pattern into an absolute rule') &&
        body.includes('Maya always checks the list carefully'),
      usUsage: body.includes('Use natural U.S. forms without inventing a false ban') &&
        body.includes('Drive safe. Go slow. Hold tight.') && body.includes('recognized expression'),
      spokenForm: body.includes('Sound natural: attach -ly lightly and stress the new contrast') &&
        body.includes('/ˈkɛrfəli/') && body.includes('/ˈkwɪkli/') && body.includes('/ˈizəli/'),
      privacy: body.includes('You never need to disclose your real work, school, home, location, schedule, abilities, performance, health, finances, family, relationships, travel, mistakes, habits, or personal opinions'),
      production: body.includes('Final production: give a 45–60 second fictional observation briefing') &&
        body.includes('Meaning check:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read adjective complement, neutral manner, hard-hardly, late-lately, flat U.S. form, and preverb-manner listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(mannerDecision.firstGap === "entity quality" && mannerDecision.success &&
    /noun and subject qualities from clear, quiet, and careful ways of acting/i.test(mannerDecision.feedback) &&
    mannerDecision.outcome && mannerDecision.target && mannerDecision.form && mannerDecision.meaning &&
    mannerDecision.placement && mannerDecision.usUsage && mannerDecision.spokenForm &&
    mannerDecision.privacy && mannerDecision.production && mannerDecision.listeningScript &&
    mannerDecision.retrieval === "#next-day-retrieval" &&
    mannerDecision.previous === "/lessons/a2/first-conditional/" &&
    mannerDecision.next === "/lessons/a2/verb-infinitive-ing/" && !mannerDecision.overflow,
    `Adverbs of manner preserves description targets, linking and action meaning, spelling, changed forms, nonabsolute placement, U.S. flat usage, speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(mannerDecision)})`);

  const mannerBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'coordinator', 'explained', 'the', 'safety', 'steps', 'clearly']) {
      const tile = tiles.find((candidate) => !candidate.disabled && candidate.dataset.buildTile === value);
      tile.click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(mannerBuilder.built === "The coordinator explained the safety steps clearly" && mannerBuilder.success &&
    /short object stays beside explained/i.test(mannerBuilder.feedback),
    "the manner sentence builder supports two identical article tiles and validates neutral verb-object-adverb order");

  const mannerRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'clearly' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(mannerRetrieval.error && /The linking meaning of sound takes the adjective clear/i.test(mannerRetrieval.first) &&
    /The instructions sound clear/i.test(mannerRetrieval.second),
    "manner retrieval gives the linking-complement cue before revealing the adjective repair");

  await navigate(`${origin}/lessons/a2/verb-infinitive-ing/`, 375, 900);
  const verbComplementDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can use common verb + to + base and verb + -ing chunks; add a person who performs the second action; place negation accurately; distinguish infinitive to from prepositional to; and interpret useful meaning contrasts with stop, remember, and try'),
      root: body.includes('Get to the root: store the whole pattern with the verb') &&
        body.includes('first verb allows one or more shapes') &&
        body.includes('meaning tendency can help memory, but it cannot safely predict an unfamiliar verb') &&
        body.includes('avoid making') && body.includes('future goal'),
      form: body.includes('Let the first verb carry tense, agreement, questions, and main negation') &&
        body.includes('Do not add tense or agreement again to the second verb') &&
        body.includes('She enjoys teaching') && body.includes('she enjoys is teaching'),
      participant: body.includes('Name the second performer and place negation precisely') &&
        body.includes('Maya asked Leo to test it') && body.includes('Maya told Leo not to open it') &&
        body.includes('Maya did not decide to cancel') && body.includes('Maya decided not to cancel'),
      twoTo: body.includes('Two kinds of to') && body.includes('plan to meet') &&
        body.includes('look forward to meeting') && body.includes('every to takes a base verb'),
      meaning: body.includes('When both shapes are possible, check the meaning') &&
        body.includes('Many contexts overlap') &&
        body.includes('both forms are often possible with little practical difference') &&
        body.includes('Do not force a difference where context does not support one') &&
        body.includes('Three high-value meaning contrasts') && body.includes('stop doing') &&
        body.includes('stop to do') && body.includes('remember to do') && body.includes('remember doing') &&
        body.includes('try to do') && body.includes('try doing'),
      spokenForm: body.includes('Sound natural: weaken infinitive to, keep -ing nasal, and stress the contrast') &&
        body.includes('/tə/') && body.includes('/ˈwɑnə/') && body.includes('standard spelling') &&
        body.includes('remove a person') && body.includes('/ɪŋ/') && body.includes('/ˈwɝkɪŋ/'),
      privacy: body.includes('You never need to disclose your real work, school, home, location, schedule, goals, hobbies, abilities, performance, health, finances, family, relationships, travel, mistakes, habits, or plans'),
      production: body.includes('Final production: give a 45–60 second fictional workshop update') &&
        body.includes('Meaning check:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read core complement, second performer, complement negation, prepositional to, stopped activity, and experimental try listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(verbComplementDecision.firstGap === "to-infinitive complement" && verbComplementDecision.success &&
    /to-infinitive, -ing complement, person plus infinitive, negative infinitive, prepositional to, and ended activity/i.test(verbComplementDecision.feedback) &&
    verbComplementDecision.outcome && verbComplementDecision.root && verbComplementDecision.form &&
    verbComplementDecision.participant && verbComplementDecision.twoTo && verbComplementDecision.meaning &&
    verbComplementDecision.spokenForm && verbComplementDecision.privacy &&
    verbComplementDecision.production && verbComplementDecision.listeningScript &&
    verbComplementDecision.retrieval === "#next-day-retrieval" &&
    verbComplementDecision.previous === "/lessons/a2/adverbs-of-manner/" &&
    verbComplementDecision.next === "/lessons/a2/travel-and-transport/" && !verbComplementDecision.overflow,
    `Verb complement lesson preserves stored patterns, performers, negation, two kinds of to, changed meanings, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(verbComplementDecision)})`);

  const verbComplementBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['maya', 'asked', 'leo', 'to', 'test', 'the', 'projector']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(verbComplementBuilder.built === "Maya asked Leo to test the projector" &&
    verbComplementBuilder.success && /Leo stands before to test/i.test(verbComplementBuilder.feedback),
    "the verb-complement sentence builder preserves the second performer before the to-infinitive");

  const verbComplementRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'to solve' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(verbComplementRetrieval.error && /Enjoy takes an -ing complement: solving/i.test(verbComplementRetrieval.first) &&
    /Leo enjoys solving technical problems/i.test(verbComplementRetrieval.second),
    "verb-complement retrieval gives the stored enjoy pattern before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/travel-and-transport/`, 375, 900);
  const travelDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can say how someone travels; say where someone is in relation to a vehicle; distinguish travel, trip, and journey; navigate a station or airport; understand a short travel announcement; and explain a delay or missed connection'),
      viewpoint: body.includes('Get to the root: choose the travel viewpoint') &&
        body.includes('Do not choose a preposition only from the object’s size') &&
        body.includes('by + mode') && body.includes('on foot') &&
        body.includes('shared or ride-on vehicle') && body.includes('specific car or taxi') &&
        body.includes('conventional, not a perfect physical rule') && body.includes('Bicycles and motorcycles'),
      vocabulary: body.includes('Name the trip, route, and place precisely') &&
        body.includes('public transportation') && body.includes('transit') &&
        body.includes('subway station') && body.includes('bus stop') &&
        body.includes('platform') && body.includes('terminal') && body.includes('gate') &&
        body.includes('one piece of luggage'),
      journey: body.includes('Build the journey from action chunks') &&
        body.includes('Take a train') && body.includes('Catch the 7:15 train') &&
        body.includes('Miss the 7:15 train') && body.includes('arrive in Denver') &&
        body.includes('arrive at the hotel') && body.includes('airport path is useful, but it is not universal'),
      spokenForm: body.includes('Sound natural: hear the content words in fast travel messages') &&
        body.includes('/flaɪt/') && body.includes('gate eighteen') &&
        body.includes('EIGHTy minutes') && body.includes('/ɡɛt ˈaʊɾəv/'),
      privacy: body.includes('You never need to disclose your real home, location, route, schedule, workplace, school, travel plans, documents, finances, health, family, safety concerns, or booking details'),
      production: body.includes('Final production: give a 45–60 second fictional travel briefing') &&
        body.includes('Clarify important information:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read destination, departure time, platform, gate change, delay, and replacement-service listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(travelDecision.firstGap === "general travel mode" && travelDecision.success &&
    /mode, vehicle location, vehicle movement, schedule change, and destination/i.test(travelDecision.feedback) &&
    travelDecision.outcome && travelDecision.viewpoint && travelDecision.vocabulary &&
    travelDecision.journey && travelDecision.spokenForm && travelDecision.privacy &&
    travelDecision.production && travelDecision.listeningScript &&
    travelDecision.retrieval === "#next-day-retrieval" &&
    travelDecision.previous === "/lessons/a2/verb-infinitive-ing/" &&
    travelDecision.next === "/lessons/a2/health-and-the-body/" && !travelDecision.overflow,
    `Travel lesson preserves viewpoint, vehicle patterns, trip vocabulary, wayfinding, journey chunks, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(travelDecision)})`);

  const travelBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['nia', 'is', 'on', 'the', 'airport', 'bus', 'now']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(travelBuilder.built === "Nia is on the airport bus now" && travelBuilder.success &&
    /locates Nia on one specific vehicle/i.test(travelBuilder.feedback),
    "the travel sentence builder preserves the specific-vehicle location viewpoint");

  const travelRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'on the bus' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(travelRetrieval.error && /General mode uses by plus transport with no article/i.test(travelRetrieval.first) &&
    /Nia usually travels by bus/i.test(travelRetrieval.second),
    "travel retrieval gives the mode viewpoint before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/health-and-the-body/`, 375, 900);
  const healthDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can describe common symptoms and body locations; say when a problem started and how long it has continued; report severity; answer common health questions; distinguish general advice from reported instructions; and use direct language to request urgent help'),
      boundary: body.includes('Communication lesson, not medical advice') &&
        body.includes('cannot diagnose a condition') &&
        body.includes('health care professional or medicine label supplies the medical instruction'),
      patterns: body.includes('Get to the root: report observations, not a diagnosis') &&
        body.includes('have + symptom noun') && body.includes('feel + adjective') &&
        body.includes('body part + hurt') && body.includes('have pain in + location') &&
        body.includes('Have does not always require a'),
      bodyLanguage: body.includes('Locate the problem with useful body groups') &&
        body.includes('head and face') && body.includes('upper body') &&
        body.includes('arm and hand') && body.includes('leg and foot') &&
        body.includes('inside the body') && body.includes('feet') && body.includes('teeth'),
      intake: body.includes('Add onset, duration, severity, and useful questions') &&
        body.includes('What brings you in today?') && body.includes('Where does it hurt?') &&
        body.includes('When did it start?') && body.includes('How long have you had it?') &&
        body.includes('How bad is the pain from zero to ten?') &&
        body.includes('Are you allergic to any medicines?'),
      safety: body.includes('Advice, instructions, and urgent help are different messages') &&
        body.includes('Do not invent a medicine, dose, or treatment') &&
        body.includes('A normal health-care path is not always the same') &&
        body.includes('fills a prescription') && body.includes('Urgent-help language') &&
        body.includes('call 911') && body.includes('local emergency number') &&
        body.includes('I’m having trouble breathing') && body.includes('I have severe chest pain') &&
        body.includes('She fainted') && body.includes('The bleeding won’t stop') &&
        body.includes('He is suddenly confused') &&
        document.querySelector('a[href="https://medlineplus.gov/ency/article/001927.htm"]')?.textContent.includes('MedlinePlus'),
      spokenForm: body.includes('Sound natural: stress the new health information') &&
        body.includes('/eɪk/') && body.includes('/ˈstʌmək/') &&
        body.includes('/ˈmɛdəsən/') && body.includes('/fɚ/') &&
        body.includes('It started on MONday, not Sunday'),
      privacy: body.includes('You never need to disclose your real health, body, symptoms, medicines, allergies, medical history, disability, mental health, pregnancy, family, workplace, school, location, contact information, or emergency experience'),
      production: body.includes('Final production: give a 45–60 second fictional clinic intake') &&
        body.includes('Do not diagnose the cause or invent a treatment') &&
        body.includes('Clarify and reformulate:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read symptom, location, onset, duration, allergy, and urgent-help listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(healthDecision.firstGap === "countable symptom" && healthDecision.success &&
    /countable symptom, feeling, pain location, onset, duration to now, and severity report/i.test(healthDecision.feedback) &&
    healthDecision.outcome && healthDecision.boundary && healthDecision.patterns &&
    healthDecision.bodyLanguage && healthDecision.intake && healthDecision.safety &&
    healthDecision.spokenForm && healthDecision.privacy && healthDecision.production &&
    healthDecision.listeningScript && healthDecision.retrieval === "#next-day-retrieval" &&
    healthDecision.previous === "/lessons/a2/travel-and-transport/" &&
    healthDecision.next === "/lessons/a2/town-and-directions/" && !healthDecision.overflow,
    `Health lesson preserves language-only scope, symptom patterns, body location, onset, duration, intake questions, urgent-help wording, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(healthDecision)})`);

  const healthBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ["i've", 'had', 'this', 'cough', 'for', 'three', 'days']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(healthBuilder.built === "I’ve had this cough for three days" && healthBuilder.success &&
    /connects the continuing cough to now/i.test(healthBuilder.feedback),
    "the health sentence builder preserves present-perfect duration to now");

  const healthRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'have' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(healthRetrieval.error && /Use present perfect have had before the continuing symptom/i.test(healthRetrieval.first) &&
    /I have had this cough since Monday/i.test(healthRetrieval.second),
    "health retrieval gives the duration-to-now cue before revealing the repaired sentence");

  await navigate(`${origin}/lessons/a2/town-and-directions/`, 375, 900);
  const directionsDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can ask for directions politely; give an ordered walking route from a clear start point; distinguish movement from location; name an exact turn point and landmark; locate the destination from the traveler’s viewpoint; and confirm or repair a misunderstood step'),
      routeSystem: body.includes('Get to the root: build from viewpoint to destination') &&
        body.includes('traveler’s current viewpoint') &&
        body.includes('establish') && body.includes('move') &&
        body.includes('change direction') && body.includes('verify') &&
        body.includes('arrive') && body.includes('recover') &&
        body.includes('not a bag of interchangeable commands'),
      movement: body.includes('Choose a movement or a location relationship') &&
        body.includes('walk along Oak Street') && body.includes('turn onto Pine Avenue') &&
        body.includes('go past the bank') && body.includes('cross Pine Avenue') &&
        body.includes('across from the park') && body.includes('Passed is the past-tense verb') &&
        body.includes('Its length varies'),
      clarification: body.includes('Ask, check, and repair directions politely') &&
        body.includes('Excuse me, where is the museum?') &&
        body.includes('Excuse me, how do I get to the museum?') &&
        body.includes('How far is it?') &&
        body.includes('Could you repeat that more slowly, please?') &&
        body.includes('Did you say the first or second traffic light?') &&
        body.includes('Pine Avenue, not Pine Street.'),
      reference: body.includes('Keep route order and reference precise') &&
        body.includes('first, then, after that') && body.includes('two landmarks could be it') &&
        body.includes('Use at for the turn point and onto for the street entered'),
      spokenForm: body.includes('Sound natural: stress the decision points and chunk the route') &&
        body.includes('/streɪt/') && body.includes('/lɛft/') && body.includes('/raɪt/') &&
        body.includes('/haʊ də aɪ ɡɛt tə ðə mjuˈziəm/') && body.includes('/əˈkrɔs/') &&
        body.includes('the SECOND light, not the first'),
      privacy: body.includes('You never need to disclose your real home, current location, workplace, school, commute, daily route, neighborhood, favorite places, travel plans, safety habits, schedule, or another person’s address'),
      production: body.includes('Final production: give a 45–60 second fictional visitor route') &&
        body.includes('Meaning check:'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read start point, turn number, entered street, passed landmark, destination location, and corrected detail listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(directionsDecision.firstGap === "start point and viewpoint" && directionsDecision.success &&
    /start viewpoint, movement, turn point, passed landmark, destination location, and too-far check/i.test(directionsDecision.feedback) &&
    directionsDecision.outcome && directionsDecision.routeSystem && directionsDecision.movement &&
    directionsDecision.clarification && directionsDecision.reference && directionsDecision.spokenForm &&
    directionsDecision.privacy && directionsDecision.production && directionsDecision.listeningScript &&
    directionsDecision.retrieval === "#next-day-retrieval" &&
    directionsDecision.previous === "/lessons/a2/health-and-the-body/" &&
    directionsDecision.next === "/lessons/a2/past-time-expressions/" && !directionsDecision.overflow,
    `Town directions lesson preserves viewpoint, executable order, movement and location, clarification, reference, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(directionsDecision)})`);

  const directionsBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['turn', 'left', 'at', 'the', 'second light', 'onto', 'pine avenue']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(directionsBuilder.built === "Turn left at the second light onto Pine Avenue" && directionsBuilder.success &&
    /turn side, exact point, and street entered/i.test(directionsBuilder.feedback),
    "the directions sentence builder preserves side, ordinal turn point, and entered street");

  const directionsRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'passed' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(directionsRetrieval.error && /After go, use past for movement beyond a landmark/i.test(directionsRetrieval.first) &&
    /Go past the library and keep walking/i.test(directionsRetrieval.second),
    "directions retrieval gives the passed-landmark form cue before revealing the repaired instruction");

  await navigate(`${origin}/lessons/a2/past-time-expressions/`, 375, 900);
  const pastTimeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can establish a clear past reference time; distinguish a finished point from duration, sequence, and overlap') &&
        body.includes('combine time expressions naturally with past simple, past continuous, and present perfect'),
      reference: body.includes('Get to the root: every expression needs a reference time') &&
        body.includes('the moment of speaking') && body.includes('another past event') &&
        body.includes('Ago and before are not interchangeable') &&
        body.includes('Earlier works only when the context makes its reference clear'),
      precision: body.includes('Locate a finished point precisely') &&
        body.includes('last night, not yesterday night') &&
        body.includes('Last week means the calendar week before the current one') &&
        body.includes('The last week is grammatical') &&
        body.includes('Last Monday can be unclear') && body.includes('use the date'),
      sequence: body.includes('Order events and keep the reference clear') &&
        body.includes('first, then, after that, later') && body.includes('finally') &&
        body.includes('before what?') && body.includes('later than what?'),
      duration: body.includes('Separate point, duration, endpoint, and overlap') &&
        body.includes('for + amount of time') && body.includes('from + start + to + end') &&
        body.includes('until + endpoint') && body.includes('by + point') &&
        body.includes('during + noun phrase') && body.includes('while + clause'),
      viewpoint: body.includes('Neither word automatically chooses past simple or past continuous') &&
        body.includes('A duration does not tell us whether a situation continues now') &&
        body.includes('this morning can be an open or closed reporting period'),
      spokenForm: body.includes('Sound natural: stress the reference and link the frame') &&
        body.includes('/ˈjɛstɚdeɪ/') && body.includes('/əˈgoʊ/') &&
        body.includes('/ə ˈwik əˈgoʊ/') && body.includes('/ˈdɪdʒə/') &&
        body.includes('TWO weeks ago, not last week'),
      privacy: body.includes('You never need to disclose your real work, home, schedule, travel, health, family, or personal history'),
      production: body.includes('Final production: give a 45–60 second fictional event timeline') &&
        body.includes('Can the listener reconstruct the order and time relationships without guessing?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read reference point, relative sequence, duration, deadline, overlap, and continuing-to-now listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pastTimeDecision.firstGap === "reference day" && pastTimeDecision.success &&
    /reference day, two event points, sequence, duration, and overlap/i.test(pastTimeDecision.feedback) &&
    pastTimeDecision.outcome && pastTimeDecision.reference && pastTimeDecision.precision &&
    pastTimeDecision.sequence && pastTimeDecision.duration && pastTimeDecision.viewpoint &&
    pastTimeDecision.spokenForm && pastTimeDecision.privacy && pastTimeDecision.production &&
    pastTimeDecision.listeningScript && pastTimeDecision.retrieval === "#next-day-retrieval" &&
    pastTimeDecision.previous === "/lessons/a2/town-and-directions/" &&
    pastTimeDecision.next === "/lessons/a2/feelings-and-personality/" && !pastTimeDecision.overflow,
    `Past-time expressions preserves reference anchoring, precision, sequence, duration, overlap, tense viewpoint, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(pastTimeDecision)})`);

  const pastTimeBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'delivery', 'arrived', 'two', 'days', 'before', 'the', 'workshop']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(pastTimeBuilder.built === "The delivery arrived two days before the workshop" &&
    pastTimeBuilder.success && /Before measures the delivery time from the later workshop event/i.test(pastTimeBuilder.feedback),
    "the past-time sentence builder preserves a measured relationship to another past event");

  const pastTimeRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The package arrived two days ago.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pastTimeRetrieval.error && /The event is the reference point, so measure backward from it/i.test(pastTimeRetrieval.first) &&
    /The package arrived two days before the event/i.test(pastTimeRetrieval.second),
    "past-time retrieval gives the reference-point cue before revealing the repaired relative-time sentence");

  await navigate(`${origin}/lessons/a2/feelings-and-personality/`, 375, 900);
  const feelingsDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can describe a current or past feeling; distinguish an experiencer from a stimulus') &&
        body.includes('replace an unsupported label with an observable behavior'),
      root: body.includes('Get to the root: describe state, reaction, tendency, or behavior') &&
        body.includes('be / feel + adjective') && body.includes('experiencer + -ed') &&
        body.includes('stimulus + -ing') && body.includes('usually / often / can be + adjective') &&
        body.includes('Feel like is a different pattern') &&
        body.includes('A feeling word is not automatically temporary, and a personality word is not automatically permanent'),
      roles: body.includes('Choose the experiencer or the stimulus') &&
        body.includes('not “person versus thing.”') &&
        body.includes('A person can therefore be interesting, boring, encouraging, or surprising') &&
        body.includes('A group or organization can be interested'),
      complements: body.includes('Add the complement and degree') &&
        body.includes('interested in, excited about, worried about, nervous about') &&
        body.includes('Choose degree from evidence, not drama'),
      evidence: body.includes('Describe tendencies with evidence and limits') &&
        body.includes('quiet does not automatically mean shy, unfriendly, or unhappy') &&
        body.includes('fun means enjoyable') && body.includes('one late task does not prove laziness') &&
        body.includes('describe the behavior before applying a label') &&
        body.includes('Avoid diagnosing a feeling from appearance alone'),
      questions: body.includes('Ask the question you actually mean') &&
        body.includes('How is Maya feeling?') && body.includes('What’s Maya like?') &&
        body.includes('What does Maya like?') && body.includes('What does Maya look like?') &&
        body.includes('What’s she like to work with?'),
      spokenForm: body.includes('Sound natural: let endings, stress, and questions carry the contrast') &&
        body.includes('/bɔrd/') && body.includes('/ɪmˈbærəst/') &&
        body.includes('/ˈɪntrəstɪd/') && body.includes('/ɪkˈsaɪtɪd/') &&
        body.includes('/haʊɚjə ˈfilɪŋ/') && body.includes('INTERESTED, not that I was INTERESTING'),
      privacy: body.includes('You never need to disclose your real feelings, mental health, personality, relationships, family, workplace, coworkers, home, schedule, or personal history'),
      production: body.includes('Final production: give a 45–60 second fictional team introduction') &&
        body.includes('Can the listener see the evidence and limit for every personality description?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read current feeling, stimulus, evidence, limited tendency, question purpose, and role-repair listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(feelingsDecision.firstGap === "past feeling" && feelingsDecision.success &&
    /past feeling, stimulus, experiencer reaction, general tendency, observed behavior, and stated preference/i.test(feelingsDecision.feedback) &&
    feelingsDecision.outcome && feelingsDecision.root && feelingsDecision.roles &&
    feelingsDecision.complements && feelingsDecision.evidence && feelingsDecision.questions &&
    feelingsDecision.spokenForm && feelingsDecision.privacy && feelingsDecision.production &&
    feelingsDecision.listeningScript && feelingsDecision.retrieval === "#next-day-retrieval" &&
    feelingsDecision.previous === "/lessons/a2/past-time-expressions/" &&
    feelingsDecision.next === "/lessons/a2/technology-and-devices/" && !feelingsDecision.overflow,
    `Feelings and personality preserves state, experiencer-stimulus roles, complements, degree, evidence limits, question purpose, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(feelingsDecision)})`);

  const feelingsBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'volunteers', 'were', 'interested', 'because', 'the', 'guide', 'was', 'interesting']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(feelingsBuilder.built === "The volunteers were interested because the guide was interesting" &&
    feelingsBuilder.success && /volunteers experience interest, and the guide creates that interest/i.test(feelingsBuilder.feedback),
    "the feelings sentence builder preserves experiencer and stimulus meaning with duplicate article tiles");

  const feelingsRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'interesting about the project' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(feelingsRetrieval.error && /person experiences attention toward a topic, so use the -ed form with in/i.test(feelingsRetrieval.first) &&
    /Nora is interested in the project/i.test(feelingsRetrieval.second),
    "feelings retrieval gives the experiencer and complement cue before revealing the repaired adjective chunk");

  await navigate(`${origin}/lessons/a2/technology-and-devices/`, 375, 900);
  const technologyDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can distinguish a device from an app, account, network, and file') &&
        body.includes('ask for a safe next step; and refuse requests for passwords or verification codes'),
      layers: body.includes('Get to the root: name the technology layer') &&
        body.includes('hardware device or part') && body.includes('app or software') &&
        body.includes('connection or network') && body.includes('account or access') &&
        body.includes('file or location') && body.includes('Report the symptom before diagnosing the cause'),
      actions: body.includes('Keep the action and result distinct') &&
        body.includes('download a file') && body.includes('upload a file') &&
        body.includes('download an app') && body.includes('install the app') &&
        body.includes('save the document') && body.includes('back up the document') &&
        body.includes('restart the device') && body.includes('reset the device') &&
        body.includes('Restart and reset are not synonyms') && body.includes('may erase information'),
      objects: body.includes('Place the object inside the correct chunk') &&
        body.includes('turn on the laptop') && body.includes('turn the laptop on') &&
        body.includes('turn it on, not turn on it') && body.includes('log in to your account') &&
        body.includes('connect to the network') && body.includes('search for the file') &&
        body.includes('send me the link') && body.includes('send the link to me'),
      symptoms: body.includes('Report the symptom and scope before the solution') &&
        body.includes('The screen is frozen') && body.includes('The page will not load') &&
        body.includes('The battery is not charging') &&
        body.includes('It is not a prediction here'),
      safety: body.includes('Safety boundary: protect the device and the account') &&
        body.includes('Do not share a real password, PIN, or verification code') &&
        body.includes('Do not open an unexpected link or attachment') &&
        body.includes('stop using and charging the device') &&
        body.includes('Do not attempt a battery repair') &&
        body.includes('Do not reset a device, erase data, install unknown software, or change security settings'),
      spokenForm: body.includes('Sound natural: stress the failed action and link the command') &&
        body.includes('/ˈwaɪfaɪ/') && body.includes('/dɪˈvaɪs/') &&
        body.includes('/ˈpæsˌwɝd/') && body.includes('/ˈɛrɚ/') &&
        body.includes('won’t /woʊnt/') && body.includes('want /wɑnt/') &&
        body.includes('/kənjə/') && body.includes('/kʊdʒə/'),
      privacy: body.includes('You never need to disclose your real devices, employer, school, network name, email, username, password, PIN, verification code, files, messages, contacts, location, or account history'),
      production: body.includes('Final production: give a 45–60 second fictional support report') &&
        body.includes('Can the listener identify what works, what fails, what was already tried, and what remains unknown?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read device, attempted action, symptom, scope, exact message, and safe account response listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(technologyDecision.firstGap === "device and location" && technologyDecision.success &&
    /device and location, attempted action, observable symptom, time, scope check, and exact message/i.test(technologyDecision.feedback) &&
    technologyDecision.outcome && technologyDecision.layers && technologyDecision.actions &&
    technologyDecision.objects && technologyDecision.symptoms && technologyDecision.safety &&
    technologyDecision.spokenForm && technologyDecision.privacy && technologyDecision.production &&
    technologyDecision.listeningScript && technologyDecision.retrieval === "#next-day-retrieval" &&
    technologyDecision.previous === "/lessons/a2/feelings-and-personality/" &&
    technologyDecision.next === "/lessons/a2/education-and-study/" && !technologyDecision.overflow,
    `Technology and devices preserves support evidence, technology layers, action-result contrasts, object placement, symptom scope, account and battery safety, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(technologyDecision)})`);

  const technologyBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'app', 'will', 'not', 'open', 'but', 'other', 'apps', 'work']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(technologyBuilder.built === "The app will not open but other apps work" &&
    technologyBuilder.success && /observable symptom and limits the scope with a comparison/i.test(technologyBuilder.feedback),
    "the technology sentence builder preserves a failed action and unaffected-app comparison");

  const technologyRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Please turn on it.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(technologyRetrieval.error && /pronoun it belongs between the separable verb and particle/i.test(technologyRetrieval.first) &&
    /Please turn it on/i.test(technologyRetrieval.second),
    "technology retrieval gives the pronoun-placement cue before revealing the repaired separable command");

  await navigate(`${origin}/lessons/a2/education-and-study/`, 375, 900);
  const educationDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      outcome: body.includes('By the end, you can distinguish a subject, course, class, lesson, program, and qualification') &&
        body.includes('report specific evidence of progress; ask for the exact clarification you need'),
      path: body.includes('Get to the root: locate each word on the learning path') &&
        body.includes('Education systems use some labels differently') &&
        body.includes('an area of knowledge or skill') &&
        body.includes('an organized series of study with goals or requirements') &&
        body.includes('a scheduled meeting, group, or course in everyday U.S. English') &&
        body.includes('one teaching unit or focus') &&
        body.includes('an organized set of related courses or activities') &&
        body.includes('Certificate, diploma, and degree are not automatic synonyms'),
      results: body.includes('Keep enrollment, participation, and results distinct') &&
        body.includes('sign up for / register for / enroll in a course') &&
        body.includes('take a course · attend class') &&
        body.includes('do homework · complete / submit an assignment · study for an exam') &&
        body.includes('taking an exam does not state its result') &&
        body.includes('completing requirements and meeting the required standard are different ideas') &&
        body.includes('homework is normally noncount') && body.includes('assignment is countable') &&
        body.includes('A score often gives points or a percentage') &&
        body.includes('Feedback gives comments about what works and what to improve'),
      learning: body.includes('Separate study, learn, teach, practice, and review') &&
        body.includes('Study does not guarantee that learning happened') &&
        body.includes('learn is not limited to a completed result') &&
        body.includes('teach someone something') && body.includes('teach something to someone'),
      evidence: body.includes('Use evidence and ask for the exact help you need') &&
        body.includes('I studied a lot reports effort') &&
        body.includes('It does not by itself show progress') &&
        body.includes('Last month I needed four prompts; today I needed one') &&
        body.includes('I understand the first step, but what does “compare the results” mean?') &&
        body.includes('Could you repeat that more slowly?') &&
        body.includes('When is the assignment due?'),
      spokenForm: body.includes('Sound natural: stress the learning result and link the question') &&
        body.includes('/kɔrs/') && body.includes('/lɝn/') && body.includes('/ˈstʌdi/') &&
        body.includes('/ˌɛdʒəˈkeɪʃən/') && body.includes('/əˈsaɪnmənt/') &&
        body.includes('/ˈprɑɡrɛs/') && body.includes('/kʊdʒə/') && body.includes('/wɛr ʃədaɪ/'),
      privacy: body.includes('You never need to disclose your real school, employer, program, teacher, transcript, scores, grades, qualification, funding, disability, immigration status, schedule, or learning history'),
      production: body.includes('Final production: give a 45–60 second fictional learning update') &&
        body.includes('Can the listener distinguish effort from progress, identify what the learner can do now, and understand the exact support still needed?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read learning goal, course-class distinction, study action, progress evidence, feedback, and clarification check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(educationDecision.firstGap === "learning goal" && educationDecision.success &&
    /goal, course and program, study routine, progress evidence, current gap, and next step/i.test(educationDecision.feedback) &&
    educationDecision.outcome && educationDecision.path && educationDecision.results &&
    educationDecision.learning && educationDecision.evidence && educationDecision.spokenForm &&
    educationDecision.privacy && educationDecision.production && educationDecision.listeningScript &&
    educationDecision.retrieval === "#next-day-retrieval" &&
    educationDecision.previous === "/lessons/a2/technology-and-devices/" &&
    educationDecision.next === "/lessons/a2/phrasal-verbs/" && !educationDecision.overflow,
    `Education and study preserves learning-path roles, enrollment-result distinctions, homework countability, learning-action meaning, progress evidence, classroom repair, U.S. speech, listening, navigation, retrieval, privacy, production, and mobile fit (observed ${JSON.stringify(educationDecision)})`);

  const educationBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['i', 'study', 'for', 'thirty', 'minutes', 'and', 'then', 'practice', 'one', 'update']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(educationBuilder.built === "I study for thirty minutes and then practice one update" &&
    educationBuilder.success && /Study presents time with the material, and practice presents the repeated performance/i.test(educationBuilder.feedback),
    "the education sentence builder preserves study activity and repeated performance");

  const educationRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The course has two homeworks this week.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(educationRetrieval.error && /Homework is noncount; assignment provides the countable unit after two/i.test(educationRetrieval.first) &&
    /The course has two homework assignments this week/i.test(educationRetrieval.second),
    "education retrieval gives the countability cue before revealing the repaired homework unit");

  await navigate(`${origin}/lessons/a2/phrasal-verbs/`, 375, 900);
  const phrasalVerbDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((candidate) => candidate.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.innerText;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('By the end, you can treat a common multiword verb as one meaning unit') &&
        body.includes('distinguish chunks used without an object, separable chunks, and chunks that stay together'),
      storage: body.includes('Get to the root: store four facts, not two words') &&
        body.includes('whole chunk') && body.includes('meaning in one context') &&
        body.includes('object pattern') && body.includes('complete example') &&
        body.includes('The main verb carries tense and agreement; the particle stays the same') &&
        body.includes('return the main verb to its base form'),
      taxonomy: body.includes('A practical label, not a false grammar rule') &&
        body.includes('Some grammar books label combinations'),
      noObject: body.includes('Pattern 1: no object in the meaning used here') &&
        body.includes('A following time, place, or manner phrase is not a movable object'),
      separable: body.includes('Pattern 2: a separable chunk has two noun positions') &&
        body.includes('turn off the projector · turn the projector off') &&
        body.includes('turn it off, not turn off it'),
      fixed: body.includes('Pattern 3: keep the chunk together before its object') &&
        body.includes('look for the sheets · look for them'),
      polysemy: body.includes('Let context select the meaning and register') &&
        body.includes('pick the box up') && body.includes('pick up the box at the desk') &&
        body.includes('take your coat off') && body.includes('the plane took off') &&
        body.includes('turn the music down') && body.includes('turn the invitation down') &&
        body.includes('Do you mean lift the box or collect it from the desk?'),
      register: body.includes('Register: common does not mean careless') &&
        body.includes('neutral in everyday U.S. English') &&
        body.includes('complete the form, power off the equipment, return the call') &&
        body.includes('Do not replace every phrasal verb mechanically'),
      spokenForm: body.includes('Sound natural: stress meaning, not a memorized particle rule') &&
        body.includes('/kənjə/') && body.includes('/dɪdʒə/') && body.includes('Actual stress changes'),
      privacy: body.includes('You never need to disclose your real home, workplace, route, travel time, phone number, address, form data, password, health information, habits, family, or daily schedule'),
      production: body.includes('Final production: give a 45–60 second fictional workshop handoff') &&
        body.includes('Can the listener identify each intended result, recover every object, and hear why its position is accurate?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read collection, object placement, fixed chunk, polysemy, register, and clarification listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(phrasalVerbDecision.firstGap === "collect an item" && phrasalVerbDecision.success &&
    /pick up, write down, look for, turn on, call back, and throw away/i.test(phrasalVerbDecision.feedback) &&
    phrasalVerbDecision.outcome && phrasalVerbDecision.storage && phrasalVerbDecision.taxonomy &&
    phrasalVerbDecision.noObject && phrasalVerbDecision.separable && phrasalVerbDecision.fixed &&
    phrasalVerbDecision.polysemy && phrasalVerbDecision.register && phrasalVerbDecision.spokenForm &&
    phrasalVerbDecision.privacy && phrasalVerbDecision.production && phrasalVerbDecision.listeningScript &&
    phrasalVerbDecision.retrieval === "#next-day-retrieval" &&
    phrasalVerbDecision.previous === "/lessons/a2/education-and-study/" &&
    phrasalVerbDecision.next === null && !phrasalVerbDecision.overflow,
    `Phrasal verbs preserves meaning units, tense, the three object patterns, polysemy, register, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(phrasalVerbDecision)})`);

  const phrasalVerbBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['please', 'write', 'the', 'room', 'number', 'down']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(phrasalVerbBuilder.built === "Please write the room number down" &&
    phrasalVerbBuilder.success && /noun object sits inside the separable chunk write down/i.test(phrasalVerbBuilder.feedback),
    "the phrasal-verb sentence builder preserves an accurate separable noun position");

  const phrasalVerbRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Please turn off it.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(phrasalVerbRetrieval.error &&
    /pronoun it belongs between the separable main verb and particle/i.test(phrasalVerbRetrieval.first) &&
    /Please turn it off\./i.test(phrasalVerbRetrieval.second),
    "phrasal-verb retrieval gives the separable-pronoun cue before revealing the accurate repair");

  await navigate(`${origin}/lessons/b1/present-perfect-continuous/`, 375, 900);
  const presentPerfectContinuousDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((candidate) => candidate.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.innerText;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('By the end, you can form positive, negative, and question patterns') &&
        body.includes('distinguish an activity that continues from one that has just stopped'),
      activityBoundary: body.includes('Get to the root: choose an activity viewpoint') &&
        body.includes('The form alone does not prove that the activity continues at this exact second') &&
        body.includes('I’ve been painting, and I’m still painting') &&
        body.includes('I’ve been painting, but I just stopped'),
      form: body.includes('subject + have / has been + -ing') &&
        body.includes('subject + haven’t / hasn’t been + -ing') &&
        body.includes('Have / Has + subject + been + -ing?') &&
        body.includes('How long + have / has + subject + been + -ing?'),
      uses: body.includes('Five common uses, one connection to now') &&
        body.includes('activity continuing now') && body.includes('repeated activity') &&
        body.includes('recent activity with evidence') && body.includes('temporary current situation') &&
        body.includes('negative recent pattern'),
      lenses: body.includes('Choose the time lens, not a nearby signal word') &&
        body.includes('present continuous') && body.includes('past continuous') &&
        body.includes('present perfect continuous') && body.includes('present perfect simple') &&
        body.includes('A time expression can support a choice, but it does not make the choice alone'),
      contrast: body.includes('Process and result: continuous versus simple') &&
        body.includes('I’ve been repairing chairs all morning') &&
        body.includes('I’ve repaired twelve chairs') &&
        body.includes('the continuous does not promise completion') &&
        body.includes('Do not force the continuous onto every recent event'),
      meaning: body.includes('Many state meanings normally use present perfect simple') &&
        body.includes('The reason is meaning, not a permanent ban on a written verb') &&
        body.includes('One verb can have a state meaning and an activity meaning') &&
        body.includes('both perfect forms can sometimes be natural'),
      spokenForm: body.includes('Sound natural: U.S. contractions, linking, and stress') && body.includes('/bɪn/') &&
        body.includes('/haʊ lɔŋ əv jə bɪn ˈweɪtɪŋ/') &&
        body.includes('The exact stress changes with the correction'),
      readingBoundary: body.includes('No. They stopped one minute ago; the wet floor is present evidence.'),
      privacy: body.includes('You never need to disclose your real employer, clients, projects, schedule, location, commute, health, sleep, finances, account details, relationships, family, study record, or daily habits'),
      production: body.includes('Final production: give a 60–75 second fictional status briefing') &&
        body.includes('Can the listener reconstruct what continues, what stopped, what is complete, how long or since when, and which evidence supports the report?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read ongoing activity, completed quantity, repeated attempt, recent evidence, duration question, and negative-pattern listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(presentPerfectContinuousDecision.firstGap === "checking the registration list" &&
    presentPerfectContinuousDecision.success &&
    /ongoing activity, a completed quantity, recent evidence, the continuous verb chain, and the present reference point/i.test(presentPerfectContinuousDecision.feedback) &&
    presentPerfectContinuousDecision.outcome && presentPerfectContinuousDecision.activityBoundary &&
    presentPerfectContinuousDecision.form && presentPerfectContinuousDecision.uses &&
    presentPerfectContinuousDecision.lenses && presentPerfectContinuousDecision.contrast &&
    presentPerfectContinuousDecision.meaning && presentPerfectContinuousDecision.spokenForm &&
    presentPerfectContinuousDecision.readingBoundary && presentPerfectContinuousDecision.privacy &&
    presentPerfectContinuousDecision.production && presentPerfectContinuousDecision.listeningScript &&
    presentPerfectContinuousDecision.retrieval === "#next-day-retrieval" &&
    presentPerfectContinuousDecision.previous === null &&
    presentPerfectContinuousDecision.next === "/lessons/b1/past-perfect/" &&
    !presentPerfectContinuousDecision.overflow,
    `Present perfect continuous preserves the activity boundary, complete form system, five uses, four time lenses, process-result contrast, state and dynamic meaning, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(presentPerfectContinuousDecision)})`);

  const presentPerfectContinuousBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['how', 'long', 'have', 'they', 'been', 'testing', 'the', 'microphones']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(presentPerfectContinuousBuilder.built === "How long have they been testing the microphones" &&
    presentPerfectContinuousBuilder.success &&
    /How long requests duration, and have they been testing preserves the question chain/i.test(presentPerfectContinuousBuilder.feedback),
    "the present-perfect-continuous builder preserves duration-question order and the full verb chain");

  const presentPerfectContinuousRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'I’ve been knowing the coordinator for five years.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(presentPerfectContinuousRetrieval.error &&
    /Know presents a continuing relationship state, not an unfolding activity/i.test(presentPerfectContinuousRetrieval.first) &&
    /I’ve known the coordinator for five years\./i.test(presentPerfectContinuousRetrieval.second),
    "present-perfect-continuous retrieval gives the state-meaning cue before revealing the accurate simple-perfect repair");

  await navigate(`${origin}/lessons/b1/past-perfect/`, 375, 900);
  const pastPerfectDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((candidate) => candidate.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.innerText;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('By the end, you can form positive, negative, yes-or-no, and information questions') &&
        body.includes('tell a clear story with one purposeful flashback'),
      reference: body.includes('Get to the root: reference time, not “long ago”') &&
        body.includes('Past Perfect is a relative tense') &&
        body.includes('before a past reference'),
      form: body.includes('subject + had + past participle') &&
        body.includes('subject + had not + past participle') &&
        body.includes('Had + subject + past participle?') &&
        body.includes('question word + had + subject + past participle?'),
      meanings: body.includes('Five useful meanings before a past reference') &&
        body.includes('completed event') && body.includes('cause or explanation') &&
        body.includes('experience before a milestone') && body.includes('state continuing to a past point') &&
        body.includes('completed number before a deadline'),
      narrative: body.includes('Past Simple moves the story; Past Perfect looks back') &&
        body.includes('both tenses may be possible') &&
        body.includes('do not pretend one grammatical alternative is an error') &&
        body.includes('Once a flashback is clear'),
      markers: body.includes('Time expressions support the viewpoint; they do not choose it alone') &&
        body.includes('already') && body.includes('just') && body.includes('never / ever') &&
        body.includes('yet') && body.includes('by the time'),
      aspect: body.includes('Past Perfect Simple or Past Perfect Continuous?') &&
        body.includes('the continuous does not prove the activity was still happening at the reference point'),
      spokenForm: body.includes('Sound natural: contractions, linking, and information stress') &&
        body.includes('/aɪd/') && body.includes('I’d finished') && body.includes('I’d finish if I had time') &&
        body.includes('/hædʒə ˈsin ɪt/'),
      privacy: body.includes('You never need to disclose a real employer, client, mistake, password, travel problem, family event, relationship, health issue, financial detail, address, schedule, or personal history'),
      production: body.includes('Final production: reconstruct a 75–90 second fictional event') &&
        body.includes('Can the listener identify the main past reference point, every earlier layer, the reason for each Past Perfect choice, and the exact moment when the story returns to Past Simple?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read contractions, linked questions, reference time, negative contrast, and simple-continuous listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pastPerfectDecision.firstGap === "Maya reached the venue at 8:15" &&
    pastPerfectDecision.success &&
    /8:15 reference point, two earlier events, the had plus participle chain, and the chronological main story/i.test(pastPerfectDecision.feedback) &&
    pastPerfectDecision.outcome && pastPerfectDecision.reference && pastPerfectDecision.form &&
    pastPerfectDecision.meanings && pastPerfectDecision.narrative && pastPerfectDecision.markers &&
    pastPerfectDecision.aspect && pastPerfectDecision.spokenForm && pastPerfectDecision.privacy &&
    pastPerfectDecision.production && pastPerfectDecision.listeningScript &&
    pastPerfectDecision.retrieval === "#next-day-retrieval" &&
    pastPerfectDecision.previous === "/lessons/b1/present-perfect-continuous/" &&
    pastPerfectDecision.next === "/lessons/b1/second-conditional/" && !pastPerfectDecision.overflow,
    `Past perfect preserves reference-time meaning, complete form, five earlier-layer jobs, narrative optionality, time markers, aspect contrast, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(pastPerfectDecision)})`);

  const pastPerfectBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['had', 'anyone', 'updated', 'the', 'schedule', 'before', 'maya', 'arrived']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(pastPerfectBuilder.built === "Had anyone updated the schedule before Maya arrived" &&
    pastPerfectBuilder.success && /Had moves before anyone to ask about an update earlier than Maya’s arrival/i.test(pastPerfectBuilder.feedback),
    "the past-perfect builder preserves question inversion and the later Past Simple reference clause");

  const pastPerfectRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'When Maya had called, the driver had leave.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pastPerfectRetrieval.error &&
    /mentions the later call first, then looks back to the earlier departure/i.test(pastPerfectRetrieval.first) &&
    /When Maya called at 8:20, the driver had left at 8:10\./i.test(pastPerfectRetrieval.second),
    "past-perfect retrieval gives the reference-time cue before revealing the accurate reversed-order sentence");

  await navigate(`${origin}/lessons/b1/second-conditional/`, 375, 900);
  const secondConditionalDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((candidate) => candidate.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.innerText;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('use a past form for imagined present or future distance') &&
        body.includes('distinguish an open First Conditional from a remote Second Conditional without claiming objective probability'),
      distance: body.includes('Get to the root: past form as distance, not past time') &&
        body.includes('The grammar reports the speaker’s stance') &&
        body.includes('Two speakers can frame the same possible event differently'),
      form: body.includes('If + subject + past form, subject + would + base verb') &&
        body.includes('if + subject + didn’t + base verb') &&
        body.includes('subject + wouldn’t + base verb') &&
        body.includes('question word + would + subject + base verb + if...?') &&
        body.includes('for willingness or a formal request'),
      purposes: body.includes('Five reasons a speaker chooses distance') &&
        body.includes('different present') && body.includes('remote future') &&
        body.includes('free imagination') && body.includes('advice') && body.includes('tactful proposal'),
      contrast: body.includes('First or Second Conditional? Read the speaker’s stance') &&
        body.includes('The difference is not a universal percentage') &&
        body.includes('Grammar reveals the chosen framing, not a verified fact about the future'),
      variation: body.includes('natural informal U.S. conversation') &&
        body.includes('Do not label that widespread informal pattern as meaningless or impossible') &&
        body.includes('real past uncertainty'),
      modals: body.includes('Choose the result: would, could, or might') &&
        body.includes('expected consequence inside the imagined situation') &&
        body.includes('ability or available option inside that situation') &&
        body.includes('uncertain possible consequence'),
      questions: body.includes('Ask a hypothetical question without scrambling the if-clause') &&
        body.includes('Keep statement order in the condition'),
      spokenForm: body.includes('Sound natural: weak would, linked questions, and contrast') &&
        body.includes('/wʌt wədʒə ˈdu/') && body.includes('/ɪfaɪ/') &&
        body.includes('We’d add') && body.includes('We’d added the chairs before noon'),
      privacy: body.includes('You never need to disclose your real income, budget, employer, career plans, housing, immigration status, family, health, schedule, location, political views, relationships, education record, or personal regrets'),
      production: body.includes('Final production: lead a 75–90 second fictional planning discussion') &&
        body.includes('Can the listener recover the speaker’s stance, the condition and result, the exact modal meaning, and whether were or was fits the chosen register?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read open and remote framing, linked hypothetical question, advice, modal result, and contraction-meaning listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(secondConditionalDecision.firstGap === "the grant arrives on Friday" &&
    secondConditionalDecision.success &&
    /open grant plan, imagined present budget, past-form distance, hypothetical result, and advice frame/i.test(secondConditionalDecision.feedback) &&
    secondConditionalDecision.outcome && secondConditionalDecision.distance && secondConditionalDecision.form &&
    secondConditionalDecision.purposes && secondConditionalDecision.contrast && secondConditionalDecision.variation &&
    secondConditionalDecision.modals && secondConditionalDecision.questions && secondConditionalDecision.spokenForm &&
    secondConditionalDecision.privacy && secondConditionalDecision.production && secondConditionalDecision.listeningScript &&
    secondConditionalDecision.retrieval === "#next-day-retrieval" &&
    secondConditionalDecision.previous === "/lessons/b1/past-perfect/" &&
    secondConditionalDecision.next === "/lessons/b1/used-to-would-for-past-habits/" &&
    !secondConditionalDecision.overflow,
    `Second conditional preserves speaker-distance meaning, complete form, willingness boundary, five purposes, First Conditional contrast, were/was variation, modal results, questions, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(secondConditionalDecision)})`);

  const secondConditionalBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['if', 'i', 'were', 'the', 'coordinator', 'i', 'would', 'start', 'with', 'a', 'pilot']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(secondConditionalBuilder.built === "If I were the coordinator I would start with a pilot" &&
    secondConditionalBuilder.success &&
    /Were creates the careful imagined position, and would start gives the advice result/i.test(secondConditionalBuilder.feedback),
    "the second-conditional builder preserves careful hypothetical were and the would-plus-base advice result");

  const secondConditionalRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The grammar proves an exact probability percentage.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(secondConditionalRetrieval.error &&
    /Compare arrives plus will with arrived plus would as choices of speaker stance/i.test(secondConditionalRetrieval.first) &&
    /The first presents an open plan; the second presents the same event from greater distance\./i.test(secondConditionalRetrieval.second),
    "second-conditional retrieval gives the stance cue before revealing the accurate open-versus-distant explanation");

  await navigate(`${origin}/lessons/b1/used-to-would-for-past-habits/`, 375, 900);
  const usedToWouldDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('use used to for past states or habits that contrast with now') &&
        body.includes('use habitual would for repeated actions inside a recoverable past frame') &&
        body.includes('use Past Simple for a neutral routine or one event'),
      discourse: body.includes('Get to the root: choose a discourse job') &&
        body.includes('Past Simple is not merely the “one-event form.”') &&
        body.includes('Sometimes more than one form is grammatical'),
      meaning: body.includes('State or repeated event? Meaning comes first') &&
        body.includes('She used to have a delivery van') &&
        body.includes('Every Friday, she would have lunch') &&
        body.includes('This lesson does not label that use impossible'),
      familiarity: body.includes('Do not confuse an old routine with familiarity') &&
        body.includes('be used to + noun or -ing') && body.includes('get used to + noun or -ing') &&
        body.includes('be used for + noun or -ing'),
      negative: body.includes('Questions, negatives, and the meaning of wouldn’t') &&
        body.includes('standard edited English') && body.includes('repeated refusal'),
      narrative: body.includes('Build the past world, revisit routines, then move the story') &&
        body.includes('hypothetical result') && body.includes('past habit'),
      spokenForm: body.includes('Sound natural: used to, linked questions, and weak would') &&
        body.includes('/ˈjuːstə/') && body.includes('/ˈdɪdʒə ˈjuːstə/') && body.includes('/wəd/') &&
        body.includes('she’d unlock') && body.includes('she’d unlocked the door before six'),
      privacy: body.includes('You never need to disclose your real childhood, family, former home, neighborhood, workplace, employer, routine, finances, health, relationships, religion, political views, immigration history, regrets, or current location'),
      production: body.includes('Final production: record a 75–90 second fictional oral history') &&
        body.includes('Can the listener recover the past frame, identify every state and repeated event, hear where one event advances the story, and distinguish old habit from current familiarity?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read former state, framed repeated action, used-to question, familiarity, and would-versus-had contraction listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(usedToWouldDecision.firstGap === "a bakery beside the station" &&
    usedToWouldDecision.success &&
    /former bakery, possession state, repeated weekday actions, one storm event, and present-day contrast/i.test(usedToWouldDecision.feedback) &&
    usedToWouldDecision.outcome && usedToWouldDecision.discourse && usedToWouldDecision.meaning &&
    usedToWouldDecision.familiarity && usedToWouldDecision.negative && usedToWouldDecision.narrative &&
    usedToWouldDecision.spokenForm && usedToWouldDecision.privacy && usedToWouldDecision.production &&
    usedToWouldDecision.listeningScript && usedToWouldDecision.retrieval === "#next-day-retrieval" &&
    usedToWouldDecision.previous === "/lessons/b1/second-conditional/" &&
    usedToWouldDecision.next === "/lessons/b1/passive-voice/" && !usedToWouldDecision.overflow,
    `Used to / would preserves former-state and habit meaning, recoverable framing, Past Simple overlap, state-event nuance, familiarity boundaries, negative and refusal meaning, narrative control, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(usedToWouldDecision)})`);

  const usedToWouldBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['every', 'morning', 'lena', 'would', 'put', 'two', 'chairs', 'outside']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(usedToWouldBuilder.built === "Every morning Lena would put two chairs outside" &&
    usedToWouldBuilder.success &&
    /Every morning supplies the past-habit frame, and would put presents the recurring action/i.test(usedToWouldBuilder.feedback),
    "the used-to/would builder preserves a recoverable frame and would-plus-base recurring action");

  const usedToWouldRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The bakery didn’t used to opened on Sundays.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(usedToWouldRetrieval.error &&
    /Didn’t carries the past marking, so write the base form use before to open/i.test(usedToWouldRetrieval.first) &&
    /The bakery didn’t use to open on Sundays\./i.test(usedToWouldRetrieval.second),
    "used-to/would retrieval gives the edited-negative cue before revealing the exact base-form repair");

  await navigate(`${origin}/lessons/b1/passive-voice/`, 375, 900);
  const passiveVoiceDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('identify the agent and affected participant') &&
        body.includes('choose active or passive according to the intended topic') &&
        body.includes('give a clear, responsible service report'),
      information: body.includes('Get to the root: the passive reorganizes an event') &&
        body.includes('The passive does not automatically change the real event or its time') &&
        body.includes('An agentless passive does not prove that the agent is unknown'),
      form: body.includes('subject + am / is / are + participle') &&
        body.includes('subject + was / were + participle') &&
        body.includes('subject + be + not + participle') &&
        body.includes('question word + be + subject + participle?'),
      details: body.includes('usually introduces an agent or responsible cause') &&
        body.includes('introduces an instrument') && body.includes('source material'),
      eligibility: body.includes('Check whether the verb has an affected participant') &&
        body.includes('was happened') && body.includes('was arrived') &&
        body.includes('Maya was sent a replacement') && body.includes('A replacement was sent to Maya'),
      boundary: body.includes('Event, routine, or current state? Context decides') &&
        body.includes('The package got damaged during delivery') &&
        body.includes('does not label natural get-passives incorrect'),
      questions: body.includes('Ask passive questions without adding do') &&
        body.includes('Who was it inspected by?') && body.includes('By whom was it inspected?'),
      responsibility: body.includes('Use the passive responsibly') &&
        body.includes('It can also hide responsibility') &&
        body.includes('If the report’s purpose is accountability'),
      spokenForm: body.includes('Sound natural: hear weak be, keep the participle') &&
        body.includes('/wəz/') && body.includes('/wɚ/') && body.includes('/wəzɪt ˈsɛnt/') &&
        body.includes('repaired ends /d/') && body.includes('washed ends /t/') && body.includes('tested adds /ɪd/'),
      privacy: body.includes('You never need to describe a real employer, workplace incident, product defect, customer, legal issue, injury, complaint, financial loss, password, address, schedule, or person responsible for a mistake'),
      production: body.includes('Final production: give a 75–90 second fictional service briefing') &&
        body.includes('Can the listener identify the topic of each clause, recover present or past time, hear the complete be + participle chain, distinguish agent from instrument, and tell whether any important responsibility was hidden?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read present process, past event, negative passive, linked time question, and agent-versus-instrument listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(passiveVoiceDecision.firstGap === "technician Maya Chen" &&
    passiveVoiceDecision.success &&
    /active agent, passive topics, unknown installer, informative named agent, and finished past time/i.test(passiveVoiceDecision.feedback) &&
    passiveVoiceDecision.outcome && passiveVoiceDecision.information && passiveVoiceDecision.form &&
    passiveVoiceDecision.details && passiveVoiceDecision.eligibility && passiveVoiceDecision.boundary &&
    passiveVoiceDecision.questions && passiveVoiceDecision.responsibility && passiveVoiceDecision.spokenForm &&
    passiveVoiceDecision.privacy && passiveVoiceDecision.production && passiveVoiceDecision.listeningScript &&
    passiveVoiceDecision.retrieval === "#next-day-retrieval" &&
    passiveVoiceDecision.previous === "/lessons/b1/used-to-would-for-past-habits/" &&
    passiveVoiceDecision.next === "/lessons/b1/reported-speech/" && !passiveVoiceDecision.overflow,
    `Passive Voice preserves information focus, complete present and past form, detail labels, verb eligibility, state and get-passive boundaries, natural questions, responsible reporting, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(passiveVoiceDecision)})`);

  const passiveVoiceBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'final', 'check', 'was', 'completed', 'by', 'lena', 'ortiz']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(passiveVoiceBuilder.built === "The final check was completed by Lena Ortiz" &&
    passiveVoiceBuilder.success &&
    /final check remains the topic, while by Lena Ortiz preserves the qualified agent/i.test(passiveVoiceBuilder.feedback),
    "the passive-voice builder preserves report focus and an informative qualified agent");

  const passiveVoiceRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Every bicycle inspected before sale.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(passiveVoiceRetrieval.error &&
    /current process needs present singular is plus the participle inspected/i.test(passiveVoiceRetrieval.first) &&
    /Every bicycle is inspected before sale\./i.test(passiveVoiceRetrieval.second),
    "passive-voice retrieval gives the missing-auxiliary cue before revealing the complete present passive");

  await navigate(`${origin}/lessons/b1/reported-speech/`, 375, 900);
  const reportedSpeechDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish exact quotation from reported meaning') &&
        body.includes('map original and new speaker-listener reference') &&
        body.includes('recognize legitimate no-backshift and Past Simple alternatives'),
      context: body.includes('Original message: Monday, 8:00 a.m., Harbor Station') &&
        body.includes('Alex’s report: Monday, 3:00 p.m., Riverside Office'),
      quotation: body.includes('Get to the root: report meaning from a new viewpoint') &&
        body.includes('A direct quotation presents words as the speaker’s exact wording') &&
        body.includes('Reported speech usually paraphrases the message without quotation marks'),
      frames: body.includes('said + (that) + clause') &&
        body.includes('told + person + (that) + clause') && body.includes('said to + person, “...”') &&
        body.includes('That is optional in many conversational statement reports'),
      backshift: body.includes('Backshift builds a later viewpoint') &&
        body.includes('It does not mean the original speaker used the past') &&
        body.includes('Past Perfect, could, would') && body.includes('normally unchanged'),
      people: body.includes('Rebuild people reference before changing tense') &&
        body.includes('Pronouns do not follow a memorized conversion table'),
      references: body.includes('Adjust time, place, and demonstratives only when reference changes') &&
        body.includes('Reference words are not replaced automatically'),
      optionality: body.includes('Backshift is common, not automatic') &&
        body.includes('still true and deliberately presented as current') &&
        body.includes('informal U.S. English may keep Past Simple') &&
        body.includes('Do not pretend that one grammatical viewpoint is always an error'),
      stance: body.includes('Do not add a quotation, promise, or doubt') &&
        body.includes('Promised adds a commitment') && body.includes('claimed can suggest') &&
        body.includes('This lesson reports statements'),
      spokenForm: body.includes('Sound natural: said, weak that, and contracted ’d') &&
        body.includes('/sɛd/') && body.includes('/toʊld/') && body.includes('/ðət/') &&
        body.includes('/sɛd ʃi/') && body.includes('/toʊld mi/') &&
        body.includes('she’d call') && body.includes('she’d sent the form'),
      privacy: body.includes('You never need to report a real private conversation, employer message, client statement, family discussion, medical detail, legal issue, travel problem, password, address, schedule, conflict, promise, or opinion'),
      production: body.includes('Final production: relay a 75–90 second fictional message') &&
        body.includes('Can the listener identify every person behind each pronoun, recover the original time and place, distinguish earlier event from later report'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read say-versus-tell frame, backshifted state, earlier canceled event, reported future, and would-versus-had contraction listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(reportedSpeechDecision.firstGap === "she" && reportedSpeechDecision.success &&
    /Mina as she, Mina’s possession as her, the original morning and next day, and the station location as there/i.test(reportedSpeechDecision.feedback) &&
    reportedSpeechDecision.outcome && reportedSpeechDecision.context && reportedSpeechDecision.quotation &&
    reportedSpeechDecision.frames && reportedSpeechDecision.backshift && reportedSpeechDecision.people &&
    reportedSpeechDecision.references && reportedSpeechDecision.optionality && reportedSpeechDecision.stance &&
    reportedSpeechDecision.spokenForm && reportedSpeechDecision.privacy && reportedSpeechDecision.production &&
    reportedSpeechDecision.listeningScript && reportedSpeechDecision.retrieval === "#next-day-retrieval" &&
    reportedSpeechDecision.previous === "/lessons/b1/passive-voice/" &&
    reportedSpeechDecision.next === "/lessons/b1/defining-relative-clauses/" && !reportedSpeechDecision.overflow,
    `Reported Speech preserves exact-versus-paraphrased meaning, say-tell frames, mapped people and reference, common and optional backshift, reporting stance, statement scope, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(reportedSpeechDecision)})`);

  const reportedSpeechBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['she', 'said', 'she', 'would', 'call', 'me', 'the', 'next', 'day']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(reportedSpeechBuilder.built === "She said she would call me the next day" &&
    reportedSpeechBuilder.success &&
    /Would reports the original future, me keeps Alex as listener, and the next day preserves the original tomorrow/i.test(reportedSpeechBuilder.feedback),
    "the reported-speech builder preserves original future, listener, and day reference");

  const reportedSpeechRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Mina said Alex that she was late.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(reportedSpeechRetrieval.error &&
    /named listener follows tell directly; say would need said to Alex or no direct listener/i.test(reportedSpeechRetrieval.first) &&
    /Mina told Alex that she was late\./i.test(reportedSpeechRetrieval.second),
    "reported-speech retrieval gives the listener-frame cue before revealing the accurate told pattern");

  await navigate(`${origin}/lessons/b1/defining-relative-clauses/`, 375, 900);
  const definingRelativeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('attach an essential identifying clause directly to its noun') &&
        body.includes('distinguish subject and object gaps') &&
        body.includes('recognize more formal preposition patterns'),
      context: body.includes('Shortlist for a community workshop') &&
        body.includes('the trainer who teaches evening classes') &&
        body.includes('the projector that Omar tested yesterday'),
      anatomy: body.includes('Get to the root: the clause contains one open role') &&
        body.includes('the subject role is now filled by who') &&
        body.includes('another subject remains') && body.includes('Do not add another it'),
      reference: body.includes('Which is also grammatical for things in defining clauses') &&
        body.includes('One tutor agrees with a singular head noun') &&
        body.includes('Several tutors agree with a plural head noun'),
      omission: body.includes('Keep a subject relative; an object relative may disappear') &&
        body.includes('If a finite verb comes next') && body.includes('If a separate subject comes next') &&
        body.includes('Whom is more formal'),
      boundaries: body.includes('Control whose, where, and what') &&
        body.includes('Where already contains a place relationship') &&
        body.includes('What does not normally follow an expressed noun'),
      information: body.includes('Essential identification usually has no comma break') &&
        body.includes('This identifies a subset') && body.includes('That non-defining pattern is developed at B2'),
      register: body.includes('Place prepositions where the register expects them') &&
        body.includes('the person I spoke to') && body.includes('the person to whom I spoke') &&
        body.includes('the room in that we met'),
      spokenForm: body.includes('Sound natural: make the noun and clause one spoken unit') &&
        body.includes('do not announce the relative clause with a strong comma-like pause') &&
        body.includes('object relatives often lose the relative word completely') && body.includes('/ðət/'),
      privacy: body.includes('You never need to identify a real employer, coworker, client, family member, address, private room, accessibility need, schedule, safety record, device, organization, or personal relationship'),
      production: body.includes('Final production: present a 75–90 second fictional shortlist') &&
        body.includes('Can the listener identify every exact referent, locate the subject and open role inside each clause'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read listening for reference, omission, stress, rhythm, and preposition register"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(definingRelativeDecision.firstGap === "trainer" && definingRelativeDecision.success &&
    /found each noun, matched the reference type, and distinguished the subject gap after trainer from the object gap after projector/i.test(definingRelativeDecision.feedback) &&
    definingRelativeDecision.outcome && definingRelativeDecision.context && definingRelativeDecision.anatomy &&
    definingRelativeDecision.reference && definingRelativeDecision.omission && definingRelativeDecision.boundaries &&
    definingRelativeDecision.information && definingRelativeDecision.register && definingRelativeDecision.spokenForm &&
    definingRelativeDecision.privacy && definingRelativeDecision.production && definingRelativeDecision.listeningScript &&
    definingRelativeDecision.retrieval === "#next-day-retrieval" &&
    definingRelativeDecision.previous === "/lessons/b1/reported-speech/" &&
    definingRelativeDecision.next === "/lessons/b1/modals-of-deduction-might-could-must/" &&
    !definingRelativeDecision.overflow,
    `Defining Relative Clauses preserves essential reference, noun attachment, subject and object gaps, omission, agreement, relative-word boundaries, comma meaning, preposition register, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(definingRelativeDecision)})`);

  const definingRelativeBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'projector', 'omar', 'tested', 'is', 'in', 'room', 'three']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(definingRelativeBuilder.built === "The projector Omar tested is in Room Three" &&
    definingRelativeBuilder.success &&
    /Omar remains the subject of tested, and the projector is its understood object without a repeated pronoun/i.test(definingRelativeBuilder.feedback),
    "the defining-relative builder preserves a zero object gap without a repeated pronoun");

  const definingRelativeRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The tutor teaches evenings is available.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(definingRelativeRetrieval.error &&
    /Who is the subject of teaches, so it must remain/i.test(definingRelativeRetrieval.first) &&
    /The tutor who teaches evenings is available\./i.test(definingRelativeRetrieval.second),
    "defining-relative retrieval gives the missing-subject cue before revealing the complete relative clause");

  await navigate(`${origin}/lessons/b1/modals-of-deduction-might-could-must/`, 375, 900);
  const deductionModalDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('separate an observation from an inference') &&
        body.includes('keep might not weaker than can’t') &&
        body.includes('state the evidence and uncertainty behind a responsible conclusion'),
      context: body.includes('North Hall, 2:10 p.m.') &&
        body.includes('Reception marked Rina present at 2:07') &&
        body.includes('Studio B was checked at 2:10 and is empty and locked'),
      stance: body.includes('Get to the root: modals show the speaker’s reasoning stance') &&
        body.includes('does not turn an inference into a verified fact') &&
        body.includes('Do not attach fixed percentages to the modals'),
      scope: body.includes('May is also a standard possibility modal') &&
        body.includes('Past conclusions such as must have left and might have forgotten belong to the later past-speculation system'),
      strength: body.includes('Calibrate the conclusion, not a memorized percentage') &&
        body.includes('A missing clue alone is rarely a contradiction'),
      functions: body.includes('Separate deduction from obligation, ability, and general possibility') &&
        body.includes('Visitors must sign in') && body.includes('Rina can use the mixer') &&
        body.includes('The hall can get noisy') && body.includes('does not label every inferential must not impossible'),
      evidence: body.includes('Make evidence strong enough for the claim') &&
        body.includes('Do not treat absence of evidence as evidence of absence') &&
        body.includes('Do not use stereotypes') && body.includes('Grammar cannot make weak evidence responsible'),
      viewpoint: body.includes('Choose a present state, repeated fact, or activity in progress') &&
        body.includes('modal + be before a noun, adjective, or location') &&
        body.includes('modal + base verb for knowledge, possession, or a general action') &&
        body.includes('modal + be + -ing for an activity viewed in progress now'),
      questions: body.includes('Ask about possibilities without turning them into requirements') &&
        body.includes('Could Rina be in the hallway?') &&
        body.includes('Do you think Rina might be inside?') &&
        body.includes('question about necessity'),
      spokenForm: body.includes('Sound natural: keep the modal clear and stress the conclusion') &&
        body.includes('There is no rule that the same word always receives stress') &&
        body.includes('may be light or unreleased'),
      privacy: body.includes('You never need to infer anything about a real coworker, client, family member, neighbor, health condition, disability, relationship, location, schedule, finances, legal matter, identity, accent, nationality, password, message, or private behavior'),
      production: body.includes('Final production: give a 75–90 second fictional evidence briefing') &&
        body.includes('Can the listener name the exact clue behind every conclusion, identify which alternatives remain live'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read observation, strong positive inference, open possibilities, strong negative inference, and contrastive stress listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(deductionModalDecision.firstGap === "an observation" && deductionModalDecision.success &&
    /separated recorded facts from inferences, kept two live possibilities, and used the checked empty room to reject Studio B/i.test(deductionModalDecision.feedback) &&
    deductionModalDecision.outcome && deductionModalDecision.context && deductionModalDecision.stance &&
    deductionModalDecision.scope && deductionModalDecision.strength && deductionModalDecision.functions &&
    deductionModalDecision.evidence && deductionModalDecision.viewpoint && deductionModalDecision.questions &&
    deductionModalDecision.spokenForm && deductionModalDecision.privacy && deductionModalDecision.production &&
    deductionModalDecision.listeningScript && deductionModalDecision.retrieval === "#next-day-retrieval" &&
    deductionModalDecision.previous === "/lessons/b1/defining-relative-clauses/" &&
    deductionModalDecision.next === "/lessons/b1/question-tags/" && !deductionModalDecision.overflow,
    `Modals of Deduction preserves observation-versus-inference reasoning, evidence strength, complete form, function boundaries, responsible use, present viewpoint, natural questions, U.S. speech, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(deductionModalDecision)})`);

  const deductionModalBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['rina', 'cannot', 'be', 'in', 'studio', 'b', 'because', 'the', 'room', 'is', 'empty']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(deductionModalBuilder.built === "Rina cannot be in Studio B because the room is empty" &&
    deductionModalBuilder.success &&
    /Cannot strongly rejects Studio B, and the because-clause makes the contradictory evidence explicit/i.test(deductionModalBuilder.feedback),
    "the deduction-modal builder preserves a strong negative conclusion and its explicit evidence");

  const deductionModalRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The noise must be Rina testing a microphone.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(deductionModalRetrieval.error &&
    /sound without a visible source leaves other explanations open/i.test(deductionModalRetrieval.first) &&
    /The noise might be a microphone test\./i.test(deductionModalRetrieval.second),
    "deduction-modal retrieval gives the open-alternatives cue before revealing the calibrated possibility");

  await navigate(`${origin}/lessons/b1/question-tags/`, 375, 900);
  const questionTagDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('build standard opposite-polarity tags with be, perfect have, modals, and do') &&
        body.includes('answer according to the truth of the statement') &&
        body.includes('choose a full question when a tag could pressure the listener'),
      context: body.includes('Cedar House event board, 4:00 p.m.') &&
        body.includes('Confirmed line: Main speaker arrives at 5:30') &&
        body.includes('Blank task: Send the guest Wi-Fi code') &&
        body.includes('Falling voice:') && body.includes('Rising voice:'),
      operator: body.includes('Get to the root: a tag echoes the statement’s operator') &&
        body.includes('first auxiliary or modal that carries tense, polarity, or question behavior') &&
        body.includes('With more than one auxiliary, repeat the first operator') &&
        body.includes('He’s the speaker, isn’t he?') && body.includes('He’s arrived, hasn’t he?'),
      doSupport: body.includes('Supply do for lexical Present and Past Simple') &&
        body.includes('The tag does not repeat the main verb') &&
        body.includes('In contemporary U.S. English, lexical possession with have normally uses do') &&
        body.includes('British and other varieties may also use You have a car, haven’t you?') &&
        body.includes('not a universal ban'),
      reference: body.includes('Track the subject reference into a pronoun') &&
        body.includes('commonly take singular they in the tag') &&
        body.includes('Existential there stays there'),
      negativeMeaning: body.includes('Read negative meaning, not only visible not') &&
        body.includes('never, nobody, no one, nothing, hardly, rarely, seldom') &&
        body.includes('Nobody called, did they?'),
      specials: body.includes('Learn the high-value special patterns as complete chunks') &&
        body.includes('I’m next, aren’t I?') && body.includes('Let’s commonly takes shall we?') &&
        body.includes('Same-polarity conversational tags also exist'),
      response: body.includes('Answer the statement, and choose intonation from the situation') &&
        body.includes('responds to whether the statement is true') &&
        body.includes('No, I haven’t') && body.includes('Yes, I have'),
      social: body.includes('These are useful tendencies, not automatic translations of pitch into certainty') &&
        body.includes('A falling tag may sound warm, routine, challenging, or pressuring') &&
        body.includes('Does Tuesday work for you?'),
      spokenForm: body.includes('Sound natural: keep the tag as a short intonation unit') &&
        body.includes('The pitch movement belongs to the whole tag') &&
        body.includes('/doʊntʃə/') && body.includes('/dɪdən(t)ʃə/') && body.includes('/ˈɪzənɪt/'),
      privacy: body.includes('You never need to confirm a real employer, coworker, client, family member, relationship, travel plan, address, appointment, payment, password, contract, health detail, schedule, or private disagreement'),
      production: body.includes('Final production: run a 75–90 second fictional coordination check') &&
        body.includes('Can the listener recover the statement operator, polarity, subject reference, truth of every short answer'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read expected agreement, open confirmation, U.S. tag linking, negative-statement response, and contrastive operator listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(questionTagDecision.firstGap === "negative" && questionTagDecision.success &&
    /reversed polarity, repeated the matching operator, interpreted No as confirmation of the negative statement, and linked each voice movement to its stated context/i.test(questionTagDecision.feedback) &&
    questionTagDecision.outcome && questionTagDecision.context && questionTagDecision.operator &&
    questionTagDecision.doSupport && questionTagDecision.reference && questionTagDecision.negativeMeaning &&
    questionTagDecision.specials && questionTagDecision.response && questionTagDecision.social &&
    questionTagDecision.spokenForm && questionTagDecision.privacy && questionTagDecision.production &&
    questionTagDecision.listeningScript && questionTagDecision.retrieval === "#next-day-retrieval" &&
    questionTagDecision.previous === "/lessons/b1/modals-of-deduction-might-could-must/" &&
    questionTagDecision.next === "/lessons/b1/gerunds-vs-infinitives/" && !questionTagDecision.overflow,
    `Question Tags preserves operator matching, semantic polarity, U.S. lexical-have do-support, pronoun reference, special chunks, response truth, social intonation, U.S. linking, listening, privacy, production, generated navigation, retrieval, and mobile fit (observed ${JSON.stringify(questionTagDecision)})`);

  const questionTagBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['nobody', 'has', 'sent', 'the', 'code', 'have', 'they']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(questionTagBuilder.built === "Nobody has sent the code have they" &&
    questionTagBuilder.success &&
    /Nobody makes the statement negative in meaning, so the tag is positive have they with singular they/i.test(questionTagBuilder.feedback),
    "the question-tag builder preserves negative meaning, positive tag polarity, and singular they");

  const questionTagRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'You have the final list, haven’t you?' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(questionTagRetrieval.error &&
    /stated contemporary U.S. pattern, possessive have is lexical and uses do-support/i.test(questionTagRetrieval.first) &&
    /You have the final list, don’t you\?/i.test(questionTagRetrieval.second),
    "question-tag retrieval gives the U.S. lexical-have cue before revealing the do-support tag");

  await navigate(`${origin}/lessons/b1/gerunds-vs-infinitives/`, 375, 900);
  const complementDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('retrieve frequent verbs with -ing or to + base verb') &&
        body.includes('build object + to-infinitive and bare-infinitive patterns') &&
        body.includes('treat flexible verbs as flexible rather than forcing a false rule'),
      context: body.includes('Bridgeway career lab, Tuesday afternoon') &&
        body.includes('I considered applying for the project role') &&
        body.includes('I stopped checking job posts at midnight') &&
        body.includes('I remembered meeting the hiring manager last spring'),
      families: body.includes('Get to the root: learn the first word together with its path') &&
        body.includes('English has no single form-meaning rule that predicts every verb complement') &&
        body.includes('suggest that Maya apply'),
      prepositions: body.includes('After a preposition, use a noun or an -ing form') &&
        body.includes('look forward to, be used to, object to, be committed to') &&
        body.includes('Use a substitution test') && body.includes('She used to speak quietly') &&
        body.includes('She is used to speaking to a group'),
      objects: body.includes('Track the object before choosing to or a bare verb') &&
        body.includes('Help can take either a bare infinitive or a to-infinitive in standard U.S. English') &&
        body.includes('recommend revising') && body.includes('recommend that Maya revise'),
      meaning: body.includes('When both forms exist, context must carry the meaning') &&
        body.includes('stop doing') && body.includes('stop to do') &&
        body.includes('remember doing') && body.includes('remember to do') &&
        body.includes('try doing') && body.includes('try to do') &&
        body.includes('regret doing') && body.includes('regret to say / inform'),
      flexibility: body.includes('Keep flexible patterns flexible') &&
        body.includes('both complements are often grammatical') &&
        body.includes('Many real contexts allow either form') &&
        body.includes('Would like is a different request or desire pattern'),
      spokenForm: body.includes('Sound natural: reduce to, but keep the pattern recoverable') &&
        body.includes('/tə/') && body.includes('/ɪŋ/') &&
        body.includes('Stress normally highlights the new or contrastive idea'),
      privacy: body.includes('You never need to reveal a real employer, application, salary, contract, manager, coworker, client, performance review, schedule, family responsibility, health detail, or private career decision'),
      production: body.includes('Final production: give a 75–90 second fictional career-lab update') &&
        body.includes('Can the listener identify what selected every complement'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read weak infinitive to, prepositional to plus -ing, stop contrast, try contrast, and information-stress listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(complementDecision.firstGap === "applying" && complementDecision.success &&
    /separated stored verb patterns from meaning-changing pairs and used the supplied time context/i.test(complementDecision.feedback) &&
    complementDecision.outcome && complementDecision.context && complementDecision.families &&
    complementDecision.prepositions && complementDecision.objects && complementDecision.meaning &&
    complementDecision.flexibility && complementDecision.spokenForm && complementDecision.privacy &&
    complementDecision.production && complementDecision.listeningScript &&
    complementDecision.retrieval === "#next-day-retrieval" &&
    complementDecision.previous === "/lessons/b1/question-tags/" &&
    complementDecision.next === "/lessons/b1/future-review-will-going-to-present-continuous/" &&
    !complementDecision.overflow,
    `Gerunds and infinitives preserves complement families, both kinds of to, object and bare-infinitive patterns, contextual meaning shifts, flexibility, U.S. speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(complementDecision)})`);

  const complementBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'coach', 'encouraged', 'maya', 'to', 'practice', 'before', 'presenting']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(complementBuilder.built === "The coach encouraged Maya to practice before presenting" &&
    complementBuilder.success &&
    /Encourage takes object Maya plus to practice, and before takes presenting/i.test(complementBuilder.feedback),
    "the complement builder preserves object plus to-infinitive and preposition plus -ing in one sentence");

  const complementRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The coach suggested to practice the opening twice.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(complementRetrieval.error &&
    /suggest selects an -ing complement/i.test(complementRetrieval.first) &&
    /The coach suggested practicing the opening twice\./i.test(complementRetrieval.second),
    "gerund-infinitive retrieval gives the verb-family cue before revealing the repaired suggestion");

  await navigate(`${origin}/lessons/b1/future-review-will-going-to-present-continuous/`, 375, 900);
  const futureReviewDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('use will for immediate responses, offers, promises, willingness, and neutral predictions') &&
        body.includes('recognize the Present Simple for official schedules') &&
        body.includes('keep future time and condition clauses in the Present Simple') &&
        body.includes('explain genuine areas of overlap'),
      context: body.includes('Harborline technology fair, Wednesday at 4:00 p.m.') &&
        body.includes('New problem: The main projector has just failed') &&
        body.includes('Yesterday’s decision: The team approved a backup rental') &&
        body.includes('Confirmed appointment: The vendor accepted 3:00 p.m. Thursday') &&
        body.includes('Official timetable: The demonstration begins at 10:00 a.m. Friday'),
      viewpoint: body.includes('Get to the root: all three forms express a present stance') &&
        body.includes('A form is not a label attached permanently to one real-world event') &&
        body.includes('Negatives and questions keep each system intact') &&
        body.includes('Do not combine systems as will going to'),
      will: body.includes('Use will for a response, commitment, willingness, or neutral prediction') &&
        body.includes('Will you ...? can ask about a future event, willingness, or a requested action') &&
        body.includes('not a mechanical signal word'),
      goingTo: body.includes('Use be going to for a prior intention or present trajectory') &&
        body.includes('The evidence does not make the predicted outcome logically certain') &&
        body.includes('Nor does present evidence make will ungrammatical in every surrounding context'),
      arrangements: body.includes('Use the Present Continuous for an arrangement, then recognize a schedule') &&
        body.includes('It need not always involve a second person') &&
        body.includes('Official timetables and programs commonly use the Present Simple') &&
        body.includes('This is a useful boundary, not a claim that speakers can never choose another form'),
      timeClauses: body.includes('Inside a future time or condition clause, use the Present Simple') &&
        body.includes('I’ll call when I arrive') && body.includes('does not claim that will can never occur after these words'),
      overlap: body.includes('Choose a viewpoint, not a signal word') &&
        body.includes('Real speakers sometimes have more than one grammatical choice') &&
        body.includes('I think it will rain') && body.includes('I think it’s going to rain') &&
        body.includes('a future Present Continuous needs future context'),
      spokenForm: body.includes('Sound natural: keep the form recoverable through reduction') &&
        body.includes('/aɪl/') && body.includes('/woʊnt/') && body.includes('/ˈɡoʊɪŋ tə/') &&
        body.includes('/ˈɡənə/') && body.includes('Use the full spelling going to in standard edited writing'),
      privacy: body.includes('You never need to reveal a real employer, client, appointment, address, trip, ticket, booking, schedule, contract, payment, password, family commitment, health visit, study plan, or private future intention'),
      production: body.includes('Final production: give a 75–90 second fictional event briefing') &&
        body.includes('Can the listener identify when each decision existed'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read immediate response, going-to intention, present-continuous arrangement, timetable, and future-clause boundary listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(futureReviewDecision.firstGap === "a response decided now" && futureReviewDecision.success &&
    /linked will to a new response, going to to the prior decision, the present continuous to a confirmed appointment, and the Present Simple to the official timetable/i.test(futureReviewDecision.feedback) &&
    futureReviewDecision.outcome && futureReviewDecision.context && futureReviewDecision.viewpoint &&
    futureReviewDecision.will && futureReviewDecision.goingTo && futureReviewDecision.arrangements &&
    futureReviewDecision.timeClauses && futureReviewDecision.overlap && futureReviewDecision.spokenForm &&
    futureReviewDecision.privacy && futureReviewDecision.production && futureReviewDecision.listeningScript &&
    futureReviewDecision.retrieval === "#next-day-retrieval" &&
    futureReviewDecision.previous === "/lessons/b1/gerunds-vs-infinitives/" &&
    futureReviewDecision.next === "/lessons/b1/work-and-careers/" && !futureReviewDecision.overflow,
    `Future Review preserves present viewpoint, complete forms, will functions, prior intention, present trajectory, arrangements, schedules, time clauses, overlap, U.S. speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(futureReviewDecision)})`);

  const futureReviewBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['i', 'will', 'call', 'you', 'as', 'soon', 'as', 'my', 'train', 'arrives']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(futureReviewBuilder.built === "I will call you as soon as my train arrives" &&
    futureReviewBuilder.success &&
    /Will marks the later call, while Present Simple arrives follows as soon as in the future-time clause/i.test(futureReviewBuilder.feedback),
    "the future-review builder preserves will in the result and Present Simple in the future-time clause");

  const futureReviewRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'These boxes are heavy. I will to carry two.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(futureReviewRetrieval.error &&
    /notices a need and offers help in the current exchange/i.test(futureReviewRetrieval.first) &&
    /These boxes are heavy\. I’ll carry two for you\./i.test(futureReviewRetrieval.second),
    "future-review retrieval gives the immediate-offer cue before revealing will plus the base verb");

  await navigate(`${origin}/lessons/b1/work-and-careers/`, 375, 900);
  const workCareerDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish job, work, and career') &&
        body.includes('interpret required and preferred qualifications in a U.S. job posting') &&
        body.includes('separate skills, qualifications, experience, and measurable achievements') &&
        body.includes('distinguish voluntary and employer-initiated career changes'),
      context: body.includes('Jordan’s fictional professional introduction') &&
        body.includes('I work as a client support coordinator for Northstar Community Services') &&
        body.includes('I’m responsible for running weekly onboarding sessions') &&
        body.includes('reduced average response time by 18 percent'),
      scale: body.includes('Get to the root: job, work, and career organize different scales') &&
        body.includes('a work of art') && body.includes('change careers') &&
        body.includes('change career paths'),
      employment: body.includes('Describe the employment relationship without forcing false categories') &&
        body.includes('An employee works for an employer') &&
        body.includes('business status versus project-based client work') &&
        body.includes('a full-time, temporary, hybrid role'),
      responsibilities: body.includes('Build responsibilities with complete professional chunks') &&
        body.includes('take responsibility for a result') &&
        body.includes('Manage can mean direct people or organize resources and tasks') &&
        body.includes('Report to identifies the person above you'),
      applications: body.includes('Read a U.S. job posting as a hierarchy, not a wall of keywords') &&
        body.includes('job posting and job opening are common') &&
        body.includes('Vacancy is correct English but is less common in everyday U.S. job-search language') &&
        body.includes('Apply for names the opportunity') && body.includes('Apply to names the organization or program') &&
        body.includes('The categories can overlap'),
      evidence: body.includes('Separate a skill, qualification, experience, and achievement') &&
        body.includes('Experience is normally uncountable when it means accumulated knowledge or work history') &&
        body.includes('The conference was a useful experience') &&
        body.includes('A number is useful only when it is truthful and relevant'),
      changes: body.includes('Name career changes without confusing cause or agency') &&
        body.includes('not because of individual misconduct') && body.includes('performance or conduct') &&
        body.includes('avoid guessing why someone left'),
      spokenForm: body.includes('Sound natural: stress the identifying word and link the relationship') &&
        body.includes('JOB posting, JOB interview, CAREER path, DEADline, TEAM lead') &&
        body.includes('/rɪˈspɑnsəbəl/') && body.includes('/rɪˌspɑnsəˈbɪləti/') &&
        body.includes('/əˈplaɪ fər/') && body.includes('/ˈrɛzəˌmeɪ/'),
      privacy: body.includes('You never need to reveal a real employer, salary, contract, application, manager, coworker, performance review, dismissal, layoff, immigration status, age, family situation, health detail, disability, address, financial need, or other private employment information') &&
        body.includes('Ask only job-relevant questions'),
      production: body.includes('Final production: run a 90-second fictional role-fit interview') &&
        body.includes('Can the listener distinguish job, work, and career'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read role-organization-field, responsibility chunk, apply-for relationship, experience countability, and layoff-cause listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(workCareerDecision.firstGap === "client support coordinator" && workCareerDecision.success &&
    /separated Jordan’s role, organization, regular responsibility, and measurable achievement/i.test(workCareerDecision.feedback) &&
    workCareerDecision.outcome && workCareerDecision.context && workCareerDecision.scale &&
    workCareerDecision.employment && workCareerDecision.responsibilities &&
    workCareerDecision.applications && workCareerDecision.evidence && workCareerDecision.changes &&
    workCareerDecision.spokenForm && workCareerDecision.privacy && workCareerDecision.production &&
    workCareerDecision.listeningScript && workCareerDecision.retrieval === "#next-day-retrieval" &&
    workCareerDecision.previous === "/lessons/b1/future-review-will-going-to-present-continuous/" &&
    workCareerDecision.next === "/lessons/b1/environment-and-nature/" && !workCareerDecision.overflow,
    `Work and Careers preserves lexical scale, employment relationships, collocations, U.S. posting language, evidence types, career-change agency, professional speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(workCareerDecision)})`);

  const workCareerBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['jordan', 'applied', 'for', 'the', 'role', 'and', 'submitted', 'a', 'résumé']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(workCareerBuilder.built === "Jordan applied for the role and submitted a résumé" &&
    workCareerBuilder.success &&
    /Apply for names the opportunity, and submit names the application document action/i.test(workCareerBuilder.feedback),
    "the work-career builder preserves the opportunity relationship and submitted résumé action");

  const workCareerRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Jordan accepted a work, has many job, and wants one support works.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(workCareerRetrieval.error &&
    /job for one position, work for its tasks, and career for the long path/i.test(workCareerRetrieval.first) &&
    /Jordan accepted a new job, has challenging work, and wants a long career in support\./i.test(workCareerRetrieval.second),
    "work-career retrieval gives the three-scale cue before revealing the precise professional sentence");

  await navigate(`${origin}/lessons/b1/environment-and-nature/`, 375, 900);
  const environmentDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish weather from climate') &&
        body.includes('distinguish mitigation, adaptation, conservation, and restoration') &&
        body.includes('evaluate a fictional proposal’s benefits, costs, and unanswered questions'),
      river: body.includes('A fictional river update') &&
        body.includes('Water tests found unusually high nutrient levels') &&
        body.includes('contributing to excessive plant growth') &&
        body.includes('upgrading the treatment system'),
      scale: body.includes('Get to the root: time scale and material type change the noun') &&
        body.includes('A single hot afternoon is evidence about the day’s weather') &&
        body.includes('not enough evidence by itself to establish or reject a long-term climate trend') &&
        body.includes('Waste becomes pollution when it contaminates or harms the environment'),
      emissions: body.includes('Separate greenhouse-gas emissions from local air pollution') &&
        body.includes('Greenhouse gases, including carbon dioxide and methane, trap heat in the atmosphere') &&
        body.includes('The categories can overlap, but they are not identical') &&
        body.includes('That does not mean every project has zero impact'),
      ecology: body.includes('Map living systems: habitat, species, wildlife, ecosystem, and biodiversity') &&
        body.includes('same form in singular and plural') &&
        body.includes('organisms and the physical environment interacting as a system') &&
        body.includes('restoration helps a damaged ecosystem recover'),
      evidence: body.includes('Match the strength of the claim to the strength of the evidence') &&
        body.includes('contributes to when the source identifies one factor among several') &&
        body.includes('Results from points backward to a cause') &&
        body.includes('Do not change is associated with into causes unless the evidence supports causation'),
      response: body.includes('Classify responses by what they change') &&
        body.includes('reduce a cause or limit the size of climate change') &&
        body.includes('prepare for or adjust to effects that are happening or expected') &&
        body.includes('who has the power to act, what the response costs, who benefits'),
      spokenForm: body.includes('Make the key contrasts audible') &&
        body.includes('/ˈklaɪmət/') && body.includes('/ˈhæbəˌtæt/') &&
        body.includes('/pəˈluʃən/') && body.includes('/rɪˈnuəbəl/') && body.includes('/ɪˈmɪʃənz/') &&
        body.includes('Clarity matters more than copying one accent'),
      listening: body.includes('Tutor-read listening: hear the word and the relationship'),
      reading: body.includes('Fictional Arroyo City heat brief') &&
        body.includes('does not claim that this small comparison represents every neighborhood') &&
        body.includes('water use, maintenance costs, and rider feedback for two summers'),
      privacy: body.includes('You never need to reveal a real home address, utility bill, health condition, immigration status, workplace practice, political affiliation, financial situation, or conflict with a neighbor, employer, landlord, or public agency'),
      production: body.includes('Final production: deliver a 90-second fictional council briefing') &&
        body.includes('Can the listener tell what was measured, what is inferred, what causes what'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(environmentDecision.firstGap === "high nutrient levels" && environmentDecision.success &&
    /separated the measured observation, contributing cause, possible biological effect, and proposed response/i.test(environmentDecision.feedback) &&
    environmentDecision.outcome && environmentDecision.river && environmentDecision.scale &&
    environmentDecision.emissions && environmentDecision.ecology && environmentDecision.evidence &&
    environmentDecision.response && environmentDecision.spokenForm && environmentDecision.listening &&
    environmentDecision.reading && environmentDecision.privacy && environmentDecision.production &&
    environmentDecision.retrieval === "#next-day-retrieval" &&
    environmentDecision.previous === "/lessons/b1/work-and-careers/" &&
    environmentDecision.next === "/lessons/b1/media-and-news/" && !environmentDecision.overflow,
    `Environment and Nature preserves time scale, environmental systems, ecological relationships, evidence calibration, response types, trade-offs, speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(environmentDecision)})`);

  const environmentBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][0];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['loss', 'of', 'plant', 'cover', 'can', 'lead', 'to', 'soil', 'erosion']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(environmentBuilder.built === "Loss of plant cover can lead to soil erosion" &&
    environmentBuilder.success &&
    /Can marks possibility, and lead to points from the supplied cause to the effect/i.test(environmentBuilder.feedback),
    "the environment builder preserves cautious modality and cause-to-effect direction");

  const environmentRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'A storm is climate; a thirty-year pattern is this afternoon’s weather.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(environmentRetrieval.error &&
    /Separate the short event from the long pattern/i.test(environmentRetrieval.first) &&
    /A storm is weather; a thirty-year rainfall pattern is climate\./i.test(environmentRetrieval.second),
    "environment retrieval gives the time-scale cue before revealing the exact weather-climate repair");

  await navigate(`${origin}/lessons/b1/media-and-news/`, 375, 900);
  const mediaDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('recognize a headline, news report, analysis, editorial, and press release') &&
        body.includes('distinguish a publisher, author, quoted source, claim, evidence, context, and independent confirmation') &&
        body.includes('summarize a fictional report without increasing its certainty'),
      metro: body.includes('Fictional Metrovale bus-lane announcement') &&
        body.includes('CITY BUS LANE “WILL END DOWNTOWN DELAYS”') &&
        body.includes('could fall from 30 to 26 minutes') &&
        body.includes('Actual travel-time results are not available yet'),
      formats: body.includes('Identify the product before evaluating its purpose') &&
        body.includes('analysis') && body.includes('editorial or opinion piece') &&
        body.includes('primary evidence for what the organization announced, not independent proof') &&
        body.includes('A label helps the reader understand purpose, but it does not settle truth by itself'),
      chain: body.includes('Map the chain: publisher, source, claim, evidence, context, confirmation') &&
        body.includes('A claim is a statement presented as true') &&
        body.includes('Evidence is information used to support, weaken, or test that claim') &&
        body.includes('Independent confirmation comes from a genuinely separate route') &&
        body.includes('It does not mean automatically neutral or correct'),
      status: body.includes('Distinguish evidence status from viewpoint') &&
        body.includes('A factual claim is a statement that evidence could establish or reject') &&
        body.includes('Unverified means the available checking is insufficient, not automatically false') &&
        body.includes('A neutral tone also does not prove accuracy'),
      attribution: body.includes('Attribute the message without inventing certainty or stance') &&
        body.includes('According to the transit office') && body.includes('told + person + clause') &&
        body.includes('Claims can create distance from the statement') &&
        body.includes('An unnamed or anonymous source is not necessarily an unknown online account') &&
        body.includes('the journalist and editor may know the person’s identity'),
      verification: body.includes('Trace the item before sharing it') &&
        body.includes('Several pages repeating one wire report or press release are not several independent confirmations') &&
        body.includes('10 percentage points') && body.includes('20% relative increase') &&
        body.includes('A modeled estimate is not a measured outcome') &&
        body.includes('An old image can be authentic but misleading'),
      spokenForm: body.includes('Sound natural: Make attribution and media vocabulary audible') &&
        body.includes('/nuz/') && body.includes('/ˈhɛdˌlaɪn/') && body.includes('/rɪˈpɔrt/') &&
        body.includes('/rɪˈlaɪəbəl/') && body.includes('RE-cord') && body.includes('re-CORD') &&
        body.includes('/əˈkɔrdɪŋ tə ðə rɪˈpɔrt/'),
      listening: body.includes('Tutor-read listening: recover the source and evidence status'),
      clearwater: body.includes('Fictional Clearwater cafeteria pilot file') &&
        body.includes('CITY CUTS FOOD WASTE BY 80% IN ONE MONTH') &&
        body.includes('a 9% decrease') && body.includes('No citywide measurement has been completed'),
      privacy: body.includes('You never need to reveal a real political belief, voting history, browsing history, search history, private message, social-media account, workplace, source contact, location, health event, legal problem, traumatic event, family conflict, or story you regret sharing'),
      production: body.includes('Final production: deliver a 90-second fictional verification-desk briefing') &&
        body.includes('Can the listener recover the product type, publisher, author if supplied, source, exact claim'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(mediaDecision.firstGap === "will end downtown delays" && mediaDecision.success &&
    /separated the headline’s promise, the transportation office as source-document publisher, the model estimate, and the reader’s opinion/i.test(mediaDecision.feedback) &&
    mediaDecision.outcome && mediaDecision.metro && mediaDecision.formats && mediaDecision.chain &&
    mediaDecision.status && mediaDecision.attribution && mediaDecision.verification &&
    mediaDecision.spokenForm && mediaDecision.listening && mediaDecision.clearwater &&
    mediaDecision.privacy && mediaDecision.production && mediaDecision.retrieval === "#next-day-retrieval" &&
    mediaDecision.previous === "/lessons/b1/environment-and-nature/" &&
    mediaDecision.next === "/lessons/b1/relationships/" && !mediaDecision.overflow,
    `Media and News preserves product purpose, claim-source-evidence chain, fact and viewpoint status, attribution, source anonymity, verification, numerical and image context, speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(mediaDecision)})`);

  const mediaBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][0];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['according', 'to', 'the', 'city', 'memo', 'total', 'food', 'waste', 'fell', 'by', 'nine', 'percent']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(mediaBuilder.built === "According to the city memo total food waste fell by nine percent" &&
    mediaBuilder.success &&
    /According to introduces the source, and the summary reports the total-site percentage/i.test(mediaBuilder.feedback),
    "the media builder preserves source attribution and the scope-correct total-waste result");

  const mediaRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'I heard a news and read three newses.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(mediaRetrieval.error &&
    /Use news without a or plural -s; use report for one countable product/i.test(mediaRetrieval.first) &&
    /I heard some news and read a detailed news report\./i.test(mediaRetrieval.second),
    "media retrieval gives the countability cue before revealing the exact news-report repair");

  await navigate(`${origin}/lessons/b1/relationships/`, 375, 900);
  const relationshipDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish an acquaintance, coworker, close friend, neighbor, and clearly identified kind of partner') &&
        body.includes('distinguish an observation, impact, need, request, boundary, and agreement') &&
        body.includes('discuss a fictional conflict without requiring forgiveness or renewed contact'),
      cedarConversation: body.includes('Fictional Cedar House project conversation') &&
        body.includes('When the schedule changed and no message arrived') &&
        body.includes('Could you send an update by 3:00') &&
        body.includes('I do not answer project messages after 8:00 p.m.') &&
        body.includes('sent every promised update for the next three weeks'),
      labels: body.includes('Name the relationship from the supplied context, not an assumption') &&
        body.includes('what the word does not prove') &&
        body.includes('Colleague can refer to a coworker or another person in the same profession or field') &&
        body.includes('romantic partner, business partner, project partner') &&
        body.includes('Relationship norms vary across people, communities, and cultures'),
      contact: body.includes('Track contact and closeness as separate changes') &&
        body.includes('Get along with someone means the relationship is generally friendly or works reasonably well') &&
        body.includes('Grow apart or drift apart means become less close over time') &&
        body.includes('does not automatically imply an argument'),
      trust: body.includes('Support claims about trust with a specific action') &&
        body.includes('one apology may begin repair but does not guarantee restored trust') &&
        body.includes('Trust can differ by domain'),
      conflict: body.includes('Use natural U.S. chunks for conflict and repair') &&
        body.includes('have a falling-out with someone') &&
        body.includes('Had a falling-out is especially natural in U.S. English') &&
        body.includes('Fell out with is also understandable and used across English varieties') &&
        body.includes('An apology does not force forgiveness, restored trust, renewed contact, or agreement'),
      communication: body.includes('Separate an observation, impact, need, request, boundary, and agreement') &&
        body.includes('Starting with I feel does not automatically remove blame') &&
        body.includes('A boundary is not a special word that makes any demand respectful') &&
        body.includes('A request allows a real response'),
      spokenForm: body.includes('Sound natural: Link the relationship and keep the contrast clear') &&
        body.includes('/əˈkweɪntəns/') && body.includes('/səˈpɔrtɪv/') &&
        body.includes('/ˈbaʊndəri/') && body.includes('/əˈpɑlədʒaɪz/') &&
        body.includes('/ˈkoʊˌwɝkər/') && body.includes('real information focus can move the strongest stress'),
      listening: body.includes('Tutor-read listening: recover the relationship, not one keyword'),
      cedarRecord: body.includes('Fictional Cedar House project record') &&
        body.includes('his embarrassment explained his silence but did not remove its impact') &&
        body.includes('trust was beginning to rebuild'),
      privacy: body.includes('You never need to reveal a real family relationship, friendship, romantic relationship, workplace conflict, breakup, estrangement, betrayal, argument, boundary, trauma, abuse, health condition, private message, identity, or contact decision') &&
        body.includes('This lesson teaches English, not counseling') &&
        body.includes('No task requires forgiveness, reconciliation, renewed contact, or remaining in a relationship'),
      production: body.includes('Final production: run a 90-second fictional repair conversation') &&
        body.includes('Can the listener identify how the people know each other, what happened, who was affected'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(relationshipDecision.firstGap === "no message arrived after the schedule changed" &&
    relationshipDecision.success &&
    /separated the missing update, the 3:00 request, Nora’s after-8:00 boundary, and Eli’s repeated follow-through/i.test(relationshipDecision.feedback) &&
    relationshipDecision.outcome && relationshipDecision.cedarConversation && relationshipDecision.labels &&
    relationshipDecision.contact && relationshipDecision.trust && relationshipDecision.conflict &&
    relationshipDecision.communication && relationshipDecision.spokenForm && relationshipDecision.listening &&
    relationshipDecision.cedarRecord && relationshipDecision.privacy && relationshipDecision.production &&
    relationshipDecision.retrieval === "#next-day-retrieval" &&
    relationshipDecision.previous === "/lessons/b1/media-and-news/" &&
    relationshipDecision.next === "/lessons/b1/money-and-spending/" && !relationshipDecision.overflow,
    `Relationships preserves evidence-limited labels, contact change, support and trust behavior, U.S. conflict language, requests, self-directed boundaries, consent-sensitive repair, speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(relationshipDecision)})`);

  const relationshipBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['i', 'reply', 'the', 'next', 'morning', 'to', 'project', 'messages', 'sent', 'after', 'eight']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(relationshipBuilder.built === "I reply the next morning to project messages sent after eight" &&
    relationshipBuilder.success &&
    /states the speaker’s own response to after-hours messages rather than controlling another person’s behavior/i.test(relationshipBuilder.feedback),
    "the relationship builder preserves a self-directed availability boundary");

  const relationshipRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Ren is automatically Jules’s closest friend.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(relationshipRetrieval.error &&
    /The context supplies only the shared workplace/i.test(relationshipRetrieval.first) &&
    /Ren is Jules’s coworker; no friendship is established\./i.test(relationshipRetrieval.second),
    "relationship retrieval gives the evidence-limit cue before revealing the precise coworker account");

  await navigate(`${origin}/lessons/b1/money-and-spending/`, 375, 900);
  const moneyDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish salary, wages, income, revenue, expenses, and savings') &&
        body.includes('separate listed price, additional charges, total cost, affordability, and value') &&
        body.includes('justify a fictional purchasing decision from complete evidence'),
      harborQuote: body.includes('Fictional Harbor Learning Center quote') &&
        body.includes('listed price is $480') && body.includes('Sales tax is $38.40') &&
        body.includes('cash total is $538.40') && body.includes('twelve payments of $47'),
      inflow: body.includes('Map money coming in and going out') &&
        body.includes('not automatically profit and not the usual word for an employee’s pay') &&
        body.includes('Profit is what remains for a business after relevant expenses are subtracted from revenue'),
      countability: body.includes('Count the item, not every money word') &&
        body.includes('Cost is not always uncountable') && body.includes('additional costs') &&
        body.includes('A saving can name an amount avoided'),
      transactions: body.includes('Track the roles in every transaction') &&
        body.includes('borrow something from someone') && body.includes('lend something to someone / lend someone something') &&
        body.includes('Pay back means return borrowed money'),
      decisionLanguage: body.includes('Separate price, total cost, affordability, and value') &&
        body.includes('Can afford means the payment fits the resources and priorities in the context') &&
        body.includes('Good value means the benefit, quality, useful life, or suitability compares favorably'),
      checkout: body.includes('Use U.S. checkout and payment language precisely') &&
        body.includes('the restaurant statement showing what is due in common U.S. English') &&
        body.includes('A service charge is an amount added for a service'),
      planning: body.includes('Describe planning without turning vocabulary into advice') &&
        body.includes('not a recommendation to borrow, invest, or choose a product'),
      spokenForm: body.includes('Sound natural: Make the amount and transaction role audible') &&
        body.includes('/ˈmʌni/') && body.includes('/rɪˈsit/') && body.includes('/dɛt/') &&
        body.includes('Can_I_borrow...?') && body.includes('thir-TEEN'),
      listening: body.includes('Tutor-read listening: recover the amount and transaction'),
      lakeside: body.includes('Fictional Lakeside Learning Center equipment record') &&
        body.includes('grant permits up to $550 for equipment this month') &&
        body.includes('The installment total is $672') &&
        body.includes('does not claim that Option B is the best choice for every buyer'),
      privacy: body.includes('You never need to reveal real income, salary, wages, rent, debt, bank balance, savings, credit score') &&
        body.includes('This lesson teaches English, not financial, tax, legal, investment, or credit advice'),
      production: body.includes('Final production: deliver a 90-second fictional purchasing briefing') &&
        body.includes('Can the listener recover what the center needs, which money is available for that purpose'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(moneyDecision.firstGap === "listed price before added charges" &&
    moneyDecision.success &&
    /separated the listed price, sales tax, cash total, and installment total/i.test(moneyDecision.feedback) &&
    moneyDecision.outcome && moneyDecision.harborQuote && moneyDecision.inflow &&
    moneyDecision.countability && moneyDecision.transactions && moneyDecision.decisionLanguage &&
    moneyDecision.checkout && moneyDecision.planning && moneyDecision.spokenForm &&
    moneyDecision.listening && moneyDecision.lakeside && moneyDecision.privacy && moneyDecision.production &&
    moneyDecision.retrieval === "#next-day-retrieval" &&
    moneyDecision.previous === "/lessons/b1/relationships/" &&
    moneyDecision.next === "/lessons/b1/crime-and-society/" && !moneyDecision.overflow,
    `Money & spending preserves inflow-outflow categories, accurate countability, transaction roles, price-total-affordability-value distinctions, U.S. checkout language, planning boundaries, speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(moneyDecision)})`);

  const moneyBuilder = await evaluate(`(() => {
    const builder = [...document.querySelectorAll('[data-tile-builder]')][1];
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the', 'center', 'paid', 'four', 'hundred', 'dollars', 'for', 'the', 'projector']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(moneyBuilder.built === "the center paid four hundred dollars for the projector" &&
    moneyBuilder.success &&
    /buyer is the subject, four hundred dollars is the payment, and for introduces the purchased item/i.test(moneyBuilder.feedback),
    `the money builder preserves the buyer, payment amount, and pay-for-item frame (observed ${JSON.stringify(moneyBuilder)})`);

  const moneyRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Cost can never be plural in any meaning.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(moneyRetrieval.error &&
    /Identify which nouns can take plural forms for separate items/i.test(moneyRetrieval.first) &&
    /Money is uncountable here, while bills and separate costs are countable\./i.test(moneyRetrieval.second),
    "money retrieval gives the countability cue before revealing the exact money-bills-costs contrast");

  await navigate(`${origin}/lessons/b1/crime-and-society/`, 375, 900);
  const crimeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish theft, robbery, burglary, vandalism, fraud, identity theft, and related offenses') &&
        body.includes('describe evidence without claiming more than it supports') &&
        body.includes('deliver a neutral fictional community-safety briefing'),
      northsideUpdate: body.includes('Fictional Northside Community Hub update') &&
        body.includes('Video shows a person entering the storage hallway at 2:18 a.m.') &&
        body.includes('No one has been arrested or charged'),
      offenses: body.includes('Name the reported act without collapsing nearby meanings') &&
        body.includes('exact legal definitions and categories vary by jurisdiction') &&
        body.includes('unlawful entry into a building or other covered place with intent to commit an offense'),
      verbPatterns: body.includes('Track the thing, place, and affected person through the verb pattern') &&
        body.includes('steal + thing + from + person/place') && body.includes('rob + person/place') &&
        body.includes('Burglarize is standard U.S. English'),
      legalStages: body.includes('Keep each person inside the correct legal stage') &&
        body.includes('An arrest does not establish guilt, and a charge does not establish conviction') &&
        body.includes('This lesson teaches neutral English, not legal advice'),
      collocations: body.includes('Match the grammar to allegation, charge, and conviction') &&
        body.includes('accuse someone of + noun/-ing') && body.includes('charge someone with + offense') &&
        body.includes('convict someone of + offense') && body.includes('sentence someone to + penalty/time'),
      evidence: body.includes('Report evidence as support, not as a verdict') &&
        body.includes('Evidence is uncountable') &&
        body.includes('should not be used to declare legal guilt from a few clues'),
      society: body.includes('Discuss society through harm, reporting, response, and measurement') &&
        body.includes('Reported crime means incidents recorded by the source being discussed') &&
        body.includes('Prevention language should not blame a victim'),
      spokenForm: body.includes('Sound natural: make the offense, role, and certainty boundary audible') &&
        body.includes('/θɛft/') && body.includes('/ˈbɝɡləri/') && body.includes('/ˈɛvədəns/') &&
        body.includes('SUSpect') && body.includes('susPECT') && body.includes('CONvict') && body.includes('conVICT'),
      listening: body.includes('Tutor-read listening: recover the sound and the legal meaning'),
      northsideFile: body.includes('Fictional Northside Community Hub case file') &&
        body.includes('Police investigate missing hub laptops') &&
        body.includes('A six-month change at one site will not by itself prove that one measure caused the result'),
      privacy: body.includes('You never need to reveal a real victimization, accusation, arrest, court case') &&
        body.includes('Do not ask a learner to perform a criminal role from personal experience'),
      production: body.includes('Final production: deliver a 90-second fictional community-safety briefing') &&
        body.includes('Can the listener reconstruct the act, affected property, sources, observable evidence, missing identity'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(crimeDecision.firstGap === "damaged door frame and three missing laptops" &&
    crimeDecision.success &&
    /separated the observed damage and missing property, limited video evidence, open investigation, and unsupported caught claim/i.test(crimeDecision.feedback) &&
    crimeDecision.outcome && crimeDecision.northsideUpdate && crimeDecision.offenses &&
    crimeDecision.verbPatterns && crimeDecision.legalStages && crimeDecision.collocations &&
    crimeDecision.evidence && crimeDecision.society && crimeDecision.spokenForm &&
    crimeDecision.listening && crimeDecision.northsideFile && crimeDecision.privacy && crimeDecision.production &&
    crimeDecision.retrieval === "#next-day-retrieval" &&
    crimeDecision.previous === "/lessons/b1/money-and-spending/" &&
    crimeDecision.next === "/lessons/b1/collocations-and-word-families/" && !crimeDecision.overflow,
    `Crime & society preserves offense meanings, participant patterns, legal stages, evidence limits, reported-data interpretation, fair response, speech, listening, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(crimeDecision)})`);

  const crimeBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['Police', 'are', 'investigating', 'a', 'suspected', 'burglary', 'at', 'the', 'community', 'hub']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(crimeBuilder.built === "Police are investigating a suspected burglary at the community hub" &&
    crimeBuilder.success &&
    /names the investigation and suspected offense without inventing an arrest, identity, or conviction/i.test(crimeBuilder.feedback),
    `the crime-report builder preserves the investigation stage and presumption boundary (observed ${JSON.stringify(crimeBuilder)})`);

  const crimeRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Robbery means any missing object with no person or threat.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(crimeRetrieval.error &&
    /Use the threat as the decisive detail/i.test(crimeRetrieval.first) &&
    /Robbery includes force or threat in the supplied act; basic theft does not require that element\./i.test(crimeRetrieval.second),
    "crime retrieval gives the force-or-threat cue before revealing the precise robbery-theft distinction");

  await navigate(`${origin}/lessons/b1/collocations-and-word-families/`, 375, 900);
  const collocationDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('produce high-value verb-noun, adjective-noun, adverb-adjective, adverb-verb, and preposition partnerships') &&
        body.includes('distinguish a conventional partnership from a universal grammar rule') &&
        body.includes('create a reusable vocabulary record'),
      westbridgeEdit: body.includes('Fictional Westbridge project update: draft and edit') &&
        body.includes('We did important progress. Our apply was success') &&
        body.includes('We made significant progress. Our application was successful'),
      network: body.includes('Get to the root: vocabulary is a network, not a single translation') &&
        body.includes('naturalness, meaning, frequency, region, or register can differ') &&
        body.includes('A collocation is not a ban on every creative or less frequent combination'),
      verbNouns: body.includes('Build verb-noun networks around a situation') &&
        body.includes('progress, an effort, a decision, a mistake, a recommendation') &&
        body.includes('research, an analysis, an experiment; work, homework') &&
        body.includes('awareness, a concern, a question, funds'),
      modifiers: body.includes('Choose modifiers by semantic preference, not by intensity alone') &&
        body.includes('heavy traffic/rain') && body.includes('strong evidence/argument') &&
        body.includes('Very is often grammatically and naturally possible'),
      slots: body.includes('Read the grammatical slot before choosing the family member') &&
        body.includes('Position is evidence, not an automatic answer'),
      families: body.includes('Learn family meaning, spelling, and constraints together') &&
        body.includes('employ · employer · employee · employment · unemployed') &&
        body.includes('produce · product · production · productive · productivity') &&
        body.includes('Friendly, lively, likely, and lonely are adjectives') &&
        body.includes('Store the real family member, not an invented form'),
      variation: body.includes('Allow natural alternatives while controlling register and meaning') &&
        body.includes('Do research is neutral and common') && body.includes('conduct research is more formal') &&
        body.includes('Strongly recommend and highly recommend are both natural') &&
        body.includes('Reach an agreement and come to an agreement are both standard'),
      spokenForm: body.includes('Sound natural: learn stress and sound with each family member') &&
        body.includes('deCIDE /dɪˈsaɪd/') && body.includes('deCIsion /dɪˈsɪʒən/') &&
        body.includes('apPLY /əˈplaɪ/') && body.includes('appliCAtion /ˌæpləˈkeɪʃən/') &&
        body.includes('make PROgress') && body.includes('the project will proGRESS'),
      listening: body.includes('Tutor-read listening: recover the family and partnership'),
      westbridgeFile: body.includes('Fictional Westbridge Skills Exchange pilot') &&
        body.includes('conducted a four-week needs survey with 80 adult residents') &&
        body.includes('did not collect later employment outcomes, compare a control group, or test whether the workshops caused a change'),
      record: body.includes('Build a vocabulary record you can retrieve and adapt') &&
        body.includes('reach an agreement on the schedule') && body.includes('natural alternative') &&
        body.includes('new sentence'),
      privacy: body.includes('You never need to reveal a real job application, rejection, unemployment, performance review') &&
        body.includes('The goal is lexical control, not evaluation of the learner’s real success or productivity'),
      production: body.includes('Final production: deliver a 90-second fictional project-language upgrade') &&
        body.includes('Can the listener recover each partnership, grammatical slot, exact family meaning, register choice'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(collocationDecision.firstGap === "made significant progress" &&
    collocationDecision.success &&
    /selected make progress, the noun application, the adjective successful, and the adverb clearly/i.test(collocationDecision.feedback) &&
    collocationDecision.outcome && collocationDecision.westbridgeEdit && collocationDecision.network &&
    collocationDecision.verbNouns && collocationDecision.modifiers && collocationDecision.slots &&
    collocationDecision.families && collocationDecision.variation && collocationDecision.spokenForm &&
    collocationDecision.listening && collocationDecision.westbridgeFile && collocationDecision.record &&
    collocationDecision.privacy && collocationDecision.production &&
    collocationDecision.retrieval === "#next-day-retrieval" &&
    collocationDecision.previous === "/lessons/b1/crime-and-society/" &&
    collocationDecision.next === "/lessons/b1/discourse-linkers/" && !collocationDecision.overflow,
    `Collocations & word families preserves lexical networks, slot and meaning decisions, valid register alternatives, corrected U.S. stress, listening, evidence limits, recording strategy, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(collocationDecision)})`);

  const collocationBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['The', 'team', 'made', 'steady', 'progress', 'and', 'met', 'the', 'grant', 'deadline']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(collocationBuilder.built === "The team made steady progress and met the grant deadline" &&
    collocationBuilder.success &&
    /Make progress reports development, and meet the deadline reports completion by the required time/i.test(collocationBuilder.feedback),
    `the collocation builder preserves development and timely-completion meanings (observed ${JSON.stringify(collocationBuilder)})`);

  const collocationRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The team did progress to the guide and caught the deadline.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(collocationRetrieval.error &&
    /Retrieve make progress on a project and meet a deadline/i.test(collocationRetrieval.first) &&
    /The team made progress on the guide and met the Friday deadline\./i.test(collocationRetrieval.second),
    "collocation retrieval gives the partnership cue before revealing the precise project-and-deadline sentence");

  await navigate(`${origin}/lessons/b1/discourse-linkers/`, 375, 900);
  const discourseDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('connect ideas through addition, contrast, concession, reason, result, example, clarification, sequence, and conclusion') &&
        body.includes('reject a connector when the logic is unsupported'),
      functionFirst: body.includes('Get to the root: decide the relationship before the linker') &&
        body.includes('They do not make unrelated ideas logical, and they do not replace evidence') &&
        body.includes('More linkers do not automatically create better writing or speaking'),
      structure: body.includes('Choose the structure: clause, phrase, or new sentence') &&
        body.includes('coordinating conjunction') && body.includes('dependent clause') &&
        body.includes('preposition phrase') && body.includes('sentence connector'),
      doubleFrames: body.includes('Keep cause, result, and concession in one complete frame') &&
        body.includes('Standard edited English normally uses one frame for each relationship'),
      placement: body.includes('Place addition, contrast, examples, and conclusions naturally') &&
        body.includes('usually before a main verb') && body.includes('more formal and less common in relaxed speech') &&
        body.includes('often at the end in conversation to add a softer contrast'),
      logic: body.includes('Audit the logic before polishing the sentence') &&
        body.includes('A connector cannot rescue a weak relationship') && body.includes('Unsupported:') &&
        body.includes('Repetition disguised as addition:') && body.includes('Example mismatch:'),
      spoken: body.includes('Sound natural: make the relationship audible') &&
        body.includes('Sentence connectors often form a short opening chunk') &&
        body.includes('and can reduce toward /ən/') && body.includes('Tutor-read listening: recover the relationship from rhythm and wording'),
      riverbend: body.includes('Fictional Riverbend evening-access file') &&
        body.includes('120 of 190 registered learners responded') &&
        body.includes('Forty-seven respondents said they had left at least one workshop early') &&
        body.includes('The quoted total is $7,200') &&
        body.includes('they do not prove that the trial will increase attendance or improve later employment outcomes'),
      privacy: body.includes('You never need to discuss a real employer, commute, disability, financial problem'),
      production: body.includes('Final production: deliver and defend a 90-second fictional recommendation') &&
        body.includes('Can the listener label each relationship, recover the evidence behind the conclusion'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      finish: document.querySelector('[data-generated-lesson-navigation] .lnav.next')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(discourseDecision.firstGap === "because" && discourseDecision.success &&
    /recovered the reason, contrast, example, concession, and result/i.test(discourseDecision.feedback) &&
    discourseDecision.outcome && discourseDecision.functionFirst && discourseDecision.structure &&
    discourseDecision.doubleFrames && discourseDecision.placement && discourseDecision.logic &&
    discourseDecision.spoken && discourseDecision.riverbend && discourseDecision.privacy &&
    discourseDecision.production && discourseDecision.retrieval === "#next-day-retrieval" &&
    discourseDecision.previous === "/lessons/b1/collocations-and-word-families/" &&
    discourseDecision.finish === "/assessments/b1-exit/" && !discourseDecision.overflow,
    `Discourse linkers preserves function-first choice, complete structures, register, logical audit, spoken chunking, proposal evidence, privacy, production, B1 completion navigation, retrieval, and mobile fit (observed ${JSON.stringify(discourseDecision)})`);

  const discourseBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['Although', 'the', 'survey', 'is', 'limited', 'it', 'identifies', 'a', 'concern', 'worth', 'testing']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(discourseBuilder.built === "Although the survey is limited it identifies a concern worth testing" &&
    discourseBuilder.success &&
    /concedes the evidence limit, and the main clause preserves the survey’s narrower value/i.test(discourseBuilder.feedback),
    `the discourse builder preserves concession and the narrower value of limited evidence (observed ${JSON.stringify(discourseBuilder)})`);

  const discourseRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Choose the longest connector and invent a relationship afterward.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(discourseRetrieval.error &&
    /Recover the decision that comes before vocabulary and punctuation/i.test(discourseRetrieval.first) &&
    /Identify the logical relationship first; then choose the linker and structure\./i.test(discourseRetrieval.second),
    "discourse retrieval gives the function-first cue before revealing the exact linker decision path");

  await navigate(`${origin}/lessons/b2/third-and-mixed-conditionals/`, 375, 900);
  const counterfactualDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish actual events from unreal alternatives') &&
        body.includes('evaluate a fictional project without turning hindsight into proof or blame'),
      greenlineNotice: body.includes('Notice one actual timeline and three unreal relationships') &&
        body.includes('It did not test older mobile phones before the May 3 launch') &&
        body.includes('staff would not be processing the backlog now'),
      timeMap: body.includes('Get to the root: locate each event before choosing a pattern') &&
        body.includes('unreal past → unreal past') && body.includes('unreal past → unreal present') &&
        body.includes('unreal continuing state → unreal past') && body.includes('unreal past → unreal future'),
      form: body.includes('Build the full form: condition, result, negatives, and questions') &&
        body.includes('positive past condition') && body.includes('negative past result') &&
        body.includes('information question') && body.includes('yes-or-no question'),
      modals: body.includes('Choose the result modal without claiming more than you know') &&
        body.includes('It is not scientific proof that the cause is sufficient'),
      evidence: body.includes('Keep counterfactual analysis separate from proof and blame') &&
        body.includes('Known fact:') && body.includes('Available opportunity:') &&
        body.includes('Uncertain outcome:') && body.includes('Unsupported blame:'),
      usage: body.includes('Use standard counterfactual if-clauses and recognize formal inversion') &&
        body.includes('occur in some informal varieties') && body.includes('Had the team not restored the backup'),
      spoken: body.includes('Sound natural: hear had, would have, and the contrast') &&
        body.includes('would’ve /ˈwʊdəv/') && body.includes('could’ve /ˈkʊdəv/') &&
        body.includes('might’ve /ˈmaɪtəv/') && body.includes('Tutor-read listening: recover the auxiliary and time relationship'),
      caseFile: body.includes('Fictional Greenline review file') &&
        body.includes('three older phone models that accounted for 18% of mobile visits during April') &&
        body.includes('The team restored 51 bookings from temporary server records') &&
        body.includes('staff were still processing 29 duplicate or incomplete requests'),
      privacy: body.includes('You never need to discuss a real mistake, disciplinary action, missed opportunity'),
      production: body.includes('Final production: lead a 90-second counterfactual review') &&
        body.includes('Can the listener recover the actual record, changed condition, condition time, consequence time'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] .lnav.prev')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(counterfactualDecision.firstGap === "The team did not test older phones before launch" &&
    counterfactualDecision.success &&
    /separated the actual record from a past possibility, present backlog consequence, continuing dependency, and calibrated might claim/i.test(counterfactualDecision.feedback) &&
    counterfactualDecision.outcome && counterfactualDecision.greenlineNotice && counterfactualDecision.timeMap &&
    counterfactualDecision.form && counterfactualDecision.modals && counterfactualDecision.evidence &&
    counterfactualDecision.usage && counterfactualDecision.spoken && counterfactualDecision.caseFile &&
    counterfactualDecision.privacy && counterfactualDecision.production &&
    counterfactualDecision.retrieval === "#next-day-retrieval" &&
    counterfactualDecision.previous === "/curriculum/#lvl-B2" &&
    counterfactualDecision.next === "/lessons/b2/past-perfect-continuous/" && !counterfactualDecision.overflow,
    `Third & mixed conditionals preserves reality layers, time mapping, complete form, modal calibration, evidence limits, inversion, U.S. spoken form, case-file reasoning, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(counterfactualDecision)})`);

  const counterfactualBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['If', 'the', 'team', 'had', 'tested', 'older', 'phones', 'it', 'might', 'have', 'found', 'the', 'problem']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(counterfactualBuilder.built === "If the team had tested older phones it might have found the problem" &&
    counterfactualBuilder.success &&
    /Past Perfect marks the unreal test, and might have found preserves uncertainty about the past result/i.test(counterfactualBuilder.feedback),
    `the counterfactual builder preserves unreal-past form and calibrated result uncertainty (observed ${JSON.stringify(counterfactualBuilder)})`);

  const counterfactualRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Choose would have twice and invent the timeline afterward.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(counterfactualRetrieval.error &&
    /Recover the two reality layers and locate both parts before selecting a formula/i.test(counterfactualRetrieval.first) &&
    /Begin with the actual record; then identify the unreal condition and result time\./i.test(counterfactualRetrieval.second),
    "counterfactual retrieval gives the reality-and-time cue before revealing the exact analysis sequence");

  await navigate(`${origin}/lessons/b2/past-perfect-continuous/`, 375, 900);
  const pastPerfectContinuousDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('anchor them to a past reference point') &&
        body.includes('give an evidence-based timeline explanation'),
      notice: body.includes('Notice one inspection from two viewpoints') &&
        body.includes('had replaced 46 of 48 circuits') && body.includes('had been drilling until 2:40'),
      referenceTime: body.includes('Get to the root: establish the past reference point first') &&
        body.includes('The continuous form does not guarantee continuation') &&
        body.includes('the endpoint remains open'),
      form: body.includes('Build the complete form') && body.includes('How long + had + subject + been + -ing?') &&
        body.includes('work → working, run → running, lie → lying'),
      aspect: body.includes('Process and result: continuous versus simple') &&
        body.includes('The difference is viewpoint, not simply long versus short') &&
        body.includes('Some contexts allow both forms'),
      tenseLens: body.includes('Choose the time lens before the aspect') &&
        body.includes('no marker chooses the tense alone'),
      lexicalMeaning: body.includes('State meanings and dynamic meanings') &&
        body.includes('Completion verbs need a plausible process reading'),
      spoken: body.includes('I’d been testing /aɪd bɪn') && body.includes('I’d be testing /aɪd bi') &&
        body.includes('/hədʒə/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      harborview: body.includes('Fictional Harborview inspection file') &&
        body.includes('46 of the building’s 48 circuits') && body.includes('called the supplier three times') &&
        body.includes('had been waiting for four hours') && body.includes('does not assign the entire delay to one person'),
      privacy: body.includes('You never need to discuss a real disciplinary issue, accident, medical event'),
      production: body.includes('Final production: give a 90-second timeline briefing') &&
        body.includes('Can the listener recover the reference point, earlier start, activity period, endpoint status'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pastPerfectContinuousDecision.firstGap === "the inspector arrived at 3:00 Friday" &&
    pastPerfectContinuousDecision.success &&
    /separated the past reference point, the extended process, the completed quantity, the stopped activity, and the limited evidence claim/i.test(pastPerfectContinuousDecision.feedback) &&
    pastPerfectContinuousDecision.outcome && pastPerfectContinuousDecision.notice &&
    pastPerfectContinuousDecision.referenceTime && pastPerfectContinuousDecision.form &&
    pastPerfectContinuousDecision.aspect && pastPerfectContinuousDecision.tenseLens &&
    pastPerfectContinuousDecision.lexicalMeaning && pastPerfectContinuousDecision.spoken &&
    pastPerfectContinuousDecision.harborview && pastPerfectContinuousDecision.privacy &&
    pastPerfectContinuousDecision.production &&
    pastPerfectContinuousDecision.retrieval === "#next-day-retrieval" &&
    pastPerfectContinuousDecision.previous === "/lessons/b2/third-and-mixed-conditionals/" &&
    pastPerfectContinuousDecision.next === "/lessons/b2/full-passive/" &&
    !pastPerfectContinuousDecision.overflow,
    `Past perfect continuous preserves reference-time mapping, complete form, aspect and tense contrasts, state and dynamic meanings, U.S. spoken form, case-file evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(pastPerfectContinuousDecision)})`);

  const pastPerfectContinuousBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['How long', 'had', 'the contractor', 'been', 'waiting', 'when', 'the inspector', 'arrived']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(pastPerfectContinuousBuilder.built === "How long had the contractor been waiting when the inspector arrived" &&
    pastPerfectContinuousBuilder.success &&
    /duration question moves had before the contractor and anchors the earlier wait to the inspector’s arrival/i.test(pastPerfectContinuousBuilder.feedback),
    `the past-perfect-continuous builder preserves duration-question order and the later past anchor (observed ${JSON.stringify(pastPerfectContinuousBuilder)})`);

  const pastPerfectContinuousRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Find any long action and choose the longest available verb form.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pastPerfectContinuousRetrieval.error &&
    /The tense is relative, so begin with the past viewpoint rather than the verb formula/i.test(pastPerfectContinuousRetrieval.first) &&
    /First establish the later past reference point; then map the earlier activity\./i.test(pastPerfectContinuousRetrieval.second),
    "past-perfect-continuous retrieval gives the relative-time cue before revealing the exact reference-point decision path");

  await navigate(`${origin}/lessons/b2/full-passive/`, 375, 900);
  const fullPassiveDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('build simple, progressive, perfect, future, and modal passives') &&
        body.includes('deliver a sourced institutional briefing'),
      notice: body.includes('Notice what stays and what changes') &&
        body.includes('The east elevator is being replaced') &&
        body.includes('The emergency signs should have been tested'),
      system: body.includes('Get to the root: preserve the auxiliary system') &&
        body.includes('future completed result') && body.includes('past criticism') &&
        body.includes('will have been inspected'),
      agency: body.includes('Choose the camera angle without hiding responsibility') &&
        body.includes('Agentless does not mean neutral') &&
        body.includes('do not delete a documented one merely to sound formal'),
      heavyChains: body.includes('Keep grammatical chains readable') &&
        body.includes('The permit has been being reviewed for six weeks') &&
        body.includes('Recasting is an information-design choice, not proof that the longer chain is ungrammatical'),
      passiveTypes: body.includes('Event, result state, and conversational get') &&
        body.includes('The package got damaged during transit') &&
        body.includes('Do not use get to replace every passive'),
      extendedPassives: body.includes('Use two-object and prepositional passives naturally') &&
        body.includes('Residents were given written notice') && body.includes('The complaint was dealt with'),
      reporting: body.includes('Report claims without changing their time or certainty') &&
        body.includes('They do not make a claim true') && body.includes('to have been + -ing') &&
        body.includes('to have been + participle'),
      spoken: body.includes('has been apPROVED') && body.includes('should have been SENT') &&
        body.includes('They’ve been reviewing the files') && body.includes('They’ve been reviewed') &&
        Boolean(document.querySelector('[data-lesson-extension] details')),
      northbank: body.includes('Fictional Northbank station accessibility file') &&
        body.includes('Eighteen of 24 platform lights had been installed') &&
        body.includes('project director Rafael Kim canceled an April 9 emergency-sign test') &&
        body.includes('final cost 7% above the original estimate') && body.includes('signed by engineer Lena Ortiz'),
      privacy: body.includes('You never need to discuss a real disciplinary investigation, accusation, medical record'),
      production: body.includes('Final production: deliver a 90-second sourced project briefing') &&
        body.includes('Can the listener recover the topic, agent status, tense, aspect, modality'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(fullPassiveDecision.firstGap === "is being replaced" && fullPassiveDecision.success &&
    /preserved progressive time, perfect result, a missed past obligation, sourced expectation, and the affected participant as passive topic/i.test(fullPassiveDecision.feedback) &&
    fullPassiveDecision.outcome && fullPassiveDecision.notice && fullPassiveDecision.system &&
    fullPassiveDecision.agency && fullPassiveDecision.heavyChains && fullPassiveDecision.passiveTypes &&
    fullPassiveDecision.extendedPassives && fullPassiveDecision.reporting && fullPassiveDecision.spoken &&
    fullPassiveDecision.northbank && fullPassiveDecision.privacy && fullPassiveDecision.production &&
    fullPassiveDecision.retrieval === "#next-day-retrieval" &&
    fullPassiveDecision.previous === "/lessons/b2/past-perfect-continuous/" &&
    fullPassiveDecision.next === "/lessons/b2/reported-speech/" && !fullPassiveDecision.overflow,
    `Full passive preserves auxiliary layers, responsible agency, readable recasting, passive types, reporting time, U.S. spoken form, case-file sourcing, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(fullPassiveDecision)})`);

  const fullPassiveBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['The remaining lights', 'should', 'have', 'been', 'tested', 'before', 'the review']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(fullPassiveBuilder.built === "The remaining lights should have been tested before the review" &&
    fullPassiveBuilder.success &&
    /Should have preserves the missed past obligation, while been tested keeps the required action passive/i.test(fullPassiveBuilder.feedback),
    `the Full Passive builder preserves modal-perfect time, obligation, and passive voice (observed ${JSON.stringify(fullPassiveBuilder)})`);

  const fullPassiveRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The records should been have transfer before the server closed.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(fullPassiveRetrieval.error &&
    /Use should have for the missed past obligation and been transferred for passive voice/i.test(fullPassiveRetrieval.first) &&
    /The records should have been transferred before the old server was closed\./i.test(fullPassiveRetrieval.second),
    "Full Passive retrieval gives the modal-perfect layering cue before revealing the exact passive repair");

  await navigate(`${origin}/lessons/b2/reported-speech/`, 375, 900);
  const b2ReportedSpeechDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('report wh-, yes-or-no, and subject questions with embedded statement order') &&
        body.includes('reconstruct a multi-speaker meeting accurately'),
      notice: body.includes('Notice three layers in every report') &&
        body.includes('Fictional Riverton cooling-center meeting, June 11') &&
        body.includes('admitted forgetting to schedule the evening security staff'),
      principle: body.includes('Get to the root: report the communicative act') &&
        body.includes('the reporter becomes responsible for the verb used to frame it') &&
        body.includes('A promise requires evidence of commitment'),
      questions: body.includes('Embed questions without keeping direct-question machinery') &&
        body.includes('subject before verb and remove question-mark-only machinery') &&
        body.includes('whether or not') && body.includes('what to bring'),
      directives: body.includes('Distinguish questions, requests, commands, and warnings') &&
        body.includes('She asked if I could stay') && body.includes('She asked me to stay'),
      patterns: body.includes('Learn stance and complement pattern together') &&
        body.includes('verb + person + preposition + -ing') &&
        body.includes('recommended that the city add shade'),
      viewpoint: body.includes('Rebuild viewpoint instead of backshifting mechanically') &&
        body.includes('Backshift is not automatic') &&
        body.includes('had to confirm two guards that day') &&
        body.includes('must be using the east entrance'),
      spoken: body.includes('Sound natural: make the report sound like a report') &&
        body.includes('statement-like falling intonation') && body.includes('She ASKED me to stay') &&
        body.includes('she didn’t TELL me to') && Boolean(document.querySelector('[data-lesson-extension] details')),
      riverton: body.includes('Fictional Riverton cooling-center record') &&
        body.includes('The certificate covers the cooling system, not evening security or staffing') &&
        body.includes('two guards for six heat-alert nights in July') &&
        body.includes('The final schedule was sent on Wednesday, June 12'),
      privacy: body.includes('You never need to report a real disciplinary meeting, accusation, legal conversation'),
      production: body.includes('Final production: give a 90-second meeting reconstruction') &&
        body.includes('Can the listener recover who originally spoke to whom'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2ReportedSpeechDecision.firstGap === "asked whether" && b2ReportedSpeechDecision.success &&
    /separated question form, admitted responsibility, safety force, an explicit listener, and a supported commitment/i.test(b2ReportedSpeechDecision.feedback) &&
    b2ReportedSpeechDecision.outcome && b2ReportedSpeechDecision.notice && b2ReportedSpeechDecision.principle &&
    b2ReportedSpeechDecision.questions && b2ReportedSpeechDecision.directives && b2ReportedSpeechDecision.patterns &&
    b2ReportedSpeechDecision.viewpoint && b2ReportedSpeechDecision.spoken && b2ReportedSpeechDecision.riverton &&
    b2ReportedSpeechDecision.privacy && b2ReportedSpeechDecision.production &&
    b2ReportedSpeechDecision.retrieval === "#next-day-retrieval" &&
    b2ReportedSpeechDecision.previous === "/lessons/b2/full-passive/" &&
    b2ReportedSpeechDecision.next === "/lessons/b2/non-defining-relative-clauses/" &&
    !b2ReportedSpeechDecision.overflow,
    `Reported speech preserves embedded order, directive force, complement patterns, viewpoint, stance ethics, U.S. spoken form, case-record evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2ReportedSpeechDecision)})`);

  const b2ReportedSpeechBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['Maya', 'asked', 'whether', 'the west branch', 'could', 'stay open', 'until nine']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2ReportedSpeechBuilder.built === "Maya asked whether the west branch could stay open until nine" &&
    b2ReportedSpeechBuilder.success &&
    /Whether introduces the yes-or-no issue, and the embedded clause keeps subject-before-modal statement order/i.test(b2ReportedSpeechBuilder.feedback),
    `the Reported Speech builder preserves yes-or-no embedding and statement order (observed ${JSON.stringify(b2ReportedSpeechBuilder)})`);

  const b2ReportedSpeechRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The coordinator asked when would the replacement bus arrive?' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2ReportedSpeechRetrieval.error &&
    /Keep when, place the subject before would, and remove direct-question order/i.test(b2ReportedSpeechRetrieval.first) &&
    /The coordinator asked when the replacement bus would arrive\./i.test(b2ReportedSpeechRetrieval.second),
    "Reported Speech retrieval gives the embedded-order cue before revealing the exact report");

  await navigate(`${origin}/lessons/b2/non-defining-relative-clauses/`, 375, 900);
  const b2NonDefiningDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent.trim(),
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('decide from discourse whether a relative clause identifies a referent') &&
        body.includes('deliver a layered project briefing whose references remain recoverable'),
      notice: body.includes('Notice how punctuation changes the group') &&
        body.includes('Six consultants were considered. Two speak Spanish') &&
        body.includes('Three consultants were selected. All three speak Spanish'),
      informationStatus: body.includes('Get to the root: identification comes from discourse') &&
        body.includes('also called a nonrestrictive clause') &&
        body.includes('does not mean unimportant') &&
        body.includes('the Jordan Lee who works for Northline'),
      forms: body.includes('Keep the relative role visible') &&
        body.includes('the relative expression cannot be omitted') &&
        body.includes('The policy, whose costs remain uncertain, is under review'),
      advancedPatterns: body.includes('Use prepositions and quantity patterns deliberately') &&
        body.includes('with whom I spoke yesterday') && body.includes('four of which') &&
        body.includes('under which staff may work off-site twice a week'),
      attachment: body.includes('comment on a whole proposition') &&
        body.includes('Attachment must be clear') &&
        body.includes('Punctuation does not turn an allegation into fact'),
      punctuation: body.includes('Punctuate the meaning, not the length') &&
        body.includes('Do not place a comma after the relative word') &&
        body.includes('The library is being renovated'),
      spoken: body.includes('Sound natural: signal a side comment without reading commas aloud') &&
        body.includes('Written commas do not require two fixed silent pauses') &&
        body.includes('The selected consultants | who ALL speak Spanish') &&
        Boolean(document.querySelector('[data-lesson-extension] details')),
      alderStreet: body.includes('Fictional Alder Street Library renovation file') &&
        body.includes('which opened in 1986') && body.includes('ten changes, four of which the board approved on May 14') &&
        body.includes('Five community advisers, all of whom attended both evening sessions') &&
        body.includes('from September 2 to September 9'),
      privacy: body.includes('You never need to identify a real family member, coworker, employer, client, medical provider'),
      production: body.includes('Final production: deliver a 90-second layered project briefing') &&
        body.includes('Can the listener recover every referent before each side comment'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2NonDefiningDecision.firstGap === "only the two Spanish-speaking consultants" && b2NonDefiningDecision.success &&
    /distinguished a selected subgroup, an identified whole group, an already identified person, a whole preceding decision, a parenthetical assertion, and an essential identifying clue/i.test(b2NonDefiningDecision.feedback) &&
    b2NonDefiningDecision.outcome && b2NonDefiningDecision.notice && b2NonDefiningDecision.informationStatus &&
    b2NonDefiningDecision.forms && b2NonDefiningDecision.advancedPatterns && b2NonDefiningDecision.attachment &&
    b2NonDefiningDecision.punctuation && b2NonDefiningDecision.spoken && b2NonDefiningDecision.alderStreet &&
    b2NonDefiningDecision.privacy && b2NonDefiningDecision.production &&
    b2NonDefiningDecision.retrieval === "#next-day-retrieval" &&
    b2NonDefiningDecision.previous === "/lessons/b2/reported-speech/" &&
    b2NonDefiningDecision.next === "/lessons/b2/modals-of-past-speculation/" &&
    !b2NonDefiningDecision.overflow,
    `Non-defining relative clauses preserves information status, set scope, relative roles, advanced patterns, attachment, punctuation, U.S. spoken form, case-file evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2NonDefiningDecision)})`);

  const b2NonDefiningBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['Jordan Lee', 'whose firm', 'won', 'the public bid', 'presented', 'the plan']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2NonDefiningBuilder.built === "Jordan Lee whose firm won the public bid presented the plan" &&
    b2NonDefiningBuilder.success &&
    /Whose links Jordan to the firm, while the main frame Jordan Lee presented the plan stays complete around the insertion/i.test(b2NonDefiningBuilder.feedback),
    `the Non-defining Relative Clauses builder preserves association and the complete main frame (observed ${JSON.stringify(b2NonDefiningBuilder)})`);

  const b2NonDefiningRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The applicants, who submitted references, reached the final stage; the commas select only some applicants.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2NonDefiningRetrieval.error &&
    /The larger applicant pool includes people without references, so the clause selects a subgroup/i.test(b2NonDefiningRetrieval.first) &&
    /The applicants who submitted references reached the final stage\./i.test(b2NonDefiningRetrieval.second),
    "Non-defining Relative Clauses retrieval gives the set-scope cue before revealing the exact identifying sentence");

  await navigate(`${origin}/lessons/b2/modals-of-past-speculation/`, 375, 900);
  const b2PastSpeculationDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: fact, inference, and time'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('reconstruct without pretending to know') && body.includes('what would change your modal?'),
      notice: body.includes('Fictional Eastport Museum archive transfer, Saturday morning') &&
        body.includes('the evidence is past, but the judgment is now'),
      calibration: body.includes('A modal does not carry a universal percentage') &&
        body.includes('new evidence can overturn it') && body.includes('not enough evidence'),
      negatives: body.includes('This use is natural in U.S. English') &&
        body.includes('can sound less common in U.S. speech') && body.includes('Past prohibition is a different meaning'),
      forms: body.includes('perfect infinitive') && body.includes('earlier ongoing or repeated activity') &&
        body.includes('earlier passive event') && body.includes('Questions invert the modal and subject'),
      boundaries: body.includes('epistemic possibility') && body.includes('unrealized ability or opportunity') &&
        body.includes('a counterfactual result') && body.includes('Had to check'),
      spoken: body.includes('Sound natural: keep weak have audible enough') && body.includes("must've") &&
        body.includes('standard writing is always could have') && Boolean(document.querySelector('[data-lesson-extension] details')),
      eastport: body.includes('Fictional Eastport Museum archive file') && body.includes('Ten of twelve image files reached Archive A') &&
        body.includes('partial encrypted package at 8:09') && body.includes('All twelve images were available by 11:18'),
      responsibility: body.includes('The record does not identify why the network connection failed') &&
        body.includes('does not establish that one person caused either problem'),
      privacy: body.includes('You never need to speculate about a real coworker, client, family member, medical event'),
      production: body.includes('Final production: deliver a 90-second evidence reconstruction') &&
        body.includes('Can the listener identify every recorded fact, the judgment time, the inferred event time'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2PastSpeculationDecision.firstGap === "a recorded past fact" && b2PastSpeculationDecision.success &&
    /separated recorded facts from present conclusions, graded the claims, and kept strong inference distinct from proof/i.test(b2PastSpeculationDecision.feedback) &&
    b2PastSpeculationDecision.outcome && b2PastSpeculationDecision.notice && b2PastSpeculationDecision.calibration &&
    b2PastSpeculationDecision.negatives && b2PastSpeculationDecision.forms && b2PastSpeculationDecision.boundaries &&
    b2PastSpeculationDecision.spoken && b2PastSpeculationDecision.eastport && b2PastSpeculationDecision.responsibility &&
    b2PastSpeculationDecision.privacy && b2PastSpeculationDecision.production &&
    b2PastSpeculationDecision.retrieval === "#next-day-retrieval" &&
    b2PastSpeculationDecision.previous === "/lessons/b2/non-defining-relative-clauses/" &&
    b2PastSpeculationDecision.next === "/lessons/b2/wish-if-only/" && !b2PastSpeculationDecision.overflow,
    `Modals of Past Speculation preserves evidence calibration, negative nuance, complete form, modal-perfect boundaries, U.S. spoken form, case-file limits, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2PastSpeculationDecision)})`);

  const b2PastSpeculationBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['file', 'l-07', 'might', 'have been', 'transferring', 'when', 'the connection', 'failed']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2PastSpeculationBuilder.built === "File L-07 might have been transferring when the connection failed" &&
    b2PastSpeculationBuilder.success &&
    /keeps the L-07 process possible and locates it at the connection failure/i.test(b2PastSpeculationBuilder.feedback),
    `the Modals of Past Speculation builder preserves continuous viewpoint and calibrated possibility (observed ${JSON.stringify(b2PastSpeculationBuilder)})`);

  const b2PastSpeculationRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The technician might have used it, although two independent records directly match.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2PastSpeculationRetrieval.error &&
    /Two independent records strongly support one positive past conclusion/i.test(b2PastSpeculationRetrieval.first) &&
    /The technician must have used the approved key/i.test(b2PastSpeculationRetrieval.second),
    "Modals of Past Speculation retrieval gives the evidence-strength cue before revealing the exact strong inference");

  await navigate(`${origin}/lessons/b2/wish-if-only/`, 375, 900);
  const b2WishDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: recover reality and attitude'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('locate reality before expressing distance') && body.includes('can you name the reality before the wish?'),
      notice: body.includes('Fictional Pine Street Learning Center open day') &&
        body.includes('one project, four distances from reality'),
      mapping: body.includes('distance from reality') && body.includes('unavailable present ability') &&
        body.includes('different completed past') && body.includes('desired behavior or process change'),
      usage: body.includes('also occurs naturally') && body.includes('Do not describe every informal') &&
        body.includes('The embedded preferred reality keeps statement order'),
      boundaries: body.includes('formal wish to') && body.includes('plausible desired change') &&
        body.includes('I wish I could have attended') && body.includes('I wish I had attended'),
      spoken: body.includes('Sound natural: let stress reveal the emotional target') && body.includes('/ˈwɪʃaɪ/') &&
        body.includes('/ˈkʊdəv/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      pineStreet: body.includes('Registration opened on September 2 for a September 15 open day') &&
        body.includes('Eighteen of the 43 attempts on those models were incomplete') && body.includes('8:00 a.m. and a duplicate at 8:05'),
      responsibility: body.includes('does not prove that one person could have predicted every problem') &&
        body.includes('Practice reflection without exposing a private regret'),
      production: body.includes('Final production: lead a 90-second reality-and-response debrief') &&
        body.includes('Can the listener recover real time, preferred reality, speaker attitude'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2WishDecision.firstGap === "an unreal present state" && b2WishDecision.success &&
    /matched each sentence to the real time and the speaker's intended attitude/i.test(b2WishDecision.feedback) &&
    b2WishDecision.outcome && b2WishDecision.notice && b2WishDecision.mapping && b2WishDecision.usage &&
    b2WishDecision.boundaries && b2WishDecision.spoken && b2WishDecision.pineStreet &&
    b2WishDecision.responsibility && b2WishDecision.production &&
    b2WishDecision.retrieval === "#next-day-retrieval" &&
    b2WishDecision.previous === "/lessons/b2/modals-of-past-speculation/" &&
    b2WishDecision.next === "/lessons/b2/causative-have-get-something-done/" && !b2WishDecision.overflow,
    `Wish / If Only preserves real-time mapping, attitude, complete form, usage boundaries, U.S. spoken form, case-file limits, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2WishDecision)})`);

  const b2WishBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['i', 'wish', 'the', 'main', 'room', 'were', 'larger']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2WishBuilder.built === "I wish the main room were larger" && b2WishBuilder.success &&
    /contrasts the room's present size with a preferred present state/i.test(b2WishBuilder.feedback),
    `the Wish / If Only builder preserves embedded order and present counterfactual meaning (observed ${JSON.stringify(b2WishBuilder)})`);

  const b2WishRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'I wish the studio had been quieter tomorrow.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2WishRetrieval.error &&
    /The studio is noisy now, so use a careful counterfactual present form/i.test(b2WishRetrieval.first) &&
    /I wish the studio were quieter/i.test(b2WishRetrieval.second),
    "Wish / If Only retrieval gives the real-time cue before revealing the exact present counterfactual");

  await navigate(`${origin}/lessons/b2/causative-have-get-something-done/`, 375, 900);
  const b2CausativeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: recover each participant and relationship'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('show who organizes, who acts, and what is affected') && body.includes('can you defend every participant?'),
      notice: body.includes('Fictional Northfield Community Center reopening') &&
        body.includes('the same project through four agency frames'),
      agency: body.includes('arranged work, affected thing in focus') && body.includes('persuasion, effort, or achieved response') &&
        body.includes('The grammar does not identify the performer automatically'),
      form: body.includes('Build tense and question form on the first verb') && body.includes('A time marker selects the tense') &&
        body.includes('We have had the locks changed'),
      boundaries: body.includes('conversational get-passive') && body.includes('Do not turn an affected person into a blamed organizer') &&
        body.includes('Directives and persuasion carry social meaning'),
      spoken: body.includes('Sound natural: keep the final action audible') && body.includes('/ˈɡɑɾɪt/') &&
        body.includes('/ˈɡɛɾɚtə/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      northfield: body.includes('approved a June 1 reopening plan on April 4') && body.includes('240 programs printed by Lakeview Print on May 20') &&
        body.includes('Staff installed the directional signs themselves on May 24'),
      responsibility: body.includes('does not identify why it burst or assign personal responsibility') &&
        body.includes('Name a provider only when the file documents that provider'),
      privacy: body.includes('You never need to disclose a real home address, landlord dispute, legal service'),
      production: body.includes('Final production: deliver a 90-second service and delegation briefing') &&
        body.includes('Can the listener identify who organized, who performed, what received the action'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2CausativeDecision.firstGap === "the center" && b2CausativeDecision.success &&
    /separated organizer, performer, affected object, achieved response, and unwanted experience/i.test(b2CausativeDecision.feedback) &&
    b2CausativeDecision.outcome && b2CausativeDecision.notice && b2CausativeDecision.agency &&
    b2CausativeDecision.form && b2CausativeDecision.boundaries && b2CausativeDecision.spoken &&
    b2CausativeDecision.northfield && b2CausativeDecision.responsibility && b2CausativeDecision.privacy &&
    b2CausativeDecision.production && b2CausativeDecision.retrieval === "#next-day-retrieval" &&
    b2CausativeDecision.previous === "/lessons/b2/wish-if-only/" &&
    b2CausativeDecision.next === "/lessons/b2/future-perfect-and-future-continuous/" && !b2CausativeDecision.overflow,
    `Causative Have/Get preserves participant roles, tense control, meaning boundaries, U.S. spoken form, case-file agency, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2CausativeDecision)})`);

  const b2CausativeBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['we', 'are having', 'the', 'sound', 'system', 'tested', 'on', 'may', '29']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2CausativeBuilder.built === "We are having the sound system tested on May 29" &&
    b2CausativeBuilder.success && /reports a future arrangement without claiming completion/i.test(b2CausativeBuilder.feedback),
    `the Causative Have/Get builder preserves progressive arrangement, participant order, and incomplete status (observed ${JSON.stringify(b2CausativeBuilder)})`);

  const b2CausativeRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'We had reviewed the contract by ourselves externally.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2CausativeRetrieval.error &&
    /We organized the service; the contract received the action; the provider is documented/i.test(b2CausativeRetrieval.first) &&
    /We had the contract reviewed by an external attorney/i.test(b2CausativeRetrieval.second),
    "Causative Have/Get retrieval gives the participant-and-provider cue before revealing the exact arranged service");

  await navigate(`${origin}/lessons/b2/future-perfect-and-future-continuous/`, 375, 900);
  const b2FutureViewpointDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: recover reference point and viewpoint'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('stand at the checkpoint, then choose the camera') && body.includes('can you defend the camera and forecast?'),
      notice: body.includes('Fictional Harborline Library archive, Friday May 10') && body.includes('one Friday checkpoint, three cameras'),
      viewpoint: body.includes('the checkpoint does not choose the camera') && body.includes('do not mechanically select a tense without meaning') &&
        body.includes('the form alone does not say that work stops'),
      form: body.includes('Build every auxiliary and final form') && body.includes('Will have been branches in two directions') &&
        body.includes('will have been verified') && body.includes('will have been verifying records'),
      boundaries: body.includes('Present Continuous arrangement versus Future Continuous viewpoint') &&
        body.includes('Polite inquiry is context, not a magic tense') && body.includes('Future time clauses normally use a present form'),
      spoken: body.includes('Sound natural: keep the viewpoint chain recoverable') && body.includes('/ˈaɪləv/') &&
        body.includes('/ˈðeɪləvbɪn/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      harborline: body.includes('5,400 complete by 5:00 p.m.') && body.includes('average of 750 records per working day') &&
        body.includes('Tuesday through Friday provide four working days') && body.includes('Restoration began April 26 for twelve damaged images'),
      responsibility: body.includes('does not guarantee the daily rate, rule out an outage, or identify one person') &&
        body.includes('forecast as a forecast, not a guarantee'),
      privacy: body.includes('You never need to disclose real immigration timing, medical treatment, legal deadlines'),
      production: body.includes('Final production: deliver a 90-second future checkpoint briefing') &&
        body.includes('Can the listener recover the checkpoint, earlier start, expected result, surrounding activity'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2FutureViewpointDecision.firstGap === "5:00 p.m. Friday" && b2FutureViewpointDecision.success &&
    /located the checkpoint, then separated expected completion, activity at that point, accumulated duration, and an explicit condition/i.test(b2FutureViewpointDecision.feedback) &&
    b2FutureViewpointDecision.outcome && b2FutureViewpointDecision.notice && b2FutureViewpointDecision.viewpoint &&
    b2FutureViewpointDecision.form && b2FutureViewpointDecision.boundaries && b2FutureViewpointDecision.spoken &&
    b2FutureViewpointDecision.harborline && b2FutureViewpointDecision.responsibility && b2FutureViewpointDecision.privacy &&
    b2FutureViewpointDecision.production && b2FutureViewpointDecision.retrieval === "#next-day-retrieval" &&
    b2FutureViewpointDecision.previous === "/lessons/b2/causative-have-get-something-done/" &&
    b2FutureViewpointDecision.next === "/lessons/b2/cleft-sentences-for-emphasis/" && !b2FutureViewpointDecision.overflow,
    `Future Perfect and Future Continuous preserves checkpoint mapping, open endpoints, complete form, future boundaries, U.S. spoken form, forecast evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2FutureViewpointDecision)})`);

  const b2FutureViewpointBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the team', 'will have', 'verified', 'all', '8400', 'records', 'by', 'friday']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2FutureViewpointBuilder.built === "The team will have verified all 8,400 records by Friday" &&
    b2FutureViewpointBuilder.success && /links an expected completed quantity to the Friday limit/i.test(b2FutureViewpointBuilder.feedback),
    `the Future Perfect builder preserves active form, completed quantity, and future limit (observed ${JSON.stringify(b2FutureViewpointBuilder)})`);

  const b2FutureViewpointRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'At noon, the team will be all six forms.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2FutureViewpointRetrieval.error &&
    /All six completed forms must exist no later than noon/i.test(b2FutureViewpointRetrieval.first) &&
    /By noon, the team will have submitted all six forms/i.test(b2FutureViewpointRetrieval.second),
    "Future viewpoint retrieval gives the completion-and-deadline cue before revealing the exact Future Perfect result");

  await navigate(`${origin}/lessons/b2/cleft-sentences-for-emphasis/`, 375, 900);
  const b2CleftDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: proposition, focus, and implication'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('keep the proposition, move the spotlight') && body.includes('does the spotlight serve the listener?'),
      notice: body.includes('Fictional Lakeside pedestrian pilot review') && body.includes('the evidence stays constant while the correction changes'),
      focus: body.includes('separate the proposition from the focus') && body.includes('It-clefts carry a background assumption') &&
        body.includes('A cleft is not simply a longer synonym'),
      form: body.includes('Build the gap, link, agreement, and tense accurately') &&
        body.includes('Subject focus versus object focus') && body.includes('Person links and pronoun case in real U.S. English'),
      variation: body.includes('It was I who called') && body.includes('It was me who called') &&
        body.includes('The reason is because') && body.includes('All I did was to call'),
      boundaries: body.includes('referential it + relative clause') && body.includes('embedded question') &&
        body.includes('neutral declarative') && body.includes('Standard cleft link and real variation'),
      spoken: body.includes('Sound natural: one nucleus carries the correction') && body.includes('/ɪtwəz/') &&
        body.includes('/ˈwʌtwi/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      lakeside: body.includes('six-month independent study ended April 30') && body.includes('430-signature resident petition') &&
        body.includes('6-2 vote') && body.includes('did not approve permanent or citywide adoption'),
      responsibility: body.includes('emphasis is not evidence') && body.includes('the source must support the correction'),
      privacy: body.includes('You never need to discuss a real accusation, workplace dispute, political belief'),
      production: body.includes('Final production: deliver a 90-second evidence-based correction') &&
        body.includes('Can the listener recover the neutral proposition, focused constituent'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2CleftDecision.firstGap === "the new safety evidence changed the committee's position" && b2CleftDecision.success &&
    /recovered the shared proposition and identified cause, time, open variable, limited scope, and evidence-based contrast/i.test(b2CleftDecision.feedback) &&
    b2CleftDecision.outcome && b2CleftDecision.notice && b2CleftDecision.focus && b2CleftDecision.form &&
    b2CleftDecision.variation && b2CleftDecision.boundaries && b2CleftDecision.spoken && b2CleftDecision.lakeside &&
    b2CleftDecision.responsibility && b2CleftDecision.privacy && b2CleftDecision.production &&
    b2CleftDecision.retrieval === "#next-day-retrieval" &&
    b2CleftDecision.previous === "/lessons/b2/future-perfect-and-future-continuous/" &&
    b2CleftDecision.next === "/lessons/b2/advanced-discourse-markers/" && !b2CleftDecision.overflow,
    `Cleft Sentences preserves proposition recovery, supported focus, presupposition, complete gaps, real usage variation, clause boundaries, U.S. spoken form, evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2CleftDecision)})`);

  const b2CleftBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['it was', 'the new', 'safety evidence', 'that', 'changed', 'the', "committee's", 'position']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2CleftBuilder.built === "It was the new safety evidence that changed the committee's position" &&
    b2CleftBuilder.success && /selects the documented cause and preserves the neutral proposition/i.test(b2CleftBuilder.feedback),
    `the Cleft Sentences builder preserves the documented focus and neutral proposition (observed ${JSON.stringify(b2CleftBuilder)})`);

  const b2CleftRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'It was Priya which the duplicate identified her.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2CleftRetrieval.error &&
    /Priya is the focused actor and fills the subject gap after who/i.test(b2CleftRetrieval.first) &&
    /It was Priya who identified the duplicate entry/i.test(b2CleftRetrieval.second),
    "Cleft Sentences retrieval gives the focused-actor and subject-gap cue before revealing the exact person cleft");

  await navigate(`${origin}/lessons/b2/advanced-discourse-markers/`, 375, 900);
  const b2DiscourseDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: relation, evidence, and strength'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('make the logic visible, not heavier') && body.includes('can every signpost defend its promise?'),
      notice: body.includes('Fictional Westbridge evening hub proposal') && body.includes('one record, six logical moves'),
      relations: body.includes('name the move before the marker') && body.includes('counterexpectation') &&
        body.includes('direct correction') && body.includes('weighed conclusion'),
      contrast: body.includes('On the contrary is not a formal version of however') &&
        body.includes('The hub was not empty. On the contrary, it averaged 46 visits per evening.'),
      form: body.includes('Build the clause, position, and punctuation accurately') &&
        body.includes('semicolon-linked connector') && body.includes('concessive degree') && body.includes('paired reinforcement'),
      however: body.includes('Contrastive however and concessive however have different syntax') &&
        body.includes('However short the trial was') && body.includes('The trial, however, was useful'),
      boundaries: body.includes('A result marker presents reasoning; it does not certify causation') &&
        body.includes('Reformulation, specification, and example promise different things') &&
        body.includes('Longer and more formal does not mean more advanced'),
      spoken: body.includes('Sound natural: signal the turn, then foreground the message') && body.includes('/ˌnevərðəˈles/') &&
        body.includes('/ðət/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      westbridge: body.includes('January 8 through March 1') && body.includes('average of 46 visits per evening') &&
        body.includes('Sixty-eight users chose to answer an optional survey') && body.includes('$28,400') &&
        body.includes('It did not consider a permanent program or expansion to other sites'),
      responsibility: body.includes('cannot use therefore to turn attendance into employment impact') &&
        body.includes('markers should display a chain the evidence already supports'),
      privacy: body.includes('You never need to discuss a real political affiliation, employer dispute'),
      production: body.includes('Final production: deliver a two-minute evidence map') &&
        body.includes('Can the listener identify each promised relation, its two connected propositions'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2DiscourseDecision.firstGap === "accepts the short duration as a real limitation" && b2DiscourseDecision.success &&
    /identified concession, counterexpectation, addition, evidence-limited inference, reformulation, and balanced conclusion/i.test(b2DiscourseDecision.feedback) &&
    b2DiscourseDecision.outcome && b2DiscourseDecision.notice && b2DiscourseDecision.relations &&
    b2DiscourseDecision.contrast && b2DiscourseDecision.form && b2DiscourseDecision.however &&
    b2DiscourseDecision.boundaries && b2DiscourseDecision.spoken && b2DiscourseDecision.westbridge &&
    b2DiscourseDecision.responsibility && b2DiscourseDecision.privacy && b2DiscourseDecision.production &&
    b2DiscourseDecision.retrieval === "#next-day-retrieval" &&
    b2DiscourseDecision.previous === "/lessons/b2/cleft-sentences-for-emphasis/" &&
    b2DiscourseDecision.next === "/lessons/b2/abstract-and-academic-topics/" && !b2DiscourseDecision.overflow,
    `Advanced Discourse Markers preserves relation mapping, concession and correction, form, however syntax, inference limits, U.S. spoken prominence, evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2DiscourseDecision)})`);

  const b2DiscourseBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['admittedly', 'the trial', 'was short', 'nevertheless', 'it', 'supports', 'a longer', 'test']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2DiscourseBuilder.built === "Admittedly the trial was short Nevertheless it supports a longer test" &&
    b2DiscourseBuilder.success && /concedes a real limitation before preserving a supported next step/i.test(b2DiscourseBuilder.feedback),
    `the Advanced Discourse Markers builder preserves the concession and counterexpectation sequence (observed ${JSON.stringify(b2DiscourseBuilder)})`);

  const b2DiscourseRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Despite the inspection covered two rooms, but the pattern.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2DiscourseRetrieval.error &&
    /Grant the narrow scope first, then preserve a proportionate next step despite it/i.test(b2DiscourseRetrieval.first) &&
    /Admittedly, the inspection covered only two rooms. Nevertheless, it identified a pattern worth testing building-wide/i.test(b2DiscourseRetrieval.second),
    "Advanced Discourse Markers retrieval gives the concession-and-counterexpectation cue before revealing the exact pair");

  await navigate(`${origin}/lessons/b2/abstract-and-academic-topics/`, 375, 900);
  const b2AcademicDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: observation, interpretation, and boundary'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('make the thinking precise and visible') && body.includes('can the source still be seen through the vocabulary?'),
      notice: body.includes('Fictional Cedar Grove library reminder trial') && body.includes('the same study supports several different statements'),
      reasoning: body.includes('every abstract noun has a reasoning job') && body.includes('causal effect') &&
        body.includes('hypothesis') && body.includes('recommendation'),
      causation: body.includes('Association and causation are claims about design, not magic words') &&
        body.includes('Random allocation can strengthen a causal inference') && body.includes('A mechanism is not the same as an effect'),
      families: body.includes('Build word families, countability, and collocations accurately') &&
        body.includes('ANalyze') && body.includes('aNALysis') && body.includes('anaLYTical'),
      countability: body.includes('Evidence and research are normally uncountable') &&
        body.includes('Data has genuine number variation') && body.includes('Do not design a one-answer item that pretends only one form exists'),
      claims: body.includes('Calibrate the claim instead of choosing a permanently cautious verb') &&
        body.includes('Significant has everyday and statistical meanings') && body.includes('Scope is part of accuracy') &&
        body.includes('Unpack dense nouns when the actor disappears'),
      spoken: body.includes('Sound natural: stress the family and chunk the reasoning') && body.includes('The results INdicate') &&
        body.includes('/ˈfæktərɪn/') && body.includes('/fər/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      cedar: body.includes('From January 15 through March 10') && body.includes('Six hundred adults who had already opted into library messages') &&
        body.includes('138 of 300 participants attended, or 46%') && body.includes('111 of 300 attended, or 37%') &&
        body.includes('The text service cost $1,260'),
      responsibility: body.includes('did not include a statistical test, confidence interval, message-delivery audit') &&
        body.includes('Random assignment supports a causal interpretation') && body.includes('Missing delivery and workshop-type information remains a limitation'),
      privacy: body.includes('You never need to discuss a real diagnosis, disability, academic result'),
      production: body.includes('Final production: deliver a two-minute evidence-to-implication briefing') &&
        body.includes('Can the listener identify the source, observation, variables, design strength'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2AcademicDecision.firstGap === "a nine-percentage-point observed difference" && b2AcademicDecision.success &&
    /separated the observed difference, bounded causal interpretation, sampling and outcome limits, next-study implication, statistical evidence gap, and practical judgment/i.test(b2AcademicDecision.feedback) &&
    b2AcademicDecision.outcome && b2AcademicDecision.notice && b2AcademicDecision.reasoning &&
    b2AcademicDecision.causation && b2AcademicDecision.families && b2AcademicDecision.countability &&
    b2AcademicDecision.claims && b2AcademicDecision.spoken && b2AcademicDecision.cedar &&
    b2AcademicDecision.responsibility && b2AcademicDecision.privacy && b2AcademicDecision.production &&
    b2AcademicDecision.retrieval === "#next-day-retrieval" &&
    b2AcademicDecision.previous === "/lessons/b2/advanced-discourse-markers/" &&
    b2AcademicDecision.next === "/lessons/b2/politics-and-global-issues/" && !b2AcademicDecision.overflow,
    `Abstract and Academic Topics preserves reasoning functions, word families, countability, design-sensitive causation, significance, scope, U.S. spoken form, evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2AcademicDecision)})`);

  const b2AcademicBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the randomized', 'trial', 'found', 'a nine', 'percentage', 'point', 'difference', 'in', 'attendance']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2AcademicBuilder.built === "The randomized trial found a nine percentage point difference in attendance" &&
    b2AcademicBuilder.success && /identifies the design and reports the observed size and outcome without adding statistical significance/i.test(b2AcademicBuilder.feedback),
    `the Abstract and Academic Topics builder preserves design, effect size, unit, outcome, and statistical restraint (observed ${JSON.stringify(b2AcademicBuilder)})`);

  const b2AcademicRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Every interpretation is automatically an observed mechanism.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2AcademicRetrieval.error &&
    /Separate what the source observed from what the analyst thinks may explain it/i.test(b2AcademicRetrieval.first) &&
    /The difference is a finding; the proposed reduced-confusion mechanism is an interpretation that still needs testing/i.test(b2AcademicRetrieval.second),
    "Abstract and Academic Topics retrieval gives the observation-versus-explanation cue before revealing the exact distinction");

  await navigate(`${origin}/lessons/b2/politics-and-global-issues/`, 375, 900);
  const b2PoliticsDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: authority, proposal, actor, and evidence'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish government, state, country, nation') && body.includes('can every public claim identify its authority and evidence?'),
      notice: body.includes('Fictional Riverton Central Market access proposal') && body.includes('a policy map comes before a position'),
      institutions: body.includes('Institution names are system-dependent') && body.includes('Stakeholder mapping is not opinion assignment') &&
        body.includes('public consultation'),
      policy: body.includes('Build policy, law, and civic collocations accurately') && body.includes('Legislation is normally uncountable') &&
        body.includes('Proposal verbs do not promise results') && body.includes('Participation verbs have different grammar'),
      evaluation: body.includes('transparency') && body.includes('accountability') && body.includes('oversight') &&
        body.includes('Define equality and equity operationally') && body.includes('Outputs, outcomes, impacts, trade-offs, and unintended consequences'),
      neutrality: body.includes('Neutral framing is not false balance'),
      protection: body.includes('refugee') && body.includes('asylum-seeker') && body.includes('internally displaced person') &&
        body.includes('Migrant is not a catchall replacement'),
      spoken: body.includes('Sound natural: attribute first, then foreground the evidence') && body.includes('governMENtal') &&
        body.includes('legisLAtion') && body.includes('/tə/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      riverton: body.includes('Over twelve baseline weekends') && body.includes('184 voluntary consultation responses') &&
        body.includes('31 of those 42') && body.includes('$72,000') && body.includes('An independent evaluator will report') &&
        body.includes('does not authorize a permanent restriction'),
      responsibility: body.includes('provides no legal or health threshold') && body.includes('The consultation was self-selected'),
      privacy: body.includes('You never need to reveal a real political affiliation'),
      production: body.includes('Final production: deliver a two-minute neutral policy briefing') &&
        body.includes('Can the listener identify who may decide, who implements, who monitors'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2PoliticsDecision.firstGap === "the elected Riverton council" && b2PoliticsDecision.success &&
    /identified decision authority, implementation, proposal scope, diverse stakeholders, consultation evidence, and temporary evidence-building status/i.test(b2PoliticsDecision.feedback) &&
    b2PoliticsDecision.outcome && b2PoliticsDecision.notice && b2PoliticsDecision.institutions &&
    b2PoliticsDecision.policy && b2PoliticsDecision.evaluation && b2PoliticsDecision.neutrality &&
    b2PoliticsDecision.protection && b2PoliticsDecision.spoken && b2PoliticsDecision.riverton &&
    b2PoliticsDecision.responsibility && b2PoliticsDecision.privacy && b2PoliticsDecision.production &&
    b2PoliticsDecision.retrieval === "#next-day-retrieval" &&
    b2PoliticsDecision.previous === "/lessons/b2/abstract-and-academic-topics/" &&
    b2PoliticsDecision.next === "/lessons/b2/science-and-innovation/" && !b2PoliticsDecision.overflow,
    `Politics and Global Issues preserves institutional roles, jurisdiction variation, policy-law language, governance criteria, protection terminology, neutral attribution, U.S. spoken form, evidence, privacy, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2PoliticsDecision)})`);

  const b2PoliticsBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['supporters', 'argue', 'that', 'the trial', 'may improve', 'safety', 'while', 'shop owners', 'raise', 'access concerns']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2PoliticsBuilder.built === "Supporters argue that the trial may improve safety while shop owners raise access concerns" &&
    b2PoliticsBuilder.success && /attributes the benefit claim and preserves the responding shop owners' separate access concern/i.test(b2PoliticsBuilder.feedback),
    `the Politics and Global Issues builder preserves two attributed positions without narrator judgment (observed ${JSON.stringify(b2PoliticsBuilder)})`);

  const b2PoliticsRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'The court implemented the bus schedule because consultation enacted it.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2PoliticsRetrieval.error &&
    /Separate legislative passage, complete enactment, executive implementation, and judicial case review/i.test(b2PoliticsRetrieval.first) &&
    /The assembly passes the bill, the complete process enacts the law, the agency implements it, and the court reviews the dispute in a case/i.test(b2PoliticsRetrieval.second),
    "Politics and Global Issues retrieval gives the institutional-stage cue before revealing the exact repair");

  await navigate(`${origin}/lessons/b2/science-and-innovation/`, 375, 900);
  const b2ScienceDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: question, design, finding, and boundary'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('separate a research question, hypothesis, prediction') && body.includes('can the evidence still be seen through the innovation claim?'),
      notice: body.includes('Fictional Marlowe adaptive cooling-controller pilot') && body.includes('one field trial supports several different claims'),
      process: body.includes('map the scientific claim before judging it') && body.includes('A hypothesis is not automatically the starting point in every field') &&
        body.includes('Publication status provides evidence context, not a truth switch'),
      measurement: body.includes('Measure evidence without turning technical words into decorations') &&
        body.includes('Accuracy and precision answer different questions') && body.includes('Reproducibility and replication have field-specific usage') &&
        body.includes('Statistical significance is not practical importance'),
      readiness: body.includes('Move from a useful idea to responsible adoption') && body.includes('Readiness labels are framework-dependent') &&
        body.includes('New, inventive, and innovative are not automatic synonyms') && body.includes('Cost-effective is an evidence claim'),
      spoken: body.includes('Sound natural: foreground the claim, then lower the certainty') && body.includes('hyPOTHeses') &&
        body.includes('aNALysis') && body.includes('innoVAtion') && body.includes('technoLOGical') &&
        body.includes('/ˈdeɪtə/') && body.includes('/ˈdætə/') && Boolean(document.querySelector('[data-lesson-extension] details')),
      marlowe: body.includes('From March 4 through April 28') && body.includes('twelve cold-storage rooms at three warehouses') &&
        body.includes('Prototype rooms averaged 18.3') && body.includes('timer rooms averaged 20.0') &&
        body.includes('seventeen hours in total') && body.includes('fourteen randomly selected days') &&
        body.includes('Hardware cost $1,800 per room') && body.includes('$35 per month'),
      responsibility: body.includes('no confidence interval or statistical test') && body.includes('no legal or product-safety threshold') &&
        body.includes('analysis code and room-level data have not been released') && body.includes('does not establish cost-effectiveness'),
      privacy: body.includes('You never need to discuss a real diagnosis, treatment choice, disability, confidential dataset'),
      assessment: body.includes('The pilot observed fewer reported delays') && body.includes('a larger comparison is needed before attributing the improvement to the tool'),
      production: body.includes('Final production: deliver a two-minute responsible innovation review') &&
        body.includes('Can the listener identify what was asked, what was measured, what was found'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2ScienceDecision.firstGap === "electricity use while temperatures remain in range" && b2ScienceDecision.success &&
    /separated the question, matched randomized comparison, measured energy finding, operating-range result, evidence boundary, and proportionate next step/i.test(b2ScienceDecision.feedback) &&
    b2ScienceDecision.outcome && b2ScienceDecision.notice && b2ScienceDecision.process &&
    b2ScienceDecision.measurement && b2ScienceDecision.readiness && b2ScienceDecision.spoken &&
    b2ScienceDecision.marlowe && b2ScienceDecision.responsibility && b2ScienceDecision.privacy &&
    b2ScienceDecision.assessment && b2ScienceDecision.production &&
    b2ScienceDecision.retrieval === "#next-day-retrieval" &&
    b2ScienceDecision.previous === "/lessons/b2/politics-and-global-issues/" &&
    b2ScienceDecision.next === "/lessons/b2/idioms-and-fixed-expressions/" && !b2ScienceDecision.overflow,
    `Science and Innovation preserves research-process roles, measurement distinctions, publication status, readiness, risk, U.S. spoken form, field evidence, privacy, assessment alignment, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2ScienceDecision)})`);

  const b2ScienceBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['the field', 'trial', 'found', 'an 8.5', 'percent', 'energy', 'difference', 'under', 'the reported', 'spring conditions']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2ScienceBuilder.built === "The field trial found an 8.5 percent energy difference under the reported spring conditions" &&
    b2ScienceBuilder.success && /reports the observed difference and field context without adding statistical significance or universal scope/i.test(b2ScienceBuilder.feedback),
    `the Science and Innovation builder preserves numerical finding, field stage, season, and evidence scope (observed ${JSON.stringify(b2ScienceBuilder)})`);

  const b2ScienceRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'A hypothesis is a proven result and a prediction is a completed deployment.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2ScienceRetrieval.error &&
    /Separate the proposed explanatory relationship from its observable test result/i.test(b2ScienceRetrieval.first) &&
    /The hypothesis proposes the relationship; the prediction states the expected measurement/i.test(b2ScienceRetrieval.second),
    "Science and Innovation retrieval gives the hypothesis-versus-prediction cue before revealing the exact distinction");

  await navigate(`${origin}/lessons/b2/idioms-and-fixed-expressions/`, 375, 900);
  const b2IdiomDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: infer purpose before definition'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish literal meaning, idiomatic meaning, collocation') && body.includes('did the expression improve the message?'),
      notice: body.includes('Fictional Alder Street Museum launch chat') && body.includes('the situation does most of the explaining'),
      inference: body.includes('Not every conventional chunk is equally idiomatic') && body.includes('Use four clues before opening a dictionary') &&
        body.includes('Recognition can come before active use'),
      meaning: body.includes('Choose ten meaning-and-purpose chunks') && body.includes('read between the lines') &&
        body.includes('a step in the right direction') && body.includes('take the claim with a grain of salt'),
      grammar: body.includes('Build the grammar around the part that cannot move') && body.includes('Fixed does not mean frozen') &&
        body.includes('Variation is not automatically an error') && body.includes('a pinch of salt'),
      pragmatics: body.includes('Choose the conversational effect, not the most colorful phrase') &&
        body.includes('Register includes relationship, channel, stakes, and evidence') &&
        body.includes("Some familiar idioms can dismiss another person's difficulty") &&
        body.includes('One exact idiom is stronger than a cluster'),
      spoken: body.includes('Sound natural: treat the chunk as one thought group') && body.includes('same PAGE about the DATE') &&
        body.includes('cut CORners on ACcess') && body.includes('rings a BELL') &&
        body.includes('call it a DAY') && Boolean(document.querySelector('[data-lesson-extension] details')),
      alder: body.includes('September 23, internal meeting') && body.includes('one inch below the museum') &&
        body.includes('delivery by October 14') && body.includes('deliver a revised ramp by October 10') &&
        body.includes('duplicated 7 of 120 test orders') && body.includes('zero duplicates in 300 staging orders') &&
        body.includes('preview moved from October 12 to October 15') && body.includes('October 19 launch date remained unchanged'),
      responsibility: body.includes('did not identify why') && body.includes('overstated the setback') &&
        body.includes('did not guarantee live reliability') && body.includes('did not cancel the preview or launch'),
      privacy: body.includes('You never need to discuss a real conflict, workplace failure, medical result, legal problem'),
      assessment: body.includes('The pilot provides limited evidence supporting a larger trial; it does not establish full effectiveness'),
      production: body.includes('Final production: tell a two-minute idiom-controlled project story') &&
        body.includes("Can the listener recover each expression's meaning, communicative job, grammar, degree, and register"),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2IdiomDecision.firstGap === "start the coordinated work" && b2IdiomDecision.success &&
    /inferred launch initiation, shared dates, an accessibility boundary, extra contractual effort, an exaggerated restart, and a provisional positive update/i.test(b2IdiomDecision.feedback) &&
    b2IdiomDecision.outcome && b2IdiomDecision.notice && b2IdiomDecision.inference &&
    b2IdiomDecision.meaning && b2IdiomDecision.grammar && b2IdiomDecision.pragmatics &&
    b2IdiomDecision.spoken && b2IdiomDecision.alder && b2IdiomDecision.responsibility &&
    b2IdiomDecision.privacy && b2IdiomDecision.assessment && b2IdiomDecision.production &&
    b2IdiomDecision.retrieval === "#next-day-retrieval" &&
    b2IdiomDecision.previous === "/lessons/b2/science-and-innovation/" &&
    b2IdiomDecision.next === "/lessons/b2/register-and-formality/" && !b2IdiomDecision.overflow,
    `Idioms and Fixed Expressions preserves contextual inference, chunk categories, fixed and flexible grammar, variety, pragmatics, restraint, U.S. spoken form, channel evidence, privacy, assessment alignment, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2IdiomDecision)})`);

  const b2IdiomBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['let us', 'make sure', 'we are', 'on the', 'same page', 'about', 'the October 19', 'launch']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2IdiomBuilder.built === "Let us make sure we are on the same page about the October 19 launch" &&
    b2IdiomBuilder.success && /uses the fixed alignment phrase while preserving the exact date and event that define agreement/i.test(b2IdiomBuilder.feedback),
    `the Idioms and Fixed Expressions builder preserves fixed grammar and explicit agreement scope (observed ${JSON.stringify(b2IdiomBuilder)})`);

  const b2IdiomRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'I ring the title because every author is certain.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2IdiomRetrieval.error &&
    /Use the clue as subject and preserve partial rather than complete recognition/i.test(b2IdiomRetrieval.first) &&
    /The title rings a bell, but the speaker cannot fully place it/i.test(b2IdiomRetrieval.second),
    "Idioms and Fixed Expressions retrieval gives the partial-recognition cue before revealing the exact repair");

  await navigate(`${origin}/lessons/b2/register-and-formality/`, 375, 900);
  const b2RegisterDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: infer the situation before labeling the language'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish register, formality, tone, and politeness') && body.includes('could this reader act correctly?'),
      notice: body.includes('Fictional Cedar Loop workshop') && body.includes('one practical need, four appropriate messages') &&
        body.includes('The safety instruction is the most direct, but it is not the least respectful'),
      bundle: body.includes('register is a bundle, not a ladder') && body.includes('Who is the audience?') &&
        body.includes('What roles and power apply?') && body.includes('What are the stakes?') &&
        body.includes('Do not assign one permanent register to a person'),
      requests: body.includes('Choose request grammar by action, choice, and consequence') &&
        body.includes('would you mind + -ing') && body.includes('requirement + reason + support') &&
        body.includes('Contractions do not automatically make professional English casual'),
      pragmatics: body.includes('Manage disagreement, refusal, and repair without hiding the message') &&
        body.includes('Respect the listener’s agency') && body.includes('The sample includes only twelve users'),
      clarity: body.includes('Use plain language at every level of formality') &&
        body.includes('Passive is a tool, not a formality switch') &&
        body.includes('our scheduling team activated the wrong automation rule'),
      spoken: body.includes('Pronunciation focus: hear respect, focus, and urgency in U.S. speech') &&
        body.includes('/kʊdʒə/') && body.includes('/wʊdʒə/') && body.includes('Not THURSday | FRIday') &&
        Boolean(document.querySelector('[data-lesson-extension] details')),
      cedar: body.includes('At 9:10 a.m.') && body.includes('Thirty-eight of 240 registered attendees') &&
        body.includes('Devin disabled the rule at 9:18') && body.includes('tested 60 fictional accounts') &&
        body.includes('Attendee correction sent at 10:05') && body.includes('confirm the next workshop update by 11:00 a.m.') &&
        body.includes('Incident record completed at 11:20') && body.includes('Live-mailing reliability remains to be verified'),
      privacy: body.includes('You never need to reveal a real workplace conflict, disciplinary event, medical matter, immigration process'),
      production: body.includes('Final production: one event, four accountable messages') &&
        body.includes('Can the listener identify the audience, relationship, role, purpose, channel, stakes'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2RegisterDecision.firstGap === "shared project context" && b2RegisterDecision.success &&
    /identified shared context, a polite request, explicit external reference, justified safety directness, stable core purpose, and situation-based appropriateness/i.test(b2RegisterDecision.feedback) &&
    b2RegisterDecision.outcome && b2RegisterDecision.notice && b2RegisterDecision.bundle &&
    b2RegisterDecision.requests && b2RegisterDecision.pragmatics && b2RegisterDecision.clarity &&
    b2RegisterDecision.spoken && b2RegisterDecision.cedar && b2RegisterDecision.privacy &&
    b2RegisterDecision.production && b2RegisterDecision.retrieval === "#next-day-retrieval" &&
    b2RegisterDecision.previous === "/lessons/b2/idioms-and-fixed-expressions/" &&
    b2RegisterDecision.next === "/lessons/b2/nuanced-adjectives-and-intensifiers/" && !b2RegisterDecision.overflow,
    `Register and Formality preserves situation diagnosis, directness, request grammar, power, pragmatics, plain language, agency, U.S. spoken form, channel evidence, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2RegisterDecision)})`);

  const b2RegisterBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['Could you', 'please confirm', 'whether', 'the north entrance', 'will be', 'step-free', 'on October 14']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2RegisterBuilder.built === "Could you please confirm whether the north entrance will be step-free on October 14" &&
    b2RegisterBuilder.success && /names the action, exact entrance, access condition, and date/i.test(b2RegisterBuilder.feedback),
    `the Register and Formality builder preserves the request frame, embedded clause, exact access condition, and date (observed ${JSON.stringify(b2RegisterBuilder)})`);

  const b2RegisterRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Count the syllables and choose whichever sentence is longest.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2RegisterRetrieval.error &&
    /Recall the complete situation bundle instead of one formality label/i.test(b2RegisterRetrieval.first) &&
    /Register emerges from multiple interacting situation variables/i.test(b2RegisterRetrieval.second),
    "Register and Formality retrieval gives the situation-bundle cue before revealing the exact principle");

  await navigate(`${origin}/lessons/b2/nuanced-adjectives-and-intensifiers/`, 375, 900);
  const b2NuancedDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check: locate evidence before degree'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    for (const gap of gaps) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: drill.querySelector('[data-feedback]').textContent,
      outcome: body.includes('distinguish a measurable fact from an evaluation') && body.includes('what licenses this degree?'),
      notice: body.includes('Fictional Marston Library quiet-pod review') &&
        body.includes('the same pilot can support different evaluations') && body.includes('absolutely transformative'),
      readings: body.includes('classify the current reading, not the word forever') &&
        body.includes('useful tendencies, not permanent boxes') && body.includes('Scale type can change with meaning') &&
        body.includes('Pairings are preferences, not sealed grammar gates') && body.includes('Utterly charming'),
      collocation: body.includes('Store adjective and intensifier as a meaningful partnership') &&
        body.includes('highly effective, likely, qualified, significant, controversial') &&
        body.includes('deeply concerned, disappointed, committed, divided, rooted') &&
        body.includes('strongly opposed, recommended, suggestive, influenced'),
      grammar: body.includes('Build the grammar of limits, sufficiency, result, and comparison') &&
        body.includes('too + adjective + to-infinitive') && body.includes('adjective + enough + to-infinitive') &&
        body.includes('Too does not simply mean very'),
      stance: body.includes('Choose stance and register, not a hidden percentage') &&
        body.includes('Quite has more than one degree meaning') && body.includes('Do not assign one fixed percentage') &&
        body.includes('Intensifiers do not create evidence'),
      spoken: body.includes('Pronunciation focus: make the degree contrast audible in U.S. speech') &&
        body.includes('not FAIRly effective | HIGHly effective') && body.includes('CONsiderably more REliable') &&
        body.includes('too SMALL | to represent the POPulation') && Boolean(document.querySelector('[data-lesson-extension] details')),
      marston: body.includes('March 4 through April 14') && body.includes('$14,800 to install') &&
        body.includes('$120 per month to maintain') && body.includes('20 matched periods') &&
        body.includes('51 decibels') && body.includes('44 decibels') && body.includes('Fifty-seven of the 83 users') &&
        body.includes('Forty-one respondents said') && body.includes('Four of the 52 booked sessions ended early') &&
        body.includes('another eight weeks') && body.includes('promising, not proven'),
      privacy: body.includes('You never need to evaluate your own body, health, intelligence, accent, income, job performance'),
      production: body.includes('Final production: lead a two-minute precision review') &&
        body.includes('Can the listener identify the underlying fact, scale, adjective reading, degree, collocation, criterion, register, evidence scope'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href') || null,
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href') || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(b2NuancedDecision.firstGap === "an average seven-decibel difference" && b2NuancedDecision.success &&
    /separated measured sound, optional survey evidence, moderate evaluation, unsupported total success, a bounded positive adjective, and a criterion-specific concern/i.test(b2NuancedDecision.feedback) &&
    b2NuancedDecision.outcome && b2NuancedDecision.notice && b2NuancedDecision.readings &&
    b2NuancedDecision.collocation && b2NuancedDecision.grammar && b2NuancedDecision.stance &&
    b2NuancedDecision.spoken && b2NuancedDecision.marston && b2NuancedDecision.privacy &&
    b2NuancedDecision.production && b2NuancedDecision.retrieval === "#next-day-retrieval" &&
    b2NuancedDecision.previous === "/lessons/b2/register-and-formality/" &&
    b2NuancedDecision.next === "/lessons/b2/phrasal-verbs/" && !b2NuancedDecision.overflow,
    `Nuanced Adjectives and Intensifiers preserves evidence-first degree, flexible readings, collocation, syntax, stance, U.S. spoken focus, case evidence, privacy, production, navigation, retrieval, and mobile fit (observed ${JSON.stringify(b2NuancedDecision)})`);

  const b2NuancedBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['The measured', 'noise reduction', 'is substantial', 'but', 'the overall evidence', 'remains limited']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(b2NuancedBuilder.built === "The measured noise reduction is substantial but the overall evidence remains limited" &&
    b2NuancedBuilder.success && /separates a substantial measured result from limited overall evidence/i.test(b2NuancedBuilder.feedback),
    `the Nuanced Adjectives and Intensifiers builder keeps a strong measured result separate from the broader evidence boundary (observed ${JSON.stringify(b2NuancedBuilder)})`);

  const b2NuancedRetrieval = await evaluate(`(() => {
    const quiz = document.querySelector('#next-day-retrieval [data-quiz]');
    const items = [...quiz.querySelectorAll('[data-quiz-item]')];
    items.forEach((item, index) => {
      const value = index === 0 ? 'Very weekly and very 1990s both mean that a calendar contains extra weeks.' : item.dataset.answer;
      item.querySelector('[data-quiz-option="' + value + '"]').click();
    });
    quiz.querySelector('[data-check-quiz]').click();
    const first = quiz.querySelector('[data-feedback]').textContent;
    quiz.querySelector('[data-check-quiz]').click();
    const second = quiz.querySelector('[data-feedback]').textContent;
    return { first, second, error: quiz.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(b2NuancedRetrieval.error &&
    /Contrast a literal category with a shifted resemblance reading/i.test(b2NuancedRetrieval.first) &&
    /A classifying word can gain a gradable qualitative reading when context explains the scale/i.test(b2NuancedRetrieval.second),
    "Nuanced Adjectives and Intensifiers retrieval gives the reading-shift cue before revealing the exact distinction");

  await navigate(`${origin}/lessons/a0/the-verb-to-be/`, 375, 900);
  const beQuestion = await evaluate(`(() => {
    const drills = [...document.querySelectorAll('[data-choice-gap-drill]')];
    const drill = drills[1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    return {
      question: drill.querySelector('[data-choice-gap]').textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(beQuestion.question === "Are" && beQuestion.success &&
    /question with you begins with Are/i.test(beQuestion.feedback) &&
    beQuestion.retrieval === "#next-day-retrieval" && !beQuestion.overflow,
    "the audited A0 question keeps real capitalization, explanatory correct feedback, direct retrieval, and mobile fit");

  await navigate(`${origin}/lessons/a0/subject-pronouns/`, 375, 900);
  const pronounDecision = await evaluate(`(() => {
    const drill = document.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    for (const gap of drill.querySelectorAll('[data-choice-gap]')) {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    }
    drill.querySelector('[data-check-choices]').click();
    return {
      firstGap: drill.querySelector('[data-choice-gap]').textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      singularThey: document.querySelector('.quiz-item:last-child .quiz-question')?.textContent,
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pronounDecision.firstGap === "She" && pronounDecision.success &&
    /my sister Maria/i.test(pronounDecision.feedback) &&
    /caller’s name or gender/i.test(pronounDecision.singularThey) &&
    pronounDecision.retrieval === "#next-day-retrieval" && !pronounDecision.overflow,
    "Subject Pronouns preserves sentence capitalization, explicit reference context, singular they, direct retrieval, and mobile fit");

  const pronounRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 2 ? 'He' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pronounRetrieval.error && /one person whose gender is not known/i.test(pronounRetrieval.first) &&
    /singular They for the visitor/i.test(pronounRetrieval.second),
    "Subject Pronouns retrieval gives a reference-based hint before the explicit singular-they repair");

  await navigate(`${origin}/lessons/a0/articles-a-an/`, 375, 900);
  const articleDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      universityArticle: gaps.at(-1).textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(articleDecision.universityArticle === "a" && articleDecision.success &&
    /first sound/i.test(articleDecision.feedback) && articleDecision.listeningScript &&
    articleDecision.retrieval === "#next-day-retrieval" &&
    articleDecision.previous === "/lessons/a0/subject-pronouns/" &&
    articleDecision.next === "/lessons/a0/this-that-these-those/" && !articleDecision.overflow,
    "Articles a/an preserves sound-based choice, tutor listening, generated sequence, direct retrieval, and mobile fit");

  const articleRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 1 ? 'an' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(articleRetrieval.error && /consonant “y” sound/i.test(articleRetrieval.first) &&
    /a useful tool/i.test(articleRetrieval.second),
    "Articles a/an retrieval gives a sound-based hint before revealing the repaired noun chunk");

  await navigate(`${origin}/lessons/a0/possessive-adjectives/`, 375, 900);
  const possessiveDecision = await evaluate(`(() => {
    const drill = document.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      singularTheir: gaps[3].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      contractionQuiz: [...document.querySelectorAll('.quiz-question')].at(-1)?.textContent,
      listeningScript: Boolean(document.querySelector('[data-lesson-extension] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(possessiveDecision.singularTheir === "their" && possessiveDecision.success &&
    /connected to the noun/i.test(possessiveDecision.feedback) &&
    /company changed/i.test(possessiveDecision.contractionQuiz) && possessiveDecision.listeningScript &&
    possessiveDecision.retrieval === "#next-day-retrieval" &&
    possessiveDecision.previous === "/lessons/a0/regular-plural-nouns/" &&
    possessiveDecision.next === "/lessons/a0/question-words-what-where-who-how/" && !possessiveDecision.overflow,
    "Possessive adjectives preserves explicit reference, singular their, contraction listening, generated sequence, retrieval, and mobile fit");

  const possessiveRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 2 ? 'its' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(possessiveRetrieval.error && /one person whose gender is not known/i.test(possessiveRetrieval.first) &&
    /their number/i.test(possessiveRetrieval.second),
    "Possessive retrieval gives a singular-their reference cue before revealing the repaired noun chunk");

  await navigate(`${origin}/lessons/a0/question-words-what-where-who-how/`, 375, 900);
  const questionWordDecision = await evaluate(`(() => {
    const drill = document.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      naturalNameCue: [...document.querySelectorAll('.transform-cue')].some((node) => /My name is Ana/.test(node.textContent)),
      boundary: document.body.textContent.includes('Where do you work?'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(questionWordDecision.firstGap === "Where" && questionWordDecision.success &&
    /place for Where/i.test(questionWordDecision.feedback) && questionWordDecision.naturalNameCue &&
    questionWordDecision.boundary && questionWordDecision.listeningScript &&
    questionWordDecision.retrieval === "#next-day-retrieval" &&
    questionWordDecision.previous === "/lessons/a0/possessive-adjectives/" &&
    questionWordDecision.next === "/lessons/a0/cardinal-numbers-0-100/" && !questionWordDecision.overflow,
    "Question words preserves capitalization, natural answer pairing, be-question scope, intonation practice, sequencing, retrieval, and mobile fit");

  const questionWordRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 2 ? 'Who' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(questionWordRetrieval.error && /speaker’s condition/i.test(questionWordRetrieval.first) &&
    /How are you\?/i.test(questionWordRetrieval.second),
    "Question-word retrieval gives an answer-type cue before revealing the complete repaired question");

  await navigate(`${origin}/lessons/a0/this-that-these-those/`, 375, 900);
  const demonstrativeDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')][1];
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      phoneEnglish: document.body.textContent.includes('Who’s this?') && document.body.textContent.includes('Is this Mr. Lopez?'),
      strongerDistractors: [...document.querySelectorAll('.quiz-item:nth-child(7) [data-quiz-option]')].map((node) => node.textContent.trim()).join('|'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(demonstrativeDecision.firstGap === "This" && demonstrativeDecision.success &&
    /agree with is/i.test(demonstrativeDecision.feedback) && demonstrativeDecision.phoneEnglish &&
    demonstrativeDecision.strongerDistractors.split("|").sort().join("|") === "that car|these cars|this car" && demonstrativeDecision.listeningScript &&
    demonstrativeDecision.retrieval === "#next-day-retrieval" &&
    demonstrativeDecision.previous === "/lessons/a0/articles-a-an/" &&
    demonstrativeDecision.next === "/lessons/a0/regular-plural-nouns/" && !demonstrativeDecision.overflow,
    "Demonstratives preserve capitalization, two-axis meaning, U.S. phone English, stronger distractors, sequencing, retrieval, and mobile fit");

  const demonstrativeRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 2 ? 'Those' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(demonstrativeRetrieval.error && /speaker is holding them/i.test(demonstrativeRetrieval.first) &&
    /These documents are for you/i.test(demonstrativeRetrieval.second),
    "Demonstrative retrieval gives number-and-distance cues before revealing the complete repaired sentence");

  await navigate(`${origin}/lessons/a0/regular-plural-nouns/`, 375, 900);
  const pluralDecision = await evaluate(`(() => {
    const drill = document.querySelector('[data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      zeroScope: document.body.textContent.includes('zero clients'),
      irregularBoundary: document.body.textContent.includes('person → people'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Optional tutor-read plural-ending listening"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(pluralDecision.firstGap === "add -s" && pluralDecision.success &&
    /Client takes -s/i.test(pluralDecision.feedback) && pluralDecision.zeroScope &&
    pluralDecision.irregularBoundary && pluralDecision.listeningScript &&
    pluralDecision.retrieval === "#next-day-retrieval" &&
    pluralDecision.previous === "/lessons/a0/this-that-these-those/" &&
    pluralDecision.next === "/lessons/a0/possessive-adjectives/" && !pluralDecision.overflow,
    "Regular plurals preserves number scope, spelling boundaries, ending-sound listening, sequencing, retrieval, and mobile fit");

  const pluralRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 3 ? '-ies' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(pluralRetrieval.error && /Key ends in vowel \+ y/i.test(pluralRetrieval.first) &&
    /key \+ -s → keys/i.test(pluralRetrieval.second),
    "Regular-plural retrieval gives the vowel-plus-y cue before revealing the repaired spelling");

  await navigate(`${origin}/lessons/a0/cardinal-numbers-0-100/`, 375, 900);
  const numberDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const responseGroups = [...new Set([
      ...document.querySelectorAll('.choice-bank'),
      ...document.querySelectorAll('[data-tile-game] .tile-bank'),
      ...document.querySelectorAll('[data-build-bank]'),
      ...document.querySelectorAll('.quiz-options')
    ])].filter((group) => group.querySelector('[data-choice-option], [data-tile], [data-build-tile], [data-quiz-option]'));
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      useBoundary: document.body.textContent.includes('read one digit at a time') && document.body.textContent.includes('commonly say oh for zero'),
      pronunciationBoundary: document.body.textContent.includes('Sentence rhythm or contrast can move the stress') && document.body.textContent.includes('twenny'),
      ordinalBoundary: document.body.textContent.includes('are ordinal numbers and belong to a later lesson'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Optional tutor-read -teen and -ty listening"] details')),
      allResponseBanksRandomized: responseGroups.length > 10 && responseGroups.every((group) => group.dataset.responseOrder === 'randomized'),
      choiceOrder: [...drill.querySelectorAll('[data-choice-option]')].map((option) => option.dataset.choiceOption).join(','),
      matchOrder: [...document.querySelector('[data-tile-game] [data-tile]').parentElement.querySelectorAll('[data-tile]')].map((tile) => tile.dataset.tile).join(','),
      builderOrder: [...document.querySelector('[data-tile-builder] [data-build-bank]').querySelectorAll('[data-build-tile]')].map((tile) => tile.dataset.buildTile).join(','),
      quizOrder: [...document.querySelector('[data-quiz-item] [data-quiz-option]').parentElement.querySelectorAll('[data-quiz-option]')].map((option) => option.dataset.quizOption).join(','),
      errorOrder: [...document.querySelector('[data-spot-error] [data-error-choice]').parentElement.querySelectorAll('[data-error-choice]')].map((option) => option.dataset.errorChoice).join(','),
      transformOrder: [...document.querySelectorAll('[data-transform] [data-transform-item]')].slice(0, 2).map((item) => item.querySelector('.transform-cue').textContent.replace(/\s+/g, ' ').trim()).join('|'),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(numberDecision.firstGap === "thirty" && numberDecision.success &&
    /-teen names 13 or 15/i.test(numberDecision.feedback) && numberDecision.useBoundary &&
    numberDecision.pronunciationBoundary && numberDecision.ordinalBoundary && numberDecision.listeningScript &&
    numberDecision.allResponseBanksRandomized &&
    numberDecision.choiceOrder !== "thirteen,thirty,fifteen,fifty" &&
    numberDecision.matchOrder !== "13,30,40,50" &&
    numberDecision.builderOrder !== "years,i,twenty-five,old,am" &&
    numberDecision.quizOrder !== "thirty,thirteen,three" &&
    numberDecision.errorOrder === "the,rent,is,fourty,dollars" &&
    numberDecision.transformOrder.startsWith("1 21") && numberDecision.transformOrder.includes("|2 40") &&
    numberDecision.retrieval === "#next-day-retrieval" &&
    numberDecision.previous === "/lessons/a0/question-words-what-where-who-how/" &&
    numberDecision.next === "/lessons/a0/greetings-and-introductions/" && !numberDecision.overflow,
    `Cardinal numbers randomizes every eligible tap-to-fill, matching, builder, and quiz response bank while preserving sentence and reveal order, content boundaries, sequencing, retrieval, and mobile fit (observed ${JSON.stringify(numberDecision)})`);

  const numberMatch = await evaluate(`(() => {
    const game = document.querySelector('[data-tile-game]');
    const tiles = [...game.querySelectorAll('[data-tile]')];
    for (const slot of game.querySelectorAll('[data-slot]')) {
      tiles.find((tile) => !tile.disabled && tile.dataset.tile === slot.dataset.slot).click();
      slot.click();
    }
    game.querySelector('[data-check-tiles]').click();
    return {
      success: game.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: game.querySelector('[data-feedback]').textContent,
      correct: [...game.querySelectorAll('[data-slot]')].every((slot) => slot.classList.contains('is-correct'))
    };
  })()`);
  check(numberMatch.success && numberMatch.correct && /Each numeral matches its complete -teen or -ty word/i.test(numberMatch.feedback),
    "randomized Cardinal-number matching still resolves every value to its correct slot");

  const numberBuilder = await evaluate(`(() => {
    const builder = document.querySelector('[data-tile-builder]');
    const tiles = [...builder.querySelectorAll('[data-build-tile]')];
    for (const value of ['i', 'am', 'twenty-five', 'years', 'old']) {
      tiles.find((tile) => !tile.disabled && tile.dataset.buildTile === value).click();
    }
    builder.querySelector('[data-check-build]').click();
    return {
      built: [...builder.querySelectorAll('[data-build-area] [data-value]')].map((tile) => tile.textContent.trim()).join(' '),
      success: builder.querySelector('[data-feedback]').classList.contains('is-success'),
      feedback: builder.querySelector('[data-feedback]').textContent
    };
  })()`);
  check(numberBuilder.built === "I am twenty-five years old" && numberBuilder.success &&
    /uses I am, the hyphenated number twenty-five, and the plural chunk years old/i.test(numberBuilder.feedback),
    "randomized Cardinal-number sentence tiles still build and explain the exact age sentence");

  const numberRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'fourteen' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(numberRetrieval.error && /40 is a whole ten/i.test(numberRetrieval.first) &&
    /invoice total is forty dollars/i.test(numberRetrieval.second),
    "Cardinal-number retrieval gives a place-value cue before revealing the repaired price sentence");

  await navigate(`${origin}/lessons/a0/greetings-and-introductions/`, 375, 900);
  const greetingDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      workplaceBoundary: document.body.textContent.includes('U.S. workplaces vary') && document.body.textContent.includes('follow that choice'),
      meetingBoundary: document.body.textContent.includes('Nice to meet you when you meet someone for the first time') && document.body.textContent.includes('Nice to see you again'),
      connectedSpeech: document.body.textContent.includes('Nice tuh meetcha') && document.body.textContent.includes('How-er-ya?'),
      arrivalBoundary: document.body.textContent.includes('Good evening when you arrive') && document.body.textContent.includes('Good night when you leave'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Optional tutor-read greeting-purpose listening"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(greetingDecision.firstGap === "Good morning" && greetingDecision.success &&
    /open conversations/i.test(greetingDecision.feedback) && greetingDecision.workplaceBoundary &&
    greetingDecision.meetingBoundary && greetingDecision.connectedSpeech && greetingDecision.arrivalBoundary &&
    greetingDecision.listeningScript && greetingDecision.retrieval === "#next-day-retrieval" &&
    greetingDecision.previous === "/lessons/a0/cardinal-numbers-0-100/" &&
    greetingDecision.next === "/lessons/a0/the-alphabet-and-spelling/" && !greetingDecision.overflow,
    "Greetings preserves social purpose, U.S. register boundaries, connected speech, sequencing, retrieval, and mobile fit");

  const greetingRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'Good night' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(greetingRetrieval.error && /arriving in the evening, not leaving/i.test(greetingRetrieval.first) &&
    /Good evening\. We have a reservation/i.test(greetingRetrieval.second),
    "Greeting retrieval gives the arrival cue before revealing the repaired evening greeting");

  await navigate(`${origin}/lessons/a0/the-alphabet-and-spelling/`, 375, 900);
  const alphabetDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      varietyBoundary: body.includes('Use zee in this course and recognize both'),
      clueBoundary: body.includes('no single universal clue-word list'),
      repairSequence: body.includes('Sorry, could you repeat that?') && body.includes('Was that B or V?') && body.includes('Let me read it back'),
      privacy: body.includes('example.com') && body.includes('Do not share real contact information'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read letter-name listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(alphabetDecision.firstGap === "J" && alphabetDecision.success &&
    /grouped the letter names/i.test(alphabetDecision.feedback) && alphabetDecision.varietyBoundary &&
    alphabetDecision.clueBoundary && alphabetDecision.repairSequence && alphabetDecision.privacy &&
    alphabetDecision.listeningScript && alphabetDecision.retrieval === "#next-day-retrieval" &&
    alphabetDecision.previous === "/lessons/a0/greetings-and-introductions/" &&
    alphabetDecision.next === "/lessons/a0/days-months-dates/" && !alphabetDecision.overflow,
    "Alphabet preserves U.S. letter-name scope, repair language, listening, privacy, sequencing, retrieval, and mobile fit");

  const alphabetRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'zed' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(alphabetRetrieval.error && /course uses the U\.S\. letter name/i.test(alphabetRetrieval.first) &&
    /In U\.S\. English, Z is zee/i.test(alphabetRetrieval.second),
    "Alphabet retrieval gives the U.S. rhyme cue before revealing the repaired Z letter name");

  await navigate(`${origin}/lessons/a0/days-months-dates/`, 375, 900);
  const calendarDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      writtenSpokenBoundary: body.includes('Common U.S. writing') && body.includes('March eighth, twenty twenty-six'),
      internationalBoundary: body.includes('same numbers may mean August 3') && body.includes('write the month name and read the date back'),
      questionBoundary: body.includes('What day is it today?') && body.includes("What's the date today?"),
      prepositionBoundary: body.includes('See you tomorrow') && body.includes('on next Monday'),
      calendarBoundary: body.includes('Many U.S. calendars display Sunday first'),
      privacy: body.includes('you do not need to share your real birth date'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read day and date listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(calendarDecision.firstGap === "on" && calendarDecision.success &&
    /Exact days and dates take on/i.test(calendarDecision.feedback) && calendarDecision.writtenSpokenBoundary &&
    calendarDecision.internationalBoundary && calendarDecision.questionBoundary && calendarDecision.prepositionBoundary &&
    calendarDecision.calendarBoundary && calendarDecision.privacy && calendarDecision.listeningScript &&
    calendarDecision.retrieval === "#next-day-retrieval" &&
    calendarDecision.previous === "/lessons/a0/the-alphabet-and-spelling/" &&
    calendarDecision.next === "/lessons/a0/colours-and-basic-adjectives/" && !calendarDecision.overflow,
    "Calendar lesson preserves U.S. date conventions, international safety, pronunciation, sequencing, retrieval, and mobile fit");

  const calendarRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'date' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(calendarRetrieval.error && /Tuesday is a weekday/i.test(calendarRetrieval.first) &&
    /What day is it today\? It's Tuesday/i.test(calendarRetrieval.second),
    "Calendar retrieval gives the weekday cue before revealing the repaired day question");

  await navigate(`${origin}/lessons/a0/colours-and-basic-adjectives/`, 375, 900);
  const adjectiveDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      adjectiveScope: body.includes('A descriptive adjective does not change for a plural noun'),
      inclusiveColor: body.includes('Color helps identify; it should not be the only clue') && body.includes('the green folder labeled “Invoices.”'),
      spellingBoundary: body.includes('U.S. spelling gray') && body.includes('alternative spelling with e before y'),
      relativeMeaning: body.includes('depend on the situation') && body.includes('Inexpensive is the more neutral choice'),
      pronunciation: body.includes('soft final sound in vision') && !body.includes('rhymes with “page”'),
      grammarSystem: body.includes('The cars are red') && body.includes('The notebook is small and black'),
      privacy: body.includes('you do not need to describe your possessions'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read color and adjective listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(adjectiveDecision.firstGap === "green" && adjectiveDecision.success &&
    /conventional color words/i.test(adjectiveDecision.feedback) && adjectiveDecision.adjectiveScope &&
    adjectiveDecision.inclusiveColor && adjectiveDecision.spellingBoundary && adjectiveDecision.relativeMeaning &&
    adjectiveDecision.pronunciation && adjectiveDecision.grammarSystem && adjectiveDecision.privacy &&
    adjectiveDecision.listeningScript && adjectiveDecision.retrieval === "#next-day-retrieval" &&
    adjectiveDecision.previous === "/lessons/a0/days-months-dates/" &&
    adjectiveDecision.next === "/lessons/a0/family-members/" && !adjectiveDecision.overflow,
    "Adjective lesson preserves scoped grammar, inclusive color identification, U.S. usage, listening, sequencing, retrieval, and mobile fit");

  const adjectiveRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'a' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(adjectiveRetrieval.error && /Old begins with a vowel sound/i.test(adjectiveRetrieval.first) &&
    /This is an old watch/i.test(adjectiveRetrieval.second),
    "Adjective retrieval gives the vowel-sound cue before revealing the repaired article phrase");

  await navigate(`${origin}/lessons/a0/family-members/`, 375, 900);
  const familyDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      vocabularySystem: body.includes('specific words such as mother and brother') &&
        body.includes('neutral words such as parent and sibling'),
      appearanceBoundary: body.includes("A person's appearance does not tell you their family role"),
      familyStructures: body.includes('A family may have one parent, two parents, or another structure'),
      relationshipMeaning: body.includes('does not mean Omar owns a person') &&
        body.includes("not Omar's his brother"),
      pronunciation: body.includes('many U.S. accents the t sounds like a quick d') &&
        body.includes("Omar's sounds like Omarz"),
      privacy: body.includes('you do not need to share real names'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read family relationship listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(familyDecision.firstGap === "mother" && familyDecision.success &&
    /explicit relationship clues/i.test(familyDecision.feedback) && familyDecision.vocabularySystem &&
    familyDecision.appearanceBoundary && familyDecision.familyStructures && familyDecision.relationshipMeaning &&
    familyDecision.pronunciation && familyDecision.privacy && familyDecision.listeningScript &&
    familyDecision.retrieval === "#next-day-retrieval" &&
    familyDecision.previous === "/lessons/a0/colours-and-basic-adjectives/" &&
    familyDecision.next === "/lessons/a0/classroom-objects/" && !familyDecision.overflow,
    "Family lesson preserves neutral and specific terms, varied structures, non-ownership meaning, listening, sequencing, retrieval, and mobile fit");

  const familyRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'grandparent' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(familyRetrieval.error && /neutral relationship word is parent/i.test(familyRetrieval.first) &&
    /Rosa is Maria's parent/i.test(familyRetrieval.second),
    "Family retrieval gives the neutral-word cue before revealing the repaired parent relationship");

  await navigate(`${origin}/lessons/a0/classroom-objects/`, 375, 900);
  const classroomDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      numberScope: body.includes('Regular countable object words add -s after zero or a number greater than one') &&
        body.includes('After one, use the singular'),
      specialObjects: body.includes('Three object words need a different pattern') &&
        body.includes('some paper · a sheet of paper · two sheets of paper') &&
        body.includes('a pair of scissors · two pairs of scissors') && body.includes('one mouse · two mice'),
      compoundForm: body.includes('Write paper clip as two words in standard U.S. English'),
      clarification: body.includes('Can you repeat that, please?') &&
        body.includes('What does “ruler” mean?') && body.includes('Can I borrow a pen, please?'),
      access: body.includes('you do not need to show your real desk') &&
        body.includes('point digitally, say the object, or choose its written label'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read classroom object and instruction listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(classroomDecision.firstGap === "a" && classroomDecision.success &&
    /consonant sounds/i.test(classroomDecision.feedback) && classroomDecision.numberScope &&
    classroomDecision.specialObjects && classroomDecision.compoundForm && classroomDecision.clarification &&
    classroomDecision.access && classroomDecision.listeningScript &&
    classroomDecision.retrieval === "#next-day-retrieval" &&
    classroomDecision.previous === "/lessons/a0/family-members/" &&
    classroomDecision.next === "/lessons/a0/animals/" && !classroomDecision.overflow,
    "Classroom-object lesson preserves number and countability boundaries, U.S. compounds, clarification, access, sequencing, retrieval, and mobile fit");

  const classroomRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'a' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(classroomRetrieval.error && /Eraser begins with a vowel sound/i.test(classroomRetrieval.first) &&
    /I need an eraser/i.test(classroomRetrieval.second),
    "Classroom-object retrieval gives the vowel-sound cue before revealing the repaired article chunk");

  await navigate(`${origin}/lessons/a0/animals/`, 375, 900);
  const animalDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      numberScope: body.includes('Zero or more than one?') &&
        body.includes('zero dogs · two dogs') && body.includes('After two we need the plural'),
      specialPlurals: body.includes('two sheep · two fish') && body.includes('two mice · two octopuses') &&
        body.includes('fishes can mean different species or types of fish'),
      categoryBoundary: body.includes("relationship with people and its situation") &&
        body.includes('A rabbit can be a pet, a farm animal, or a wild animal') &&
        body.includes('not a wildlife'),
      factualClues: body.includes('This adult male is a large wild cat with a mane') &&
        body.includes('A hen is an adult female of this farm bird'),
      safetyAndPrivacy: body.includes('Observe unknown wildlife from a safe distance') &&
        body.includes('You never need to share information about your home, street, or a real pet'),
      pronunciation: body.includes('In common U.S. English') && body.includes('ZEE-bruh'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read singular and plural animal listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] a[rel="next"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(animalDecision.firstGap === "a" && animalDecision.success &&
    /matched is or are/i.test(animalDecision.feedback) && animalDecision.numberScope &&
    animalDecision.specialPlurals && animalDecision.categoryBoundary && animalDecision.factualClues &&
    animalDecision.safetyAndPrivacy && animalDecision.pronunciation && animalDecision.listeningScript &&
    animalDecision.retrieval === "#next-day-retrieval" &&
    animalDecision.previous === "/lessons/a0/classroom-objects/" &&
    animalDecision.next === "/lessons/a0/countries-and-nationalities/" && !animalDecision.overflow,
    "Animal lesson preserves plural scope, contextual categories, factual clues, safety, listening, sequencing, retrieval, and mobile fit");

  const animalRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'a' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(animalRetrieval.error && /Owl begins with a vowel sound/i.test(animalRetrieval.first) &&
    /There is an owl/i.test(animalRetrieval.second),
    "Animal retrieval gives the vowel-sound cue before revealing the repaired article chunk");

  await navigate(`${origin}/lessons/a0/countries-and-nationalities/`, 375, 900);
  const countryDecision = await evaluate(`(() => {
    const drill = [...document.querySelectorAll('[data-choice-gap-drill]')]
      .find((node) => node.querySelector('h3')?.textContent.includes('Discovery check'));
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap) => {
      gap.click();
      options.find((option) => option.dataset.choiceOption === gap.dataset.answer).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const body = document.body.textContent;
    return {
      firstGap: gaps[0].textContent,
      feedback: drill.querySelector('[data-feedback]').textContent,
      success: drill.querySelector('[data-feedback]').classList.contains('is-success'),
      fourMeanings: body.includes('Country, nationality, language, and current home are different') &&
        body.includes('One fact does not prove the others'),
      personBoundary: body.includes('Some nationality words can also be person nouns') &&
        body.includes('a Brazilian person') && body.includes('two Brazilian people'),
      identityBoundary: body.includes("A flag does not prove a person's nationality") &&
        body.includes('Do not infer identity from a name, appearance, accent, or flag'),
      countryBoundaries: body.includes('the United States') && body.includes('the United Kingdom') &&
        body.includes('British and English are not exact synonyms') && body.includes('The Americas'),
      currentName: body.includes('official country name used here is Türkiye') &&
        body.includes('hear or read Turkey in some English-language contexts'),
      spokenForm: body.includes('Where-er-yuh from?') && body.includes('keep the full words in writing'),
      privacy: body.includes('You never need to share your nationality, birthplace, current home, languages, immigration history'),
      listeningScript: Boolean(document.querySelector('[data-lesson-extension="Tutor-read country, nationality, and language listening check"] details')),
      retrieval: document.querySelector('a[href="#next-day-retrieval"]')?.getAttribute('href'),
      previous: document.querySelector('[data-generated-lesson-navigation] a[rel="prev"]')?.getAttribute('href'),
      next: document.querySelector('[data-generated-lesson-navigation] .lnav.next')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(countryDecision.firstGap === "Mexico" && countryDecision.success &&
    /from introduces the country/i.test(countryDecision.feedback) && countryDecision.fourMeanings &&
    countryDecision.personBoundary && countryDecision.identityBoundary && countryDecision.countryBoundaries &&
    countryDecision.currentName && countryDecision.spokenForm && countryDecision.privacy &&
    countryDecision.listeningScript && countryDecision.retrieval === "#next-day-retrieval" &&
    countryDecision.previous === "/lessons/a0/animals/" &&
    countryDecision.next === "/assessments/a0-exit/" && !countryDecision.overflow,
    "Country lesson preserves form and identity boundaries, current naming, listening, level-exit sequencing, retrieval, and mobile fit");

  const countryRetrieval = await evaluate(`(() => {
    const drill = document.querySelector('#next-day-retrieval [data-choice-gap-drill]');
    const options = [...drill.querySelectorAll('[data-choice-option]')];
    const gaps = [...drill.querySelectorAll('[data-choice-gap]')];
    gaps.forEach((gap, index) => {
      gap.click();
      const value = index === 0 ? 'Japanese' : gap.dataset.answer;
      options.find((option) => option.dataset.choiceOption === value).click();
    });
    drill.querySelector('[data-check-choices]').click();
    const first = drill.querySelector('[data-feedback]').textContent;
    drill.querySelector('[data-check-choices]').click();
    const second = drill.querySelector('[data-feedback]').textContent;
    return { first, second, error: drill.querySelector('[data-feedback]').classList.contains('is-error') };
  })()`);
  check(countryRetrieval.error && /After from, choose the country Japan/i.test(countryRetrieval.first) &&
    /I'm from Japan/i.test(countryRetrieval.second),
    "Country retrieval gives the country cue before revealing the repaired from phrase");
}

async function testQuickCheck(origin) {
  await navigate(`${origin}/assessments/quick-level-check/`, 375, 900);
  await waitFor(`document.querySelectorAll('[data-choice]').length === 3`);
  await evaluate(`document.querySelector('[data-choice="0"]').focus()`);
  await press("ArrowRight", "ArrowRight", 39);
  const radioState = await evaluate(`({
    selected: document.querySelector('[data-choice="1"]').getAttribute('aria-checked'),
    focused: document.activeElement?.dataset.choice,
    groupLabel: document.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby')
  })`);
  check(radioState.selected === "true" && radioState.focused === "1" && radioState.groupLabel,
    "quick-check radio cards support arrow-key selection and managed focus");

  await evaluate(`document.querySelector('[data-next]').click(); document.querySelector('[data-next]').click()`);
  check(await evaluate(`document.querySelector('[data-answer-reminder]').textContent === 'Choose an answer before continuing.' && document.querySelector('[data-answer-reminder]').getAttribute('aria-live') === 'polite'`),
    "quick check blocks unanswered progression with announced guidance");

  await navigate(`${origin}/assessments/quick-level-check/`, 375, 900);
  await waitFor(`document.querySelectorAll('[data-choice]').length === 3`);
  const completed = await evaluate(`(() => {
    const root = document.querySelector('[data-quick-check]');
    for (let index = 0; index < 10; index += 1) {
      root.querySelector('[data-choice="0"]').click();
      root.querySelector('[data-next]').click();
    }
    return {
      resultVisible: !root.querySelector('[data-result-view]').hidden,
      score: root.querySelector('[data-result-score]').textContent,
      reviewCount: root.querySelectorAll('.review-item').length,
      focusedResult: document.activeElement === root.querySelector('[data-result-level]')
    };
  })()`);
  check(completed.resultVisible && completed.score.includes("/ 10") && completed.reviewCount === 10 && completed.focusedResult,
    "quick check produces a focused result and complete answer review");
}

async function testLevelAssessment(origin) {
  await navigate(`${origin}/assessments/a2-exit/`, 375, 900);
  const initial = await evaluate(`({
    heading: document.querySelector('h1')?.textContent.trim(),
    itemCount: document.querySelectorAll('[data-assessment-item]').length,
    optionCount: document.querySelectorAll('[data-option]').length,
    creditCount: document.querySelectorAll('[data-credit]').length,
    resultLabel: document.querySelector('.score-card')?.getAttribute('aria-label'),
    resultTabIndex: document.querySelector('.score-card')?.getAttribute('tabindex'),
    feedbackLive: document.querySelector('[data-assessment] > [data-feedback]')?.getAttribute('aria-live'),
    allOptionBanksRandomized: [...document.querySelectorAll('[data-assessment-item]')]
      .filter((item) => item.querySelectorAll('[data-option]').length > 1)
      .every((item) => item.querySelector('[data-option]').parentElement.dataset.responseOrder === 'randomized'),
    firstOptionOrder: [...document.querySelector('[data-assessment-item] [data-option]').parentElement.querySelectorAll('[data-option]')]
      .map((option) => option.dataset.option).join('|'),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  })`);
  check(initial.heading === "A2 End-of-Level Diagnostic" && initial.itemCount === 22 &&
    initial.optionCount === 60 && initial.creditCount === 10 && initial.allOptionBanksRandomized &&
    initial.firstOptionOrder !== "She goed to the pharmacy after work.|She went to the pharmacy after work.|She goes to the pharmacy after work yesterday." &&
    !initial.overflow,
    "the full A2 diagnostic loads directly with randomized answer banks and complete receptive and productive evidence at 375px");
  check(initial.resultLabel === "Assessment results" &&
    initial.resultTabIndex === "-1" && initial.feedbackLive === "polite",
    "the level diagnostic exposes an announced, programmatically focusable result summary");

  await evaluate(`(() => {
    const audio = document.querySelector('audio[data-audio-src][data-speak]');
    audio.dispatchEvent(new Event('error'));
  })()`);
  const audioFallback = await evaluate(`({
    staticSource: document.querySelector('audio[data-audio-src]')?.dataset.audioSrc,
    audioHidden: document.querySelector('audio[data-audio-src]')?.hidden,
    fallbackVisible: !document.querySelector('.audio-fallback')?.hidden,
    fallbackLabel: document.querySelector('.audio-fallback')?.getAttribute('aria-label')
  })`);
  check(audioFallback.staticSource === "/audio/assessments/a2-exit/train-delay.mp3" &&
    audioFallback.audioHidden && audioFallback.fallbackVisible &&
    /recorded audio is unavailable/i.test(audioFallback.fallbackLabel),
    "a missing static assessment clip exposes the optional browser-voice fallback without a live API request");

  await evaluate(`(() => {
    const item = document.querySelector('[data-assessment-item][data-answer]');
    const options = [...item.querySelectorAll('[data-option]')];
    const correctIndex = options.findIndex((option) => option.dataset.option === item.dataset.answer);
    options[(correctIndex - 1 + options.length) % options.length].focus();
  })()`);
  await press("ArrowRight", "ArrowRight", 39);
  const radioState = await evaluate(`({
    checked: document.activeElement?.getAttribute('aria-checked'),
    selected: document.activeElement?.classList.contains('is-selected'),
    correct: document.activeElement?.dataset.option === document.activeElement?.closest('[data-assessment-item]')?.dataset.answer,
    groupRole: document.activeElement?.parentElement?.getAttribute('role'),
    groupLabel: document.activeElement?.parentElement?.getAttribute('aria-labelledby')
  })`);
  check(radioState.checked === "true" && radioState.selected && radioState.correct &&
    radioState.groupRole === "radiogroup" && radioState.groupLabel,
    "level-diagnostic answer cards support arrow-key selection and managed radio state");

  await evaluate(`document.querySelector('[data-check-assessment]').click()`);
  const incomplete = await evaluate(`({
    score: document.querySelector('[data-score-text]').textContent.trim(),
    label: document.querySelector('[data-score-label]').textContent.trim(),
    missing: document.querySelectorAll('[data-assessment-item].is-missing').length,
    focused: document.activeElement === document.querySelector('.score-card'),
    percent: document.querySelector('[data-assessment]').dataset.resultPercent
  })`);
  check(incomplete.score === "1 / 30" && incomplete.label === "A2 still developing" &&
    incomplete.missing === 21 && incomplete.focused && incomplete.percent === "3",
    `checking incomplete work marks missing evidence honestly and moves focus to the result summary (observed ${JSON.stringify(incomplete)})`);

  const recognitionOnly = await evaluate(`(() => {
    const root = document.querySelector('[data-assessment]');
    root.querySelectorAll('[data-assessment-item]').forEach((item) => {
      const input = item.querySelector('[data-answer]');
      if (input) input.value = String(input.dataset.answer).split('|')[0];
      const answer = item.dataset.answer;
      const option = answer && [...item.querySelectorAll('[data-option]')]
        .find((candidate) => candidate.dataset.option === answer);
      if (option) option.click();
    });
    root.querySelector('[data-credit]').checked = true;
    root.querySelector('[data-check-assessment]').click();
    return {
      score: root.querySelector('[data-score-text]').textContent.trim(),
      label: root.querySelector('[data-score-label]').textContent.trim(),
      feedbackError: root.querySelector(':scope > [data-feedback]').classList.contains('is-error')
    };
  })()`);
  check(recognitionOnly.score === "21 / 30" && recognitionOnly.label === "More live evidence needed" &&
    recognitionOnly.feedbackError,
    "a passing aggregate score cannot confirm A2 without sufficient listening, speaking, and writing evidence");

  const completed = await evaluate(`(() => {
    const root = document.querySelector('[data-assessment]');
    root.querySelectorAll('[data-assessment-item]').forEach((item) => {
      const input = item.querySelector('[data-answer]');
      if (input) {
        input.value = String(input.dataset.answer).split('|')[0];
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const answer = item.dataset.answer;
      if (answer) {
        const option = [...item.querySelectorAll('[data-option]')]
          .find((candidate) => candidate.dataset.option === answer);
        if (option) option.click();
      }
      item.querySelectorAll('[data-credit]').forEach((credit) => {
        credit.checked = true;
        credit.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    root.querySelector('[data-check-assessment]').click();
    const name = root.querySelector('[data-student-name]');
    name.value = 'Runtime QA learner';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      score: root.querySelector('[data-score-text]').textContent.trim(),
      label: root.querySelector('[data-score-label]').textContent.trim(),
      percent: root.dataset.resultPercent,
      correct: root.querySelectorAll('[data-assessment-item].is-correct').length,
      skillRows: root.querySelectorAll('[data-skill-summary] .skill-score').length,
      focused: document.activeElement === root.querySelector('.score-card'),
      recordName: root.querySelector('[data-record-name]').textContent.trim(),
      recordScore: root.querySelector('[data-record-score]').textContent.trim(),
      feedbackSuccess: root.querySelector(':scope > [data-feedback]').classList.contains('is-success')
    };
  })()`);
  check(completed.score === "30 / 30" && completed.label === "A2 secure" &&
    completed.percent === "100" && completed.correct === 22 && completed.skillRows === 7 &&
    completed.focused && completed.feedbackSuccess,
    "the full diagnostic scores perfect recognition and teacher evidence, builds seven skill results, and focuses the outcome");
  check(completed.recordName === "Runtime QA learner" && completed.recordScore === "30 / 30 (100%)",
    "the diagnostic produces a named, shareable result record from the checked evidence");

  const reset = await evaluate(`(() => {
    const root = document.querySelector('[data-assessment]');
    root.querySelector('[data-reset-assessment]').click();
    return {
      score: root.querySelector('[data-score-text]').textContent.trim(),
      label: root.querySelector('[data-score-label]').textContent.trim(),
      percent: root.dataset.resultPercent || '',
      selected: root.querySelectorAll('[data-option].is-selected').length,
      checkedCredits: root.querySelectorAll('[data-credit]:checked').length,
      gradedItems: root.querySelectorAll('[data-assessment-item].is-correct, [data-assessment-item].is-wrong, [data-assessment-item].is-partial, [data-assessment-item].is-missing').length,
      skillRows: root.querySelectorAll('[data-skill-summary] .skill-score').length,
      radioStateReset: [...root.querySelectorAll('[data-option]')].every((option) => option.getAttribute('aria-checked') === 'false')
    };
  })()`);
  check(reset.score === "0 / 30" && reset.label === "Not checked yet" && reset.percent === "" &&
    reset.selected === 0 && reset.checkedCredits === 0 && reset.gradedItems === 0 &&
    reset.skillRows === 0 && reset.radioStateReset,
    "reset clears the full diagnostic score, evidence, visual grading, skill profile, and ARIA selection state");
}

async function testDictionary(origin) {
  await navigate(`${origin}/dictionary/?q=get&level=A1`, 375, 900);
  const filtered = await evaluate(`({
    query: document.querySelector('[data-dictionary-query]').value,
    level: document.querySelector('[data-dictionary-level]').value,
    visibleWords: [...document.querySelectorAll('[data-dictionary-entry]')].filter((node) => !node.hidden).length,
    status: document.querySelector('[data-dictionary-status]').textContent,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  })`);
  check(filtered.query === "get" && filtered.level === "A1" && filtered.visibleWords > 0 && !filtered.overflow,
    "dictionary direct URL restores filters and remains usable at 375px");

  await evaluate(`document.querySelector('[data-dictionary-entry]:not([hidden]) [data-dictionary-cleared-input]:not([hidden])').click()`);
  check(await evaluate(`document.querySelector('[data-dictionary-cleared]').textContent.startsWith('1 of ') && !document.querySelector('[data-dictionary-reset-cleared]').disabled`),
    "an individual dictionary meaning can be cleared and reset in-session");

  await navigate(`${origin}/dictionary/?q=get&level=A1`, 375, 900);
  check(await evaluate(`[...document.querySelectorAll('[data-dictionary-cleared-input]')].every((input) => !input.checked) && document.querySelector('[data-dictionary-cleared]').textContent.startsWith('0 of ')`),
    "dictionary clear marks remain private to the current page session");

  await evaluate(`document.querySelector('[data-dictionary-reset]').click()`);
  await waitFor(`location.search === ''`);
  check(await evaluate(`document.activeElement === document.querySelector('[data-dictionary-query]') && document.querySelector('[data-dictionary-status]').textContent.startsWith('Showing 26 words')`),
    "dictionary clear filters restores the collection and search focus");
}

async function testLanguageTransfer(origin) {
  await navigate(`${origin}/languages/#transfer-turkish`, 320, 900);
  const state = await evaluate(`({
    languageCount: document.querySelectorAll('[data-transfer-language]').length,
    patternCount: document.querySelectorAll('[data-transfer-pattern]').length,
    openCount: document.querySelectorAll('[data-transfer-pattern][open]').length,
    practiceLinks: document.querySelectorAll('[data-transfer-pattern] a[href^="/lessons/"]').length,
    target: document.querySelector('#transfer-turkish')?.querySelector('h2')?.textContent.trim(),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  })`);
  check(state.languageCount === 3 && state.patternCount === 27 && state.openCount === 3 && state.practiceLinks === 52,
    "language-transfer route renders all validated guides and targeted practice links");
  check(state.target === "Turkish" && !state.overflow, "language-transfer anchors refresh directly without 320px overflow");

  await evaluate(`document.querySelector('#transfer-turkish [data-transfer-pattern]:not([open]) > summary').click()`);
  check(await evaluate(`document.querySelectorAll('#transfer-turkish [data-transfer-pattern][open]').length === 2`),
    "native language-transfer disclosures open without page-specific JavaScript");
}

async function testTutorWorkflow(origin) {
  await navigate(`${origin}/tutor/`, 320, 900);
  const queue = await evaluate(`(() => {
    const root = document.querySelector('[data-tutor-review-queue]');
    const items = Array.from(document.querySelectorAll('[data-review-queue-item]'));
    return {
      declaredCount: Number(root?.dataset.reviewQueueCount ?? -1),
      itemCount: items.length,
      recordedCount: items.reduce((total, item) => total + Number(item.dataset.pilotRecorded ?? 0), 0),
      linksTargetWorksheets: items.every((item) => item.getAttribute('href')?.endsWith('/#pilot-evidence')),
      privacy: root?.textContent.includes('Record no names or identifying details') ?? false,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(queue.declaredCount === reviewQueueLessons.length && queue.itemCount === reviewQueueLessons.length &&
    queue.recordedCount === reviewQueuePilotCount && queue.linksTargetWorksheets,
    "tutor review queue derives every pending lesson, pilot count, and worksheet link from canonical metadata");
  check(queue.privacy && !queue.overflow, "tutor review queue keeps privacy guidance visible without 320px overflow");

  await navigate(`${origin}/tutor/?level=C1&q=aspect`, 375, 900);
  await waitFor(`document.querySelector('[data-tutor-status]')?.textContent.startsWith('1 lesson')`);
  check(await evaluate(`document.querySelectorAll('[data-tutor-lesson]:not([hidden])').length === 1 && location.search.includes('level=C1') && location.search.includes('q=aspect')`),
    "tutor finder still initializes direct filters while the review queue is present");

  const representative = reviewQueueLessons[0];
  await navigate(`${origin}/tutor/plans/${representative.id}/#pilot-evidence`, 320, 900);
  const worksheet = await evaluate(`(() => {
    const sheet = document.querySelector('[data-pilot-evidence-worksheet]');
    return {
      lesson: sheet?.dataset.pilotLessonId,
      recorded: Number(sheet?.dataset.pilotRecorded ?? -1),
      target: Number(sheet?.dataset.pilotTarget ?? -1),
      hash: location.hash,
      privacy: sheet?.textContent.includes('never submitted or stored by the website') ?? false,
      browserFields: sheet?.querySelectorAll('form, input, textarea').length ?? -1,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  })()`);
  check(worksheet.lesson === representative.id && worksheet.recorded === (representative.qualityReview?.learnerPilotCount ?? 0) &&
    worksheet.target === LESSON_REVIEW_PILOT_TARGET && worksheet.hash === "#pilot-evidence",
    "direct tutor-plan refresh resolves the correct canonical pilot worksheet and evidence count");
  check(worksheet.privacy && worksheet.browserFields === 0 && !worksheet.overflow,
    "pilot worksheet is privacy-safe, non-collecting, and usable at 320px");

  await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
  const printState = await evaluate(`({
    worksheetBreak: getComputedStyle(document.querySelector('[data-pilot-evidence-worksheet]')).breakBefore,
    navigationHidden: getComputedStyle(document.querySelector('.topnav')).display === 'none',
    actionHidden: getComputedStyle(document.querySelector('.tutor-plan-actions')).display === 'none'
  })`);
  await cdp.send("Emulation.setEmulatedMedia", { media: "screen" });
  check(printState.worksheetBreak === "page" && printState.navigationHidden && printState.actionHidden,
    "print mode starts the evidence worksheet on a clean page and removes navigation controls");
}

async function navigate(url, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url });
  await waitFor(`document.readyState === 'complete' && Boolean(document.body)`, 10_000);
  await delay(120);
}

async function evaluate(expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text;
    throw new Error(`Browser evaluation failed: ${detail}`);
  }
  return response.result?.value;
}

async function waitFor(expression, timeout = 5_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(40);
  }
  throw new Error(`Timed out waiting for browser state: ${expression}${lastError ? ` (${lastError.message})` : ""}`);
}

async function press(key, code, keyCode) {
  const params = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...params });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
  await delay(40);
}

function check(condition, message) {
  if (condition) checks.push(message);
  else fail(message);
}

function fail(message) {
  failures.push(message);
}

function finish() {
  if (failures.length) {
    console.error(`Browser validation failed with ${failures.length} error(s):`);
    failures.forEach((message) => console.error(`- ${message}`));
    if (globalThis.process) globalThis.process.exitCode = 1;
    throw new Error(`Browser validation did not pass: ${failures.join("; ")}`);
  }
  console.log(`Browser validation passed: ${checks.length} assertions across homepage navigation, curriculum discovery, every published lesson response bank, lesson feedback, quick assessment, full level diagnostics, static-audio fallback, dictionary state, language transfer, tutor review workflow, direct refreshes, keyboard behavior, print behavior, console health, and 320–1440px layouts.`);
}

function findBrowser() {
  const explicit = environment.BROWSER_BIN || globalThis.BROWSER_BIN;
  if (explicit && /\/Applications\/Google Chrome\.app\//.test(explicit)) {
    throw new Error("BROWSER_BIN must not point to /Applications/Google Chrome.app. Use a separate headless Chromium installation.");
  }
  if (explicit && existsSync(explicit)) return explicit;
  const paths = currentPlatform === "darwin"
    ? [
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ]
    : currentPlatform === "win32"
      ? []
      : ["/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const installed = paths.find((candidate) => candidate && existsSync(candidate));
  if (installed) return installed;
  for (const name of ["chromium", "chromium-browser"]) {
    const found = spawnSync(currentPlatform === "win32" ? "where" : "which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  return undefined;
}

function normalizedLocalOrigin(value) {
  const origin = new URL(value);
  if (!["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) {
    throw new Error("BROWSER_QA_URL must point to a local preview server");
  }
  return origin.origin;
}

function startPreview(port) {
  const astro = path.join(root, "node_modules", "astro", "bin", "astro.mjs");
  const child = spawn("node", [astro, "preview", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...environment, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("exit", (code) => {
    if (code && !cleaningUp && !failures.length) fail(`Astro preview exited with code ${code}: ${output.trim()}`);
  });
  return child;
}

async function startChrome(browser, userDataDir) {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--single-process",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-features=Translate,MediaRouter",
    "--disable-gpu",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];
  chromeOutput = "";
  chrome = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
  chrome.stdout.on("data", (chunk) => { chromeOutput += chunk; });
  chrome.stderr.on("data", (chunk) => { chromeOutput += chunk; });

  const activePort = path.join(userDataDir, "DevToolsActivePort");
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (existsSync(activePort)) {
      const [port] = readFileSync(activePort, "utf8").trim().split(/\r?\n/);
      if (/^\d+$/.test(port)) return Number(port);
    }
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      const status = chrome.exitCode !== null ? `code ${chrome.exitCode}` : `signal ${chrome.signalCode}`;
      throw new Error(`Chromium exited before opening its debugging port (${status}).${browserDiagnostics()}`);
    }
    await delay(40);
  }
  throw new Error(`Timed out waiting for Chromium to start.${browserDiagnostics()}`);
}

function browserDiagnostics() {
  const output = chromeOutput.trim();
  if (!output) return " No browser output was captured.";
  const maximum = 4_000;
  const excerpt = output.length > maximum ? `…${output.slice(-maximum)}` : output;
  return ` Browser output:\n${excerpt}`;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHttp(url) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (preview && preview.exitCode !== null) throw new Error(`Astro preview exited before ${url} became available`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return;
    } catch {}
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Browser debugging request failed (${response.status})`);
  return response.json();
}

async function cleanup() {
  cleaningUp = true;
  try { cdp?.close(); } catch {}
  if (chrome?.exitCode === null) chrome.kill("SIGTERM");
  if (preview?.exitCode === null) preview.kill("SIGTERM");
  await delay(80);
  if (profile) rmSync(profile, { recursive: true, force: true });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class DevToolsClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium DevTools")), { once: true });
    });
    this.socket.addEventListener("message", (event) => this.handle(event.data));
    this.socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chromium DevTools connection closed"));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const existing = this.listeners.get(method) || [];
    existing.push(listener);
    this.listeners.set(method, existing);
  }

  handle(raw) {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result || {});
      return;
    }
    for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
  }

  close() {
    this.socket.close();
  }
}

await run();
