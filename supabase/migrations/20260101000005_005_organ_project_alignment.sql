-- PlantAI — Stage F3: organ CHECK + project default alignment (005)
--
-- Source of truth:
--   SCHEMA_RECONCILIATION_PROPOSAL_F1_F2_F3.md §F-3 (owner-approved, file creation only)
--   DATABASE_SCHEMA.md §3.3 / §3.10 (mismatch flags)
--   src/lib/plantnet/organs.ts (canonical enum: leaf | flower | fruit | bark | auto)
--   src/lib/plantnet/live-provider.ts DEFAULT_PROJECT = "all" (verified Stage A1)
--
-- What this migration does (metadata only — NO rows are rewritten, deleted or
-- truncated, and NO indexes / RLS policies / grants / triggers / functions are
-- touched):
--   [A] identifications.organ CHECK: legacy ('flower','leaf','lateral','root','auto')
--       → canonical ('leaf','flower','fruit','bark','auto').
--   [B] identification_cache.organ: gains a CHECK with the SAME canonical values
--       (it previously had none — default 'auto' only).
--   [C] Column defaults 'allplants' → 'all' on identifications.project and
--       identification_cache.project (default changes are metadata; existing
--       rows, if any, are never rewritten).
--
-- Why: the Stage A1 verified upstream contract uses exactly
-- leaf/flower/fruit/bark (+ auto for detection). 'lateral'/'root' are invalid
-- upstream values and are already rejected by the application (HTTP 400 before
-- any upstream call, Stage C). Until this migration, explicit organ values
-- 'fruit'/'bark' FAIL the legacy CHECK on identifications — the application
-- handles that best-effort (logged, response unaffected). After this migration
-- they persist correctly. The application (Stage F1/F2) already writes
-- project = "all" explicitly, so the default change aligns the schema with
-- what is actually written; no code change is required before or after.
--
-- ROLLBACK IMPLICATIONS (summary — full rollback SQL lives in the Stage F3
-- preflight report / owner records; do NOT create a separate rollback file):
--   - [A] reverse = drop the canonical CHECK, re-add the legacy set. CRITICAL
--     PRECONDITION: at rollback time no rows may hold 'fruit' or 'bark' — the
--     legacy CHECK would reject them. If such rows exist, restoring the legacy
--     CHECK requires a SEPARATE OWNER-APPROVED DATA DECISION (no automatic
--     rewrite is ever performed).
--   - [B] reverse = drop the identification_cache organ CHECK (no row-state
--     precondition).
--   - [C] reverse = set the defaults back to 'allplants' (unconditional,
--     metadata-only).
--   - The application remains compatible with BOTH pre- and post-migration
--     states (it writes explicit canonical values), so a rollback does not
--     require a code revert.
--
-- SAFETY: every step below VERIFIES the current schema/row state through the
-- PostgreSQL catalogs first and RAISES AN EXCEPTION (aborting the whole
-- transaction, leaving the schema byte-for-byte unchanged) on ANY deviation
-- from the expected state. Nothing is assumed by name without verification.
--
-- TRANSACTION CONTROL: this file contains NO explicit BEGIN/COMMIT — per the
-- Supabase Knowledge Base warning on embedded transaction control, the
-- migration runner's built-in transaction wrapper supplies the transaction:
-- the whole file runs as ONE transaction, so any verify-step failure rolls
-- back every statement (partial-migration impossible). Never wrap this file
-- in additional transaction-control statements.

-- ────────────────────────────────────────────────────────────────────────────
-- [0] ROW-STATE PRECONDITION — canonical-set safety gate
--
-- The constraint swaps below validate existing rows. If any row held an organ
-- value outside the canonical set (e.g. legacy 'lateral'/'root' data), the
-- forward swap would fail mid-migration. We therefore check FIRST and abort
-- BEFORE touching anything, so the failure mode is always "clean abort, schema
-- unchanged" — never a partially applied state. NO data is rewritten here (or
-- anywhere in this file): out-of-set rows are an owner-decision matter, not
-- something this migration may "fix" automatically.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_bad_rows bigint;
begin
  select count(*) into v_bad_rows
  from public.identifications
  where organ not in ('leaf', 'flower', 'fruit', 'bark', 'auto');
  if v_bad_rows > 0 then
    raise exception
      'F3 aborted: % row(s) in public.identifications hold organ values outside the canonical set (leaf/flower/fruit/bark/auto). Schema unchanged. Owner decision required before this migration can proceed.',
      v_bad_rows;
  end if;

  select count(*) into v_bad_rows
  from public.identification_cache
  where organ not in ('leaf', 'flower', 'fruit', 'bark', 'auto');
  if v_bad_rows > 0 then
    raise exception
      'F3 aborted: % row(s) in public.identification_cache hold organ values outside the canonical set (leaf/flower/fruit/bark/auto). Schema unchanged. Owner decision required before this migration can proceed.',
      v_bad_rows;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [A1] VERIFY the identifications.organ CHECK through the catalogs
--
-- The legacy constraint was defined UNNAMED inline in migration 000, so
-- PostgreSQL auto-named it <table>_<column>_check = identifications_organ_check
-- (deterministic for a single unnamed check on that column). We do NOT hardcode
-- that assumption: the constraint is located by CONTENT (any CHECK constraint
-- on public.identifications whose definition references the organ column) and
-- must match EXACTLY ONE such constraint. Expected legacy value set:
-- flower, leaf, lateral, root, auto — verified as:
--   * 'lateral' AND 'root' present   (legacy values still listed)
--   * 'flower', 'leaf', 'auto' present
--   * 'fruit' AND 'bark' ABSENT      (the values this migration adds)
-- Any deviation → hard abort, schema unchanged.
-- ROLLBACK IMPLICATION: none yet (no DDL executed in this block).
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_count integer;
  v_name text;
  v_definition text;
begin
  select count(*), min(conname), min(pg_get_constraintdef(oid))
    into v_count, v_name, v_definition
  from pg_constraint
  where conrelid = 'public.identifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ~ '\morgan\M';

  if v_count is distinct from 1 then
    raise exception
      'F3 aborted: expected exactly 1 organ CHECK constraint on public.identifications, found % (%). Schema unchanged.',
      v_count,
      coalesce((select string_agg(conname, ', ') from pg_constraint
                where conrelid = 'public.identifications'::regclass
                  and contype = 'c'
                  and pg_get_constraintdef(oid) ~ '\morgan\M'), 'none');
  end if;

  if (v_definition !~ '\mlateral\M'
      or v_definition !~ '\mroot\M'
      or v_definition !~ '\mflower\M'
      or v_definition !~ '\mleaf\M'
      or v_definition !~ '\mauto\M'
      or v_definition ~ '\mfruit\M'
      or v_definition ~ '\mbark\M') then
    raise exception
      'F3 aborted: organ CHECK on public.identifications does not match the expected legacy value set (flower, leaf, lateral, root, auto). Definition: %',
      v_definition;
  end if;

  raise notice 'F3: verified legacy organ CHECK on identifications: % (%)', v_name, v_definition;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [B1] VERIFY identification_cache has NO organ CHECK yet
--
-- The owner-approved design adds the canonical CHECK to this table in this
-- migration; it must not already carry one (that would indicate an unexpected
-- schema state). Any existing organ-referencing CHECK here → hard abort.
-- ROLLBACK IMPLICATION: none yet.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_constraint
  where conrelid = 'public.identification_cache'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ~ '\morgan\M';

  if v_count <> 0 then
    raise exception
      'F3 aborted: public.identification_cache already has % organ-referencing CHECK constraint(s) — unexpected state, schema unchanged.',
      v_count;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [C1] VERIFY the project column defaults are still the legacy 'allplants'
--
-- Guards against running 005 on a schema where the defaults were already
-- changed by other means (which would be an unexpected state per the
-- owner-approved preflight). Column presence is verified implicitly: a missing
-- column yields a NULL default → abort.
-- ROLLBACK IMPLICATION: none yet.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_ident_default text;
  v_cache_default text;
begin
  select column_default into v_ident_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'identifications'
    and column_name = 'project';

  select column_default into v_cache_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'identification_cache'
    and column_name = 'project';

  -- The default expression may be rendered with or without a type cast
  -- depending on tooling; a substring check tolerates both spellings while
  -- still rejecting anything that is not the legacy 'allplants' default.
  -- (Two separate IFs on purpose: SQL does not guarantee OR short-circuit
  -- evaluation, and position(<null>) = 0 evaluates to NULL — an implicit
  -- pass. Explicit sequencing makes the NULL case an unconditional abort.)
  if v_ident_default is null then
    raise exception
      'F3 aborted: identifications.project column or its default not found (missing column or no default). Schema unchanged.';
  end if;
  if position('allplants' in v_ident_default) = 0 then
    raise exception
      'F3 aborted: identifications.project default is not the expected legacy ''allplants'' (found: %). Schema unchanged.',
      v_ident_default;
  end if;

  if v_cache_default is null then
    raise exception
      'F3 aborted: identification_cache.project column or its default not found (missing column or no default). Schema unchanged.';
  end if;
  if position('allplants' in v_cache_default) = 0 then
    raise exception
      'F3 aborted: identification_cache.project default is not the expected legacy ''allplants'' (found: %). Schema unchanged.',
      v_cache_default;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [A2] SWAP the identifications.organ CHECK (legacy → canonical)
--
-- The constraint name resolved in [A1] is reused verbatim (it is NOT hardcoded
-- here), so the name round-trips: forward uses the auto-generated name, and a
-- rollback can re-add the legacy set under the same name. Dropping and re-adding
-- a CHECK constraint re-validates existing rows — safe because [0] proved every
-- row already satisfies the canonical set. No index, RLS policy, grant, trigger,
-- or function references this constraint (verified against migrations 001–004
-- during preflight), so the drop affects nothing else.
-- ROLLBACK IMPLICATION: reversible via the documented rollback SQL (drop
-- canonical CHECK, re-add legacy set) — provided no 'fruit'/'bark' rows have
-- accumulated in the meantime (else: owner data decision first).
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.identifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ~ '\morgan\M';

  execute format('alter table public.identifications drop constraint %I', v_name);

  execute format(
    'alter table public.identifications add constraint %I check (organ in (''leaf'', ''flower'', ''fruit'', ''bark'', ''auto''))',
    v_name
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [B2] ADD the canonical organ CHECK to identification_cache
--
-- Uses the standard auto-generated name (identification_cache_organ_check —
-- unnamed inline form, mirroring how 000 named the identifications constraint).
-- [0] already proved every existing row satisfies the canonical set, so the
-- validation pass cannot fail. Existing unique index identification_cache_key_idx
-- (p_hash, project, organ) and all other indexes/policies are untouched.
-- ROLLBACK IMPLICATION: reverse = drop constraint identification_cache_organ_check
-- (no row-state precondition).
-- ────────────────────────────────────────────────────────────────────────────
alter table public.identification_cache
  add check (organ in ('leaf', 'flower', 'fruit', 'bark', 'auto'));

-- ────────────────────────────────────────────────────────────────────────────
-- [C2] CHANGE the two project column defaults 'allplants' → 'all'
--
-- Metadata-only: existing rows are NEVER rewritten; only future inserts that
-- OMIT project pick up the new default. The application (Stage F1/F2) always
-- writes project = "all" explicitly, so neither the old nor the new default is
-- ever exercised by the app — this change makes the schema default honest
-- relative to the verified upstream contract. The unique cache key
-- (p_hash, project, organ) is unaffected.
-- ROLLBACK IMPLICATION: reverse = set both defaults back to 'allplants'
-- (unconditional — no row-state precondition; existing rows untouched).
-- ────────────────────────────────────────────────────────────────────────────
alter table public.identifications      alter column project set default 'all';
alter table public.identification_cache alter column project set default 'all';
-- (no COMMIT here — the migration runner's transaction wrapper commits the
-- file atomically; see the TRANSACTION CONTROL note at the top of this file)
