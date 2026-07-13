import { curriculum } from "../data/curriculum-data";

export interface CurriculumLevel {
  code: "A0" | "A1" | "A2" | "B1" | "B2";
  name: string;
  cefr: string;
  hours: string;
  gse: string;
  blurb: string;
  canDo: string[];
  grammar: string[];
  vocab: string[];
  skills: Record<"listening" | "reading" | "speaking" | "writing", string[]>;
}

export { curriculum };

export function lessonSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
