import { curriculum } from "../data/curriculum-data";

export interface CurriculumLevel {
  code: "A0" | "A1" | "A2" | "B1" | "B2" | "C1";
  name: string;
  cefr: string;
  hours: string;
  gse: string;
  blurb: string;
  canDo: string[];
  skills: Record<"listening" | "reading" | "speaking" | "writing", string[]>;
}

export { curriculum };
