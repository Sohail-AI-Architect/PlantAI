# =====================================================================
# PlantAI - approved Data API privilege configuration (Steps 1-3)
# ---------------------------------------------------------------------
# Authorization: explicit owner approval 2026-11-11, covering exactly
#   Steps 1, 2, 3 of DATA_API_PRIVILEGE_HARDENING_PLAN.md. Step 4
#   (schema USAGE) is SKIPPED - audit confirmed USAGE=true already.
# Target : plantai-dev (qdcirgpzuwnarwqehtmo) - verified before anything runs.
# Safety :
#   - Backup integrity checked BEFORE password prompt (SHA-256 pinned).
#   - SQL pre-checks abort (before BEGIN) unless exactly 10 public
#     tables exist, all RLS enabled+forced, and no views/matviews exist.
#   - BEFORE/AFTER relacl snapshots printed for rollback reference.
#   - One transaction: BEGIN ... COMMIT with ON_ERROR_STOP=1. If any
#     statement fails, psql stops and NO COMMIT is sent, so the server
#     rolls back automatically when the session ends. NO retry logic.
# Security: masked password (Read-Host -AsSecureString -> BSTR ->
#   temporary PGPASSWORD env passthrough into the psql container);
#   removed + zeroed + disposed in finally. No secrets in this file.
# Read-only guidance: the only write statements below are the 17
#   owner-approved statements (1 REVOKE + 15 GRANT + 1 ALTER DEFAULT
#   PRIVILEGES). Nothing else.
# =====================================================================

$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\supersohail\PlantAI'
Set-Location $projectRoot
$expectedRef = 'qdcirgpzuwnarwqehtmo'
$expectedBackupHash = '0BA5F4A5C40876DC90AE031D28EC5148767C20900D1C741100B2583D2157B62D'

# --- local pre-checks (fail fast, before any password prompt) --------
$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
if ($ref -ne $expectedRef) { Write-Host "FAIL: linked ref is '$ref', expected '$expectedRef'. Aborting." -ForegroundColor Red; exit 1 }

$backupHash = (Get-FileHash -Algorithm SHA256 (Join-Path $projectRoot 'backups\pre_phase1.sql')).Hash
Write-Host "Backup SHA-256: $backupHash"
if ($backupHash -ne $expectedBackupHash) { Write-Host 'FAIL: backup hash mismatch. Aborting.' -ForegroundColor Red; exit 1 }

if (-not (Test-Path (Join-Path $projectRoot 'DATA_API_PRIVILEGE_HARDENING_PLAN.md'))) { Write-Host 'FAIL: approved plan missing. Aborting.' -ForegroundColor Red; exit 1 }

$poolerUrl = (Get-Content (Join-Path $projectRoot 'supabase\.temp\pooler-url') -Raw).Trim()
$u = [uri]$poolerUrl
$pgHost = $u.Host; $pgPort = if ($u.Port -gt 0) { $u.Port } else { 5432 }
$pgUser = "postgres.$ref"; $pgDb = 'postgres'
Write-Host 'Local pre-checks PASS (ref, backup, plan). Using scoped session-pooler username (host hidden).' -ForegroundColor Green
Write-Host '== Approved Steps 1-3 execution (target plantai-dev, ONE transaction) ==' -ForegroundColor Cyan

$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGPASSWORD = $plain
    $plain = $null

    $sql = @'
\echo == PRE-CHECK 0: connection identity (must be the scoped owner role) ==
select current_user, current_database();
\echo == PRE-CHECK 1: exactly 10 public tables, no views/matviews/foreign tables, all RLS enabled+forced ==
do $chk$
declare
  tbls int; bad_rls int; extra int;
begin
  select count(*) into tbls from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r';
  if tbls <> 10 then raise exception 'PRECHECK FAIL: expected 10 public tables, found %', tbls; end if;
  select count(*) into extra from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v','m','f');
  if extra <> 0 then raise exception 'PRECHECK FAIL: % view-like objects in public', extra; end if;
  select count(*) into bad_rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not (c.relrowsecurity and c.relforcerowsecurity);
  if bad_rls <> 0 then raise exception 'PRECHECK FAIL: % tables without RLS enable+force', bad_rls; end if;
end
$chk$;
\echo == BEFORE STATE: relacl snapshot (rollback/reference record) ==
select c.relname as table_name, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
\echo == APPLYING THE 17 APPROVED STATEMENTS IN ONE TRANSACTION ==
begin;

-- Step 1: strip TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from the three API roles
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated, service_role;

-- Step 2: exact per-table grants (no GRANT ALL, nothing beyond the approved matrix)
grant select on public.plant_library to anon, authenticated, service_role;
grant insert, update, delete on public.plant_library to authenticated, service_role;
grant select on public.blog_posts to anon, authenticated, service_role;
grant insert, update, delete on public.blog_posts to authenticated, service_role;
grant select, update on public.profiles to authenticated, service_role;
grant select on public.identifications to authenticated, service_role;
grant insert, update, delete on public.identifications to service_role;
grant select, insert, update, delete on public.user_plants to authenticated, service_role;
grant select, insert, update, delete on public.care_reminders to authenticated, service_role;
grant select, insert, delete on public.saved_plants to authenticated, service_role;
grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated, service_role;
grant select on public.app_settings to anon, authenticated, service_role;
grant insert, update, delete on public.app_settings to authenticated, service_role;
grant select, insert, update, delete on public.identification_cache to service_role;

-- Step 3: future tables created by postgres start with ZERO API-role privileges
alter default privileges for role postgres in schema public
  revoke all on tables
  from anon, authenticated, service_role;

-- Step 4 (schema USAGE) intentionally SKIPPED - audit confirmed USAGE=true.
commit;
\echo == COMMIT DONE ==
\echo == AFTER STATE: relacl snapshot (new state of record) ==
select c.relname as table_name, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
\echo == AFTER STATE: future-table default privileges (granting role postgres) ==
select d.defaclrole::regrole as granting_role, a.grantee::regrole as grantee,
       string_agg(a.privilege_type, ', ' order by a.privilege_type) as privileges
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) a
where d.defaclnamespace = 'public'::regnamespace
  and d.defaclobjtype = 'r'
group by 1, 2 order by 1, 2;
'@
    $sql | & docker run --rm -i `
        -e PGPASSWORD `
        -e PGHOST=$pgHost -e PGPORT=$pgPort -e PGUSER=$pgUser -e PGDATABASE=$pgDb -e PGSSLMODE=require `
        postgres:17-alpine psql -v ON_ERROR_STOP=1 -X
    if ($LASTEXITCODE -ne 0) {
        Write-Host "PSQL EXIT CODE $LASTEXITCODE - if the failure was inside the transaction, NO COMMIT was sent and the server rolled back automatically. Paste the ENTIRE output; do NOT re-run." -ForegroundColor Red
    } else {
        Write-Host 'PSQL EXIT 0 - transaction committed.' -ForegroundColor Green
    }
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($secure -is [System.Security.SecureString]) { $secure.Dispose() }
    $secure = $null
    $bstr = $null
    Write-Host 'Security cleanup: PGPASSWORD removed, BSTR zeroed, SecureString disposed.'
}
Write-Host 'Paste the ENTIRE output to the agent.'
