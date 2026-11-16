# =====================================================================
# PlantAI - post-hardening privilege verification (READ-ONLY)
# ---------------------------------------------------------------------
# Purpose : Assert the exact end state of DATA_API_PRIVILEGE_HARDENING_PLAN.md
#           AFTER the owner runs the approved GRANT/REVOKE block:
#             - DML matrix per plan §3
#             - TRUNCATE/REFERENCES/TRIGGER/MAINTAIN = false for
#               anon/authenticated/service_role on all 10 tables
#             - default privileges for future tables = none for the 3 roles
#             - RLS enabled + forced on all 10 tables
#             - rolbypassrls facts
# Run by  : the OWNER, one line (AFTER the SQL block is applied):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\welsohail\PlantAI\scripts\api-grant-verify.ps1"
# Security: same masked-password pattern as previous scripts.
# Read-only: every statement is SELECT. NO GRANT/REVOKE/DDL/DML.
# =====================================================================

$ErrorActionPreference = 'Continue'
$projectRoot = 'C:\Users\welsohail\PlantAI'
Set-Location $projectRoot

$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
if ($ref -ne 'qdcirgpzuwnarwqehtmo') { Write-Host 'FAIL: unexpected linked target.' -ForegroundColor Red; exit 1 }

$poolerUrl = (Get-Content (Join-Path $projectRoot 'supabase\.temp\pooler-url') -Raw).Trim()
$u = [uri]$poolerUrl
$pgHost = $u.Host; $pgPort = if ($u.Port -gt 0) { $u.Port } else { 5432 }
$pgUser = "postgres.$ref"; $pgDb = 'postgres'
Write-Host '== Post-hardening privilege verification (target plantai-dev, host hidden, READ-ONLY) ==' -ForegroundColor Cyan

$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGPASSWORD = $plain
    $plain = $null

    $sql = @'
\echo == 1. DML matrix (expect per plan: plant_library/blog_posts/app_settings = anon sel + auth CRUD; profiles = auth sel+upd; identifications = auth sel + svc CRUD; user_plants/care_reminders = auth+svc CRUD; saved_plants = auth+svc sel/ins/del; contact_messages = anon+auth ins, auth+svc sel+upd; identification_cache = svc CRUD only) ==
select t.tablename,
  has_table_privilege('anon','public.'||t.tablename,'SELECT')  as anon_sel,
  has_table_privilege('anon','public.'||t.tablename,'INSERT')  as anon_ins,
  has_table_privilege('authenticated','public.'||t.tablename,'SELECT') as auth_sel,
  has_table_privilege('authenticated','public.'||t.tablename,'INSERT') as auth_ins,
  has_table_privilege('authenticated','public.'||t.tablename,'UPDATE') as auth_upd,
  has_table_privilege('authenticated','public.'||t.tablename,'DELETE') as auth_del,
  has_table_privilege('service_role','public.'||t.tablename,'SELECT')  as svc_sel,
  has_table_privilege('service_role','public.'||t.tablename,'INSERT')  as svc_ins,
  has_table_privilege('service_role','public.'||t.tablename,'UPDATE')  as svc_upd,
  has_table_privilege('service_role','public.'||t.tablename,'DELETE')  as svc_del
from pg_tables t where t.schemaname = 'public' order by t.tablename;
\echo == 2. non-DML privileges (EXPECT ALL FALSE) ==
select t.tablename,
  has_table_privilege('anon','public.'||t.tablename,'TRUNCATE')    as anon_trunc,
  has_table_privilege('anon','public.'||t.tablename,'REFERENCES')  as anon_ref,
  has_table_privilege('anon','public.'||t.tablename,'TRIGGER')     as anon_trig,
  has_table_privilege('anon','public.'||t.tablename,'MAINTAIN')    as anon_maint,
  has_table_privilege('authenticated','public.'||t.tablename,'TRUNCATE')   as auth_trunc,
  has_table_privilege('authenticated','public.'||t.tablename,'REFERENCES') as auth_ref,
  has_table_privilege('authenticated','public.'||t.tablename,'TRIGGER')    as auth_trig,
  has_table_privilege('authenticated','public.'||t.tablename,'MAINTAIN')   as auth_maint,
  has_table_privilege('service_role','public.'||t.tablename,'TRUNCATE')    as svc_trunc,
  has_table_privilege('service_role','public.'||t.tablename,'REFERENCES')  as svc_ref,
  has_table_privilege('service_role','public.'||t.tablename,'TRIGGER')     as svc_trig,
  has_table_privilege('service_role','public.'||t.tablename,'MAINTAIN')    as svc_maint
from pg_tables t where t.schemaname = 'public' order by t.tablename;
\echo == 3. default privileges for future tables (EXPECT NO ROWS for the 3 API roles) ==
select d.defaclrole::regrole as granting_role, a.grantee::regrole as grantee,
       string_agg(a.privilege_type, ', ' order by a.privilege_type) as privileges
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) a
where d.defaclnamespace = 'public'::regnamespace
  and d.defaclobjtype = 'r'
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
group by 1, 2 order by 1, 2;
\echo == 4. RLS enabled + forced (EXPECT 10 ROWS, BOTH TRUE) ==
select c.relname, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
\echo == 5. role RLS-bypass facts (EXPECT postgres true, service_role true, anon/authenticated false) ==
select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname in ('anon','authenticated','service_role','postgres')
order by rolname;
\echo == 6. schema USAGE (EXPECT ALL TRUE) ==
select has_schema_privilege('anon','public','USAGE') as anon_usage,
       has_schema_privilege('authenticated','public','USAGE') as auth_usage,
       has_schema_privilege('service_role','public','USAGE') as svc_usage;
'@
    $sql | & docker run --rm -i `
        -e PGPASSWORD `
        -e PGHOST=$pgHost -e PGPORT=$pgPort -e PGUSER=$pgUser -e PGDATABASE=$pgDb -e PGSSLMODE=require `
        postgres:17-alpine psql -v ON_ERROR_STOP=0 -X
    Write-Host "(psql exit code: $LASTEXITCODE)"
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
Write-Host 'Verification complete - paste the ENTIRE output to the agent.'
