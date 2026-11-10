# PlantAI — AI Integration Plan

> Companion docs: PROJECT_PLAN.md, REQUIREMENTS.md, ARCHITECTURE.md, DATABASE_SCHEMA.md,
> API_DOCUMENTATION.md, UI_UX_DESIGN.md, SECURITY.md, TESTING_PLAN.md, SEO_STRATEGY.md,
> CONTENT_STRATEGY.md, LEGAL_AND_COMPLIANCE.md, MONETIZATION_PLAN.md, TASKS.md,
> docs/VERIFIED_FACTS.md.
>
> **Rule:** every claim about Pl@ntNet behavior/quotas/limits is cited from docs/VERIFIED_FACTS.md.
> Everything else about third-party specifics is marked **UNVERIFIED**. No model names, weights, or
> vendors are researched or added without explicit written approval (canonical decision 5).

---

## Table of Contents

1. [AI usage map — what is AI in PlantAI](#1-ai-usage-map--what-is-ai-in-plantai)
2. [Current integration: Pl@ntNet identification](#2-current-integration-plantnet-identification)
3. [Result uncertainty design](#3-result-uncertainty-design)
4. [Failure modes & UX copy](#4-failure-modes--ux-copy)
5. [Pl@ntNet diseases route: capability & limitations](#5-plantnet-diseases-route-capability--limitations)
6. [Disease detection future architecture](#6-disease-detection-future-architecture)
7. [Model evaluation methodology (any future model)](#7-model-evaluation-methodology-any-future-model)
8. [AI limitations & user expectation management](#8-ai-limitations--user-expectation-management)
9. [Data & learning ethics](#9-data--learning-ethics)
10. [Research backlog table](#10-research-backlog-table)
11. [Decision log](#11-decision-log)

---

## 1. AI usage map — what is AI in PlantAI

**Product principle (standing):** PlantAI is honest about what is AI.

| Capability | Is it AI? | Source |
|---|---|---|
| Species identification from photos | **Yes — the only AI feature** | Pl@ntNet API (docs/VERIFIED_FACTS.md) |
| Plant library entries, care guides, disease guides | **No — curated, structured, human-written content** | CONTENT_STRATEGY / SEO_STRATEGY |
| Care reminders, My Plants, dashboards | **No — deterministic logic** | Phase 4 features |
| Any generative-AI text/images | **Does not exist and must not exist in MVP** | Canonical decision 5 |

No generative AI in the MVP — period. Guide copy is human-written (which is also the AdSense
"original content" posture, MONETIZATION_PLAN.md §3). Any temptation to "just generate" library
content is a compliance risk, not a shortcut.

## 2. Current integration: Pl@ntNet identification

Technical request/response spec lives in API_DOCUMENTATION.md. The **behavioral contract** to know
at planning level (all verified in docs/VERIFIED_FACTS.md, Pl@ntNet section):

| Behavior | Verified fact |
|---|---|
| Cost | Free plan **€0**, 500 identifications/day, commercial use allowed up to that cap |
| Quota reset | Midnight UTC; over-quota → **HTTP 429** until reset |
| Error credit burn | Since 2026-02-13 an errored request **also consumes 1 credit** → strict client/server-side upload validation is a quota-protection design point |
| Concurrency | Max **20 simultaneous requests** per client |
| Images | **1–5 images**, same individual plant, `image/jpeg`/`image/png`, POST ≤ 50 MB, auto-resized to 1280px (smaller side) |
| Scores | Confidence **0–1** |
| Floras | Regional/thematic projects to restrict results (crops, invasive, useful plants…) |
| Rate-limit visibility | `remainingIdentificationRequests` + rate-limit headers in each response → surfacing remaining quota in the server proxy is cheap |
| Key secrecy | API key is private; client-side use requires CORS whitelisting → PlantAI **never** calls Pl@ntNet from the browser; server route only (ARCHITECTURE.md) |

### 2.1 Image selection strategy (accuracy guidance)

- Ask for **1–3 photos**: leaf close-up **plus** flower/fruit when available (more informative
  organs → better discrimination). Exceeding ~3 rarely helps and burns server-side validation cost.
- Pl@ntNet **auto-detects organ**; PlantAI does not need organ labels but the UI shows it
  ("leaf detected") when possible.
- **Regional flora option when GPS provided:** if the user consents to coarse location, the request
  restricts to the matching regional flora for materially better top-1 results. Consent is explicit
  and refusable (LEGAL_AND_COMPLIANCE.md §2.2; UI_UX_DESIGN.md).
- Client-side validation (file type/size, plant-ish prompt, min resolution) exists mainly to protect
  the quota given the error-credit-burns rule above.

### 2.2 Quota & limits posture

- Server proxy pools the 500/day across all users; per-user fair-use subcap defined in
  API_DOCUMENTATION.md (rate limiting design in ARCHITECTURE.md). Over-quota UX: see §4 for the 429
  row — friendly, non-blaming copy, retry-time hint at next UTC midnight.

---

## 3. Result uncertainty design

**Never show a single forced answer.** The results screen (UI_UX_DESIGN.md) presents:

| Band | Score range (0–1 verified scale) | Display |
|---|---|---|
| Exact | high-band (e.g. ≥ 0.85, threshold tune in Phase 2) | "Likely this plant: X" + verify checklist |
| Likely | mid-band | Top result + **"not sure? browse similar plants"** fallback list |
| Possible | low-band | "We couldn't be confident" + gallery of the top few species for visual comparison |

- Real score-backed bands only — the exact thresholds are a Phase 2 calibration task (TESTING_PLAN.md
  includes scoring-accuracy checks).
- The same-species / different-phenotype problem is real (see §8): results always include a
  "browse similar plants" escape hatch into the library (SEO-friendly internal linking too).

---

## 4. Failure modes & UX copy

| Failure mode | Technical shape | UX copy direction (draft) |
|---|---|---|
| Quota exhausted **429** | From Pl@ntNet when 500/day is spent (verified) | "PlantAI's plant experts (the AI ones 🌱) need a rest until day's end. Try again tomorrow — your photos here haven't been lost." |
| No result **404/empty** | Model can't match | "We couldn't match this one confidently. Try a closer photo of a single plant — leaves, then flowers if you have them." |
| Low confidence | Scores in low band | See §3 "Possible" band — gallery comparison, no false certainty |
| Non-plant photo | No/irrelevant match | "Hmm — this doesn't look like a plant. Snap a leaf, flower, or the whole plant against a simple background." |
| Validation error (type/size) | Client & server rejections | Immediate, specific: "JPG or PNG under 50 MB total" (verified API limits) |
| Network/upstream error | 5xx | "Identification service unreachable — try again shortly." |
| Rate-limited client (per-user subcap) | Our own throttle (ARCHITECTURE.md) | "You've hit today's limit on the free plan — identifiers return tomorrow. Premium gets more (Phase 7)." |

UX principles: never imply the failure is the service being broken (it often is quota math), never
invent internal jargon (no "HTTP 429" to users), and errors must reveal to Pl@ntNet no wasted credits
(server-validated first).

## 5. Pl@ntNet diseases route: capability & limitations

**Verified (docs/VERIFIED_FACTS.md, Pl@ntNet section):** `/v2/diseases/identify` is a **separate BETA
route** launched **2025-12-02**, covering a **small list of species and pathologies (EPPO codes)**;
a `/v2/diseases` listing route enumerates identifiable diseases; it **consumes the same identify
quota**. It is **not** equivalent to species identification and **must not be misrepresented as a
mature disease-diagnosis service**.

Consequences already locked:
- PlantAI **does not market disease detection** anywhere (canonical decision 3); MVP disease content
  is human-written educational guides (CONTENT_STRATEGY).
- The varieties beta route (`/v2/varieties/identify`, 2025-12-02) has the same "limited crops"
  nature — same non-feature stance; noted here so it is not accidentally adopted either.

**Quarterly monitoring:** the Pl@ntNet changelog is checked on the recurring compliance cycle
(LEGAL_AND_COMPLIANCE.md §12 / TASKS.md).

### 5.1 Evaluation criteria for ever integrating a disease route

| Criterion | Gate question |
|---|---|
| Coverage | Does it cover PlantAI's **top 100 user plants** (derived from identification telemetry)? |
| Accuracy | Acceptable top-k on our validation cases? (PlantAI cannot validate pathogen identity — expert-adjacent check required) |
| API stability | Out of BETA? Documented SLA-ish behavior? Error/credit semantics stable? |
| Comms | Can it be worded honestly ("detects X of the most common diseases, in Y species") without overclaiming? |

**Recommendation: monitor quarterly, no integration decision before the Phase 7 gate.**

## 6. Disease detection future architecture

Independent research track (canonical decision 5) — **no further research of specific models without
approval.** Only option categories are documented:

| Option | Approach | Free-sustainability | Assessment |
|---|---|---|---|
| **1 — Wait for Pl@ntNet diseases maturity** | Adopt the beta route when coverage/accuracy are sufficient (§5.1) | Free always | **Default and recommended.** Zero cost, zero liability, honors "no unauthorized vendors". Weakness: schedule outside our control. |
| **2 — Open-source fine-tuned image model** | Fine-tune a published image-classifier architecture on **PlantVillage-style public datasets** for common diseases | Training via free compute e.g. a Colab-free-tier-like GPU route (**UNVERIFIED** whether any free GPU tier fits 2026 limits) → then inference options: serverless function (cold-start/size caveats on Vercel/Netlify free runtimes — **UNVERIFIED) or on-device ONNX in the Capacitor app (Phase 7+)** | Categories-of-approach only; **not researched further** until the Phase 7 gate + owner approval. Multi-stage risk: dataset license check, hosting a model artifact, inference quota logic — a project of its own. |
| **3 — LLM symptom-triage chat** | "Describe the problem → LLM suggests diagnosis" | Requires a paid/LLM API (none authorized) + hallucination risk on plant pathology | **Explicitly REJECTED for MVP.** Requires an LLM API cost (canonical decision 5 forbids) and creates med/agri-adjacent misdiagnosis risk (LEGAL_AND_COMPLIANCE.md §5). Not researched further. |

**Decision discipline:** Options stay in this backlog; the Phase 7 decision gate (ROADMAP M7.2 in
PROJECT_PLAN.md) picks or defers with the owner's written approval for whatever path is chosen.

## 7. Model evaluation methodology (any future model)

Applies identically to a Pl@ntNet route upgrade or any independently built model:

| Dimension | Method |
|---|---|
| Test set | Held-out set sized for the claim (minimum: a few hundred images per class for a disease classifier; for species at least per-region samples); source **PlantAI-platform-independent** (no training serve overlap) |
| Accuracy targets | Top-1 ≥ some pre-registered threshold + top-5 band; per-class minimums so rare species aren't sacrificed |
| Confusion analysis | Per-species confusion matrix; publish/handle the worst confusions (e.g. same-genus lookalikes) in the UI copy |
| Degenerate inputs | Non-plant photos, screenshots of other apps, blurred images, heavily-edited images, memetic text-overlaid photos |
| Bias / regional coverage | Per-flora-region evaluation — a model strong on temperate houseplants may fail tropical/tropical-leaf phenotypes |
| Latency & cost per inference | Measured end-to-end at p50/p95; free-tier budget math before launch (a "free" model that needs a paid GPU runtime is not approved for this zero-budget project) |
| Fail-open UX | A model that cannot answer must degrade to the uncertainty bands of §3, never to an invented guess |

## 8. AI limitations & user expectation management

Documented and surfaced in-product (link to `/disclaimer`, LEGAL_AND_COMPLIANCE.md §5):

| Limitation | Honest phrasing |
|---|---|
| Wrong IDs happen | "Identification can be wrong — treat results as a starting hypothesis to verify (flowers, leaves, seedpods)." |
| Hybrids & cultivars | Cultivars often indistinguishable visually → results to the species level mostly |
| Diseased vs healthy same-species | Visual disease symptoms vs. species confusion is a known NLP-of-images problem — covered by §5 stance (no disease diagnosis marketed) |
| Photographic dependence | Better input → better output; guide for photos in UI_UX_DESIGN.md |
| Regional variation | Same plant looks different across climates/seasons; the GPS-optional regional-flora mode mitigates the mainstream cases |

**No dark-pattern confidence inflation:** the UI displays **real scores** with honest presentation
rules (§3). Showing "98% sure!" when the top-1 was 0.31 is banned ("fake certainty"). Confidence
band labels are connected to the real thresholds at all times.

## 9. Data & learning ethics

- **We do NOT train any model on user photos by default.** No default data-flywheel; future
  structural improvement is **opt-in only, default OFF** (also in ToS, LEGAL_AND_COMPLIANCE.md §3)
  and only ever ships through a developer-approved vendor decision (canonical decision 5).
- **Pl@ntNet receives the identification request as part of the service** (this is inherent to an API
  identification call), and it is disclosed plainly and in the `/privacy` third-party table
  (LEGAL_AND_COMPLIANCE.md §2.6). No pretending the images don't cross the border.
- Images stay in PlantAI's **private storage bucket** (not public web URLs); deletion removes both
  rows and images (SECURITY.md / DATABASE_SCHEMA.md).

## 10. Research backlog table

| # | Item | Status | Recheck cadence / next date |
|---|---|---|---|
| 1 | **Pl@ntNet changelog + diseases coverage evolution** (species/pathology list growth, error-credit rule changes) | UNVERIFIED going forward | Quarterly (recurring compliance check, TASKS.md) |
| 2 | Open models for common-plant disease classification (option 2 category above) | UNVERIFIED — **blocked pending owner approval** | Phase 7 gate |
| 3 | Free hosting/inference options for a self-hosted image model (serverless constraints, on-device ONNX in Capacitor) | UNVERIFIED | Phase 7 gate |
| 4 | Pl@ntNet Pro plan pricing (if the 500/day pool ever nears saturation) | UNVERIFIED (facts-file research item #4) | Only when telemetry shows sustained quota pressure |
| 5 | Free-GPU training feasibility (e.g. current free-tier Colab limits) for a future fine-tune | UNVERIFIED | Phase 7 gate + owner approval |
| 6 | Varieties beta route (`/v2/varieties/identify`) coverage for houseplant-cultivar users | UNVERIFIED | Quarterly (change-log watch) |

Backlog maintenance: each recheck updates this table **and** adds a dated note in
docs/VERIFIED_FACTS.md if a fact changes status.

## 11. Decision log

| # | Decision | Status | Date |
|---|---|---|---|
| D1 | **Integrate Pl@ntNet species identification** as the MVP AI (server-side only, free plan, commercial-use allowed ≤500/day) | **APPROVED** | 2026-11-10 |
| D2 | **No generative AI** in MVP (no LLM/generated content/images) | **APPROVED** | 2026-11-10 |
| D3 | **Diseases beta watch:** no integration before the quarterly-monitor + Phase 7 gate; never marketed as a feature | **APPROVED** | 2026-11-10 |
| D4 | **Independent disease model** (option 2) | **PENDING — research gate** (owner approval required before any vendor/model research) | — |
| D5 | Disease-triage LLM chat (option 3) | **REJECTED** for MVP (cost + hallucination risk) | 2026-11-10 |
| D6 | No training on user photos without explicit opt-in + new approval | **APPROVED** (standing) | 2026-11-10 |
