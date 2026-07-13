export function normalizeCurriculumText(value) {
  return String(value).trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function lessonMatchesFilters(lesson, filters) {
  const query = normalizeCurriculumText(filters.query);
  return (filters.level === "all" || filters.level === lesson.level)
    && (!query || normalizeCurriculumText(lesson.text).includes(query))
    && (filters.type === "all" || filters.type === lesson.type)
    && (filters.availability === "all" || filters.availability === lesson.availability);
}
