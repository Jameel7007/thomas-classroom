import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const lessons = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/lessons" }),
  schema: z.object({
    lessonId: z.string().regex(/^[a-z][a-z0-9-]+$/),
    title: z.string().min(3),
    description: z.string().min(80).max(180),
    level: z.enum(["A0", "A1", "A2", "B1", "B2"]),
    kind: z.enum(["grammar", "vocabulary", "skills"]),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    order: z.number().int().positive(),
    status: z.enum(["draft", "review", "published"]),
    durationMinutes: z.number().int().min(15).max(180),
    objectives: z.array(z.string().min(8)).min(1),
    skills: z.array(z.enum([
      "grammar",
      "vocabulary",
      "listening",
      "reading",
      "speaking",
      "writing",
      "functional-language",
    ])).min(1),
    prerequisites: z.array(z.string()).default([]),
    audioClips: z.array(z.string()).default([]),
    updated: z.coerce.date(),
  }),
});

export const collections = { lessons };
