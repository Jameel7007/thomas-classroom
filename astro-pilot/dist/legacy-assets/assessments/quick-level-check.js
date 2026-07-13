(function(){
  const QUESTIONS = [
    {
      level: "Pre-A1 / A1",
      prompt: "You meet a new person. What do you ask?",
      choices: ["What is your name?", "What is her name?", "What is its name?"],
      answer: 0
    },
    {
      level: "A1",
      prompt: "Choose the correct sentence.",
      choices: ["I from Mexico.", "I am from Mexico.", "I be from Mexico."],
      answer: 1
    },
    {
      level: "A1",
      prompt: "Choose the correct sentence.",
      choices: ["She work in a hotel.", "She works in a hotel.", "She working in a hotel."],
      answer: 1
    },
    {
      level: "A2",
      prompt: "Yesterday, I ____ to the store.",
      choices: ["go", "went", "going"],
      answer: 1
    },
    {
      level: "A2",
      prompt: "I usually drink coffee in the morning, but today I ____ tea.",
      choices: ["drink", "am drinking", "drank"],
      answer: 1
    },
    {
      level: "A2",
      prompt: "Why is the person writing?",
      passage: "Hi Ana, I can't come to class today because I'm sick. Can you send me the homework after class?",
      choices: ["To ask for help", "To invite Ana to class", "To cancel the homework"],
      answer: 0
    },
    {
      level: "B1",
      prompt: "I have lived here ____ 2020.",
      choices: ["for", "since", "during"],
      answer: 1
    },
    {
      level: "B1",
      prompt: "Choose the correct sentence.",
      choices: [
        "I want to improve my English because I need it for work.",
        "I want improve my English because I need for work.",
        "I want improving my English because I need it work."
      ],
      answer: 0
    },
    {
      level: "B1 / B2",
      prompt: "Choose the best sentence.",
      choices: [
        "Although it was raining, we decided to go out.",
        "Because it was raining, but we decided to go out.",
        "Although it was raining, but we decided to go out."
      ],
      answer: 0
    },
    {
      level: "B2",
      prompt: "Choose the most natural sentence.",
      choices: [
        "If I would have more time, I will study every day.",
        "If I had more time, I would study every day.",
        "If I have more time, I would studied every day."
      ],
      answer: 1
    }
  ];

  const RESULT_BANDS = [
    {
      min: 0,
      max: 2,
      level: "Pre-A1",
      explanation: "The student recognizes some basic English but may need help forming full sentences."
    },
    {
      min: 3,
      max: 4,
      level: "A1",
      explanation: "The student can understand and produce very simple personal English, but grammar is still limited."
    },
    {
      min: 5,
      max: 6,
      level: "A2",
      explanation: "The student can handle daily topics and simple past/present sentences, but longer speaking may break down."
    },
    {
      min: 7,
      max: 8,
      level: "B1",
      explanation: "The student can explain daily life, past events, reasons, and plans with some mistakes."
    },
    {
      min: 9,
      max: 10,
      level: "B2 range",
      explanation: "The student can handle more complex grammar and meaning, but speaking should confirm fluency and accuracy."
    }
  ];

  function init(root){
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
    const reviewList = root.querySelector("[data-review-list]");
    const reset = root.querySelector("[data-reset]");
    const speakingLevel = root.querySelector("[data-speaking-level]");
    const speakingOutcome = root.querySelector("[data-speaking-outcome]");
    let current = 0;
    let answers = Array(QUESTIONS.length).fill(null);
    let multipleChoiceLevel = "";

    function renderQuestion(){
      const question = QUESTIONS[current];
      const letters = ["A", "B", "C"];
      stage.innerHTML =
        '<article class="question-card">' +
          '<div class="question-meta"><span>Question ' + (current + 1) + '</span><span class="level-tag">' + question.level + '</span></div>' +
          (question.passage ? '<div class="reading-message"><p>' + question.passage + '</p></div>' : '') +
          '<h2>' + question.prompt + '</h2>' +
          '<div class="choice-list">' +
            question.choices.map(function(choice, index){
              return '<button class="answer-choice' + (answers[current] === index ? ' is-selected' : '') +
                '" type="button" data-choice="' + index + '"><span class="choice-letter">' +
                letters[index] + '.</span>' + choice + '</button>';
            }).join("") +
          '</div>' +
        '</article>';

      stage.querySelectorAll("[data-choice]").forEach(function(button){
        button.addEventListener("click", function(){
          answers[current] = Number(button.dataset.choice);
          stage.querySelectorAll("[data-choice]").forEach(function(choice){
            choice.classList.toggle("is-selected", choice === button);
          });
          reminder.textContent = "";
        });
      });

      progressText.textContent = "Question " + (current + 1) + " of " + QUESTIONS.length;
      progressBar.style.width = ((current + 1) / QUESTIONS.length * 100) + "%";
      previous.disabled = current === 0;
      next.textContent = current === QUESTIONS.length - 1 ? "See my result" : "Next question";
      reminder.textContent = "";
    }

    function renderReview(){
      reviewList.innerHTML = QUESTIONS.map(function(question, index){
        const selected = answers[index];
        const correct = selected === question.answer;
        const selectedText = selected === null ? "No answer" : question.choices[selected];
        return '<article class="review-item ' + (correct ? 'is-correct' : 'is-wrong') + '">' +
          '<p>' + (index + 1) + '. ' + question.prompt + '</p>' +
          '<span>Your answer: <b>' + selectedText + '</b></span>' +
          (!correct ? '<span>Correct answer: <b>' + question.choices[question.answer] + '</b></span>' : '') +
        '</article>';
      }).join("");
    }

    function showResult(){
      const score = QUESTIONS.reduce(function(total, question, index){
        return total + (answers[index] === question.answer ? 1 : 0);
      }, 0);
      const band = RESULT_BANDS.find(function(item){ return score >= item.min && score <= item.max; });
      multipleChoiceLevel = band.level;
      resultLevel.textContent = band.level;
      resultScore.textContent = score + " / " + QUESTIONS.length;
      resultExplanation.textContent = band.explanation;
      renderReview();
      stage.hidden = true;
      actions.hidden = true;
      reminder.textContent = "";
      resultView.hidden = false;
      root.querySelector("[data-part-label]").textContent = "Result and speaking confirmation";
      progressText.textContent = "Multiple choice complete";
      progressBar.style.width = "100%";
      resultView.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function resetCheck(){
      current = 0;
      answers = Array(QUESTIONS.length).fill(null);
      multipleChoiceLevel = "";
      speakingLevel.value = "";
      speakingOutcome.textContent = "Choose a level after listening to the student. The multiple-choice estimate remains visible for comparison.";
      resultView.hidden = true;
      stage.hidden = false;
      actions.hidden = false;
      root.querySelector("[data-part-label]").textContent = "Part 1 · Multiple Choice";
      renderQuestion();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    previous.addEventListener("click", function(){
      if (current === 0) return;
      current -= 1;
      renderQuestion();
    });

    next.addEventListener("click", function(){
      if (answers[current] === null) {
        reminder.textContent = "Choose an answer before continuing.";
        return;
      }
      if (current === QUESTIONS.length - 1) {
        showResult();
        return;
      }
      current += 1;
      renderQuestion();
    });

    speakingLevel.addEventListener("change", function(){
      if (!speakingLevel.value) {
        speakingOutcome.textContent = "Choose a level after listening to the student. The multiple-choice estimate remains visible for comparison.";
        return;
      }
      if (speakingLevel.value === multipleChoiceLevel) {
        speakingOutcome.textContent = "Speaking confirms the " + multipleChoiceLevel + " quick estimate.";
      } else {
        speakingOutcome.textContent = "Multiple choice suggested " + multipleChoiceLevel +
          ". Speaking suggests " + speakingLevel.value + ". Use the speaking evidence to choose the teaching starting point.";
      }
    });

    reset.addEventListener("click", resetCheck);
    renderQuestion();
  }

  document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll("[data-quick-check]").forEach(init);
  });
})();
