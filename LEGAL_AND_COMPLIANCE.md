# PlantAI — Legal & Compliance

> Companion docs: PROJECT_PLAN.md, REQUIREMENTS.md, ARCHITECTURE.md, DATABASE_SCHEMA.md,
> API_DOCUMENTATION.md, UI_UX_DESIGN.md, SECURITY.md, TESTING_PLAN.md, DEPLOYMENT_GUIDE.md,
> MONETIZATION_PLAN.md, AI_INTEGRATION_PLAN.md, TASKS.md, docs/VERIFIED_FACTS.md.

---

## ⚠️ IMPORTANT DISCLAIMER (read first)

**This document is not legal advice.** It is a technical planning aid written by a development
assistant. All templates, outlines, and postures here must be **reviewed and adapted by a qualified
professional or, at minimum, carefully personalized by the project owner** before being published as
site legal text. Jurisdiction-specific rules vary; this document is written in a **GDPR-aware,
privacy-first posture** because the service may be visited by EU/UK users — even though the
developer's home jurisdiction is **not yet known** (see §Open legal questions). Nothing here
constitutes counsel, readiness certification, or a claim of compliance.

---

## Table of Contents

1. [Required legal pages inventory](#1-required-legal-pages-inventory)
2. [Privacy Policy — content outline](#2-privacy-policy--content-outline)
3. [Terms of Service — content outline](#3-terms-of-service--content-outline)
4. [Cookie Policy — content outline](#4-cookie-policy--content-outline)
5. [Disclaimer page — content outline](#5-disclaimer-page--content-outline)
6. [Imprint / About — operator info](#6-imprint--about--operator-info)
7. [Attribution (Pl@ntNet + data sources)](#7-attribution-plantnet--data-sources)
8. [Copyright & image licensing policy](#8-copyright--image-licensing-policy)
9. [Google AdSense compliance mapping](#9-google-adsense-compliance-mapping)
10. [Google Play / AdMob future compliance checklist](#10-google-play--admob-future-compliance-checklist)
11. [User data protection implementation notes](#11-user-data-protection-implementation-notes)
12. [Compliance verification schedule](#12-compliance-verification-schedule)
13. [Open legal questions for the project owner](#13-open-legal-questions-for-the-project-owner)

---

## 1. Required legal pages inventory

All URLs are fixed by canonical project decisions. Pages ship as static Next.js routes.

| Page | URL | Phase | Purpose |
|---|---|---|---|
| Privacy Policy | `/privacy` | MVP (2) before auth launch; extended Phase 5 for ads | PII handling, user rights, third parties |
| Terms of Service | `/terms` | MVP (2) | Contract between operator and user |
| Cookie Policy | `/cookie-policy` | MVP (2) minimal; extended Phase 5 | Cookie/consent inventory |
| Disclaimer | `/disclaimer` | MVP (3) alongside first guides | AI accuracy, plant safety, no professional advice |
| Imprint / About operator info | `/about` (+ `/contact`) | MVP (2) | Operator identity, contact route |

Content outlines follow in §§2–6. Every page is linked sitewide from the footer (UI_UX_DESIGN.md).

---

## 2. Privacy Policy — content outline

Mandatory sections to write at authoring time:

### 2.1 Controller identity
- Who operates PlantAI (legal/name identity), contact address, email — pending owner inputs (§13).

### 2.2 Data collected (table)

| Data | Collected? | Notes |
|---|---|---|
| Email | Yes (registered users) | Supabase auth credential |
| Display name | Optional | Explicitly optional at signup |
| Identification photos | Yes | Uploaded for ID; private storage bucket (DATABASE_SCHEMA.md, SECURITY.md) |
| Species results / identification history | Yes | Rows tied to the account |
| Coarse GPS / location | **Not sent in MVP** (Stage A1, 2026-11-12) | PlantAI's MVP sends **no GPS coordinates to Pl@ntNet**; the coarse-GPS consent flow remains a documented future option solely for regional-flora restriction, gated on explicit consent + a privacy disclosure if ever adopted (AI_INTEGRATION_PLAN.md §2.1) |
| Technical logs (server-side) | Yes (operational) | Vercel request logs nature per its standard logging — exact fields UNVERIFIED, reflect at authoring time |
| Ad data (Google) | Phase 5+ only, post-consent | AdSense cookie/ad identifiers — section dormant until ads enable |

### 2.3 Purposes
- Provide the service (identification, account, My Plants, reminders).
- Storage of user plants/reminders state.
- Spam protection and abuse prevention (rate limiting, banned-account handling — SECURITY.md).

### 2.4 Legal bases (GDPR framing)
| Processing | Basis |
|---|---|
| Account + identification service | Performance of contract |
| Technical logs / anti-abuse | Legitimate interest |
| Location use | Consent (explicit, revocable) |
| Advertising cookies (Phase 5+) | Consent (EU/UK) |
| Service emails (magic links, confirmations) | Performance of contract |

### 2.5 Retention
| Item | Default | On request |
|---|---|---|
| Identification rows + images | **90 days** (privacy-first posture) and then auto-purge or fully anonymize — final default set at implementation | **Immediate erasure** |
| Account data | Life of account | Erased with account deletion |
| Logs | Host-default rotation | Per host mechanics (documented at authoring time) |

### 2.6 Third parties (table)

| Party | What's shared | Why | Notes |
|---|---|---|---|
| **Supabase** | Account data, DB rows, image files | BaaS: auth, database, storage | **Region is selectable at project creation** — note the consideration of choosing an **EU region** for GDPR friendliness; decision recorded in PROJECT_PLAN.md owner questions (§13) |
| **Vercel** | Request data, deployment artifacts | Hosting/runtime | Hobby-plan usage is non-commercial today; ads change hosting (MONETIZATION_PLAN.md §2) |
| **Pl@ntNet** | Uploaded photo (never location in MVP) | The identification request itself | Disclosed plainly: photos go to Pl@ntNet to produce results (AI_INTEGRATION_PLAN.md §Data & learning ethics). **Retention verified 2026-11-12 (terms of use):** Pl@ntNet keeps submitted photos only in **volatile server memory during processing** — not stored — **but retains query history (date, time, submitted image URL references) tied to the API account**. This upstream retention is **distinct from PlantAI's own Supabase Storage retention**; privacy copy must not claim "nothing is stored" based on the upstream practice (docs/VERIFIED_FACTS.md) |
| **Google AdSense** | Cookie/ad identifiers, page data | Ad serving | Only when enabled (Phase 5/6) and consent-gated for EU/UK |
| Hosting DNS provider | DNS traffic | Domain | Named at authoring time |

### 2.7 User rights
- Access, erasure, objection, portability (also rectification/restriction as applicable), plus the
  contact channel and response expectations. Erasure covers: account, profile, plants, reminders,
  identification rows, **and stored images** (see §11 deletion UX spec).

### 2.8 Children
- Service is not directed at children. Minimum age stated as **13** in ToS, with a note that in
  several jurisdictions (e.g. EU member states under GDPR Article 8 framing, varies by country —
  **UNVERIFIED per-country detail**) parental consent is required up to 13–16. Final statement
  depends on the operator's country (§13).

### 2.9 Cookies & ad-tech consent section
- Pointer to `/cookie-policy`; Phase 5 extension describing ad cookies and consent status.

---

## 3. Terms of Service — content outline

- **Acceptance:** using PlantAI = accepting ToS; updates notified via changelog/versioning on the page.
- **Eligibility:** 13+ (see §2.8 caveat); one account per person; no false identities.
- **Service description:** AI-assisted plant species identification **"provided for guidance only;
  no guarantee of accuracy"** — mirrors Pl@ntNet's beta-disease limits; MVP disease content is
  educational (canonical decision 3). Identification scores are machine outputs, not certainties
  (AI_INTEGRATION_PLAN.md §Result uncertainty).
- **Acceptable use:** no unlawful uploads — **stated plainly: any unlawful content, including any
  depiction of child sexual abuse or other illegal material, is absolutely prohibited** and will be
  reported/deleted as the law and the operator's judgment direct; no abuse of the service (no attempt
  to drain the shared identification quota, no automated bulk requests); **no scraping our API**
  (PlantAI's own endpoints) or circumventing rate limits; no uploading images you don't have the
  right to submit (see §8).
- **User content license grant:** photos are licensed to PlantAI under a **limited license to
  process for identification purposes** + an explicit, **default-OFF**, opt-in-only grant for
  anonymized service improvement (model improvement / datasets). Available only via the
  developer-approved future path (canonical decision 5 — no AI vendor by default).
- **Intellectual property:** site content owned by the operator; **Pl@ntNet data attribution
  preserved verbatim** (§7); third-party illustration images returned by the API carry
  **cc-by-sa citations** displayed with the attribution pattern (§7); plant-guide facts remain
  PlantAI's editorial work.
- **Disclaimers:** no warranty; AI accuracy disclaimer; plant-care information is **educational, not
  professional horticulture, agriculture, or medical/pesticide advice**; living-plant safety caveat
  (toxicity information in guides is general and never substitutes for poison-control/medical help).
- **Limitation of liability:** operator not liable for losses from AI misidentification, plant
  damage, or decisions taken on PlantAI content (drafted with the professional reviewer, §0 note).
- **Account termination:** rights to suspend for abuse (quota abuse, unlawful uploads), and the
  appeal-contact route.
- **Governing law:** **placeholder** — `[Operator's country]` until owner inputs (§13).

---

## 4. Cookie Policy — content outline

Cookie inventory table (page):

| Cookie / storage | Type | Purpose | Phase | Who sets |
|---|---|---|---|---|
| Auth session cookie(s) | Essential | Keep you logged in | 2 | App + Supabase (`sb-` prefixed Supabase auth cookies) |
| CSRF-protection token (if implemented) | Essential | Form/request protection | 2 | App |
| Analytics | **None in MVP** | — | — | — |
| Ad cookies (Google AdSense identifiers) | Advertising | Ad serving/frequency | 5/6 only, consent-gated | Google |

Consent mechanics: MVP ships **essential cookies only** (no consent banner strictly required for
essential-only, mechanism specifics **UNVERIFIED** — verify EU guidance in Phase 5, facts-file
research item #8). Phase 5 adds the consent banner that gates ad-script loading
(MONETIZATION_PLAN.md §3.5); the `/cookie-policy` text and this inventory update in the same change.

---

## 5. Disclaimer page — content outline

The AI-accuracy + plant-safety claim surface (linked from every guide and results screen):

1. **AI identification is not certainty** — plausible errors, hybrids/cultivars weakness,
   photographic dependence (full limitations in AI_INTEGRATION_PLAN.md).
2. **Plant safety** — many plants are toxic to humans/pets; never eat a wild plant identified only
   by an app; in case of suspected poisoning, contact your local poison control immediately.
3. **No medical / agricultural advice** — care guides and disease education are informational only;
   for crop/greenhouse/medical decisions consult a professional.
4. **Disease content is educational** — not a diagnosis engine MVP; the beta disease API is not
   marketed as a feature (canonical decision 3).
5. Pl@ntNet attribution link (§7) so API-sourced errors are traceable.

---

## 6. Imprint / About — operator info

- Site name, operator name (natural person or entity) with contact address and email (owner inputs —
  §13). If interchange with consumers/e-commerce appears later (premium), the operator's consumer
  transactional-information duties may add required fields — **UNVERIFIED, jurisdiction-dependent**;
  reviewed when premium (Phase 7+) approaches.
- `/about` also hosts the operator blurb, the Pl@ntNet attribution sentence (§7), and the editorial
  statement for guides (human-written, sources listed — canonical decision 3).

---

## 7. Attribution (Pl@ntNet + data sources)

**Verified basis** (docs/VERIFIED_FACTS.md, Pl@ntNet section — Stage A1, 2026-11-12): on the
**free plan**, the "Powered by Pl@ntNet" logo is *appreciated but not required* (required only on
the Non-profit plan). PlantAI displays attribution anyway (good practice, licence clarity, SEO
honesty). Per-image photo attribution and the optional platform logo are **separate obligations**.

- **Recommended sentence (verbatim, per Pl@ntNet terms as verified):**
  *"The image-based plant species identification service used, is based on the Pl@ntNet recognition
  API, regularly updated and accessible through the site https://my.plantnet.org/."*
- **Placement pattern:**
  1. `/about` — full sentence above.
  2. **Every identify-results footer** — short-line attribution with link: "Identification by
     Pl@ntNet" (component built in UI_UX_DESIGN.md results spec).
  3. Any jurisdisction-specific legal page that lists third-party processors (§2.6) — name Pl@ntNet.
- **cc-by-sa image citations display pattern (verified 2026-11-12, "Using images" doc):**
  returned image objects carry **actual** `author`, `license` and `citation` fields (e.g. citation
  form `Fabrice Rubio / Pl@ntNet, cc-by-sa`). Images are **usually** CC BY-SA — Attribution +
  ShareAlike — and the documented attribution pattern is
  `Photo(s): [Contributor] / Pl@ntNet, CC BY-SA`. Render the returned citation string **adjacent to
  each third-party image** (caption or title attr + visible small-print under the image in the
  library entry). **CC BY-SA is the only documented reusable case; the full license-value vocabulary
  is not documented — PlantAI therefore displays an upstream image only when its returned `license`
  is a documented-reusable value, and unknown/missing/unsupported license values prevent image
  display** (display rule in API_DOCUMENTATION.md §2.8).
- **Other data sources:** if taxonomy IDs from sources like **GBIF** are ever displayed in the
  library, an equivalent provider citation line is added to both `/about` and the page template.
  Current MVP shows vendor IDs only where the data came from — source-mapping lives in
  DATABASE_SCHEMA.md.

---

## 8. Copyright & image licensing policy

- **Original photos only:** PlantAI's own content uses photos the owner/self-shot (or CC-licensed
  with citations per the §7 pattern).
- **No scraping Google Images** — ever; not for library illustrations either. Library species images
  come from Pl@ntNet's API (with its citations) or from **user-contributed, permission-recorded**
  uploads for curated pages if accepted later.
- **User photo rights responsibility:** the ToS (§3) obliges uploaders to hold rights; the upload UI
  states it at submission time (UI_UX_DESIGN.md).
- **Takedown procedure:** `/contact` route → email owner; handling: (1) verify claim, (2) remove the
  material while disputed, (3) respond with the outcome and what was removed. Documented as a
  support playbook item in TASKS.md content ops.

---

## 9. Google AdSense compliance mapping

AdSense is Phase 5/6 only. Basis for eligibility/policy items: docs/VERIFIED_FACTS.md (AdSense
section). Compliance discipline: for each Google requirement, name the **PlantAI control**:

| Google policy area | Requirement essence (verified) | PlantAI responsible control |
|---|---|---|
| Content quality | Original content that attracts an audience | CONTENT_STRATEGY gates: 25+ quality pages, human-written guides, no scraped content |
| Site navigation | Live, navigable site | UI templates, menu/footer, sitemap (SEO_STRATEGY.md) |
| Privacy disclosure | Privacy policy covering advertising cookies / third-party advertising | `/privacy` Phase 5 extension (this doc §2.6/§2.9), `/cookie-policy` updated |
| ads.txt | Required at ad-serving time (not approval) | Post-approval root route, MONETIZATION_PLAN.md §3.3 |
| Consent (EU/UK) | Consent for personalized ads | Phase 5 consent banner gating ad scripts (mechanics UNVERIFIED → research item #8) |
| No clicks manipulation | No inviting/detecting/inducing clicks | Zone design excludes CTAs near ads; no "support us" ad prompts; nothing overlaps ads |
| Traffic quality | No purchased/artificial traffic | No incentives ever; organic-only acquisition (SEO_STRATEGY.md) |
| No misleading placements | Ads not styled as content/results | Zone rules in MONETIZATION_PLAN.md §3.4 (never in identification flow or legal pages) |
| Adult/illegal content borders | Keep ads off content they can't serve on | Content is botanical/educational; guideline autocovers upload moderation (SECURITY.md) |

## 10. Google Play / AdMob future compliance checklist

For the Phase 7 Android launch (all items re-verified in Phase 7 — 2026 details UNVERIFIED,
facts-file research item #5):

- [ ] **Privacy policy URL in the Play listing** (live URL, not app-internal) — our `/privacy`.
- [ ] **Data safety form** — draft fields: data collected (photos, email, display name, app-internal
      identifiers), collected for "app functionality", encrypted-in-transit claim (verify basis),
      deletion mechanism availability; ad identifiers **only if** personalized ads are allowed.
- [ ] **Target audience rules** — a plant-care app is **general audience**, not child-directed; the
      safe configuration to document the intent for: an app-store setting of general audience +
      the **AdMob "no personalized ads to children" safe posture** chosen by default in the app
      build; avoid "designed for children" classifications entirely.
- [ ] **app-ads.txt** on the website root when AdMob exists (MONETIZATION_PLAN.md §4.3).
- [ ] **Consent in the mobile app** — AdMob consent mechanics inside Capacitor wrapper; plugin
      capability **UNVERIFIED** until the Phase 7 plugin comparison.
- [ ] Play Console registration cost ($25 one-time, historical) — re-verify; first Android-path cost.
- [ ] Data erasure parity in-app: deletion UX (§11) works inside the Capacitor app; document the
      in-app deletion path for Play's data-deletion requirements (field specifics UNVERIFIED,
      Phase 7).

## 11. User data protection implementation notes

Controls and threat model live in SECURITY.md. Here: the **privacy-first UX spec** to implement.

**Deletion UX spec (account menu):**

1. `/account` → **Delete my data** (distinct from "sign out").
2. Confirmation screen: plain-language list of what will be purged — profile, My Plants/saved
   identification rows, reminders, **and all identification photos**.
3. **Second step:** type-confirm (`DELETE` pattern) — 2-step confirm as required by spec.
4. Execution: purge `user_plants`, `saved_items`, `reminders` + identification rows + **images from
   the private storage bucket** (object names per DATABASE_SCHEMA.md); then delete the auth account.
   All server-side, rejecting direct client write attempts (SECURITY.md RLS posture).
5. Post-state: signed out, confirmation notice, no dangling rows. Retention default for
   **non-deleting** users: 90 days for identification rows+images then purge/anonymize (§2.5).
6. No dark retention: exports first, then deletion, in one flow — user may request a **data export**
   (access/portability right) from the same menu.

Cross-references: identification history rows in DATABASE_SCHEMA.md; image bucket layout in
ARCHITECTURE.md; RLS + key service-role rules in SECURITY.md; test coverage in TESTING_PLAN.md.

## 12. Compliance verification schedule

**Quarterly verification task** (added to TASKS.md as a recurring item — `quarterly-compliance-check`):

| Check | Source to recheck | Note |
|---|---|---|
| AdSense Program Policies + Publisher Policies updates | Google policy pages | Only relevant once Phase 5+ begins |
| Host ToS / fair-use updates (Vercel Hobby restriction still in place; Netlify/CF commercial allowance) | Host legal pages | Facts-file research items #1/#2 |
| Google Play data-safety form + policy changes | Play Console announcements | Phase 7+ only |
| Pl@ntNet terms of use + API changes | my.plantnet.org terms/changelog | Facts-file mutable areas (error-credit rule changed 2026-02-13 — they revise terms) |
| EU cookie/consent guidance | Current official guidance | Research item #8 |

Each check records a dated row back into docs/VERIFIED_FACTS.md (research notes table) to keep that
file the single source of truth.

## 13. Open legal questions for the project owner

These must be answered by the project owner to finalize page text; they are blocking for Phase 5:

1. **Developer's country of residence** — governs ToS governing-law placeholder, privacy-route
   (GDPR direct vs. one-stop-shop considerations, consumer-law overlays on `/terms`).
2. **Legal name / entity** — natural person vs. registered entity for the imprint, ToS contract
   party, and (much later) payment processor.
3. **Hosting region choice for Supabase: EU vs US** — EU region favors EU-user data residency;
   US region favors latency to the likely-majority audience; decision recorded in PROJECT_PLAN.md,
   then the `/privacy` third-party table (§2.6) is updated with the actual region before launch.
