# PlantAI — UI/UX Design

> Status: Phase 0 planning document. Defines the design principles, design system (tokens, typography, components), layout and navigation systems, page-by-page specifications, accessibility baseline, and ads-ready layout zones for the PlantAI web experience (MVP = Phases 1–3, PWA polish in Phase 6).
>
> Companion documents: `PROJECT_PLAN.md` (phases), `REQUIREMENTS.md` (functional scope), `ARCHITECTURE.md` (technical structure), `DATABASE_SCHEMA.md` (data), `MONETIZATION_PLAN.md` (ads planning), `SEO_STRATEGY.md` (growth), `CONTENT_STRATEGY.md` (editorial), `docs/VERIFIED_FACTS.md` (third-party facts).
>
> Third-party factual claims in this document are cited to `docs/VERIFIED_FACTS.md`. Anything else is a design decision of this document, not a verified outside fact.

## Table of Contents

1. [Design principles](#1-design-principles)
2. [Design system](#2-design-system)
   - 2.1 Color palette
   - 2.2 Typography
   - 2.3 Spacing, radius, shadow tokens
   - 2.4 Iconography
   - 2.5 Imagery rules
3. [Component inventory](#3-component-inventory)
4. [Layout systems](#4-layout-systems)
5. [Navigation design](#5-navigation-design)
6. [Page-by-page design specs](#6-page-by-page-design-specs)
7. [Loading, empty, and error state patterns](#7-loading-empty-and-error-state-patterns)
8. [Accessibility baseline (WCAG 2.1 AA)](#8-accessibility-baseline-wcag-21-aa)
9. [PWA design considerations](#9-pwa-design-considerations)
10. [Ads-ready layout zones](#10-ads-ready-layout-zones)
11. [Mobile UX priorities](#11-mobile-ux-priorities)
12. [Do / Don't examples](#12-do-dont-examples)

---

## 1. Design principles

| # | Principle | What it means concretely |
|---|-----------|--------------------------|
| 1 | **Clarity first** | One primary action per screen. The identify flow always has the most prominent CTA. No decorative elements compete with content. |
| 2 | **Mobile-first** | Every screen is designed at 360–390 px width first, then enhanced upward. Thumb-reachable actions, min 44 dp touch targets. |
| 3 | **Quiet UI around photos** | The *user's plant photo* is the hero of the interface. UI chrome (buttons, cards, headers) is neutral, low-contrast, and rounded, so photos read clearly. Backgrounds are off-white, not saturated. |
| 4 | **No dark patterns** | No fake urgency ("Only 2 scans left!"), no disguised ads, no confirm-shaming, no forced account creation before identification. Quota messaging is factual (see §6.2 Results). |
| 5 | **Honest UI** | Loading states say what is actually happening ("Analyzing your photos…"), progress is not over-promised, and identity results state confidence plainly. No theatrical "AI scanning" animation that implies clinical certainty. |
| 6 | **Graceful gating** | Signed-out users can identify and browse everything public. Where auth is required (My Plants, reminders later), the UI invites — it never blocks or nags. |
| 7 | **Respect for cost & time** | Every identification consumes the shared API quota (Pl@ntNet free plan: 500/day, `docs/VERIFIED_FACTS.md`), so the UI prevents accidental duplicate submits and warns before a submit that would fail client-side validation (each failed API error also burns 1 credit — `docs/VERIFIED_FACTS.md`). |

---

## 2. Design system

All tokens are defined once (CSS custom properties + Tailwind theme extension) and referenced everywhere. Tailwind major version is verified at scaffold time (`docs/VERIFIED_FACTS.md`, pending item #6); hex values below match the widely documented Tailwind default palette. **Verify exact hexes against the installed Tailwind version's palette at Phase 1.**

### 2.1 Color palette

| Token | Hex (Tailwind family) | Usage |
|---|---|---|
| `--color-primary` | `#0D9488` (teal-600) — *alt: emerald-600 `#059669`* | Primary buttons, active nav, primary CTA, focused brand moments. Final choice: **verify both hexes side by side on real photo backgrounds at Phase 1 and pick one; emerald-600 is the default suggestion per project decision #10.** |
| `--color-primary-hover` | `#047857` (emerald-700) | Hover/active state of primary controls. |
| `--color-primary-soft` | `#ECFDF5` (emerald-50) | Tinted backgrounds: highlighted steps, badges, "success story" panels. |
| `--color-leaf` | `#A7F3D0` (emerald-200) | Secondary leaf-light green: illustration accents, subtle dividers, decorative leaf motifs, charts. Never used as text color. |
| `--color-bg` | `#FAFAF7` | Page background (off-white, warm) — sits better behind plant photos than pure white. |
| `--color-surface` | `#FFFFFF` | Cards, sheets, modals. |
| `--color-text` | `#111827` (gray-900) | Primary text. |
| `--color-text-secondary` | `#4B5563` (gray-600) | Secondary text, captions. |
| `--color-text-muted` | `#6B7280` (gray-500) | Meta text, placeholders, disclaimers. |
| `--color-border` | `#E5E7EB` (gray-200) | Card borders, dividers, input outlines. |
| `--color-success` | `#16A34A` (green-600) | Success toasts, valid form states, "high confidence" tint (≥ 0.80). |
| `--color-warning` | `#D97706` (amber-600) | Quota-soon messaging, "medium confidence" tint (0.50–0.79), cautionary disclaimers. |
| `--color-error` | `#DC2626` (red-600) | Errors, destructive actions, "low confidence" tint (< 0.50). |
| `--color-ads-label` | `#9CA3AF` (gray-400) bg `#F3F4F6` (gray-100) | Reserved ad-slot frames and "Advertisement" micro-labels (Phase 5+). Deliberately quiet so never mistaken for content (AdSense policy: no misleading placement). |

Contrast rule: all text/background combinations must pass WCAG AA (≥ 4.5:1 body text, ≥ 3:1 large text ≥ 24 px / 18.66 px bold). Gray-500 on `#FAFAF7` ≈ 4.6:1 → allowed for small meta text; gray-400 is reserved for non-text decoration and ad labels only.

### 2.2 Typography

Self-hosted via `next/font` (no external font requests; `font-display: swap` handled by next/font automatically).

| Role | Font | Weight | Notes |
|---|---|---|---|
| UI sans | **Inter** | 400, 500, 600, 700 | Default for everything: UI, headings, data. Excellent at small sizes. |
| Article serif (optional) | **Source Serif 4** (fallback: Lora) | 600, 700 | Blog + guide headings only. Adds editorial character to content pages without inflating UI weight. Final choice is ours to specify: **Source Serif 4 for article headings, Inter everywhere else.** |

Type scale (mobile → desktop; all rem-based, mobile-first):

| Step | Mobile | Desktop | Line-height | Usage |
|---|---|---|---|---|
| Display | 2.0rem (32px) | 2.75rem (44px) | 1.15 | Home hero headline (1 per page). |
| H1 | 1.5rem (24px) | 2.0rem (32px) | 1.2 | Page titles. |
| H2 | 1.25rem (20px) | 1.5rem (24px) | 1.3 | Section headings, card group headings. |
| H3 | 1.0625rem (17px) | 1.25rem (20px) | 1.35 | Card titles (plant names), form section titles. |
| Body | 1rem (16px) | 1rem (16px) | 1.6 | Paragraphs, buttons ≥ 1rem (never shrink button text). |
| Body sm | 0.875rem (14px) | 0.875rem (14px) | 1.5 | Captions, stair-step meta, table secondary cells. |
| Micro | 0.75rem (12px) | 0.75rem (12px) | 1.4 | Attribution lines, legal footnotes, ad labels. Min size used anywhere. |

Rules: no font sizes below 12px; body text never justified; paragraph measure 60–75 characters on desktop article columns.

### 2.3 Spacing, radius, shadow tokens

- Spacing scale: strict 4 px base unit. Tailwind spacing steps map directly: `4` = 16 px is the default card padding (`p-4`), section vertical rhythm `py-12` mobile / `py-16` desktop, page gutters `px-4` mobile / container-managed on desktop.
- Radius tokens: `rounded` = 6 px (chips, inputs), `rounded-lg` = 10 px (buttons), `rounded-xl` = 14 px (cards), `rounded-2xl` = 20 px (hero panels, bottom sheets), full for avatars/photo dots. Generous soft corners are part of the "quiet UI" language.
- Shadows: three functional tiers only.
  | Token | Definition | Usage |
  |---|---|---|
  | `shadow-none` | — | Default for most cards (borders carry definition). |
  | `shadow-card` | `0 1px 3px rgba(17,24,39,0.08)` | Cards floating over photos or elevation-requiring surfaces. |
  | `shadow-sheet` | `0 -6px 24px rgba(17,24,39,0.16)` | Bottom sheets, modals. |
- Generous whitespace: contents breathe; sections separated by ≥ 48 px; no cramped photo grids (min 12 px gutters in image grids).

### 2.4 Iconography

- **Decision: `lucide-react`** (open-source, MIT, tree-shaken so unused icons add zero bytes; consistent 24 px grid, stroke-based → reads cleanly at small sizes). Frequent icons: `Camera`, `Image`, `Leaf`, ` Droplets`, `Sun`, `Sprout`, `Bookmark`, `Bell`, `Search`, `ChevronRight`, `X`, `Menu`. This keeps the project zero-dependency-friendly: one well-maintained, MIT-licensed icon library, no icon font, no CDN.
- Inline SVG is used only for the logo and the "Powered by Pl@ntNet" attribution mark (must be brand-controlled, not substituted).
- Icon sizing: 20 px inline with text, 24 px in nav; icons always paired with a text label in interactive controls (icon-only allowed only for close buttons and image dots, with `aria-label`).

### 2.5 Imagery rules

**User-submitted identification photos** (guidance shown in the capture UI):

| Organ | Guidance copy shown to users |
|---|---|
| Leaf | One full leaf in frame, flat against plain background, sharp focus. |
| Flower | If flowering, include one close-up of the flower. |
| Fruit | If fruiting, include one close-up of fruit/seed. |
| Habit | Optional full-plant shot. |

Per the Pl@ntNet v2 API, 1–5 images of the same individual may be submitted per request; PlantAI MVP accepts **1–3** so the flow stays fast (`docs/VERIFIED_FACTS.md`). Site-wide imagery rules:

- Natural-light photography; avoid harsh flash imagery in our own content/decorative assets.
- Our own photos must be original or properly licensed, with attribution stored next to the asset and displayed where required (see `CONTENT_STRATEGY.md` quality checklist).
- Never crop away the identifying organ in thumbnails; use object-fit `cover` with a deliberate focal center.
- Alt text on every image (accessibility + SEO, see `SEO_STRATEGY.md`); decorative images get `alt=""`.

---

## 3. Component inventory

Building blocks (each a small Server-Component-first file with a documented API; interactive parts become Client Components only where needed):

| Component | Variants / states | Notes |
|---|---|---|
| **Badge** | `neutral`, `primary`, `success`, `warning`, `error` | 24 px-high pill; used in Lists for family, difficulty, confidence labels. |
| **Button** | variants `primary`, `secondary` (outline), `ghost`, `destructive`; sizes `sm` 36 px, `md` 44 px, `lg` 56 px; states default / hover / active / focus-ring / loading (spinner + unchanged width) / disabled. The `lg` variant is the identify CTA. |
| **Input** | Text; states default / focus (2 px primary ring + 1 px border) / error (message below in error color)/ disabled | Labels always visible (no placeholder-as-label); helper text slot. |
| **Card** | Default (border, no shadow), elevated (`shadow-card`), concise | Content wrapper, not for interactive lists (avoid whole-card links in favor of a clear link/button target). |
| **Image card** | Photo + caption overlay; hover: slight lift | Used in the library grid and blog teasers; includes lazy loading + fixed aspect ratio to protect CLS. |
| **Chip** | Selectable / static / removable | Static chips display traits (e.g. "Low light ok", "Pet-safe? see detail"). Selectable chips reserved for future filters. |
| **Empty state** | Illustration or icon, title, one sentence, one action | Every list surface (My Plants, Saved, search results) has one; see §7. |
| **Skeleton** | Shape-matched (text lines, image block, card block) | Shimmer disabled under `prefers-reduced-motion`. |
| **Toast** | `success`, `error`, `info`; auto-dismiss 5 s with dismiss button | Announced via `aria-live="polite"`, not stacked, max 1 visible on mobile. |
| **Modal-lite** | Centered ≤ 640 px dialog, focus-trapped, ESC/scrim closes | Used for confirmations (e.g. "Delete plant?"). No full-screen overlay modals on mobile — bottom sheet instead. |
| **Bottom sheet** (mobile) | Slides from bottom, drag handle, rounded-top `rounded-2xl` | Suggested (Phase 4) for: specimen image review, saved-plant actions, filter selection. Fallback on desktop: inline panel or modal-lite. |

---

## 4. Layout systems

- **Container:** content column `max-w-6xl` (72rem) centered with `px-4` gutters; article/reading column `max-w-2xl` (42rem ~ 68 chars); wide visual sections (hero banners) may bleed to full width *behind* an overlaid container.
- **Grid:** 12-column CSS grid on desktop for plant detail and dashboard layouts; single stacked column on mobile. Image grids: 2 columns mobile, 3–4 desktop, 12 px gutters.
- **Breakpoints (Tailwind defaults — confirm version at Phase 1):**

| Name | Width | Typical behavior change |
|---|---|---|
| default | 0–639 px | Single column, bottom nav, stacked sections. |
| `sm` | 640 px | Still single column; wider gutters; results cards 2-up begins. |
| `md` | 768 px | Desktop navbar replaces bottom nav; 3-up grids; two-column plant detail (main + sidebar). |
| `lg` | 1024 px | Full desktop grid; content sidebar for guides upsell begins (future ad zone — disabled). |
| `xl` | 1280 px | Max widths clamp; no further layout changes. |

- **Responsive strategy by page type:**

| Page type | Mobile | Desktop |
|---|---|---|
| Content-forward (library list, blog) | Single column image grid (2-up), bottom nav | 3–4-up grid; left rail navigation unnecessary; secondary column only for search + filters. |
| Tool flow (identify/results) | Full-screen stepper, sticky progress, bottom action button | Same flow centered in a 2-col workspace: preview column + status/results column; no sidebar ads ever. |
| Article (blog, guides, problem pages) | Reading column + TOC collapsed | Reading column + sticky mini-TOC + breadcrumbs; future right-rail ad zone (disabled until Phase 5). |
| Data detail (plant/[slug]) | Hero image → care summary cards stacked → gallery | Hero left / tabular care panel right; gallery below. |

---

## 5. Navigation design

**Desktop (`md`+): sticky top navbar** — logo (wordmark + leaf mark), links: Identify, Library, Blog, About, plus right side: "My Plants" (or Sign in) and a prominent primary "Identify" button. Sticky, `bg` transitions from transparent-on-hero to solid `#FAFAF7` after scroll; height 64 px.

**Mobile: header + bottom nav bar** — a 56 px header containing the logo and (contextually) search or account icon; a persistent **bottom nav with 5 items** (height incl. safe-area ≥ 64 px, `scroll-padding` respected):

| Slot | Item | Design |
|---|---|---|
| 1 | Home | Icon + label. |
| 2 | **Identify** | **Prominent center-left platform raised button**: a 56 px primary-green circular icon button that floats slightly above the bar, shadow-card. It is the product's core action and must be one thumb-tap from anywhere. |
| 3 | Library | Icon + label. |
| 4 | My Plants | Icon + label. **Auth gating is graceful:** when signed out, tapping opens a small scale-in CTA (justify-content card, ~ 200 ms ease-out, no jarring modal) explaining My Plants keeps your identified plants, with "Sign in or create a free account →" and "Not now". Nothing else is gated. |
| 5 | Menu | Opens a bottom sheet with: Search, Blog, About, Contact, Privacy & terms, Sign in/Account. Keeps the bar tight while remaining reachable. |

- Active state: primary green icon + label; inactive gray-500; 44 dp hit areas on every slot.
- Bottom nav hidden on the identify results screen while images are uploading? No — it stays, but the sticky bottom action button stacks above it (no overlap; results action bar `bottom: nav height + 8px`).

---

## 6. Page-by-page design specs

### 6.1 Home (`/`)

- **Hero:** large full-bleed photo of a healthy houseplant (original/licensed), off-white gradient scrim at the text edge; headline (Display size) like "Find out what's growing on your windowsill."; sub-line: free, AI-assisted plant identification with plain-English care tips. **Primary CTA: "Identify a Plant"** (`lg` primary button, ≥ 56 px tall). Secondary link: "Browse the plant library →".
- **How it works — 3 steps:** numbered cards (1. Photograph your plant, 2. We compare against Pl@ntNet's botany engine, 3. Get likely species + care tips) with a small photo/icon each; each step ≤ 2 lines.
- **Trust / attribution block:** "Powered by Pl@ntNet" mark + the recommended attribution sentence from Pl@ntNet's terms (*quote from `docs/VERIFIED_FACTS.md`*), plus a one-line honesty note: "AI identification can be wrong — always double-check before you act."
- **Recent blog teaser:** 2–3 newest article image-cards linking to `/blog/[slug]` (only once posts exist in Phase 4; before that the section is replaced by a static "Popular plants" strip linking to library entries).
- Footer: standard footer with navigation, legal links, and the attribution line.

### 6.2 Identify (`/identify`)

- **Header:** H1 "Identify a plant"; a two-line explainer: "Photos of the *same* plant, up to 3. Best organs: leaf, flower, fruit."
- **Upload zone:** large dashed-border dropzone (desktop, click-to-browse) / two buttons on mobile ("Take a photo" using `capture` input through camera, "Choose from gallery"). Min 44 dp both.
- **Multi-image (1–3):** thumbnails row with remove ✕ (44 dp hit) and "Add another" slot; one at a time mobile.
- **Client-side guards before submit** (protect quota — failed API requests also consume a credit, `docs/VERIFIED_FACTS.md`): JPEG/PNG only, ≤ ~10 MB each, ≥ 1 image. Clear inline errors.
- **Progress states (honest):**
  1. Uploading: per-image progress ring, cancel available.
  2. Analyzing: single calm animation — a leaf icon over the photo with subtle pulse + text "Analyzing your photos…" (no fake gauge, no "DNA scanning" theatrics).
  3. Cannot cancel mid-request but the UI explains "This usually takes a few seconds."
- **Quota-reached state:** if the API answers 429 (daily quota reset is midnight UTC, `docs/VERIFIED_FACTS.md`): a warning card: "Today's identification limit has been reached. It resets at midnight UTC. Your photos are safe — try again in a few hours." Photos are kept in the draft state; no data loss; retry is one tap.
- **Privacy microcopy** near the upload button: "Your photos are sent to our identification service to find the species." (Linked to `/privacy`.)

### 6.3 Results

Reachable from `/identify` after a successful request (same route renders the results view; results also trigger a "Save this plant" action).

- **"Top matches" identity cards:** for each of the top 3 candidates: species scientific name (H3, italic), common names, family, genus; **confidence bar** (0–100% shown as "Confidence: 87%") color-coded by success/warning/error ranges; small `cc-by-sa` cited example image (attribution string visible in caption per `docs/VERIFIED_FACTS.md`).
- **Specimen photo strip:** the user's own 1–3 photos in a horizontal strip, with an "Is this correct?" lightweight feedback: user picks the correct candidate or "None of these"; feedback is purely optional and never gates the experience (data used only to improve internal editorial priorities — see `CONTENT_STRATEGY.md` metrics).
- **Care summary for the top candidate:** 4 compact cards — **Watering, Sunlight, Soil, Fertilizer** — each with icon (Droplets/Sun/Sprout/Leaf), 1–2 sentence summary. Care info comes **from our own plant library content only**, never claimed to be AI output (canonical decision #6). If the species is not yet in our library: a quieter card states "We're still writing the full care guide for this species" with a "View more on Pl@ntNet" link? No — external linking is not part of MVP spec; instead show the structured identity fields only and invite the user to "Save this plant" or browse `/library`.
- **Actions:** primary "Save plant" (requires sign-in: graceful scale-in CTA, same pattern as My Plants gating), secondary "Open full detail →" (goes to `/plant/[slug]` when the species exists in the library; otherwise the button shows the non-published state: disabled with tooltip "Full profile coming soon").
- **Educational disclaimer footer:** "Identification is AI-assisted and may be incorrect. This is not a disease diagnosis." (links to `/about` for how it works).
- **No ads anywhere in this flow** (canonical decision #9, aligned with project growth policy).

### 6.4 Plant detail (`/plant/[slug]`)

- **Hero image** full-width (max height 40vh) with a subtle scrim; overlay: H1 scientific name (+ italic styling), common names below; badges for family, category, difficulty.
- **Care table:** tabular data (definition list styled as a two-column table) — Watering, Sunlight, Soil, Fertilizer, Temperature, Humidity, Common problems (when present), Difficulty. Rows separated by 1px border; icon per row; desktop = right column beside the hero.
- **Gallery:** 3–6 images with attribution captions (CC-BY-SA citations from Pl@ntNet images or our own licensed assets) — visible attribution strings, not hidden.
- **Related plants:** 3 image-cards (same genus or family) linking to other `/plant/[slug]` pages.
- **Breadcrumb:** Home › Library › Species (rendered as `BreadcrumbList` data — see `SEO_STRATEGY.md`).
- Action row: "Save to My Plants" (auth-gated gracefully), "Back to results" when navigated from identification.

### 6.5 Library grid + search (`/library?q=`)

- **Search bar** prominent top; the query is carried in the `?q=` URL parameter (shareable, crawl-safety rules in `SEO_STRATEGY.md`).
- **Grid:** image-cards (photo, scientific name, one common name, difficulty chip). 2-up mobile, 3-up md, 4-up lg.
- **Filters:** *future* (family/category/pet-safety) — the layout reserves a filter row but Phase 3 ships without selectable filters to avoid shallow-UX debt; chips render only when data supports them.
- **No results:** empty state with the closest suggestions (e.g. "Try fewer words, or the scientific name") + link to "Identify a plant instead".
- Url stays `?q=` only; nested facet params are deferred with the filters.

### 6.6 Auth screens (`/login`, `/signup`, `/auth/callback`)

- Minimal, quiet, centered card: logo, one-line sub-copy, and a single accessible **Continue with Google** button. No email, username, password, magic-link, resend, forgot-password or reset-password control appears in normal use.
- The button shows a clear "Continuing with Google…" loading state, generic accessible error text, and duplicate-click protection. `/auth/callback` is a non-interactive server handoff; legacy password/recovery routes redirect back to Google sign-in.
- Same-shell layout as other minimal pages; bottom nav remains for continuity. The flow is mobile-friendly and keyboard/screen-reader accessible.
- Identity handling is delegated to Supabase Google OAuth with PKCE/SSR cookies; no Firebase, custom JWT, or client-supplied identity field. Owner setup is in `docs/GOOGLE_OAUTH_SETUP.md`.

### 6.7 Contact (`/contact`)

- Simple form: name, email, topic (select), message, submit. Below the form: disclaimers — response time expectations ("Typically within a few days"), "we cannot diagnose a sick plant from emails — identification is AI-assisted only", and links to privacy policy.
- mailto fallback shown if JS forms are unavailable (progressive enhancement).

### 6.8 Static legal pages (`/privacy`, `/terms`, `/cookie-policy`)

- Reading-column typography only (max-w-2xl), sticky mini-TOC, strict H2/H3 hierarchy, "Last updated" date at top, no decorative imagery, no ads, plain-language summaries above dense clauses.

---

## 7. Loading, empty, and error state patterns

Every async surface follows the same pattern family:

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Identification submit | Skeleton for results cards + "Analyzing your photos…" | n/a | Calm error card: reason + next step (resize image / try again / quota message). Never a bare toast-only error. |
| Library grid (first paint) | 6 skeletons matching image-card aspect | "No plants match '{q}'" + suggestions | "Couldn't load the library — tap to retry". |
| Plant detail | Full-page skeleton (hero block + care rows) | n/a (404 page handles unknown slugs with "Search the library" + "Identify instead") | 500 page: friendly leaf illustration + "Try the homepage". |
| My Plants / Saved | Skeleton cards | Illustration + "Your identified plants will live here" + "Identify your first plant" CTA | Retry toast + refresh button. |
| Search results | Inline spinner beside the input (debounced) | No-results + close-match suggestions. | Keep previous results, inline error inline. |
| Blog list | Grid skeletons | "No posts yet" (transitional Phase-3 state) | Retry row. |

Global rules: skeletons mirror final layout (no CLS); states are accessible (`aria-live="polite"` for identification status progress — see §8); every error offers a next action, never a dead end.

---

## 8. Accessibility baseline (WCAG 2.1 AA checklist)

| Item | Standard | Verification |
|---|---|---|
| Contrast | ≥ 4.5:1 body text, ≥ 3:1 large text & UI boundaries | Palette in §2.1 pre-audited; re-audit with a contrast tool at Phase 1. |
| Focus states | Visible 2 px primary focus ring on all interactive elements (`:focus-visible`); never `outline: none` without a replacement. | Manual keyboard pass per template. |
| Keyboard | Full flow reachable: identify → results → save → library. Logical tab order, skip-link to main content. | Manual Lighthouse axe point at Phase 1. |
| Form labels | Every input has a real `<label>`; errors are programmatically associated (`aria-describedby`); error summary at top of forms. | During component build. |
| Alt text | Meaningful alt for informative images, `alt=""` for decoration; the identity photo gets descriptive alt including organ type if known. | Content checklist (`CONTENT_STRATEGY.md`). |
| `aria-live` | Identification status region: "Analyzing your photos…" → "3 possible matches found" announced politely (not assertively). | During identify flow build. |
| Touch / pointer | Targets ≥ 44 dp; spacing between adjacent targets ≥ 8 px. | Design tokens; audit during QA. |
| Reduced motion | `prefers-reduced-motion` disables skeleton shimmer, card scale-ins, sheet slide; content appears instantly. | CSS-level support from Phase 1. |
| Language & semantics | `lang=en`, landmarks (`header/nav/main/footer`), one H1 per page, heading order never skipped. | Per-template code review. |

---

## 9. PWA design considerations (Phase 6)

- Manifest: `name: "PlantAI — Identify Plants & Care Guides"`, `short_name: "PlantAI"`, `background_color: #FAFAF7`, `theme_color: #0D9488` (or final primary hex), `display: standalone`, icon purpose maskable set (192 px, 512 px) generated from the app icon.
- **App icon guidance:** a single leaf motif (rounded, botanical, high-contrast against primary green), tested at 48 px and 24 px; no text inside the icon.
- Install prompt UX: **deferred to Phase 6**; when built, presented softly (a one-time dismissible banner on the home page, never overlaid mid-flow).

---

## 10. Ads-ready layout zones (Phase 5+; disabled until then)

Goal: reserve slots so that enabling ads later does not cause layout shift (CLS) and stays out of the core flows (no ads in `/identify`, `/identify` results, My Plants, auth).

| Zone | Location | Reserved dimensions (placeholder, disabled) |
|---|---|---|
| A1 | Content pages bottom (plant detail, blog post, guides) | responsive leaderboard, min-height 250 px placeholder frame (muted ad-label styling) |
| A2 | Blog article right rail (desktop `lg`+) | 300×250 / 300×600 staggered option |
| A3 | Library list between items 8–9 | native-style single unit, min-height 120 px |
| A4 | Search results footer (not top — never above organic results) | responsive leaderboard |

Rules: placeholders reserve height via a fixed-aspect container so CLS remains ~0 when units load or are toggled off; every unit is labeled "Advertisement" (ads-label token §2.1); density limited to ≤ 1 unit per viewport scroll section; this document defers all AdSense policy nuance to `MONETIZATION_PLAN.md` and `LEGAL_AND_COMPLIANCE.md` (ad units are added **only** after the host supports commercial use per the Vercel Hobby constraint in `docs/VERIFIED_FACTS.md`).

---

## 11. Mobile UX priorities

1. **Thumb-friendly everything:** primary actions in the bottom 40% of the screen; bottom nav + bottom sheets drive interaction; desktop-style floating buttons are banned.
2. **Camera access friction minimized:** `capture="environment"` input paths kept short; permission-denied fallback is always the gallery picker.
3. **Battery- and data-respectful loading:** images below the fold lazy-loaded via `next/image`; no autoplaying video; animations limited to short transform/opacity transitions; LCP image preloaded as priority.
4. **Offline-resilient feel (progressive toward Phase 6 PWA):** every page renders meaningful server-first content, so a slow connection still shows real content (not a blank shell).
5. **Graceful degradation:** JS-off states keep pages legible (forms use native fallbacks; identification requires JS for image compression and is the only feature that shows a "JavaScript is needed to identify plants" notice).

---

## 12. Do / Don't examples

| Situation | ✅ Do | ❌ Don't |
|---|---|---|
| Loading state in identify | "Analyzing your photos…" with a small leaf pulse | Fake "Scanning DNA…" progress bar that fills to 99% |
| Quota message | "Today's limit has been reached — resets at midnight UTC." | "Upgrade now to keep identifying!" (upsell doesn't exist yet; urgency copy is a dark pattern) |
| Confidence | "Confidence: 62% — moderate match" with amber bar | "AI is 62% sure — almost certainly correct!!" |
| Care info sourcing | Watering tips rendered from our library entry with the honest footer note | Presenting care tips as "AI care recommendations" |
| Ads (Phase 5+) | Quiet labeled unit after content, reserved height | Interstitials between identify steps, or ads disguised as "Plant tips" buttons |
| CTA design | One `lg` green "Identify a Plant" button | Three competing same-weight CTAs in a hero |
| Save plant gating | Friendly scale-in "Sign in to save this plant — it's free" card | Full-screen modal interrupting the results view |
| Photos | Sharp leaf close-up on plain background | Dark blurry multi-plant wide shot with no organ detail |

---

*End of document. Changes to tokens or flows must be mirrored in `REQUIREMENTS.md` scope notes and `TASKS.md` build items.*
