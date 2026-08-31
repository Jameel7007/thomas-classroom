import { randomizeResponseGroups } from "./randomize-responses.js";
import "./teaching-mode.js";

(function(){
  let lessonControlId = 0;

  function ensureId(element, prefix){
    if (!element.id) element.id = prefix + "-" + (++lessonControlId);
    return element.id;
  }

  function setupRadioGroup(options, label, onSelect){
    if (!options.length) return function(){};
    const group = options[0].parentNode;
    group.setAttribute("role", "radiogroup");
    if (label) group.setAttribute("aria-labelledby", ensureId(label, "lesson-question"));

    function select(option, moveFocus){
      options.forEach(function(candidate){
        const chosen = candidate === option;
        candidate.setAttribute("aria-checked", chosen ? "true" : "false");
        candidate.tabIndex = chosen ? 0 : -1;
      });
      onSelect(option);
      if (moveFocus) option.focus();
    }

    options.forEach(function(option, index){
      option.setAttribute("role", "radio");
      option.setAttribute("aria-checked", "false");
      option.tabIndex = index === 0 ? 0 : -1;
      option.addEventListener("click", function(){ select(option, false); });
      option.addEventListener("keydown", function(event){
        const current = options.indexOf(option);
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % options.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = options.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(options[next], true);
      });
    });

    return function(){
      options.forEach(function(option, index){
        option.setAttribute("aria-checked", "false");
        option.tabIndex = index === 0 ? 0 : -1;
      });
    };
  }

  function norm(value){
    return String(value || "").trim().toLowerCase()
      .replace(/[‘’]/g, "'")   // curly apostrophes → straight, so typed answers match
      .replace(/\s+/g, " ");
  }

  function choiceNorm(value){
    return String(value || "").trim()
      .replace(/\s+/g, " ");
  }

  function setFeedback(root, message, state){
    const out = root.querySelector("[data-feedback]");
    if (!out) return;
    out.textContent = message;
    out.classList.remove("is-success", "is-error");
    if (state) out.classList.add("is-" + state);
  }

  function itemNumber(item, items){
    const index = items.indexOf(item);
    return index >= 0 ? index + 1 : 1;
  }

  function feedbackValue(item, root, name){
    if (item && item.dataset && item.dataset[name]) return item.dataset[name];
    const container = item && item.closest
      ? item.closest(".q, [data-quiz-item], [data-transform-item]")
      : null;
    if (container && container.dataset && container.dataset[name]) return container.dataset[name];
    return root.dataset[name] || "";
  }

  function failedAttempts(item){
    const attempts = Number(item.dataset.feedbackAttempts || 0) + 1;
    item.dataset.feedbackAttempts = String(attempts);
    return attempts;
  }

  function clearFailedAttempts(items){
    items.forEach(function(item){ delete item.dataset.feedbackAttempts; });
  }

  function explanatoryCue(item, root, attempts, fallback, answer, answerLead){
    const hint = feedbackValue(item, root, "hint");
    const why = feedbackValue(item, root, "why");
    const fix = feedbackValue(item, root, "fix");

    if (attempts > 1 && (fix || answer)) {
      return (answerLead || "Use") + " “" + (fix || answer) + "”, then try again.";
    }
    return hint || why || fallback;
  }

  function wrongFeedback(correct, total, item, items, cue){
    return correct + " of " + total + " correct. Item " +
      itemNumber(item, items) + ": " + cue;
  }

  function firstAnswer(item){
    return String(item.dataset.answer || "").split("|")[0].trim();
  }

  function optionAnswerText(item, options, attribute){
    const answers = String(item.dataset.answer || "").split("|").map(choiceNorm);
    const option = options.find(function(candidate){
      return answers.includes(choiceNorm(candidate.dataset[attribute]));
    });
    return option ? option.textContent.trim() : firstAnswer(item);
  }

  function resetMotion(root){
    root.classList.remove("is-success", "is-error");
    root.querySelectorAll(".drill-burst").forEach(function(node){ node.remove(); });
  }

  function animateDrill(root, ok){
    resetMotion(root);
    root.classList.add(ok ? "is-success" : "is-error");
    window.setTimeout(function(){ root.classList.remove("is-success", "is-error"); }, ok ? 1100 : 520);
    if (!ok || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const burst = document.createElement("span");
    burst.className = "drill-burst";
    for (let i = 0; i < 18; i += 1) {
      const spark = document.createElement("span");
      const angle = (Math.PI * 2 * i) / 18;
      const distance = 54 + Math.random() * 56;
      spark.className = "spark";
      spark.style.setProperty("--x", Math.cos(angle) * distance + "px");
      spark.style.setProperty("--y", Math.sin(angle) * distance + "px");
      spark.style.left = 50 + (Math.random() * 22 - 11) + "%";
      spark.style.top = 48 + (Math.random() * 18 - 9) + "%";
      spark.style.animationDelay = (Math.random() * 0.08) + "s";
      burst.appendChild(spark);
    }
    root.appendChild(burst);
    window.setTimeout(function(){ burst.remove(); }, 1000);
  }

  function initAnswerDrill(root){
    const inputs = Array.from(root.querySelectorAll("[data-answer]"));
    const check = root.querySelector("[data-check-answers]");
    const reset = root.querySelector("[data-reset-answers]");
    if (!inputs.length || !check) return;

    check.addEventListener("click", function(){
      let correct = 0;
      let firstWrong = null;
      inputs.forEach(function(input){
        const answers = input.dataset.answer.split("|").map(norm);
        const ok = answers.includes(norm(input.value));
        input.classList.toggle("is-correct", ok);
        input.classList.toggle("is-wrong", !ok);
        if (ok) {
          correct += 1;
          delete input.dataset.feedbackAttempts;
        } else if (!firstWrong) firstWrong = input;
      });
      const firstWrongAttempts = firstWrong ? failedAttempts(firstWrong) : 0;
      const allCorrect = correct === inputs.length;
      animateDrill(root, allCorrect);
      const cue = firstWrong
        ? explanatoryCue(
          firstWrong,
          root,
          firstWrongAttempts,
          norm(firstWrong.value)
            ? "Check the highlighted gap and try again."
            : "Complete this gap, then check again.",
          firstAnswer(firstWrong)
        )
        : "";
      setFeedback(root, allCorrect
        ? root.dataset.successMessage || "Perfect. Say the full sentences aloud."
        : wrongFeedback(correct, inputs.length, firstWrong, inputs, cue),
        allCorrect ? "success" : "error");
    });

    if (reset) {
      reset.addEventListener("click", function(){
        inputs.forEach(function(input){
          input.value = "";
          input.classList.remove("is-correct", "is-wrong");
        });
        clearFailedAttempts(inputs);
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initChoiceGapDrill(root){
    randomizeResponseGroups(root, "[data-choice-option]");
    const gaps = Array.from(root.querySelectorAll("[data-choice-gap]"));
    const options = Array.from(root.querySelectorAll("[data-choice-option]"));
    const check = root.querySelector("[data-check-choices]");
    const reset = root.querySelector("[data-reset-choices]");
    if (!gaps.length || !options.length) return;
    let activeGap = gaps[0];

    function setActive(gap){
      gaps.forEach(function(item){
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });
      activeGap = gap;
      if (activeGap) {
        activeGap.classList.add("is-active");
        activeGap.setAttribute("aria-pressed", "true");
      }
    }

    function setGap(gap, option){
      gap.dataset.value = option.dataset.choiceOption;
      gap.textContent = option.textContent;
      gap.classList.remove("is-empty", "is-correct", "is-wrong");
      const next = gaps.find(function(item){ return !item.dataset.value; });
      setActive(next || gap);
    }

    gaps.forEach(function(gap){
      gap.classList.add("is-empty");
      gap.setAttribute("aria-pressed", "false");
      gap.addEventListener("click", function(){ setActive(gap); });
    });
    setActive(activeGap);

    options.forEach(function(option){
      option.setAttribute("aria-pressed", "false");
      option.addEventListener("click", function(){
        options.forEach(function(item){
          item.classList.remove("is-selected");
          item.setAttribute("aria-pressed", "false");
        });
        option.classList.add("is-selected");
        option.setAttribute("aria-pressed", "true");
        if (!activeGap) setActive(gaps.find(function(item){ return !item.dataset.value; }) || gaps[0]);
        setGap(activeGap, option);
      });
    });

    if (check) {
      check.addEventListener("click", function(){
        let correct = 0;
        let firstWrong = null;
        gaps.forEach(function(gap){
          const answers = gap.dataset.answer.split("|").map(choiceNorm);
          const ok = answers.includes(choiceNorm(gap.dataset.value));
          gap.classList.toggle("is-correct", ok);
          gap.classList.toggle("is-wrong", !ok);
          if (ok) {
            correct += 1;
            delete gap.dataset.feedbackAttempts;
          } else if (!firstWrong) firstWrong = gap;
        });
        const firstWrongAttempts = firstWrong ? failedAttempts(firstWrong) : 0;
        const allCorrect = correct === gaps.length;
        animateDrill(root, allCorrect);
        const cue = firstWrong
          ? explanatoryCue(
            firstWrong,
            root,
            firstWrongAttempts,
            firstWrong.dataset.value
              ? "Check the words around the gap and try again."
              : "Choose a word, then check again.",
            optionAnswerText(firstWrong, options, "choiceOption")
          )
          : "";
      setFeedback(root, allCorrect
        ? root.dataset.successMessage || "Perfect. Now read the full sentences aloud."
          : wrongFeedback(correct, gaps.length, firstWrong, gaps, cue),
          allCorrect ? "success" : "error");
      });
    }

    if (reset) {
      reset.addEventListener("click", function(){
        gaps.forEach(function(gap){
          gap.dataset.value = "";
          gap.textContent = gap.dataset.placeholder || "choose";
          gap.classList.add("is-empty");
          gap.classList.remove("is-correct", "is-wrong", "is-active");
        });
        clearFailedAttempts(gaps);
        options.forEach(function(option){
          option.classList.remove("is-selected");
          option.setAttribute("aria-pressed", "false");
        });
        setActive(gaps[0]);
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initTileGame(root){
    randomizeResponseGroups(root, "[data-tile]");
    const tiles = Array.from(root.querySelectorAll("[data-tile]"));
    const slots = Array.from(root.querySelectorAll("[data-slot]"));
    const reset = root.querySelector("[data-reset-tiles]");
    if (!tiles.length || !slots.length) return;
    let selected = null;

    function select(tile){
      tiles.forEach(function(t){
        t.classList.remove("is-selected");
        t.setAttribute("aria-pressed", "false");
      });
      selected = tile;
      if (tile) {
        tile.classList.add("is-selected");
        tile.setAttribute("aria-pressed", "true");
      }
    }

    tiles.forEach(function(tile){
      tile.setAttribute("aria-pressed", "false");
      tile.addEventListener("click", function(){
        if (!tile.disabled) select(tile);
      });
    });

    slots.forEach(function(slot){
      slot.addEventListener("click", function(){
        if (!selected) return;
        slot.textContent = selected.textContent;
        slot.dataset.value = selected.dataset.tile;
        slot.classList.add("is-filled");
        slot.classList.remove("is-wrong");
        slot.setAttribute("aria-label", "Placed " + selected.textContent.trim() + ". Activate to replace it.");
        selected.disabled = true;
        select(null);
      });
    });

    const check = root.querySelector("[data-check-tiles]");
    if (check) {
      check.addEventListener("click", function(){
        let correct = 0;
        let firstWrong = null;
        slots.forEach(function(slot){
          const ok = norm(slot.dataset.value) === norm(slot.dataset.slot);
          slot.classList.toggle("is-correct", ok);
          slot.classList.toggle("is-wrong", !ok);
          if (ok) {
            correct += 1;
            delete slot.dataset.feedbackAttempts;
          } else if (!firstWrong) firstWrong = slot;
        });
        const firstWrongAttempts = firstWrong ? failedAttempts(firstWrong) : 0;
        const allCorrect = correct === slots.length;
        animateDrill(root, allCorrect);
        const matchingTile = firstWrong
          ? tiles.find(function(tile){
            return norm(tile.dataset.tile) === norm(firstWrong.dataset.slot);
          })
          : null;
        const cue = firstWrong
          ? explanatoryCue(
            firstWrong,
            root,
            firstWrongAttempts,
            firstWrong.dataset.value
              ? "Check the match and try again."
              : "Place a tile, then check again.",
            matchingTile ? matchingTile.textContent.trim() : "",
            "Match it with"
          )
          : "";
        setFeedback(root, allCorrect
          ? root.dataset.successMessage || "Great match. Now say each pair aloud."
          : wrongFeedback(correct, slots.length, firstWrong, slots, cue),
          allCorrect ? "success" : "error");
      });
    }

    if (reset) {
      reset.addEventListener("click", function(){
        tiles.forEach(function(tile){
          tile.disabled = false;
          tile.classList.remove("is-selected");
          tile.setAttribute("aria-pressed", "false");
        });
        slots.forEach(function(slot){
          slot.textContent = slot.dataset.placeholder || "Choose";
          slot.dataset.value = "";
          slot.classList.remove("is-filled", "is-correct", "is-wrong");
          slot.removeAttribute("aria-label");
        });
        clearFailedAttempts(slots);
        selected = null;
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initTileBuilder(root){
    const bank = root.querySelector("[data-build-bank]");
    const area = root.querySelector("[data-build-area]");
    const check = root.querySelector("[data-check-build]");
    const reset = root.querySelector("[data-reset-build]");
    if (!bank || !area) return;
    randomizeResponseGroups(bank, "[data-build-tile]");
    const sourceTiles = Array.from(bank.querySelectorAll("[data-build-tile]"));
    bank.setAttribute("role", "group");
    bank.setAttribute("aria-label", "Available words");
    area.setAttribute("role", "group");
    area.setAttribute("aria-label", "Sentence being built");

    function currentValues(){
      return Array.from(area.querySelectorAll("[data-value]")).map(function(tile){
        return tile.dataset.value;
      });
    }

    function answerDisplay(){
      const sourceByValue = {};
      sourceTiles.forEach(function(tile){
        sourceByValue[norm(tile.dataset.buildTile || tile.textContent)] = tile.textContent.trim();
      });
      return norm(root.dataset.answer).split(" ").map(function(value){
        return sourceByValue[value] || value;
      }).join(" ");
    }

    function addTile(source){
      if (source.disabled) return;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "built-tile";
      tile.textContent = source.textContent;
      tile.dataset.value = source.dataset.buildTile || source.textContent;
      tile.setAttribute("aria-label", "Remove " + source.textContent.trim() + " from the sentence");
      tile.addEventListener("click", function(){
        source.disabled = false;
        tile.remove();
      });
      source.disabled = true;
      area.appendChild(tile);
    }

    sourceTiles.forEach(function(tile){
      tile.addEventListener("click", function(){ addTile(tile); });
    });

    if (check) {
      check.addEventListener("click", function(){
        const answer = norm(root.dataset.answer);
        const attempt = norm(currentValues().join(" "));
        const ok = answer && attempt === answer;
        area.classList.toggle("is-correct", ok);
        area.classList.toggle("is-wrong", !ok);
        const attempts = ok ? 0 : failedAttempts(area);
        if (ok) delete area.dataset.feedbackAttempts;
        animateDrill(root, ok);
        const cue = ok ? "" : explanatoryCue(
          area,
          root,
          attempts,
          attempt
            ? "Check the order and try again."
            : "Build the sentence, then check.",
          answerDisplay(),
          "Correct order is"
        );
        setFeedback(root, ok
          ? root.dataset.successMessage || "Correct. Now say it aloud."
          : cue,
          ok ? "success" : "error");
      });
    }

    if (reset) {
      reset.addEventListener("click", function(){
        sourceTiles.forEach(function(tile){ tile.disabled = false; });
        area.innerHTML = "";
        area.classList.remove("is-correct", "is-wrong");
        clearFailedAttempts([area]);
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initSpotError(root){
    const choices = Array.from(root.querySelectorAll("[data-error-choice]"));
    const feedback = root.querySelector("[data-error-feedback]");
    if (!choices.length) return;
    const answer = norm(root.dataset.answer);
    if (feedback) {
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
    }
    setupRadioGroup(
      choices,
      root.querySelector("h3"),
      function(choice){
        choices.forEach(function(item){ item.classList.remove("is-correct", "is-wrong"); });
        const value = norm(choice.dataset.errorChoice || choice.textContent);
        const ok = choice.dataset.correct === "true" || value === answer;
        choice.classList.add(ok ? "is-correct" : "is-wrong");
        const attempts = ok ? 0 : failedAttempts(choice);
        if (ok) delete choice.dataset.feedbackAttempts;
        animateDrill(root, ok);
        if (feedback) {
          const fix = choice.dataset.fix || root.dataset.fix || "";
          const why = choice.dataset.why || root.dataset.why || "";
          const hint = choice.dataset.hint || root.dataset.hint || "";
          feedback.innerHTML = ok
            ? "<strong>Fix:</strong> " + fix + (why ? "<br><strong>Why:</strong> " + why : "")
            : (hint || (attempts > 1
              ? "That word works. Compare the others with the rule and try again."
              : "That word works. Try another word."));
          feedback.classList.add("is-visible");
        }
      }
    );
  }

  function initTransform(root){
    const items = Array.from(root.querySelectorAll("[data-transform-item]"));
    items.forEach(function(item){
      const reveal = item.querySelector("[data-reveal-transform]");
      const answer = item.querySelector("[data-transform-answer]");
      if (!reveal || !answer) return;
      ensureId(answer, "transform-answer");
      if (!reveal.dataset.teachingOriginalLabel) {
        reveal.dataset.teachingOriginalLabel = reveal.textContent.trim();
      }
      reveal.setAttribute("aria-controls", answer.id);
      reveal.setAttribute("aria-expanded", "false");
      answer.setAttribute("aria-hidden", "true");
      reveal.addEventListener("click", function(){
        answer.hidden = false;
        answer.classList.add("is-visible");
        answer.setAttribute("aria-hidden", "false");
        reveal.setAttribute("aria-expanded", "true");
        reveal.disabled = true;
        reveal.textContent = "Revealed";
        animateDrill(root, true);
      });
    });
  }

  function initQuiz(root){
    const items = Array.from(root.querySelectorAll("[data-quiz-item]"));
    const check = root.querySelector("[data-check-quiz]");
    const reset = root.querySelector("[data-reset-quiz]");
    if (!items.length || !check) return;

    const resetGroups = [];
    items.forEach(function(item){
      randomizeResponseGroups(item, "[data-quiz-option]");
      const options = Array.from(item.querySelectorAll("[data-quiz-option]"));
      resetGroups.push(setupRadioGroup(
        options,
        item.querySelector(".quiz-question"),
        function(option){
          options.forEach(function(candidate){
            candidate.classList.remove("is-selected", "is-correct", "is-wrong");
          });
          option.classList.add("is-selected");
          item.dataset.value = option.dataset.quizOption;
          item.removeAttribute("aria-invalid");
        }
      ));
    });

    check.addEventListener("click", function(){
      let correct = 0;
      let firstWrong = null;
      items.forEach(function(item){
        const answer = choiceNorm(item.dataset.answer);
        const options = Array.from(item.querySelectorAll("[data-quiz-option]"));
        options.forEach(function(option){
          const selected = choiceNorm(item.dataset.value) === choiceNorm(option.dataset.quizOption);
          const isAnswer = choiceNorm(option.dataset.quizOption) === answer;
          option.classList.toggle("is-correct", isAnswer && selected);
          option.classList.toggle("is-wrong", selected && !isAnswer);
        });
        if (choiceNorm(item.dataset.value) === answer) {
          correct += 1;
          item.setAttribute("aria-invalid", "false");
          delete item.dataset.feedbackAttempts;
        } else {
          item.setAttribute("aria-invalid", "true");
          if (!firstWrong) firstWrong = item;
        }
      });
      const firstWrongAttempts = firstWrong ? failedAttempts(firstWrong) : 0;
      const allCorrect = correct === items.length;
      animateDrill(root, allCorrect);
      const cue = firstWrong
        ? explanatoryCue(
          firstWrong,
          root,
          firstWrongAttempts,
          firstWrong.dataset.value
            ? "Compare the choice with the question and try again."
            : "Choose an answer, then check again.",
          optionAnswerText(
            firstWrong,
            Array.from(firstWrong.querySelectorAll("[data-quiz-option]")),
            "quizOption"
          )
        )
        : "";
      setFeedback(root, allCorrect
        ? root.dataset.successMessage || "Excellent. You can use the target language accurately."
        : wrongFeedback(correct, items.length, firstWrong, items, cue),
        allCorrect ? "success" : "error");
    });

    if (reset) {
      reset.addEventListener("click", function(){
        items.forEach(function(item, index){
          item.dataset.value = "";
          item.removeAttribute("aria-invalid");
          item.querySelectorAll("[data-quiz-option]").forEach(function(option){
            option.classList.remove("is-selected", "is-correct", "is-wrong");
          });
          resetGroups[index]();
        });
        clearFailedAttempts(items);
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    // Make each drill's feedback line a polite live region so results are
    // announced to assistive tech, not shown by color alone.
    document.querySelectorAll("[data-feedback]").forEach(function(out){
      out.setAttribute("role", "status");
      out.setAttribute("aria-live", "polite");
    });
    document.querySelectorAll("[data-answer-drill]").forEach(initAnswerDrill);
    document.querySelectorAll("[data-choice-gap-drill]").forEach(initChoiceGapDrill);
    document.querySelectorAll("[data-tile-game]").forEach(initTileGame);
    document.querySelectorAll("[data-tile-builder]").forEach(initTileBuilder);
    document.querySelectorAll("[data-spot-error]").forEach(initSpotError);
    document.querySelectorAll("[data-transform]").forEach(initTransform);
    document.querySelectorAll("[data-quiz]").forEach(initQuiz);
  });
})();
