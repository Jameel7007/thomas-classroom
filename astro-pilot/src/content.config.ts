import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().min(12).max(90),
    description: z.string().min(80).max(180),
    published: z.coerce.date(),
    category: z.enum(["Assessment", "Curriculum", "Methodology", "Languages"]),
    audience: z.enum(["Learners", "Tutors", "Learners + tutors"]),
    minutes: z.number().int().min(4).max(20),
    featured: z.boolean().default(false),
  }).strict(),
});

const readingQuestion = z.object({
  question: z.string().min(12),
  answer: z.string().min(1),
  hint: z.string().min(12),
  fix: z.string().min(12),
  options: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
  }).strict()).min(2).max(4),
}).strict().refine((question) => question.options.some((option) => option.value === question.answer), {
  message: "answer must match one option value",
});

const readings = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/readings" }),
  schema: z.object({
    title: z.string().min(8).max(90),
    description: z.string().min(80).max(180),
    level: z.enum(["A0", "A1", "A2", "B1", "B2", "C1"]),
    order: z.number().int().min(1),
    genre: z.enum(["Practical document", "Message", "Narrative", "Feature", "Opinion", "Fiction"]),
    focus: z.string().min(8).max(90),
    grammarFocus: z.string().min(5).max(100).optional(),
    minutes: z.number().int().min(5).max(30),
    wordCount: z.number().int().min(60).max(1400),
    relatedLessonIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(4),
    before: z.array(z.string().min(12)).min(2).max(4),
    vocabulary: z.array(z.object({
      term: z.string().min(2),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      meaning: z.string().min(12),
      chunks: z.array(z.string().min(3)).min(1).max(4),
    }).strict()).min(4).max(12),
    comprehension: z.array(readingQuestion).min(3).max(8),
    languageFocus: z.object({
      title: z.string().min(8),
      explanation: z.string().min(40),
      examples: z.array(z.object({
        text: z.string().min(5),
        note: z.string().min(12),
      }).strict()).min(2).max(6),
      check: z.array(readingQuestion).min(2).max(6),
    }).strict(),
    craft: z.object({
      title: z.string().min(8),
      introduction: z.string().min(35),
      moves: z.array(z.object({
        label: z.string().min(3),
        example: z.string().min(5),
        effect: z.string().min(15),
      }).strict()).min(2).max(5),
    }).strict(),
    responseStages: z.array(z.object({
      name: z.enum(["Gist", "Main points", "Analyze", "React"]),
      prompt: z.string().min(12),
      chunks: z.array(z.string().min(3)).min(2).max(5),
      model: z.string().min(30),
    }).strict()).min(2).max(4),
    production: z.object({
      speaking: z.string().min(20),
      writing: z.string().min(20),
      chunks: z.array(z.string().min(3)).min(2).max(6),
    }).strict(),
    tutor: z.object({
      aim: z.string().min(30),
      timing: z.array(z.object({
        minutes: z.string().regex(/^\d+(?:–\d+)?$/),
        stage: z.string().min(4),
      }).strict()).min(4).max(8),
      watchFor: z.array(z.string().min(15)).min(2).max(6),
      shorten: z.string().min(25),
      extend: z.string().min(25),
    }).strict(),
    rights: z.object({
      status: z.enum(["Original", "Public domain", "Licensed"]),
      credit: z.string().min(12),
      sourceUrl: z.url().optional(),
      territoryNote: z.string().min(15).optional(),
    }).strict(),
    tutorReviewRequired: z.boolean().default(true),
  }).strict(),
});

export const collections = { blog, readings };
