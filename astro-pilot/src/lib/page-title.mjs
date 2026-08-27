export const SITE_TITLE_BRAND = "Thomas’s Classroom";

export function formatPageTitle(value, { brand = SITE_TITLE_BRAND, maxLength = 70 } = {}) {
  const normalized = String(value || "").replace(/\s+/gu, " ").trim();
  if (!normalized) throw new TypeError("A page title is required");
  if (!Number.isInteger(maxLength) || maxLength < 20) {
    throw new TypeError("Page-title maxLength must be an integer of at least 20");
  }

  const suffix = ` · ${brand}`;
  const unbranded = normalized.endsWith(suffix)
    ? normalized.slice(0, -suffix.length).trim()
    : normalized;
  const firstCharacter = Array.from(unbranded)[0];
  const baseTitle = firstCharacter
    ? firstCharacter.toLocaleUpperCase("en-US") + unbranded.slice(firstCharacter.length)
    : unbranded;
  const brandedTitle = `${baseTitle}${suffix}`;

  return characterLength(brandedTitle) <= maxLength ? brandedTitle : baseTitle;
}

function characterLength(value) {
  return Array.from(value).length;
}
