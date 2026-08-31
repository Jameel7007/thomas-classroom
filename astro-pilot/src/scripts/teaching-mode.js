import { randomizeResponseGroups } from "./randomize-responses.js";

(function(){
  const INTERACTIVE_STAGE = ".practice, .tile-game, .micro-drill, .quiz";
  const CHECK_CONTROLS = "[data-check-answers], [data-check-choices], [data-check-tiles], [data-check-build], [data-check-quiz]";
  const RESET_CONTROLS = "[data-reset-answers], [data-reset-choices], [data-reset-tiles], [data-reset-build], [data-reset-quiz]";
  const REVEAL_CONTROLS = "[data-reveal-transform]";
  const RESPONSE_SELECTORS = ["[data-choice-option]", "[data-tile]", "[data-build-tile]", "[data-quiz-option]"];

  function stageLabel(stage, index){
    const heading = stage.querySelector("h1, h2, h3");
    const text = heading && heading.textContent ? heading.textContent.trim() : "";
    return text || `Lesson stage ${index + 1}`;
  }

  function wrapStage(nodes, index){
    const stage = document.createElement("div");
    stage.className = "teaching-stage";
    stage.dataset.teachingStage = String(index + 1);
    stage.tabIndex = -1;
    nodes[0].before(stage);
    nodes.forEach(function(node){ stage.appendChild(node); });
    const label = stageLabel(stage, index);
    stage.dataset.teachingStageLabel = label;
    stage.setAttribute("aria-label", label);
    return stage;
  }

  function buildStages(main){
    if (main.dataset.teachingPrepared === "true") {
      return Array.from(main.querySelectorAll(":scope > [data-teaching-stage]"));
    }

    const groups = [];
    let pending = [];
    const flush = function(){
      if (!pending.length) return;
      groups.push(pending);
      pending = [];
    };

    Array.from(main.children).forEach(function(child){
      if (child.matches("section")) {
        flush();
        groups.push([child]);
        return;
      }
      if (child.matches("h2")) {
        flush();
        pending.push(child);
        return;
      }
      if (child.matches(INTERACTIVE_STAGE)) {
        if (pending.length) {
          pending.push(child);
          flush();
        } else {
          groups.push([child]);
        }
        return;
      }
      pending.push(child);
    });
    flush();

    const stages = groups.filter(function(group){ return group.length; }).map(wrapStage);
    main.dataset.teachingPrepared = "true";
    return stages;
  }

  function initTeachingMode(){
    const launch = document.querySelector("[data-teaching-launch]");
    const toolbar = document.querySelector("[data-teaching-toolbar]");
    const lessonSections = Array.from(document.querySelectorAll(
      "#lesson-content > .lesson-content-native > .wrap, #lesson-content > .wrap",
    ));
    if (!launch || !toolbar || !lessonSections.length) return;

    const stages = lessonSections.flatMap(buildStages);
    if (!stages.length) return;

    const previous = toolbar.querySelector("[data-teaching-previous]");
    const next = toolbar.querySelector("[data-teaching-next]");
    const progress = toolbar.querySelector("[data-teaching-progress]");
    const progressBar = toolbar.querySelector("[data-teaching-progress-bar]");
    const stageTitle = toolbar.querySelector("[data-teaching-stage-title]");
    const check = toolbar.querySelector("[data-teaching-check]");
    const reset = toolbar.querySelector("[data-teaching-reset]");
    const reveal = toolbar.querySelector("[data-teaching-reveal]");
    const shuffle = toolbar.querySelector("[data-teaching-shuffle]");
    const copy = toolbar.querySelector("[data-teaching-copy]");
    const exit = toolbar.querySelector("[data-teaching-exit]");
    const announcement = toolbar.querySelector("[data-teaching-announcement]");
    const timerOutput = toolbar.querySelector("[data-teaching-timer]");
    const timerToggle = toolbar.querySelector("[data-teaching-timer-toggle]");
    const timerReset = toolbar.querySelector("[data-teaching-timer-reset]");
    let currentIndex = 0;
    let teaching = false;
    let elapsedMilliseconds = 0;
    let timerStartedAt = 0;
    let timerInterval = null;

    stages.forEach(function(stage){
      stage.querySelectorAll(REVEAL_CONTROLS).forEach(function(button){
        if (!button.dataset.teachingOriginalLabel) {
          button.dataset.teachingOriginalLabel = button.textContent.trim();
        }
      });
    });

    function setAnnouncement(message){
      announcement.textContent = message;
    }

    function activeStage(){ return stages[currentIndex]; }

    function toolbarHeight(){
      return Math.ceil(toolbar.getBoundingClientRect().height);
    }

    function syncToolbarHeight(){
      const height = toolbar.hidden ? 0 : toolbarHeight();
      document.documentElement.style.setProperty("--teaching-toolbar-height", `${height}px`);
    }

    function scrollStageIntoView(stage){
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lesson-bar-height")) || 0;
      const offset = headerHeight + toolbarHeight() + 20;
      const top = window.scrollY + stage.getBoundingClientRect().top - offset;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }

    function hasControls(selector){
      return Boolean(activeStage().querySelector(`${selector}:not([disabled])`));
    }

    function updateActions(){
      previous.disabled = currentIndex === 0;
      next.disabled = currentIndex === stages.length - 1;
      check.disabled = !hasControls(CHECK_CONTROLS);
      reset.disabled = !hasControls(RESET_CONTROLS) &&
        !activeStage().querySelector(REVEAL_CONTROLS) &&
        !activeStage().querySelector("[data-spot-error]");
      reveal.disabled = !hasControls(REVEAL_CONTROLS);
      shuffle.disabled = !RESPONSE_SELECTORS.some(function(selector){
        return activeStage().querySelectorAll(selector).length > 1;
      });
      copy.disabled = !findPromptSource();
    }

    function showStage(index, focusStage){
      currentIndex = Math.max(0, Math.min(index, stages.length - 1));
      stages.forEach(function(stage, stageIndex){
        const active = stageIndex === currentIndex;
        stage.hidden = !active;
      });
      const stage = activeStage();
      const title = stage.dataset.teachingStageLabel || `Lesson stage ${currentIndex + 1}`;
      progress.textContent = `Stage ${currentIndex + 1} of ${stages.length}`;
      progressBar.max = stages.length;
      progressBar.value = currentIndex + 1;
      stageTitle.textContent = title;
      updateActions();
      window.requestAnimationFrame(function(){
        syncToolbarHeight();
        scrollStageIntoView(stage);
        if (focusStage) stage.focus({ preventScroll: true });
      });
    }

    function startTeaching(){
      if (teaching) return;
      teaching = true;
      document.body.classList.add("is-teaching-mode");
      toolbar.hidden = false;
      launch.setAttribute("aria-expanded", "true");
      launch.textContent = "Teaching mode on";
      window.requestAnimationFrame(function(){
        syncToolbarHeight();
        showStage(currentIndex, false);
        toolbar.focus({ preventScroll: true });
      });
      setAnnouncement("Live Teaching Mode started. Use Previous and Next to move through the lesson.");
    }

    function pauseTimer(){
      if (!timerInterval) return;
      elapsedMilliseconds += Date.now() - timerStartedAt;
      window.clearInterval(timerInterval);
      timerInterval = null;
      timerToggle.textContent = "Resume timer";
      renderTimer();
    }

    function stopTeaching(){
      if (!teaching) return;
      const anchor = activeStage().firstElementChild;
      pauseTimer();
      teaching = false;
      document.body.classList.remove("is-teaching-mode");
      toolbar.hidden = true;
      document.documentElement.style.setProperty("--teaching-toolbar-height", "0px");
      launch.setAttribute("aria-expanded", "false");
      launch.textContent = "Teach this lesson";
      stages.forEach(function(stage){
        stage.hidden = false;
      });
      window.requestAnimationFrame(function(){
        if (anchor) {
          const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lesson-bar-height")) || 0;
          window.scrollTo({ top: Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - headerHeight - 20) });
        }
        launch.focus({ preventScroll: true });
      });
    }

    function clickControls(selector){
      const controls = Array.from(activeStage().querySelectorAll(`${selector}:not([disabled])`));
      controls.forEach(function(control){ control.click(); });
      return controls.length;
    }

    function resetReveals(stage){
      stage.querySelectorAll(REVEAL_CONTROLS).forEach(function(button){
        const item = button.closest("[data-transform-item]") || button.parentElement;
        const answer = item && item.querySelector("[data-transform-answer]");
        button.disabled = false;
        button.textContent = button.dataset.teachingOriginalLabel || "Reveal after you answer";
        button.setAttribute("aria-expanded", "false");
        if (answer) {
          answer.hidden = true;
          answer.classList.remove("is-visible");
          answer.setAttribute("aria-hidden", "true");
        }
      });
    }

    function resetSpotErrors(stage){
      stage.querySelectorAll("[data-spot-error]").forEach(function(root){
        root.classList.remove("is-success", "is-error");
        const choices = Array.from(root.querySelectorAll("[data-error-choice]"));
        choices.forEach(function(choice, index){
          choice.classList.remove("is-correct", "is-wrong");
          choice.setAttribute("aria-checked", "false");
          choice.tabIndex = index === 0 ? 0 : -1;
          delete choice.dataset.feedbackAttempts;
        });
        const feedback = root.querySelector("[data-error-feedback]");
        if (feedback) {
          feedback.textContent = "";
          feedback.classList.remove("is-visible");
        }
      });
    }

    function resetCurrentStage(){
      const stage = activeStage();
      clickControls(RESET_CONTROLS);
      resetReveals(stage);
      resetSpotErrors(stage);
      updateActions();
      setAnnouncement("Current stage reset.");
    }

    function shuffleCurrentStage(){
      resetCurrentStage();
      RESPONSE_SELECTORS.forEach(function(selector){
        randomizeResponseGroups(activeStage(), selector, { force: true });
      });
      setAnnouncement("Answer choices shuffled.");
    }

    function revealCurrentStage(){
      const count = clickControls(REVEAL_CONTROLS);
      updateActions();
      setAnnouncement(count ? "Answers revealed for this stage." : "This stage has nothing to reveal.");
    }

    function findPromptSource(){
      const stage = activeStage();
      return stage.querySelector(".prompt-card, .transform-cue, .tile-target, .quiz-question, .choice-hint, .q, h3 + p, p");
    }

    function promptText(source){
      const clone = source.cloneNode(true);
      clone.querySelectorAll("button, input, textarea, select").forEach(function(control){
        const value = control.value || control.textContent.trim() || "___";
        control.replaceWith(document.createTextNode(` ${value} `));
      });
      clone.querySelectorAll("[data-feedback], [data-transform-answer], [data-error-feedback]").forEach(function(node){ node.remove(); });
      return clone.textContent.replace(/\s+/g, " ").trim();
    }

    async function copyCurrentPrompt(){
      const source = findPromptSource();
      if (!source) return;
      const text = promptText(source);
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setAnnouncement("Prompt copied. Paste it into the lesson chat.");
      } catch (error) {
        setAnnouncement("Copy was unavailable. Select the prompt text manually.");
      }
    }

    function renderTimer(){
      const running = timerInterval ? Date.now() - timerStartedAt : 0;
      const seconds = Math.floor((elapsedMilliseconds + running) / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      timerOutput.textContent = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    function toggleTimer(){
      if (timerInterval) {
        pauseTimer();
        setAnnouncement("Timer paused.");
        return;
      }
      timerStartedAt = Date.now();
      timerInterval = window.setInterval(renderTimer, 250);
      timerToggle.textContent = "Pause timer";
      renderTimer();
      setAnnouncement("Timer started.");
    }

    function clearTimer(){
      if (timerInterval) window.clearInterval(timerInterval);
      timerInterval = null;
      timerStartedAt = 0;
      elapsedMilliseconds = 0;
      timerToggle.textContent = "Start timer";
      renderTimer();
      setAnnouncement("Timer reset.");
    }

    launch.hidden = false;
    launch.addEventListener("click", function(){ teaching ? stopTeaching() : startTeaching(); });
    previous.addEventListener("click", function(){ showStage(currentIndex - 1, true); });
    next.addEventListener("click", function(){ showStage(currentIndex + 1, true); });
    check.addEventListener("click", function(){
      const count = clickControls(CHECK_CONTROLS);
      setAnnouncement(count ? "Current stage checked." : "This stage checks as you answer.");
    });
    reset.addEventListener("click", resetCurrentStage);
    reveal.addEventListener("click", revealCurrentStage);
    shuffle.addEventListener("click", shuffleCurrentStage);
    copy.addEventListener("click", copyCurrentPrompt);
    exit.addEventListener("click", stopTeaching);
    timerToggle.addEventListener("click", toggleTimer);
    timerReset.addEventListener("click", clearTimer);

    document.addEventListener("keydown", function(event){
      if (!teaching) return;
      if (event.key === "Escape") {
        event.preventDefault();
        stopTeaching();
        return;
      }
      const editing = event.target && event.target.closest && event.target.closest("input, textarea, select, [contenteditable='true']");
      if (editing || !event.altKey) return;
      const key = event.key.toLowerCase();
      const actions = {
        arrowleft: function(){ if (!previous.disabled) showStage(currentIndex - 1, true); },
        arrowright: function(){ if (!next.disabled) showStage(currentIndex + 1, true); },
        c: function(){ if (!check.disabled) check.click(); },
        r: function(){ if (!reset.disabled) reset.click(); },
        v: function(){ if (!reveal.disabled) reveal.click(); },
        s: function(){ if (!shuffle.disabled) shuffle.click(); },
        p: function(){ if (!copy.disabled) copy.click(); },
        t: toggleTimer,
      };
      if (!actions[key]) return;
      event.preventDefault();
      actions[key]();
    });

    if (typeof ResizeObserver === "function") {
      new ResizeObserver(function(){ if (teaching) syncToolbarHeight(); }).observe(toolbar);
    } else {
      window.addEventListener("resize", function(){ if (teaching) syncToolbarHeight(); }, { passive: true });
    }
  }

  document.addEventListener("DOMContentLoaded", initTeachingMode);
})();
