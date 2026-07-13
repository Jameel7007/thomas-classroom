import { runInNewContext } from "node:vm";
import legacySource from "../../../outputs/data.js?raw";

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

// Temporary migration adapter: the existing curriculum array remains the
// source of truth while the Astro collections are proved. It executes only at
// build time and ships no legacy JavaScript to the browser.
const context: { window: { CURRICULUM?: CurriculumLevel[] } } = { window: {} };
runInNewContext(legacySource, context, { filename: "outputs/data.js" });

if (!Array.isArray(context.window.CURRICULUM)) {
  throw new Error("The legacy curriculum data did not expose window.CURRICULUM.");
}

export const curriculum = context.window.CURRICULUM;

export function lessonSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
