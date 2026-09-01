export const QUICK_CHECK_BANDS = Object.freeze(["a1", "a2", "b1", "b2"]);

export function scoreQuickCheck(questions, answers) {
  const evidence = Object.fromEntries(QUICK_CHECK_BANDS.map((band) => [band, { correct: 0, total: 0 }]));
  let score = 0;

  questions.forEach((question, index) => {
    const band = evidence[question.band];
    if (!band) throw new Error(`Unknown quick-check band: ${question.band}`);
    band.total += 1;
    if (answers[index] === question.answer) {
      band.correct += 1;
      score += 1;
    }
  });

  return { score, evidence };
}

export function estimateQuickCheckBand({ score, evidence }) {
  if (score >= 8 && evidence.b1.correct >= 2 && evidence.b2.correct >= 2) return "b2";
  if (score >= 6 && evidence.b1.correct >= 1 && evidence.b1.correct + evidence.b2.correct >= 3) return "b1";
  if (score >= 4 && (evidence.a2.correct >= 1 || evidence.b1.correct + evidence.b2.correct >= 2)) return "a2";
  if (score >= 2 || evidence.a1.correct >= 1) return "a1";
  return "a0";
}
