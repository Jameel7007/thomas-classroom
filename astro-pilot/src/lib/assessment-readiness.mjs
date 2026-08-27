export function percent(score, points) {
  return points ? Math.round((score / points) * 100) : 0;
}

export function evidenceFor(results, levels, skills) {
  const selected = results.filter((item) =>
    (!levels || levels.includes(item.level)) && (!skills || skills.includes(item.skill)));
  return {
    attempted: selected.some((item) => item.attempted),
    score: selected.reduce((total, item) => total + item.score, 0),
    points: selected.reduce((total, item) => total + item.points, 0),
    attemptedItems: selected.filter((item) => item.attempted).length,
  };
}

function liveEvidenceScores(results, level) {
  const levels = level ? [level] : null;
  const listeningLevels = level === "B2" ? ["B1", "B2"] : levels;
  const listening = evidenceFor(results, listeningLevels, ["Listening"]);
  const speaking = evidenceFor(results, levels, ["Speaking"]);
  const writing = evidenceFor(results, levels, ["Writing"]);
  const complete = speaking.attempted && writing.attempted && listening.attempted;
  return [
    percent(listening.score, listening.points),
    percent(speaking.score, speaking.points),
    percent(writing.score, writing.points),
    complete,
  ];
}

export function hasLiveEvidence(results, level, productionMinimum = 60, listeningMinimum = 50) {
  const [listening, speaking, writing, complete] = liveEvidenceScores(results, level);
  return complete &&
    speaking >= productionMinimum &&
    writing >= productionMinimum &&
    listening >= listeningMinimum;
}

export function productionStatus(results, level, productionMinimum = 60, listeningMinimum = 50) {
  const [listeningPercent, speakingPercent, writingPercent, complete] = liveEvidenceScores(results, level);
  return {
    complete,
    supportive: hasLiveEvidence(results, level, productionMinimum, listeningMinimum),
    listeningPercent,
    speakingPercent,
    writingPercent,
  };
}
