# PlantAI — Final Phase 1 Documentation Audit Report

**Audit date:** 2026-11-10
**Auditor role:** Senior Technical Auditor & Project Manager (OpenCode agent)
**Scope:** All Phase 0 planning documents (called "Phase 1" per the owner's audit brief; in the project roadmap this is **Phase 0 — Planning & Documentation, milestone M0**. Nothing in this report changes the phase numbering — the roadmap remains canonical).
**Verdict:** ✅ **AUDIT PASSED — documentation is MVP-ready and internally consistent. One gate remains: explicit owner approval before Phase 1 (Environment & Scaffold) begins.**

---

## Table of Contents

1. [Document inventory — Task 1](#1-document-inventory--task-1)
2. [Quality audit results — Task 2](#2-quality-audit-results--task-2)
3. [Factual accuracy audit — Task 3](#3-factual-accuracy-audit--task-3)
4. [Cross-document consistency — Task 4](#4-cross-document-consistency--task-4)
5. [MVP scope confirmation — Task 5](#5-mvp-scope-confirmation--task-5)
6. [Project management updates — Task 6](#6-project-management-updates--task-6)
7. [Critical issues, security concerns & unresolved decisions](#7-critical-issues-security-concerns--unresolved-decisions)
8. [MVP readiness & recommended Phase 1/2 tasks](#8-mvp-readiness--recommended-phase-12-tasks)
9. [Restrictions compliance statement](#9-restrictions-compliance-statement)

For live third-party facts backing every claim below, see [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) (verified 2026-11-10).

---

## 1. Document inventory — Task 1

**19/19 files exist. 18 required + 1 authoritative research log. 0 missing. 0 empty. 0 placeholder stubs.**

| Required document | Exists | Lines | Size | TOC | Tables | Cross-references facts file |
|---|---|---|---|---|---|---|
| PROJECT_PLAN.md | ✅ | 183 | 20 KB | ✅ | ✅ | ✅ |
| REQUIREMENTS.md | ✅ | 285 | 25 KB | ✅ | ✅ | ✅ |
| ARCHITECTURE.md | ✅ | 456 | 39 KB | ✅ | ✅ | ✅ |
| DATABASE_SCHEMA.md | ✅ | 877 | 43 KB | ✅ | ✅ | ✅ |
| API_DOCUMENTATION.md | ✅ | 423 | 30 KB | ✅ | ✅ | ✅ |
| UI_UX_DESIGN.md | ✅ | 344 | 31 KB | ✅ | ✅ | ✅ |
| SEO_STRATEGY.md | ✅ | 288 | 21 KB | ✅ | ✅ | ✅ |
| SECURITY.md | ✅ | 347 | 35 KB | ✅ | ✅ | ✅ |
| MONETIZATION_PLAN.md | ✅ | 289 | 19 KB | ✅ | ✅ | ✅ |
| TESTING_PLAN.md | ✅ | 310 | 23 KB | ✅ | ✅ | ✅ |
| DEVELOPMENT_ROADMAP.md | ✅ | 280 | 23 KB | ✅ | ✅ | ✅ |
| TASKS.md | ✅ | 178 | 11 KB | ✅ | ✅ | ✅ |
| CHANGELOG.md | ✅ | 65 | 7 KB | n/a (changelog format) | ✅ | ✅ |
| ENVIRONMENT_SETUP.md | ✅ | 331 | 18 KB | ✅ | ✅ | ✅ |
| DEPLOYMENT_GUIDE.md | ✅ | 449 | 35 KB | ✅ | ✅ | ✅ |
| LEGAL_AND_COMPLIANCE.md | ✅ | 325 | 20 KB | ✅ | ✅ | ✅ |
| AI_INTEGRATION_PLAN.md | ✅ | 221 | 16 KB | ✅ | ✅ | ✅ |
| CONTENT_STRATEGY.md | ✅ | 157 | 14 KB | ✅ | ✅ | ✅ |
| docs/VERIFIED_FACTS.md (supporting, required) | ✅ | 108 | 12 KB | ✅ | ✅ | source of truth |

Total documentation volume: ≈ 5,482 lines / ≈ 460 KB of professional planning material.

## 2. Quality audit results — Task 2

Per-document verdicts (structure checked via heading inventory; key sections read in full):

| Document | Completeness | Findings |
|---|---|---|
| PROJECT_PLAN.md | ✅ Complete | Vision, G1–G9 measurable goals, in/out scope, A–Z features mapped to tiers/phases, M0–M7 milestones with exit criteria, honest success criteria, zero-cost budget ledger, 8-item risk register, explicit non-goals. No gaps. |
| REQUIREMENTS.md | ✅ Complete | Tier 1–5 FR IDs, NFR families (performance/a11y/security/privacy/reliability/compat), personas, admin, business, technical requirements, AC-* acceptance tables. **Minor cosmetic issue §11.1** (heading wording "Group: Capture; Groups: …" is awkwardly compounded) — cosmetic only, no requirement is missing or duplicated; non-blocking, can fix opportunistically in Phase 1 or leave as-is. |
| ARCHITECTURE.md | ✅ Complete | Principles, `src/` structure, system diagram, client-boundary inventory (earned-only), Route Handler + Server Action catalogs, sequence diagram, auth & role patterns, ADR-1…ADR-8, scalability path, risks. No conflicting decision vs any other doc. |
| DATABASE_SCHEMA.md | ✅ Complete | 10 tables × (purpose, columns, PK/FK, indexes, RLS SQL), 5 enums, 4 triggers, 2 storage buckets + policies, migration/seed strategy, backup + retention decisions. Strongest document in the set. |
| API_DOCUMENTATION.md | ✅ Complete | Full `/api/identify` spec (endpoint facts, auth classes, request pipeline, rate-limit headers, success JSON, 10-row error table with user copy, upstream mapping, client+server validation), Server Actions catalog with typed contracts, rate-limiting strategy with **honest** multi-instance limitation documented. |
| UI_UX_DESIGN.md | ✅ Complete | Tokens (emerald/teal + hex-verify note), typography, components, layouts, desktop navbar + 5-item mobile bottom nav with raised Identify button, per-page specs (incl. quota-reached & degraded states), WCAG 2.1 AA checklist, PWA Phase 6 notes, 4 disabled future ad zones, Do/Don't. |
| SEO_STRATEGY.md | ✅ Complete | Technical/on-page plans, canonical URL table for every route, template title/meta rules, keyword clusters + intent map, crawl-safe `?q=` rule, JSON-LD plan (honest: Taxon rejected as UNVERIFIED), sitemap/robots specs, CWV budgets, GSC plan. Claims-free honesty rule stated at top. |
| SECURITY.md | ✅ Complete | STRIDE-lite threat model (5 actors), secrets inventory + `NEXT_PUBLIC_` enforcement + rotation, server-only Pl@ntNet proxy policy, auth patterns, upload hardening (magic-byte sniff, no SVG, namespaced paths, signed URLs), abuse table, RLS-per-table matrix, OWASP Top-10 mapping, headers/CSP, incident runbook, explicitly accepted residual risks. No critical gap found. |
| MONETIZATION_PLAN.md | ✅ Complete | Hosting-prerequisite decision matrix (Vercel Pro VERIFIED $20/mo vs Netlify/Cloudflare UNVERIFIED — do not touch ads before a host decision), AdSense preconditions + timing + ads.txt post-approval, AdMob Phase-7 banners-only + app-ads.txt, premium split with **no fabricated pricing**, KPIs, risks. Complies with zero-budget + no-guarantee rules. |
| TESTING_PLAN.md | ✅ Complete | Free-tooling decision table (versions UNVERIFIED-flagged for Phase 1), unit scope with example cases, RLS actor×table verification matrix, 10 `/api/identify` contract cases on **recorded fixtures** (no live quota burn in CI; one weekly manual smoke), 7 E2E scenarios, manual responsive/keyboard/SR checklists, Lighthouse thresholds, per-phase gates, accepted gaps. |
| DEVELOPMENT_ROADMAP.md | ✅ Complete | Phases 0–7 with tasks, dependencies, S/M/L sizing, per-phase exit criteria + exclusions, Day-1 Phase 2 guidance, dependency graph, solo-capacity assumptions, per-phase risk register, change management. Updated with audit task 0.20 (see Task 6). |
| TASKS.md | ✅ Complete | P0-01…P0-24 (this audit) by phase, dependencies, statuses, blocked table (P0-22 user gate), recurring compliance/backup tasks. Updated (see Task 6). |
| CHANGELOG.md | ✅ Complete | v0.1.0 doc-set entry + v0.1.1 audit entry; decisions summary; open items; UNVERIFIED carry-over. Updated (see Task 6). |
| ENVIRONMENT_SETUP.md | ✅ Complete | Windows prerequisites (Node LTS UNVERIFIED-tagged until Phase 1), step-by-step MSI/git/GitHub/VS Code, Supabase 2-project setup, Pl@ntNet key path, canonical env inventory + `.env.local` & `.env.example` templates with exposure rules, Windows gotchas (execution policy, long paths, CRLF→LF via `.gitattributes`, node-gyp), "what NOT to do now", Phase-1 handoff. |
| DEPLOYMENT_GUIDE.md | ✅ Complete | Hosting constraint front and center, environment matrix with shared-quota caution, GitHub/Vercel/Supabase flows (2-project split), full env table, production checklist, domain path, migration verification steps Phase 5, backups/DR, cost-drift monitoring with the no-paid-toggle rule, rollback strategy, Windows-friendly commands. |
| LEGAL_AND_COMPLIANCE.md | ✅ Complete | Not-legal-advice disclaimer, all 5 legal-page outlines (privacy bases/90-day retention/third-party data-sharing table), attribution policy, image licensing + takedown, AdSense & Play/AdMob compliance maps, erasure UX spec, quarterly compliance schedule, **3 open owner questions** (documented, see §7). |
| AI_INTEGRATION_PLAN.md | ✅ Complete | "Identification is the only AI" honesty map, verified Pl@ntNet contract, image-selection guidance, uncertainty bands (exact/likely/possible), failure-mode UX copy matrix, diseases-BETA evaluation gates, future options table (LLM option explicitly REJECTED), model-eval methodology, ethics policy, decision log D1–D6. |
| CONTENT_STRATEGY.md | ✅ Complete | Mission, 5 pillars, quality checklist, editorial workflow, plant_library entry template matching schema exactly, 10 prioritized launch species, blog roadmap, AdSense-content alignment, metrics decision (GA4 deferred). |
| docs/VERIFIED_FACTS.md | ✅ Complete | 7 documented service sections + 10-item pending-verification table with recheck phases. Single fact source throughout. |

**Notable quality strengths:** no generic filler detected anywhere; every doc opens with TOC + citation rule; failure/quota UX states are planned (a common omission); `UNVERIFIED` discipline is applied consistently instead of guessing.

**Complete/missing coverage of the audit brief's checklist:**
- Missing sections: none material.
- Incomplete requirements: none found (all FRs have IDs and placement; ACs cover MVP groups).
- Generic placeholders: none (only intentional, date-stamped UNVERIFIED flags).
- Conflicting decisions: none found (see §4).
- Duplicate requirements: none found; cross-doc references defer to the ID source rather than restating it.
- Missing dependencies: none (roadmap has a dependency graph; TASKS rows carry Depends-on).
- Missing acceptance criteria: MVP ACs present (REQUIREMENTS §11 + TESTING_PLAN gates).
- Security gaps: none critical (see §7 for conscious residual risks).
- SEO gaps: covered; one deferred-by-design item (GSC needs a live public URL — Phase 5, tracked).
- Monetization limitations: fully respected (no host migration/upgrade decision taken yet — correctly gated).
- Zero-budget compatibility: all chosen tooling free/open-source; all future cost events documented as decision gates, none invoked.

## 3. Factual accuracy audit — Task 3

Method: grep-verified every third-party quota/price statement across the corpus and matched it against `docs/VERIFIED_FACTS.md` (verified 2026-11-10 against the actual publisher pages).

| Claim | Verified wording & location | Status |
|---|---|---|
| Pl@ntNet free = **500 identifications/day, €0, commercial use allowed up to cap** | PROJECT_PLAN G6/R1; ARCHITECTURE §8/§13; API_DOCUMENTATION (header + upstream table); AI_INTEGRATION_PLAN contract table; SECURITY threat model; DATABASE `app_settings` comment; DEPLOYMENT_GUIDE §2/§6; MONETIZATION premium clause; all cite VERIFIED_FACTS | ✅ Accurate, consistently cited |
| **API errors consume 1 credit** (effective 2026-02-13) | VERIFIED_FACTS; REQUIREMENTS FR-UP-004 quota rationale; API_DOCUMENTATION pipeline; SECURITY threat model; ARCHITECTURE risk register | ✅ Preserved everywhere (this restriction was NOT softened by any document) |
| Pl@ntNet **429 until midnight UTC reset** + 20 concurrent max + 1–5 images + ≤50 MB POST + 0–1 scores | API_DOCUMENTATION header/§2.8; AI_INTEGRATION_PLAN; VERIFIED_FACTS | ✅ Consistent |
| **Disease identification = Beta (2025-12-02), limited species/pathologies (EPPO codes)** | AI_INTEGRATION_PLAN §5 gates; LEGAL doc; API "Future endpoints" labeled non-MVP; CONTENT_STRATEGY educational-only framing | ✅ Correctly kept as non-MVP/educational-only; never marketed as diagnosis |
| **Vercel Hobby = non-commercial only; AdSense explicitly named as commercial; deployment may be disabled** | VERIFIED_FACTS (verbatim ToS quote); ARCHITECTURE §10.1 + ADR-2 + risk table; DEPLOYMENT_GUIDE "single hosting constraint"; MONETIZATION §2 decision matrix; REQUIREMENTS FR-MON-001 | ✅ Preserved with hard Phase-5 gate + "CI guard: no AdSense script in any Hobby deploy" |
| **Supabase Free: 500 MB DB / 1 GB storage / 50k MAU / 5 GB egress; pause after ~1 week inactivity; restore ≤1 year; no automatic backups** | VERIFIED_FACTS; DEPLOYMENT_GUIDE §5.5 + backups; DATABASE_SCHEMA §8; ARCHITECTURE risks | ✅ Preserved; backup + pause mitigations documented as recurring tasks |
| **AdSense eligibility = 18+, original content, HTML access, policy compliance; NO published content/traffic minimums; discretionary; common rejection "low value content"** | VERIFIED_FACTS; MONETIZATION §3.1–3.2; REQUIREMENTS FR-BIZ-001; SEO_STRATEGY honesty table; CHANGELOG | ✅ No approval/revenue guarantee exists anywhere in the corpus (grep-level verified) |
| **Google Play Console $25 one-time + AdMob 2026 policies = UNVERIFIED until Phase 7** | VERIFIED_FACTS pending table; LEGAL §10; MONETIZATION §4; TASKS P7-01; PROJECT_PLAN budget row "UNVERIFIED" | ✅ Correctly un-invented |
| No price/limit was introduced anywhere without a source or UNVERIFIED flag | grep audit across corpus | ✅ Clean |

**Verdict:** factual discipline holds. Zero invented pricing, zero removed restrictions.

## 4. Cross-document consistency — Task 4

Compared the 9 documents named in the audit brief, plus the Support documents for contradiction risk (UI_UX_DESIGN, SECURITY, TESTING_PLAN, DEPLOYMENT_GUIDE, ENVIRONMENT_SETUP, LEGAL_AND_COMPLIANCE, CONTENT_STRATEGY, TASKS/CHANGELOG).

**Architecture & stack — one voice.** Next.js App Router, TypeScript strict, Server-first rendering, Tailwind, Supabase Auth/Postgres/Storage, Pl@ntNet via server-only proxy: described identically in PROJECT_PLAN, REQUIREMENTS (FR-TEC-001/003/004/006), ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, DEPLOYMENT_GUIDE, ENVIRONMENT_SETUP. No doc proposes a dissenting alternative except where an options table is explicitly a decision record (ADR-1…8; AI options table).

**Identical numbers across docs:**
- Rate limits 5/day anonymous, 20/day authenticated, tunable `app_settings` — PROJECT_PLAN G6 = DATABASE_SCHEMA §3.9 = API_DOCUMENTATION §2.5 = SECURITY §7 = ARCHITECTURE §13. ✅
- Upload rules JPEG/PNG ≤10 MB, 1–3 images client-validated AND server-revalidated — API §2.3 = SECURITY §6 = REQUIREMENTS FR-UP-003/004 = UI_UX_IDENTIFY. ✅
- Canonical URL set — FR-TEC-006 enumeration == UI_UX_DESIGN §5/§6 == SEO_STRATEGY §3 == ARCHITECTURE §4.3. ✅
- Table names & public-read rule — all 10 names identical wherever used; "public read only for published plant_library + blog_posts" consistent across DATABASE_SCHEMA, ARCHITECTURE, SECURITY matrix, API docs, CONTENT_STRATEGY. ✅
- Storage buckets `request-images` (private) / `plant-images` (public) — DATABASE_SCHEMA §6 == ARCHITECTURE §6 == SECURITY §6 == DEPLOYMENT_GUIDE §5.3. ✅
- Hosting gate wording — VERIFIED_FACTS §Vercel == ARCHITECTURE ADR-2 == DEPLOYMENT_GUIDE §1/§10 == MONETIZATION §2 == FR-MON-001. ✅

**MVP boundary — identical everywhere.** MVP = Phases 1–3 ("identification core + content/SEO"), with Tier 3+ items (My Plants/Reminders/Dashboard, full admin, PWA polish, ads, Android, premium, disease-AI) marked post-MVP in PROJECT_PLAN §5, REQUIREMENTS tiers, ROADMAP phases, TASKS statuses, AI plan, MONETIZATION roadmap. No doc claims an MVP feature the others exclude. ✅ (See §5.)

**Requirement-ID traceability check.** IDs cited by DEVELOPMENT_ROADMAP (FR-TEC-003/006, FR-ID-*, FR-UP-*, FR-RES-*, FR-MON-*, FR-BIZ-002/003/005, FR-PROD-001, NFR-PR-*, NFR-S-*, NFR-B-002) all resolve in REQUIREMENTS.md — verified by grep. TESTING_PLAN maps AC-*/FR/NFR to test artifacts. TASKS reference these IDs. ✅

**Minor observations (non-conflicting, logged for transparency):**
1. REQUIREMENTS §11.1 heading wording is clunky (cosmetic; no content issue).
2. UI_UX color doc says "≥800 words" appears in CONTENT_STRATEGY as internal editorial guideline — both documents phrase it as guideline-not-rule; no contradiction.
3. Some docs slightly differ in *summary line counts* vs reality (cosmetic; totals here are authoritative).

**Decision resolution:** no contradictions required arbitration. The 8 ADRs + decision logs D1–D6 in AI_INTEGRATION_PLAN coincide with CHANGELOG's 6 decisions — cross-checked. ✅

## 5. MVP scope confirmation — Task 5

The owner's frozen 10-item MVP list maps exactly to the documented MVP (Phases 1–3):

| # | Owner's MVP item | Where documented | Status |
|---|---|---|---|
| 1 | Responsive Homepage | REQUIREMENTS FR-HOME-*; UI_UX §6.1; SEED layout | ✅ In MVP |
| 2 | Plant Image Upload | FR-UP-001…006; API §2; SECURITY §6 | ✅ In MVP |
| 3 | Real Pl@ntNet Identification | FR-ID-*; API §2 full spec; ARCHITECTURE §8 | ✅ In MVP (server proxy, real upstream; mock mode only for dev) |
| 4 | Identification Results | FR-RES-001…006; UI_UX §6.3 | ✅ In MVP |
| 5 | Plant Information | FR-LIB/detail `/plant/[slug]`; DATABASE plant_library | ✅ In MVP |
| 6 | Basic Plant Care Guide (watering/sunlight/soil/fertilizer) | careSummary from plant_library; CONTENT template fields | ✅ In MVP (curated content, NOT AI-claimed) |
| 7 | Plant Search | `/library?q=` + trigram index (Phase 3 = MVP completion) | ✅ In MVP |
| 8 | Basic Saved Plants | P2-08; FR-RES-006; saved_plants table | ✅ In MVP (lightweight) |
| 9 | SEO Foundation | FR-SEO-001/002; sitemap.ts/robots.ts/metadata/JSON-LD (Phase 3) | ✅ In MVP |
| 10 | Legal Pages | /privacy /terms /cookie-policy /about /contact (P3-05) | ✅ In MVP |

**Explicitly OUT of the MVP (and consistently so):** AI disease detection (Pl@ntNet diseases BETA → Phase 7 evaluation), premium subscriptions, advanced reminders engine, My Plants/Dashboard full suite, Android/Capacitor packaging, AdMob, PWA install polish, blog publishing cadence. Verified against PROJECT_PLAN §5, REQUIREMENTS tiers 3–5, ROADMAP phase exclusions, TASKS statuses, AI_INTEGRATION_PLAN D2/D3, MONETIZATION roadmap. **No scope creep into MVP.** ✅

## 6. Project management updates — Task 6

All three management documents updated during this audit:

1. **TASKS.md** — added and completed `P0-23` (documentation audit) and `P0-24` (audit report creation); "Last updated" note refreshed; the sole blocked item remains **P0-22 = user gate to Phase 1**; Phase 1–7 rows remain pending with dependencies intact; recurring quarterly/weekly tasks untouched.
2. **CHANGELOG.md** — new `[0.1.1] — Documentation Audit — 2026-11-10` entry recording the audit, its findings, and the decision confirmation (no architecture change). Historical `[0.1.0]` entry preserved.
3. **DEVELOPMENT_ROADMAP.md** — Phase 0 task table extended with `0.20` (this audit, size S, completed); M0 exit criteria now explicitly include "documentation audit completed with report"; findings line added under the Phase 0 section.

Status summary: **Completed = Phase 0 items P0-01…P0-24 (24 tasks). Pending = all Phase 1–7 items. Blocked = P0-22 (user approval), P5-05 (AdSense — depends on user/host/content), P7-03 (Play/AdMob — depends on Phase 7 verification).**

## 7. Critical issues, security concerns & unresolved decisions

**Critical issues: 0** — nothing blocks Phase 1 start after approval.

**Security concerns (all acceptable, all documented):**
1. Multi-instance in-memory rate limiting is best-effort on serverless (SECURITY §7 + API §5.2 state this honestly); migration trigger to a durable counter is pre-planned for Phase 5 if abuse telemetry appears.
2. Shared single Pl@ntNet key across dev/preview/prod = one exhaustion surface (rejected alternative was a second free account — forbidden by Pl@ntNet terms). Mitigated by `PLANTNET_MODE=mock` for dev and strict pre-validation (errors burn quota).
3. Conscious residual risks list in SECURITY §14 (no WAF, no paid pentest, hashed-junk many-IP abuse theoretically possible) — accepted deliberately for MVP scale, with early-warning sign and response route recorded.

**Unresolved decisions (owner input needed, none blocking the scaffold except Q1):**
1. **Q1 (needed for Phase 1):** Supabase region choice (data residency vs latency; e.g. ap-south-1 vs eu-central-1) — asked in LEGAL_AND_COMPLIANCE §13; prompt-friendly answer at Phase 1 kick-off is fine.
2. **Q1b (needed for Phase 1):** developer country/jurisdiction for ToS governing-law placeholder.
3. **Q2 (Phase 5):** hosting path when monetization nears — verify Netlify/Cloudflare current ToS (research items #1–2, UNVERIFIED) vs upgrade Vercel Pro; recommendation path documented, decision deferred by design.
4. **Q3 (Phase 5, optional):** custom domain purchase timing (first optional spend).
5. Analytics tool (GA4 or Search-Console-only) — deferred to Phase 5 by recorded decision.

## 8. MVP readiness & recommended Phase 1/2 tasks

**Readiness:** documentation set is complete, internally consistent, factually grounded, and scoped correctly for the 10-item MVP. A competent AI coding agent can execute Phase 1 immediately from ENVIRONMENT_SETUP.md + DEVELOPMENT_ROADMAP.md §3 without re-deriving decisions. **MVP is documentation-ready; implementation awaits the owner gate.**

**Recommended next actions (in order), pending explicit approval:**

*Phase 1 — Environment & Project Scaffold (after P0-32 approval):*
1. Answer Q1/Q1b (Supabase region, jurisdiction) — 5 minutes.
2. Install Node LTS/Git (ENVIRONMENT_SETUP §2), create GitHub repo, first commit.
3. Create Supabase `plantai-dev` + `plantai-prod`, generate Pl@ntNet key, populate `.env.local` (+ committed `.env.example`).
4. Scaffold Next.js (App Router, TS strict, Tailwind — pin & record the exact Node/Tailwind versions, closing two UNVERIFIED items).
5. Apply DATABASE_SCHEMA migrations + RLS + storage buckets + seed (species starter set), make shell deploy live on Vercel preview.

*Phase 2 — MVP Identification & Auth (scaffold approved):*
6. `POST /api/identify` with fixture-first testing (`PLANTNET_MODE=mock`), rate limits 5/20, hash cache.
7. Identify & Results UI per UI_UX spec incl. quota/degraded states; plant detail; auth loop; basic saved plants.
8. First manual live identification smoke test; log remaining-quota telemetry from day 1.

**Definition of "done" for the audits' next milestone:** MVP acceptance criteria in REQUIREMENTS §11 pass in TESTING_PLAN gates.

## 9. Restrictions compliance statement

- ❌ Next.js was **not** initialized; no scaffolding performed.
- ❌ No npm packages installed anywhere.
- ❌ No application source code exists in the workspace (documentation + SQL snippets inside docs only).
- ❌ No frontend/backend development started.
- ❌ No paid service introduced, registered, or toggled; zero net cost to date.
- ✅ Audit stopped at documentation; **explicit owner approval is awaited before Phase 1** (and the scaffold, per the approved roadmap, precedes Phase 2 implementation).

---

*Audit artifacts: this report, updated TASKS.md P0-23/P0-24, CHANGELOG.md v0.1.1, DEVELOPMENT_ROADMAP.md task 0.20. Audit trail reproducible from `docs/VERIFIED_FACTS.md` (source URLs + dates) and the grep checks described in §3–§4.*
