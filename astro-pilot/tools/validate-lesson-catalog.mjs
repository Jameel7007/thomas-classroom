import { lessonCatalog, lessonCounts, readyLessons, getLessonNavigation } from "../src/data/lesson-catalog.mjs";

const counts = lessonCounts();
const errors = [];

for (const lesson of readyLessons) {
  const navigation = getLessonNavigation(lesson.id);
  if (navigation.previous && navigation.previous.level !== lesson.level) errors.push(`${lesson.id}: previous lesson leaves its level`);
  if (navigation.next && navigation.next.level !== lesson.level) errors.push(`${lesson.id}: next lesson leaves its level`);
}

if (errors.length) {
  console.error(`Lesson catalog validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Lesson catalog verified: ${lessonCatalog.length} unique records, ${counts.ready} ready routes, ${counts.planned} planned topics, contiguous level sequences, valid references, and generated navigation.`);
