import { QUICK_CHECK_BANDS, estimateQuickCheckBand, scoreQuickCheck } from "../lib/quick-check-scoring.mjs";

(function(){
  function init(root){
    const configNode = root.querySelector("[data-quick-check-config]");
    const config = JSON.parse(configNode?.textContent || "{}");
    const questions = config.questions || [];
    const results = config.results || {};
    if (!questions.length) return;

    const stage = root.querySelector("[data-question-stage]");
    const actions = root.querySelector("[data-question-actions]");
    const previous = root.querySelector("[data-previous]");
    const next = root.querySelector("[data-next]");
    const reminder = root.querySelector("[data-answer-reminder]");
    const progressText = root.querySelector("[data-progress-text]");
    const progressBar = root.querySelector("[data-progress-bar]");
    const resultView = root.querySelector("[data-result-view]");
    const resultLevel = root.querySelector("[data-result-level]");
    const resultScore = root.querySelector("[data-result-score]");
    const resultExplanation = root.querySelector("[data-result-explanation]");
    const resultProfile = root.querySelector("[data-result-profile]");
    const reviewList = root.querySelector("[data-review-list]");
    const reset = root.querySelector("[data-reset]");
    const speakingLevel = root.querySelector("[data-speaking-level]");
    const speakingOutcome = root.querySelector("[data-speaking-outcome]");
    const speakingTasks = Array.from(root.querySelectorAll("[data-speaking-task]"));
    let current = 0;
    let answers = Array(questions.length).fill(null);
    let multipleChoiceBand = "";

    function selectChoice(button, moveFocus){
      answers[current] = Number(button.dataset.choice);
      stage.querySelectorAll("[data-choice]").forEach(function(choice){
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-checked", String(selected));
        choice.tabIndex = selected ? 0 : -1;
      });
      reminder.textContent = "";
      if (moveFocus) button.focus();
    }

    function renderQuestion(focusHeading){
      const question = questions[current];
      const letters = ["A", "B", "C"];
      const questionId = "quick-question-" + (current + 1);
      stage.innerHTML =
        '<article class="question-card">' +
          '<div class="question-meta"><span>Question ' + (current + 1) + '</span></div>' +
          (question.passage ? '<div class="reading-message"><p>' + question.passage + '</p></div>' : '') +
          '<h2 id="' + questionId + '" tabindex="-1">' + question.prompt + '</h2>' +
          '<div class="choice-list" role="radiogroup" aria-labelledby="' + questionId + '">' +
            question.choices.map(function(choice, index){
              const selected = answers[current] === index;
              const tabbable = selected || (answers[current] === null && index === 0);
              return '<button class="answer-choice' + (selected ? ' is-selected' : '') +
                '" type="button" role="radio" aria-checked="' + String(selected) + '" tabindex="' + (tabbable ? '0' : '-1') +
                '" data-choice="' + index + '"><span class="choice-letter">' +
                letters[index] + '.</span>' + choice + '</button>';
            }).join("") +
          '</div>' +
        '</article>';

      stage.querySelectorAll("[data-choice]").forEach(function(button){
        button.addEventListener("click", function(){
          selectChoice(button, false);
        });
        button.addEventListener("keydown", function(event){
          const choices = Array.from(stage.querySelectorAll("[data-choice]"));
          const index = choices.indexOf(button);
          let targetIndex = index;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") targetIndex = (index + 1) % choices.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") targetIndex = (index - 1 + choices.length) % choices.length;
          else if (event.key === "Home") targetIndex = 0;
          else if (event.key === "End") targetIndex = choices.length - 1;
          else return;
          event.preventDefault();
          selectChoice(choices[targetIndex], true);
        });
      });

      progressText.textContent = "Question " + (current + 1) + " of " + questions.length;
      progressBar.style.width = ((current + 1) / questions.length * 100) + "%";
      previous.disabled = current === 0;
      next.textContent = current === questions.length - 1 ? "See my result" : "Next question";
      reminder.textContent = "";
      if (focusHeading) stage.querySelector("h2").focus();
    }

    function renderReview(){
      reviewList.innerHTML = questions.map(function(question, index){
        const selected = answers[index];
        const correct = selected === question.answer;
        const selectedText = selected === null ? "No answer" : question.choices[selected];
        return '<article class="review-item ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
          '<span>' + question.band.toUpperCase() + ' evidence</span>' +
          '<p>' + (index + 1) + '. ' + question.prompt + '</p>' +
          (question.passage ? '<span>Context: ' + question.passage + '</span>' : '') +
          '<span>Your answer: <b>' + selectedText + '</b></span>' +
          (!correct ? '<span>Correct answer: <b>' + question.choices[question.answer] + '</b></span>' : '') +
          '<span><b>Why:</b> ' + question.why + '</span>' +
        '</article>';
      }).join("");
    }

    function renderEvidenceProfile(evidence){
      resultProfile.innerHTML = QUICK_CHECK_BANDS.map(function(band){
        return '<span><b>' + band.toUpperCase() + '</b> ' + evidence[band].correct + ' / ' + evidence[band].total + '</span>';
      }).join("");
    }

    function showSpeakingTask(band){
      speakingTasks.forEach(function(task){
        task.hidden = task.dataset.speakingTask !== band;
      });
    }

    function showResult(){
      const summary = scoreQuickCheck(questions, answers);
      multipleChoiceBand = estimateQuickCheckBand(summary);
      const result = results[multipleChoiceBand];
      resultLevel.textContent = result.level;
      resultScore.textContent = summary.score + " / " + questions.length;
      resultExplanation.textContent = result.explanation;
      renderEvidenceProfile(summary.evidence);
      renderReview();
      showSpeakingTask(multipleChoiceBand);
      stage.hidden = true;
      actions.hidden = true;
      reminder.textContent = "";
      resultView.hidden = false;
      root.querySelector("[data-part-label]").textContent = "Result and speaking confirmation";
      progressText.textContent = "Language-use questions complete";
      progressBar.style.width = "100%";
      resultLevel.tabIndex = -1;
      resultLevel.focus();
      resultView.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }

    function resetCheck(){
      current = 0;
      answers = Array(questions.length).fill(null);
      multipleChoiceBand = "";
      speakingLevel.value = "";
      speakingOutcome.textContent = "Choose the strongest level sustained across the complete response. The language-use evidence remains visible for comparison.";
      speakingTasks.forEach(function(task){ task.hidden = true; });
      resultProfile.innerHTML = "";
      resultView.hidden = true;
      stage.hidden = false;
      actions.hidden = false;
      root.querySelector("[data-part-label]").textContent = "Part 1 · Multiple Choice";
      renderQuestion(false);
      root.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }

    previous.addEventListener("click", function(){
      if (current === 0) return;
      current -= 1;
      renderQuestion(true);
    });

    next.addEventListener("click", function(){
      if (answers[current] === null) {
        reminder.textContent = "Choose an answer before continuing.";
        return;
      }
      if (current === questions.length - 1) {
        showResult();
        return;
      }
      current += 1;
      renderQuestion(true);
    });

    speakingLevel.addEventListener("change", function(){
      if (!speakingLevel.value) {
        speakingOutcome.textContent = "Choose the strongest level sustained across the complete response. The language-use evidence remains visible for comparison.";
        return;
      }
      const languageUseLabel = results[multipleChoiceBand].level;
      const speakingLabel = results[speakingLevel.value].level.replace(" checkpoint", " evidence");
      if (speakingLevel.value === multipleChoiceBand) {
        speakingOutcome.textContent = "Speaking supports the " + languageUseLabel + " starting point.";
      } else {
        speakingOutcome.textContent = "Language-use evidence suggests " + languageUseLabel +
          ". Speaking suggests " + speakingLabel + ". Use the weaker area to choose the first lesson, then reassess after one session.";
      }
    });

    reset.addEventListener("click", resetCheck);
    function reducedMotion(){
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    renderQuestion(false);
  }

  document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll("[data-quick-check]").forEach(init);
  });
})();
