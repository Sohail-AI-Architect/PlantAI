# =====================================================================
# PlantAI - is_admin() EXECUTE-privilege READ-ONLY check (v2)
# ---------------------------------------------------------------------
# Purpose : Determine whether the anon role can execute
#           public.is_admin() (catalog inspection + a live, rolled-back
#           anon simulation; resolves R1 from PRE_MIGRATION_SAFETY_REVIEW.md).
# Run by  : the OWNER, one line:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\supersohail\PlantAI\scripts\check-isadmin-acl.ps1"
# Security: password prompted masked; passed into the psql container
#   via docker env passthrough (`-e PGPASSWORD` with no inline value);
#   removed + zeroed + disposed in finally. No credentials in file.
# Read-only: SELECT / has_function_privilege / BEGIN-ROLLBACK only.
#   The anon simulation runs inside an explicit transaction and rolls
#   back, so nothing persists. NO grants changed.
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
Write-Host '== is_admin() ACL read-only check v2 (target plantai-dev, host hidden) ==' -ForegroundColor Cyan

$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGPASSWORD = $plain
    $plain = $null

    $sql = @'
\echo == is_admin() ACL (proacl; NULL = default = PUBLIC has EXECUTE) ==
select p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_admin';
\echo == has_function_privilege verdicts ==
select
  has_function_privilege('anon',          'public.is_admin()', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('public',        'public.is_admin()', 'EXECUTE') as public_can_execute;
\echo == live anon simulation inside an explicit transaction (ROLLS BACK, changes nothing) ==
begin;
set local role anon;
select current_user as session_role,
       has_function_privilege(current_user, 'public.is_admin()', 'EXECUTE') as anon_can_execute,
       public.is_admin() as is_admin_result_for_anon;
rollback;
\echo == confirm rollback left no state (session role back to owner) ==
select current_user as session_role_after_rollback;
'@
    $sql | & docker run --rm -i `
        -e PGPASSWORD `
        -e PGHOST=$pgHost -e PGPORT=$pgPort -e PGUSER=$pgUser -e PGDATABASE=$pgDb -e PGSSLMODE=require `
        postgres:17-alpine psql -v ON_ERROR_STOP=1 -X
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
Write-Host 'Paste the entire output to the agent.'
