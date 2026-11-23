# =====================================================================
# PlantAI - Data API privilege audit (READ-ONLY)
# ---------------------------------------------------------------------
# Purpose : Inspect actual table / schema / sequence / function
#           privileges for anon, authenticated, service_role on the 10
#           public tables, so the least-privilege GRANT plan can be
#           confirmed before anything is granted or exposed.
# Run by  : the OWNER, one line:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\supersohail\PlantAI\scripts\api-privilege-audit.ps1"
# Security: same masked-password pattern as previous scripts.
# Read-only: every statement is SELECT. NO GRANT/REVOKE/DDL/DML.
# =====================================================================

$ErrorActionPreference = 'Continue'
$projectRoot = 'C:\Users\supersohail\PlantAI'
Set-Location $projectRoot

$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
if ($ref -ne 'qdcirgpzuwnarwqehtmo') { Write-Host 'FAIL: unexpected linked target.' -ForegroundColor Red; exit 1 }

$poolerUrl = (Get-Content (Join-Path $projectRoot 'supabase\.temp\pooler-url') -Raw).Trim()
$u = [uri]$poolerUrl
$pgHost = $u.Host; $pgPort = if ($u.Port -gt 0) { $u.Port } else { 5432 }
$pgUser = "postgres.$ref"; $pgDb = 'postgres'
Write-Host '== Data API privilege audit (target plantai-dev, host hidden, READ-ONLY) ==' -ForegroundColor Cyan

$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGPASSWORD = $plain
    $plain = $null

    $sql = @'
\echo == 1. table ACL (raw relacl) for the 10 public tables ==
select c.relname as table_name, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
\echo == 2. has_table_privilege matrix (t = granted) ==
select t.tablename,
  has_table_privilege('anon', 'public.' || t.tablename, 'SELECT')    as anon_sel,
  has_table_privilege('anon', 'public.' || t.tablename, 'INSERT')    as anon_ins,
  has_table_privilege('authenticated', 'public.' || t.tablename, 'SELECT') as auth_sel,
  has_table_privilege('authenticated', 'public.' || t.tablename, 'INSERT') as auth_ins,
  has_table_privilege('authenticated', 'public.' || t.tablename, 'UPDATE') as auth_upd,
  has_table_privilege('authenticated', 'public.' || t.tablename, 'DELETE') as auth_del,
  has_table_privilege('service_role', 'public.' || t.tablename, 'SELECT')  as svc_sel,
  has_table_privilege('service_role', 'public.' || t.tablename, 'INSERT')  as svc_ins
from pg_tables t where t.schemaname = 'public' order by t.tablename;
\echo == 3. default privileges (what NEW postgres objects in public receive) ==
select
  case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' end as object_type,
  a.grantee::regrole as role,
  string_agg(a.privilege_type, ', ' order by a.privilege_type) as privileges
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) a
where d.defaclrole = 'postgres'::regrole
  and d.defaclnamespace = 'public'::regnamespace
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
group by 1, 2 order by 1, 2;
\echo == 4. schema USAGE privileges ==
select 'anon' as role, has_schema_privilege('anon', 'public', 'USAGE') as usage_ok
union all select 'authenticated', has_schema_privilege('authenticated', 'public', 'USAGE')
union all select 'service_role', has_schema_privilege('service_role', 'public', 'USAGE');
\echo == 5. sequences in public (expect none - uuid primary keys) ==
select sequencename from pg_sequences where schemaname = 'public';
\echo == 6. function ACLs for the 6 application functions ==
select p.proname as function_name, p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;
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
Write-Host 'Audit complete - paste the ENTIRE output to the agent.'
