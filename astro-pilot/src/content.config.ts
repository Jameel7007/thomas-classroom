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

export const collections = { blog };
