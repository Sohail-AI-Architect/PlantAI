-- PlantAI — seed data (app_settings defaults + starter plant_library rows)
-- Source of truth: DATABASE_SCHEMA.md §3.9 seed table + §7.2.
-- Starter species text is human-written placeholder-grade editorial and is
-- enhanced in Phase 3 (P3-06/P3-07 per TASKS.md). Images are added in
-- Phase 3 together with attribution (image_credit), so image_url stays NU LL.

-- ── app_settings defaults (§3.9) ───────────────────────────────────────────
insert into public.app_settings (key, value, value_type, description) values
  ('identify.daily_limit.anonymous',  '5',          'number',  'Per-IP identify calls/day, anonymous (upstream Pl@ntNet free quota = 500/day total)'),
  ('identify.daily_limit.authenticated','20',       'number',  'Per-user identify calls/day'),
  ('identify.concurrent.upstream',    '4',          'number',  'Per-instance semaphore; multi-instance total must stay ≤ Pl@ntNet''s 20-concurrent cap'),
  ('identify.images.max',             '3',          'number',  'Max images per request (upstream allows 1–5; we under-rate to save quota)'),
  ('identify.image.max_bytes',        '10485760',   'number',  '10 MB per image (upstream accepts 50 MB total, we are stricter)'),
  ('contact.rate_limit.per_day',      '3',          'number',  'Contact form messages per IP/day (app-level rate limit)'),
  ('feature.identification_cache',    'true',       'boolean', 'Toggle for image-hash dedup cache (quota protection)'),
  ('feature.reminders',               'false',      'boolean', 'Phase 4 feature flag — UI hides reminders until shipped')
on conflict (key) do nothing;

-- ── Starter plant_library rows (first slice for smoke tests) ───────────────
-- Care text = curated starting content (human-written in planning docs),
-- NOT AI-generated facts. Published true so /library smoke tests show rows.
insert into public.plant_library
  (slug, scientific_name, common_names, family, genus, category, description,
   watering, sunlight, soil, fertilizer, difficulty, is_published)
values
  ('monstera-deliciosa', 'Monstera deliciosa',
   array['swiss cheese plant','ceriman'], 'Araceae', 'Monstera', 'houseplant',
   'A vigorous tropical climber loved for its fenestrated (split) leaves. Fast-growing indoors with a moss pole; the leaf size increases as the plant climbs.',
   'Water when the top 2–3 cm of soil feels dry; reduce frequency in winter.',
   'Bright indirect light; avoid direct midday sun which scorches leaves.',
   'Airy mix of peat or coir, perlite and orchid bark for drainage.',
   'Balanced NPK fertilizer monthly during the growing season.',
   'easy', true),
  ('epipremnum-aureum', 'Epipremnum aureum',
   array['golden pothos','devil’s ivy'], 'Araceae', 'Epipremnum', 'vine_climber',
   'One of the easiest vining houseplants; tolerates lower light and irregular watering better than most, and trails or climbs readily.',
   'Let the top 3–4 cm of soil dry between waterings; very forgiving of missed ones.',
   'Tolerates low light but grows fastest in medium-to-bright indirect light.',
   'Standard potting mix with added perlite for drainage.',
   'Half-strength balanced fertilizer monthly in spring and summer.',
   'easy', true),
  ('dracaena-trifasciata', 'Dracaena trifasciata',
   array['snake plant','mother-in-law''s tongue'], 'Asparagaceae', 'Dracaena', 'succulent_cactus',
   'An architectural succulent with stiff upright leaves. Famous for surviving neglect and low light; the most common killer is overwatering.',
   'Let soil dry out fully between waterings — roughly every 2–4 weeks; even less in winter.',
   'Any light level from low to bright indirect; tolerates a few hours of direct sun.',
   'Free-draining cactus or succulent mix.',
   'Cactus fertilizer a few times during the growing season only.',
   'easy', true),
  ('zamioculcas-zamiifolia', 'Zamioculcas zamiifolia',
   array['zz plant','zanzibar gem'], 'Araceae', 'Zamioculcas', 'succulent_cactus',
   'Waxy dark leaves and water-storing rhizomes make this one of the most drought-tolerant foliage houseplants. Handles dim corners well.',
   'Water only when soil is completely dry, typically every 2–3 weeks.',
   'Low to bright indirect light; direct afternoon sun can scorch leaflets.',
   'Fast-draining potting mix; grit or perlite helps.',
   'Balanced fertilizer 2–3 times during the growing season.',
   'easy', true),
  ('spathiphyllum-wallisii', 'Spathiphyllum wallisii',
   array['peace lily'], 'Araceae', 'Spathiphyllum', 'houseplant',
   'Dark, glossy leaves and white spoon-shaped spathes. Dramatically droops when thirsty — an honest hydration indicator — but recovers quickly.',
   'Keep lightly moist; water when the top inch dries. Never leave standing in water.',
   'Medium-to-low indirect light; avoids direct sun.',
   'Fine, moisture-retentive potting mix with good drainage.',
   'Weak balanced fertilizer monthly in the growing season.',
   'easy', true),
  ('philodendron-hederaceum', 'Philodendron hederaceum',
   array['heartleaf philodendron'], 'Araceae', 'Philodendron', 'vine_climber',
   'A classic heart-shaped-leaf vine, similar in temperament to pothos and equally beginner-proof. Prune to keep it bushy.',
   'Water when the top 2 cm dries; moderate watering, no waterlogging.',
   'Medium indirect light; tolerates low light with slower growth.',
   'Standard airy potting mix.',
   'Half-strength balanced fertilizer monthly while growing.',
   'easy', true),
  ('ficus-lyrata', 'Ficus lyrata',
   array['fiddle-leaf fig'], 'Moraceae', 'Ficus', 'houseplant',
   'A statement tree with large, violin-shaped leaves. Rewarding but particular: it dislikes sudden changes in light, temperature, or watering routine.',
   'Water when the top 2–3 cm dries; keep the schedule consistent; never soggy.',
   'Very bright indirect light with some gentle direct morning sun.',
   'Rich, well-draining potting mix; vented terracotta helps.',
   'Balanced fertilizer monthly in spring and summer.',
   'hard', true),
  ('aloe-vera', 'Aloe vera',
   array['aloe','true aloe'], 'Asphodelaceae', 'Aloe', 'succulent_cactus',
   'A rosette-forming succulent valued for the soothing gel in its leaves. Grows best lean and dry; droopy or browning tips usually mean water stress.',
   'Deep-water then dry completely; typically every 2–3 weeks, less in winter.',
   'Bright light with a few hours of direct sun; south or east windows suit it.',
   'Gritty cactus/succulent mix in a pot with a drainage hole.',
   'Cactus fertilizer sparingly in spring and summer.',
   'easy', true),
  ('crassula-ovata', 'Crassula ovata',
   array['jade plant','money tree'], 'Crassulaceae', 'Crassula', 'succulent_cactus',
   'A shrubby succulent with rounded, coin-like leaves and a tree-like habit with age. Long-lived and easy to branch by pinching.',
   'Soak-and-dry thoroughly; reduce sharply in winter dormancy.',
   'Bright light, ideally 4+ hours of direct sun for compact growth.',
   'Gritty succulent mix; small pots constrain size nicely.',
   'Cactus fertilizer monthly in the growing season.',
   'easy', true),
  ('ficus-elastica', 'Ficus elastica',
   array['rubber plant','rubber fig'], 'Moraceae', 'Ficus', 'houseplant',
   'Bold, glossy leaves on an upright stem — a forgiving statement plant that rewards steady care with fast vertical growth. Wipe leaves to keep them shiny.',
   'Water when the top 3 cm dry; consistent but never waterlogged.',
   'Bright indirect light; tolerates gentle morning direct sun.',
   'Standard potting mix with perlite or bark for drainage.',
   'Half-strength balanced fertilizer every 2–4 weeks while growing.',
   'easy', true)
on conflict (slug) do nothing;

-- ── Admin promotion (§7.2) ────────────────────────────────────────────────
-- The seed CANNOT create auth.users rows. After the owner creates/verifies
-- the real admin account in the dashboard (Auth → Add user), promote it:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'THE_REAL_ADMIN_EMAIL');
-- Run only in the dashboards/deploy env — never hardcode an email here.
