// src/content.config.ts
// Add this blog collection to your existing content.config.ts
// If you don't have one yet, this is the full file.

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  blog: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default("Richard Prins Jr."),
      category: z.enum([
        "Local Business",
        "Events",
        "Neighborhood Guides",
        "Business Tips",
        "Hidden Gems Features",
      ]),
      coverImage: z.string().optional(),
      coverImageAlt: z.string().optional(),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
  }),
};
