-- One-off backfill for the new category visual columns.
-- Run AFTER `npm run db:push` has added the hero_image_url, tagline,
-- description, sort_order columns. Idempotent (re-running is a no-op when the
-- values already match) and only touches the 8 seeded categories.
--
-- Values are lifted verbatim from the constants we just deleted:
--   - hero_image_url + description: src/pages/explore/[category]/index.astro
--   - tagline:                     src/pages/index.astro
--   - sort_order:                  src/layouts/PublicLayout.astro nav order

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Coffee, brunch, breweries, and the dive bars locals actually go to.',
  description    = 'From specialty coffee to craft breweries, find the best places to eat and drink across the Treasure Valley.',
  sort_order     = 1,
  updated_at     = now()
WHERE slug = 'food-and-drink';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Gyms, yoga, salons, and self-care that doesn''t feel performative.',
  description    = 'Gyms, spas, salons, and wellness studios dedicated to helping you feel your best.',
  sort_order     = 2,
  updated_at     = now()
WHERE slug = 'health-and-wellness';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Boutiques, vintage, art, gifts — when the chain just won''t do.',
  description    = 'Boutiques, vintage shops, bookstores, and local retailers worth exploring.',
  sort_order     = 3,
  updated_at     = now()
WHERE slug = 'shopping';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'The HVAC, the plumber, the painter — the ones who answer the phone.',
  description    = 'Trusted local contractors, cleaners, landscapers, and home professionals.',
  sort_order     = 4,
  updated_at     = now()
WHERE slug = 'home-services';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Galleries, venues, escape rooms — places to leave the house for.',
  description    = 'Galleries, venues, studios, and experiences that make Boise''s creative scene shine.',
  sort_order     = 5,
  updated_at     = now()
WHERE slug = 'arts-and-entertainment';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Lawyers, accountants, designers — local pros worth a real conversation.',
  description    = 'Local lawyers, accountants, marketers, and consultants serving the Treasure Valley.',
  sort_order     = 6,
  updated_at     = now()
WHERE slug = 'professional-services';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Tutors, music teachers, dance schools — for kids and adults alike.',
  description    = 'Learning centers, tutors, dance studios, martial arts, and more.',
  sort_order     = 7,
  updated_at     = now()
WHERE slug = 'education';

UPDATE category
SET
  hero_image_url = 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1600&auto=format&fit=crop&q=80',
  tagline        = 'Mechanics, detailers, body shops — without the upsell.',
  description    = 'Local shops for repairs, detailing, customization, and everything your vehicle needs.',
  sort_order     = 8,
  updated_at     = now()
WHERE slug = 'automotive';

-- Also backfill subcategory.sort_order in the same display order they were
-- seeded in (the inline `for (let i = 0; ...)` index in seed.ts). The number
-- doesn't matter semantically, but assigning explicit values now means newly
-- created subcategories will sort below existing ones if their sort_order
-- stays at the default 0.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY category_id ORDER BY name) AS rn
  FROM subcategory
)
UPDATE subcategory s
SET sort_order = ranked.rn,
    updated_at = now()
FROM ranked
WHERE s.id = ranked.id;
