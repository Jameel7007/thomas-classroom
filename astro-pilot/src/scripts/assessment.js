import { evidenceFor, hasLiveEvidence, percent } from "../lib/assessment-readiness.mjs";
import { randomizeResponseGroups } from "./randomize-responses.js";

(function(){
  var idSeq = 0;

  function norm(value){
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function answers(value){
    return String(value || "").split("|").map(norm);
  }

  function resetMotion(root){
    root.classList.remove("is-success", "is-error");
    root.querySelectorAll(".drill-burst").forEach(function(node){ node.remove(); });
  }

  function animate(root, ok){
    resetMotion(root);
    root.classList.add(ok ? "is-success" : "is-error");
    window.setTimeout(function(){ root.classList.remove("is-success", "is-error"); }, ok ? 1200 : 520);
    if (!ok || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const burst = document.createElement("span");
    burst.className = "drill-burst";
    for (let i = 0; i < 22; i += 1) {
      const spark = document.createElement("span");
      const angle = (Math.PI * 2 * i) / 22;
      const distance = 58 + Math.random() * 78;
      spark.className = "spark";
      spark.style.setProperty("--x", Math.cos(angle) * distance + "px");
      spark.style.setProperty("--y", Math.sin(angle) * distance + "px");
      spark.style.left = 50 + (Math.random() * 20 - 10) + "%";
      spark.style.top = 48 + (Math.random() * 18 - 9) + "%";
      spark.style.animationDelay = (Math.random() * 0.08) + "s";
      burst.appendChild(spark);
    }
    root.appendChild(burst);
    window.setTimeout(function(){ burst.remove(); }, 1000);
  }

  function setItemState(item, score, points, attempted){
    const ok = attempted && score === points;
    const partial = attempted && score > 0 && score < points;
    item.classList.remove("is-correct", "is-wrong", "is-partial", "is-missing");
    item.classList.add(!attempted ? "is-missing" : ok ? "is-correct" : partial ? "is-partial" : "is-wrong");
  }

  function gradeItem(item){
    const points = Number(item.dataset.points || 1);
    const skill = item.dataset.skill || "Language";
    const level = item.dataset.level || "";
    const input = item.querySelector("[data-answer]");
    const options = Array.from(item.querySelectorAll("[data-option]"));
    const checks = Array.from(item.querySelectorAll("[data-credit]"));
    let score = 0;
    let attempted = false;

    if (input) {
      attempted = !!norm(input.value);
      const ok = attempted && answers(input.dataset.answer).includes(norm(input.value));
      score = ok ? points : 0;
      input.classList.toggle("is-correct", ok);
      input.classList.toggle("is-wrong", attempted && !ok);
    } else if (options.length) {
      const selected = options.find(function(option){ return option.classList.contains("is-selected"); });
      attempted = !!selected;
      score = selected && norm(selected.dataset.option) === norm(item.dataset.answer) ? points : 0;
      options.forEach(function(option){
        const isAnswer = norm(option.dataset.option) === norm(item.dataset.answer);
        const isSelected = option.classList.contains("is-selected");
        option.classList.toggle("is-correct", attempted && isAnswer);
        option.classList.toggle("is-wrong", attempted && isSelected && !isAnswer);
      });
    } else if (checks.length) {
      const perCheck = points / checks.length;
      attempted = checks.some(function(check){ return check.checked; });
      score = checks.reduce(function(total, check){
        return total + (check.checked ? perCheck : 0);
      }, 0);
    }

    score = Math.round(score * 10) / 10;
    setItemState(item, score, points, attempted);
    return {
      score: score,
      points: points,
      skill: skill,
      level: level,
      attempted: attempted,
      evidence: options.length || input ? "recognition" : checks.length ? "teacher" : "other"
    };
  }

  function groupScores(results, key){
    const grouped = {};
    results.forEach(function(item){
      const name = item[key];
      if (!name) return;
      if (!grouped[name]) grouped[name] = { score: 0, points: 0 };
      grouped[name].score += item.score;
      grouped[name].points += item.points;
    });
    return grouped;
  }

  function todayValue(){
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function displayDate(value){
    if (!value) return "Not added";
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function buildResultText(root){
    const title = document.querySelector("h1")?.textContent.trim() || "English assessment";
    const student = root.querySelector("[data-student-name]")?.value.trim() || "Student";
    const date = displayDate(root.querySelector("[data-assessment-date]")?.value);
    const note = document.body.classList.contains("teacher-mode-active")
      ? root.querySelector("[data-teacher-note]")?.value.trim()
      : "";
    const rawScore = root.querySelector("[data-score-text]")?.textContent.trim() || "Not checked";
    const score = root.dataset.placement
      ? rawScore
      : root.dataset.resultPercent
      ? rawScore + " (" + root.dataset.resultPercent + "%)"
      : rawScore;
    const outcome = root.querySelector("[data-score-label]")?.textContent.trim() || "Not checked";
    const estimate = root.querySelector("[data-placement-level]")?.textContent.trim();
    const analysis = root.querySelector("[data-placement-analysis]")?.textContent.trim();
    const skills = Array.from(root.querySelectorAll("[data-skill-summary] .skill-score")).map(function(row){
      const name = row.querySelector("span")?.textContent.trim();
      const value = row.querySelector("b")?.textContent.trim();
      return name && value ? "- " + name + ": " + value : "";
    }).filter(Boolean);
    const lines = [
      "ENGLISH ASSESSMENT RESULT",
      "Student: " + student,
      "Assessment: " + title,
      "Date: " + date,
      "Score: " + score,
      "Outcome: " + outcome
    ];

    if (estimate && estimate !== "Not estimated yet") {
      lines.push(root.dataset.placement ? "Placement estimate: " + estimate : "Estimated CEFR: " + estimate);
    }
    if (skills.length) lines.push("", "Skill profile:", ...skills);
    if (analysis && root.dataset.placement) lines.push("", "Analysis: " + analysis);
    if (note) lines.push("", "Teacher note: " + note);
    lines.push("", "Keep this result to compare with the next assessment.");
    return lines.join("\n");
  }

  function updateResultRecord(root){
    const record = root.querySelector("[data-result-record]");
    if (!record) return;
    const name = root.querySelector("[data-student-name]")?.value.trim() || "Student name";
    const date = displayDate(root.querySelector("[data-assessment-date]")?.value);
    const note = root.querySelector("[data-teacher-note]")?.value.trim() || "No teacher note added.";
    const rawScore = root.querySelector("[data-score-text]")?.textContent.trim() || "Not checked";
    const score = root.dataset.placement
      ? rawScore
      : root.dataset.resultPercent
      ? rawScore + " (" + root.dataset.resultPercent + "%)"
      : rawScore;
    const outcome = root.querySelector("[data-score-label]")?.textContent.trim() || "Not checked";
    const title = document.querySelector("h1")?.textContent.trim() || "English assessment";
    const estimate = root.querySelector("[data-placement-level]")?.textContent.trim();
    const skillText = Array.from(root.querySelectorAll("[data-skill-summary] .skill-score")).map(function(row){
      const skill = row.querySelector("span")?.textContent.trim();
      const value = row.querySelector("b")?.textContent.trim();
      return skill && value ? skill + " " + value : "";
    }).filter(Boolean).join(" · ");

    record.querySelector("[data-record-name]").textContent = name;
    record.querySelector("[data-record-assessment]").textContent = title;
    record.querySelector("[data-record-date]").textContent = date;
    record.querySelector("[data-record-score]").textContent = score;
    record.querySelector("[data-record-outcome]").textContent =
      estimate && estimate !== "Not estimated yet"
        ? (root.dataset.placement ? "Estimate: " : "CEFR: ") + estimate
        : outcome;
    record.querySelector("[data-record-skills]").textContent =
      skillText || "Skill profile appears after the assessment is checked.";
    record.querySelector("[data-record-note]").textContent = note;
  }

  function showShareStatus(root, message, state){
    const status = root.querySelector("[data-share-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.remove("is-success", "is-error");
    if (state) status.classList.add("is-" + state);
  }

  function copyText(text){
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject){
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        const legacyCopy = Reflect.get(document, "execCommand");
        legacyCopy.call(document, "copy") ? resolve() : reject(new Error("Copy failed"));
      } catch (error) {
        reject(error);
      }
      area.remove();
    });
  }

  function addResultRecord(root){
    const scoreCard = root.querySelector(".score-card");
    const actions = root.querySelector(".actions");
    if (!scoreCard || !actions || root.querySelector("[data-result-tool]")) return;

    const tool = document.createElement("section");
    tool.className = "result-tool";
    tool.dataset.resultTool = "";
    tool.innerHTML =
      '<div class="result-tool-head">' +
        '<div><p class="result-eyebrow">Student result record</p><h2>Name it before you share it</h2></div>' +
        '<p>Keep one chat or notes thread per student and add each dated result there. Nothing is stored automatically here.</p>' +
      '</div>' +
      '<div class="result-fields">' +
        '<label><span>Student name</span><input type="text" data-student-name placeholder="e.g. Ana Silva" autocomplete="off" /></label>' +
        '<label><span>Assessment date</span><input type="date" data-assessment-date /></label>' +
        '<label class="result-note-field' + (root.dataset.placement ? ' teacher-only' : '') + '"><span>Teacher note</span><textarea data-teacher-note rows="2" placeholder="One strength and one next step"></textarea></label>' +
      '</div>' +
      '<article class="result-record" data-result-record aria-label="Shareable assessment result">' +
        '<div class="result-record-top"><div><span>Student</span><b data-record-name>Student name</b></div><div><span>Date</span><b data-record-date></b></div></div>' +
        '<p class="result-assessment" data-record-assessment></p>' +
        '<div class="result-score-line"><strong data-record-score>Not checked</strong><span data-record-outcome>Not checked</span></div>' +
        '<p class="result-skills" data-record-skills>Skill profile appears after the assessment is checked.</p>' +
        '<p class="result-note' + (root.dataset.placement ? ' teacher-only' : '') + '"><span>Teacher note</span><b data-record-note>No teacher note added.</b></p>' +
      '</article>' +
      '<p class="share-status" data-share-status>Tip: this card is intentionally easy to screenshot.</p>';
    root.insertBefore(tool, scoreCard);

    const dateInput = root.querySelector("[data-assessment-date]");
    dateInput.value = todayValue();
    root.querySelectorAll("[data-student-name], [data-assessment-date], [data-teacher-note]").forEach(function(field){
      field.addEventListener("input", function(){ updateResultRecord(root); });
      field.addEventListener("change", function(){ updateResultRecord(root); });
    });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "assessment-btn";
    copy.dataset.copyResult = "";
    copy.textContent = "Copy result for chat";
    copy.addEventListener("click", function(){
      copyText(buildResultText(root)).then(function(){
        showShareStatus(root, "Result copied. Paste it into a student chat, email, or notes app.", "success");
      }).catch(function(){
        showShareStatus(root, "Copy was blocked. Screenshot the card or use Print / save PDF.", "error");
      });
    });

    const print = actions.querySelector("[data-print-assessment]");
    if (print) print.textContent = "Print / save PDF";
    if (print) actions.insertBefore(copy, print);
    else actions.appendChild(copy);
    updateResultRecord(root);
  }

  function estimatePlacement(byLevel){
    const order = ["A0", "A1", "A2", "B1", "B2"];
    let estimate = "Below A0";
    let secureChain = true;

    order.forEach(function(level){
      const item = byLevel[level];
      const pct = item ? percent(item.score, item.points) : 0;
      if (secureChain && pct >= 70) estimate = level;
      if (pct < 60) secureChain = false;
    });

    const b2 = byLevel.B2 ? percent(byLevel.B2.score, byLevel.B2.points) : 0;
    const b1 = byLevel.B1 ? percent(byLevel.B1.score, byLevel.B1.points) : 0;
    if (estimate === "B1" && b2 >= 60) return "B1+ / early B2";
    if (estimate === "A2" && b1 >= 60) return "A2+ / early B1";
    if (estimate === "A1" && byLevel.A2 && percent(byLevel.A2.score, byLevel.A2.points) >= 60) return "A1+ / early A2";
    if (estimate === "Below A0" && byLevel.A0 && percent(byLevel.A0.score, byLevel.A0.points) >= 45) return "A0 emerging";
    return estimate;
  }

  function recommendedStart(estimate){
    if (!estimate || estimate === "Below A0") return "Start at A0 with foundation lessons.";
    if (estimate === "A0 emerging") return "Start at A0 and move quickly through secure basics.";
    if (estimate.includes("early A2")) return "Start at late A1, then bridge into A2.";
    if (estimate.includes("early B1")) return "Start at late A2, then bridge into B1.";
    if (estimate.includes("early B2")) return "Start at late B1, then bridge into B2.";
    return "Start at " + estimate + " and use the level check to confirm.";
  }

  function baseLevel(estimate){
    if (!estimate) return "Below A0";
    if (estimate === "Below A0") return "Below A0";
    if (estimate.includes("B2")) return "B2";
    if (estimate.includes("B1")) return "B1";
    if (estimate.includes("A2")) return "A2";
    if (estimate.includes("A1")) return "A1";
    if (estimate.includes("A0")) return "A0";
    return "Below A0";
  }

  function updatePlacementSummary(root, results){
    if (!root.dataset.placement) return;
    const recognition = results.filter(function(item){ return item.evidence === "recognition"; });
    const byLevel = groupScores(recognition, "level");
    const bySkill = groupScores(results, "skill");
    const ceiling = estimatePlacement(byLevel);
    const ceilingLevel = baseLevel(ceiling);
    const foundation = recognition.filter(function(item){ return item.level === "A0" || item.level === "A1"; });
    const foundationAttempted = foundation.reduce(function(total, item){
      return total + (item.attempted ? item.points : 0);
    }, 0);
    const foundationScore = foundation.reduce(function(total, item){ return total + item.score; }, 0);
    const foundationPossible = foundation.reduce(function(total, item){ return total + item.points; }, 0);
    const minimumFoundation = Math.min(6, Math.ceil(foundationPossible * 0.55));
    const a0Evidence = evidenceFor(recognition, ["A0"]);
    const enoughEvidence = foundationAttempted >= minimumFoundation &&
      a0Evidence.attemptedItems >= 2 && foundationScore > 0;
    const recognitionAttempted = recognition.reduce(function(total, item){
      return total + (item.attempted ? item.points : 0);
    }, 0);
    const recognitionPossible = recognition.reduce(function(total, item){ return total + item.points; }, 0);
    const attemptedPercent = percent(recognitionAttempted, recognitionPossible);
    const levelRoot = root.querySelector("[data-placement-level]");
    const analysisRoot = root.querySelector("[data-placement-analysis]");
    const ladderRoot = root.querySelector("[data-level-summary]");
    const skillProfileRoot = root.querySelector("[data-placement-skills]");
    const scoreLabel = root.querySelector("[data-score-label]");
    const feedback = root.querySelector("[data-feedback]");
    let displayEstimate = ceiling;
    let analysis = "";

    if (!enoughEvidence) {
      displayEstimate = "Not enough evidence";
      analysis = "There is not enough foundation evidence to suggest a starting point yet. Complete more of the A0-A1 section first.";
    } else if (ceilingLevel === "B2") {
      const b2Evidence = hasLiveEvidence(results, "B2");
      const b1Evidence = hasLiveEvidence(results, "B1");
      if (b2Evidence) {
        displayEstimate = "B2 starting point";
        analysis = "Current evidence suggests a B2 starting point. Recognition, listening, speaking, and writing evidence are aligned. This is a placement estimate, not an official CEFR certificate.";
      } else if (b1Evidence) {
        displayEstimate = "B1 starting point";
        analysis = "Multiple-choice answers suggest a possible B2 ceiling, while current production evidence supports a B1 starting point. More B2 speaking or writing practice may help close the gap.";
      } else {
        displayEstimate = "Possible B2 ceiling";
        analysis = "Your multiple-choice answers suggest a possible B2 ceiling. Speaking, listening, and writing evidence are recommended before choosing a final starting point.";
      }
    } else if (ceilingLevel === "B1") {
      const b1Evidence = hasLiveEvidence(results, "B1");
      if (b1Evidence) {
        displayEstimate = "B1 starting point";
        analysis = "Current evidence suggests a B1 starting point. Recognition and live performance are broadly aligned. This is a placement estimate, pending teacher confirmation.";
      } else {
        displayEstimate = "Possible B1 ceiling";
        analysis = "Your multiple-choice answers suggest a possible B1 ceiling. Speaking, listening, and writing evidence help confirm whether B1 or late A2 is the best starting point.";
      }
    } else {
      displayEstimate = ceilingLevel === "Below A0" ? "A0 foundation" : ceiling + " starting point";
      const attemptedBySkill = groupScores(results.filter(function(item){ return item.attempted; }), "skill");
      const weakest = Object.keys(attemptedBySkill).sort(function(a, b){
        return percent(attemptedBySkill[a].score, attemptedBySkill[a].points) -
          percent(attemptedBySkill[b].score, attemptedBySkill[b].points);
      })[0];
      analysis = "Current evidence suggests " + displayEstimate + ". " + recommendedStart(ceiling) +
        " Current evidence suggests " + (weakest || "one area") +
        " may be a priority area. Blank higher-level answers can simply show that the later sections were above the current range.";
    }

    analysis += " Recognition coverage: " + attemptedPercent + "%. Speaking and writing confirmation makes the placement more reliable.";
    if (levelRoot) levelRoot.textContent = displayEstimate;
    if (analysisRoot) analysisRoot.textContent = analysis;
    if (scoreLabel) scoreLabel.textContent = enoughEvidence ? "Placement estimate ready" : "More foundation evidence needed";
    if (feedback) {
      feedback.textContent = enoughEvidence
        ? "This is a placement estimate. Review the level ladder and live performance evidence with your teacher."
        : "Complete more foundation questions before generating a placement estimate.";
      feedback.classList.remove("is-success", "is-error");
      feedback.classList.add(enoughEvidence ? "is-success" : "is-error");
    }
    root.dataset.placementReady = enoughEvidence ? "true" : "false";
    if (ladderRoot) {
      ladderRoot.innerHTML = "";
      ["A0", "A1", "A2", "B1", "B2"].forEach(function(level){
        const item = byLevel[level] || { score: 0, points: 0 };
        const pct = percent(item.score, item.points);
        const row = document.createElement("div");
        row.className = "level-score";
        row.innerHTML = "<span>" + level + "</span><b>" + pct + "%</b><i><em style=\"width:" + pct + "%\"></em></i>";
        ladderRoot.appendChild(row);
      });
    }
    if (skillProfileRoot) {
      skillProfileRoot.innerHTML = "";
      Object.keys(bySkill).forEach(function(skill){
        const item = bySkill[skill];
        const pct = percent(item.score, item.points);
        const row = document.createElement("div");
        row.className = "level-score";
        row.innerHTML = "<span>" + skill + "</span><b>" + item.score + "/" + item.points +
          "</b><i><em style=\"width:" + pct + "%\"></em></i>";
        skillProfileRoot.appendChild(row);
      });
    }
  }

  function updateSummary(root, results){
    const total = results.reduce(function(n, item){ return n + item.points; }, 0);
    const score = results.reduce(function(n, item){ return n + item.score; }, 0);
    const totalPercent = total ? Math.round((score / total) * 100) : 0;
    root.dataset.resultPercent = totalPercent;
    const pass = Number(root.dataset.pass || 70);
    const strong = Number(root.dataset.strong || 86);
    const requiresLiveEvidence = root.hasAttribute("data-require-live-evidence");
    const evidenceReady = !requiresLiveEvidence ||
      hasLiveEvidence(results, null, Number(root.dataset.productionMin), Number(root.dataset.listeningMin));
    const ready = totalPercent >= pass && evidenceReady;
    const label = totalPercent >= strong && evidenceReady ? root.dataset.strongLabel :
      ready ? root.dataset.passLabel :
      totalPercent >= pass ? root.dataset.evidenceLabel : root.dataset.reviewLabel;

    const scoreText = root.querySelector("[data-score-text]");
    const scoreBar = root.querySelector("[data-score-bar]");
    const scoreLabel = root.querySelector("[data-score-label]");
    const feedback = root.querySelector("[data-feedback]");
    if (scoreText) scoreText.textContent = root.dataset.placement
      ? score + " evidence points"
      : score + " / " + total;
    if (scoreBar) scoreBar.style.width = totalPercent + "%";
    if (scoreLabel) scoreLabel.textContent = label || totalPercent + "%";
    if (feedback) {
      feedback.textContent = ready
        ? root.dataset.passFeedback || "Good evidence. Compare this with the next check to show visible progress."
        : totalPercent >= pass && !evidenceReady
          ? root.dataset.evidenceFeedback
          : root.dataset.reviewFeedback || "Useful baseline. These items show where the next lessons should focus.";
      feedback.classList.remove("is-success", "is-error");
      feedback.classList.add(ready ? "is-success" : "is-error");
    }

    const skillRoot = root.querySelector("[data-skill-summary]");
    if (skillRoot) {
      const bySkill = {};
      results.forEach(function(item){
        if (!bySkill[item.skill]) bySkill[item.skill] = { score: 0, points: 0 };
        bySkill[item.skill].score += item.score;
        bySkill[item.skill].points += item.points;
      });
      skillRoot.innerHTML = "";
      Object.keys(bySkill).forEach(function(skill){
        const item = bySkill[skill];
        const skillPercent = percent(item.score, item.points);
        const row = document.createElement("div");
        row.className = "skill-score";
        row.innerHTML = root.dataset.placement
          ? "<span>" + skill + " evidence</span><b>" + item.score + "/" + item.points + "</b>"
          : "<span>" + skill + "</span><b>" + skillPercent + "%</b>";
        skillRoot.appendChild(row);
      });
    }

    updatePlacementSummary(root, results);
    updateResultRecord(root);
    animate(root, root.dataset.placement ? root.dataset.placementReady === "true" : ready);
  }

  function resetAssessment(root){
    if (root._activeLessonAudio) {
      root._activeLessonAudio.pause();
      root._activeLessonAudio = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    root.querySelectorAll("[data-assessment-item]").forEach(function(item){
      item.classList.remove("is-correct", "is-wrong", "is-partial", "is-missing");
      item.querySelectorAll("[data-option]").forEach(function(option, index){
        option.classList.remove("is-selected", "is-correct", "is-wrong");
        option.setAttribute("aria-checked", "false");
        option.tabIndex = index === 0 ? 0 : -1;
      });
      item.querySelectorAll("[data-answer]").forEach(function(input){
        input.value = "";
        input.classList.remove("is-correct", "is-wrong");
      });
      item.querySelectorAll("[data-credit]").forEach(function(check){ check.checked = false; });
      item.querySelectorAll("[data-speak]").forEach(function(button){ button.classList.remove("is-playing"); });
    });
    resetMotion(root);
    const scoreText = root.querySelector("[data-score-text]");
    const scoreBar = root.querySelector("[data-score-bar]");
    const scoreLabel = root.querySelector("[data-score-label]");
    const feedback = root.querySelector("[data-feedback]");
    const skillRoot = root.querySelector("[data-skill-summary]");
    const placementLevel = root.querySelector("[data-placement-level]");
    const placementAnalysis = root.querySelector("[data-placement-analysis]");
    const levelSummary = root.querySelector("[data-level-summary]");
    const placementSkills = root.querySelector("[data-placement-skills]");
    const total = Array.from(root.querySelectorAll("[data-assessment-item]")).reduce(function(n, item){
      return n + Number(item.dataset.points || 1);
    }, 0);
    if (scoreText) scoreText.textContent = root.dataset.placement ? "0 evidence points" : "0 / " + total;
    if (scoreBar) scoreBar.style.width = "0%";
    if (scoreLabel) scoreLabel.textContent = "Not checked yet";
    if (feedback) {
      feedback.textContent = "Complete the sections, then check the assessment.";
      feedback.classList.remove("is-success", "is-error");
    }
    if (skillRoot) skillRoot.innerHTML = "";
    if (placementLevel) placementLevel.textContent = "Not estimated yet";
    if (placementAnalysis) placementAnalysis.textContent = "Complete the exam to generate a CEFR-aligned placement estimate and learning priorities.";
    if (levelSummary) levelSummary.innerHTML = "";
    if (placementSkills) placementSkills.innerHTML = "";
    delete root.dataset.resultPercent;
    delete root.dataset.placementReady;
    showShareStatus(root, "Tip: this card is intentionally easy to screenshot.");
    updateResultRecord(root);
  }

  function selectOption(item, option){
    item.querySelectorAll("[data-option]").forEach(function(other){
      const chosen = other === option;
      other.classList.toggle("is-selected", chosen);
      other.classList.remove("is-correct", "is-wrong");
      other.setAttribute("aria-checked", chosen ? "true" : "false");
      other.tabIndex = chosen ? 0 : -1;
    });
    item.classList.remove("is-correct", "is-wrong", "is-partial", "is-missing");
  }

  // Turn each question's option buttons into an accessible single-select radio
  // group: arrow-key navigation, roving tabindex, and aria-checked state.
  function initOptionGroups(root){
    root.querySelectorAll("[data-assessment-item]").forEach(function(item){
      randomizeResponseGroups(item, "[data-option]");
      const options = Array.from(item.querySelectorAll("[data-option]"));
      if (!options.length) return;
      const group = options[0].parentNode;
      group.setAttribute("role", "radiogroup");
      const question = item.querySelector(".question");
      if (question) {
        if (!question.id) question.id = "assess-q-" + (++idSeq);
        group.setAttribute("aria-labelledby", question.id);
      }
      options.forEach(function(option, index){
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", "false");
        option.tabIndex = index === 0 ? 0 : -1;
        option.addEventListener("click", function(){ selectOption(item, option); });
        option.addEventListener("keydown", function(event){
          const current = options.indexOf(option);
          let next = null;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % options.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = options.length - 1;
          if (next === null) return;
          event.preventDefault();
          selectOption(item, options[next]);
          options[next].focus();
        });
      });
    });
  }

  function initAssessment(root){
    addResultRecord(root);
    if (root.dataset.placement) initTeacherMode();
    initStaticAudio(root);
    initOptionGroups(root);

    const check = root.querySelector("[data-check-assessment]");
    const reset = root.querySelector("[data-reset-assessment]");
    const print = root.querySelector("[data-print-assessment]");
    const resultRegion = root.querySelector(".score-card");
    if (resultRegion) {
      resultRegion.ariaLabel = "Assessment results";
      resultRegion.tabIndex = -1;
    }
    if (check) {
      check.addEventListener("click", function(){
        const results = Array.from(root.querySelectorAll("[data-assessment-item]")).map(gradeItem);
        updateSummary(root, results);
        if (resultRegion) resultRegion.focus();
      });
    }
    if (reset) reset.addEventListener("click", function(){ resetAssessment(root); });
    if (print) print.addEventListener("click", function(){ window.print(); });
    resetAssessment(root);

    // Announce results to assistive tech. Set after the initial reset so the
    // page does not announce the empty state on load.
    const feedbackEl = root.querySelector("[data-feedback]");
    if (feedbackEl) {
      feedbackEl.setAttribute("role", "status");
      feedbackEl.setAttribute("aria-live", "polite");
    }
    [".score-card", ".placement-result"].forEach(function(selector){
      const region = root.querySelector(selector);
      if (region) region.setAttribute("aria-live", "polite");
    });
  }

  function initStaticAudio(root){
    root.querySelectorAll("audio[data-audio-src][data-speak]").forEach(function(audio){
      const fallback = document.createElement("button");
      fallback.type = "button";
      fallback.className = "listen-btn audio-fallback";
      fallback.hidden = true;
      fallback.dataset.speak = audio.dataset.speak;
      fallback.textContent = "Use browser voice";
      fallback.setAttribute("aria-label", "Use browser voice because the recorded audio is unavailable");
      audio.insertAdjacentElement("afterend", fallback);

      let attemptedPlayback = false;
      const stopOtherAudio = function(){
        if (root._activeLessonAudio && root._activeLessonAudio !== audio) root._activeLessonAudio.pause();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        root.querySelectorAll("[data-speak]").forEach(function(other){ other.classList.remove("is-playing"); });
      };
      const clear = function(){
        audio.classList.remove("is-playing");
        if (root._activeLessonAudio === audio) root._activeLessonAudio = null;
      };
      const useFallback = function(){
        clear();
        audio.hidden = true;
        fallback.hidden = false;
        fallback.title = "The recorded MP3 is missing. Browser speech is available as a fallback.";
        if (attemptedPlayback) {
          attemptedPlayback = false;
          stopOtherAudio();
          playBrowserVoice(fallback);
        }
      };

      audio.addEventListener("click", function(){ attemptedPlayback = true; });
      audio.addEventListener("keydown", function(event){
        if (event.key === " " || event.key === "Enter") attemptedPlayback = true;
      });
      audio.addEventListener("play", function(){
        attemptedPlayback = true;
        stopOtherAudio();
        root._activeLessonAudio = audio;
        audio.classList.add("is-playing");
      });
      audio.addEventListener("pause", clear);
      audio.addEventListener("ended", clear);
      audio.addEventListener("error", useFallback);
      fallback.addEventListener("click", function(){
        stopOtherAudio();
        playBrowserVoice(fallback);
      });

      // The native control already contains its static src so playback works
      // without JavaScript. Keep the data attribute for validation and fallback
      // handling when a draft build does not yet contain the generated MP3.
    });
  }

  function initTeacherMode(){
    const toggle = document.querySelector("[data-teacher-mode]");
    if (!toggle) return;
    const storageKey = "english-diagnostic-teacher-mode";
    let active = false;
    try { active = window.localStorage.getItem(storageKey) === "true"; } catch {}

    function applyTeacherMode(){
      document.body.classList.toggle("teacher-mode-active", active);
      toggle.setAttribute("aria-pressed", String(active));
      toggle.textContent = active ? "Hide teacher notes" : "Teacher mode";
      try { window.localStorage.setItem(storageKey, String(active)); } catch {}
    }

    toggle.addEventListener("click", function(){
      active = !active;
      applyTeacherMode();
    });
    applyTeacherMode();
  }

  function playBrowserVoice(button){
    if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
      button.title = "Audio is unavailable. Ask the teacher to read this item.";
      return;
    }
    const utterance = new SpeechSynthesisUtterance(button.dataset.speak);
    utterance.lang = "en-US";
    utterance.rate = 0.72;
    button.classList.add("is-playing");
    utterance.onend = function(){ button.classList.remove("is-playing"); };
    utterance.onerror = function(){ button.classList.remove("is-playing"); };
    window.speechSynthesis.speak(utterance);
  }

  document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll("[data-assessment]").forEach(initAssessment);
  });
})();
