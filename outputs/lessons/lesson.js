(function(){
  function norm(value){
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function setFeedback(root, message, state){
    const out = root.querySelector("[data-feedback]");
    if (!out) return;
    out.textContent = message;
    out.classList.remove("is-success", "is-error");
    if (state) out.classList.add("is-" + state);
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
      inputs.forEach(function(input){
        const answers = input.dataset.answer.split("|").map(norm);
        const ok = answers.includes(norm(input.value));
        input.classList.toggle("is-correct", ok);
        input.classList.toggle("is-wrong", !ok);
        if (ok) correct += 1;
      });
      const allCorrect = correct === inputs.length;
      animateDrill(root, allCorrect);
      setFeedback(root, allCorrect
        ? "Perfect. Say the full sentences aloud."
        : correct + " of " + inputs.length + " correct. Fix the highlighted gaps and try again.",
        allCorrect ? "success" : "error");
    });

    if (reset) {
      reset.addEventListener("click", function(){
        inputs.forEach(function(input){
          input.value = "";
          input.classList.remove("is-correct", "is-wrong");
        });
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initChoiceGapDrill(root){
    const gaps = Array.from(root.querySelectorAll("[data-choice-gap]"));
    const options = Array.from(root.querySelectorAll("[data-choice-option]"));
    const check = root.querySelector("[data-check-choices]");
    const reset = root.querySelector("[data-reset-choices]");
    if (!gaps.length || !options.length) return;
    let activeGap = gaps[0];

    function setActive(gap){
      gaps.forEach(function(item){ item.classList.remove("is-active"); });
      activeGap = gap;
      if (activeGap) activeGap.classList.add("is-active");
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
      gap.addEventListener("click", function(){ setActive(gap); });
    });
    setActive(activeGap);

    options.forEach(function(option){
      option.addEventListener("click", function(){
        options.forEach(function(item){ item.classList.remove("is-selected"); });
        option.classList.add("is-selected");
        if (!activeGap) setActive(gaps.find(function(item){ return !item.dataset.value; }) || gaps[0]);
        setGap(activeGap, option);
      });
    });

    if (check) {
      check.addEventListener("click", function(){
        let correct = 0;
        gaps.forEach(function(gap){
          const answers = gap.dataset.answer.split("|").map(norm);
          const ok = answers.includes(norm(gap.dataset.value));
          gap.classList.toggle("is-correct", ok);
          gap.classList.toggle("is-wrong", !ok);
          if (ok) correct += 1;
        });
        const allCorrect = correct === gaps.length;
        animateDrill(root, allCorrect);
        setFeedback(root, allCorrect
          ? "Perfect. Now read the full dialogue aloud."
          : correct + " of " + gaps.length + " correct. Tap a gap to change it.",
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
        options.forEach(function(option){ option.classList.remove("is-selected"); });
        setActive(gaps[0]);
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  function initTileGame(root){
    const tiles = Array.from(root.querySelectorAll("[data-tile]"));
    const slots = Array.from(root.querySelectorAll("[data-slot]"));
    const reset = root.querySelector("[data-reset-tiles]");
    if (!tiles.length || !slots.length) return;
    let selected = null;

    function select(tile){
      tiles.forEach(function(t){ t.classList.remove("is-selected"); });
      selected = tile;
      if (tile) tile.classList.add("is-selected");
    }

    tiles.forEach(function(tile){
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
        selected.disabled = true;
        select(null);
      });
    });

    const check = root.querySelector("[data-check-tiles]");
    if (check) {
      check.addEventListener("click", function(){
        let correct = 0;
        slots.forEach(function(slot){
          const ok = norm(slot.dataset.value) === norm(slot.dataset.slot);
          slot.classList.toggle("is-correct", ok);
          slot.classList.toggle("is-wrong", !ok);
          if (ok) correct += 1;
        });
        const allCorrect = correct === slots.length;
        animateDrill(root, allCorrect);
        setFeedback(root, allCorrect
          ? "Great match. Now say each pair aloud."
          : correct + " of " + slots.length + " tiles placed correctly.",
          allCorrect ? "success" : "error");
      });
    }

    if (reset) {
      reset.addEventListener("click", function(){
        tiles.forEach(function(tile){
          tile.disabled = false;
          tile.classList.remove("is-selected");
        });
        slots.forEach(function(slot){
          slot.textContent = slot.dataset.placeholder || "Choose";
          slot.dataset.value = "";
          slot.classList.remove("is-filled", "is-correct", "is-wrong");
        });
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
    const sourceTiles = Array.from(bank.querySelectorAll("[data-build-tile]"));

    function currentValues(){
      return Array.from(area.querySelectorAll("[data-value]")).map(function(tile){
        return tile.dataset.value;
      });
    }

    function addTile(source){
      if (source.disabled) return;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "built-tile";
      tile.textContent = source.textContent;
      tile.dataset.value = source.dataset.buildTile || source.textContent;
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
        animateDrill(root, ok);
        setFeedback(root, ok
          ? "Correct. Now say it aloud."
          : "Not yet. Tap a word in the build area to move it back.",
          ok ? "success" : "error");
      });
    }

    if (reset) {
      reset.addEventListener("click", function(){
        sourceTiles.forEach(function(tile){ tile.disabled = false; });
        area.innerHTML = "";
        area.classList.remove("is-correct", "is-wrong");
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

    choices.forEach(function(choice){
      choice.addEventListener("click", function(){
        choices.forEach(function(item){ item.classList.remove("is-correct", "is-wrong"); });
        const value = norm(choice.dataset.errorChoice || choice.textContent);
        const ok = choice.dataset.correct === "true" || value === answer;
        choice.classList.add(ok ? "is-correct" : "is-wrong");
        animateDrill(root, ok);
        if (feedback) {
          const fix = choice.dataset.fix || root.dataset.fix || "";
          const why = choice.dataset.why || root.dataset.why || "";
          feedback.innerHTML = ok
            ? "<strong>Fix:</strong> " + fix + (why ? "<br><strong>Why:</strong> " + why : "")
            : "That word is not the target. Try again.";
          feedback.classList.add("is-visible");
        }
      });
    });
  }

  function initTransform(root){
    const items = Array.from(root.querySelectorAll("[data-transform-item]"));
    items.forEach(function(item){
      const reveal = item.querySelector("[data-reveal-transform]");
      const answer = item.querySelector("[data-transform-answer]");
      if (!reveal || !answer) return;
      reveal.addEventListener("click", function(){
        answer.classList.add("is-visible");
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

    items.forEach(function(item){
      const options = Array.from(item.querySelectorAll("[data-quiz-option]"));
      options.forEach(function(option){
        option.addEventListener("click", function(){
          options.forEach(function(candidate){
            candidate.classList.remove("is-selected", "is-correct", "is-wrong");
          });
          option.classList.add("is-selected");
          item.dataset.value = option.dataset.quizOption;
        });
      });
    });

    check.addEventListener("click", function(){
      let correct = 0;
      items.forEach(function(item){
        const answer = norm(item.dataset.answer);
        const options = Array.from(item.querySelectorAll("[data-quiz-option]"));
        options.forEach(function(option){
          const selected = norm(item.dataset.value) === norm(option.dataset.quizOption);
          const isAnswer = norm(option.dataset.quizOption) === answer;
          option.classList.toggle("is-correct", isAnswer && selected);
          option.classList.toggle("is-wrong", selected && !isAnswer);
        });
        if (norm(item.dataset.value) === answer) correct += 1;
      });
      const allCorrect = correct === items.length;
      animateDrill(root, allCorrect);
      setFeedback(root, allCorrect
        ? root.dataset.successMessage || "Excellent. You can use the target language accurately."
        : "Quiz score: " + correct + " of " + items.length + ". Fix the highlighted answers and try again.",
        allCorrect ? "success" : "error");
    });

    if (reset) {
      reset.addEventListener("click", function(){
        items.forEach(function(item){
          item.dataset.value = "";
          item.querySelectorAll("[data-quiz-option]").forEach(function(option){
            option.classList.remove("is-selected", "is-correct", "is-wrong");
          });
        });
        resetMotion(root);
        setFeedback(root, "");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll("[data-answer-drill]").forEach(initAnswerDrill);
    document.querySelectorAll("[data-choice-gap-drill]").forEach(initChoiceGapDrill);
    document.querySelectorAll("[data-tile-game]").forEach(initTileGame);
    document.querySelectorAll("[data-tile-builder]").forEach(initTileBuilder);
    document.querySelectorAll("[data-spot-error]").forEach(initSpotError);
    document.querySelectorAll("[data-transform]").forEach(initTransform);
    document.querySelectorAll("[data-quiz]").forEach(initQuiz);
  });
})();
