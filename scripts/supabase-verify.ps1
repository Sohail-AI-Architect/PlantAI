# =====================================================================
# PlantAI - Post-migration READ-ONLY verification helper (v2)
# ---------------------------------------------------------------------
# Purpose : Verify the applied migrations on plantai-dev without any
#           write operations:
#             0) read-only connection test (SELECT current_user, ...)
#             1) npx supabase migration list --remote
#             2) read-only catalog queries (tables, RLS, functions,
#                triggers, buckets, seed counts, role properties)
# Run by  : the OWNER, one line:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\welsohail\PlantAI\scripts\supabase-verify.ps1"
# Pooler  : shared Supavisor session pooler, port 5432, database
#           postgres, and the SCOPED username postgres.<project-ref>
#           (plain "postgres" is NOT valid on the shared pooler).
# Security: database password prompted masked (Read-Host
#   -AsSecureString); set as HOST environment variables named
#   SUPABASE_DB_PASSWORD (for the CLI) and PGPASSWORD (passed into the
#   psql container via docker's env passthrough `-e PGPASSWORD` with
#   no inline value). The password never appears in a command line,
#   output, or file. Both env vars are removed, the BSTR is zeroed,
#   and the SecureString is disposed in finally. No credentials here.
# Read-only: every SQL statement is SELECT. No push, no DDL, no DML.
# =====================================================================

$ErrorActionPreference = 'Continue'
$projectRoot = 'C:\Users\welsohail\PlantAI'
Set-Location $projectRoot

Write-Host '== PlantAI post-migration READ-ONLY verification (v2) ==' -ForegroundColor Cyan

# ---- 1. Linked target must be plantai-dev ----------------------------
$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
$linked = (Get-Content (Join-Path $projectRoot 'supabase\.temp\linked-project.json') -Raw | ConvertFrom-Json).name
if ($ref -ne 'qdcirgpzuwnarwqehtmo' -or $linked -ne 'plantai-dev') {
    Write-Host "FAIL: linked target is '$linked' ('$ref') - expected plantai-dev." -ForegroundColor Red
    exit 1
}
Write-Host 'OK: target is plantai-dev (qdcirgpzuwnarwqehtmo)'

# ---- 2. Pooler connection parameters ---------------------------------
# Shared pooler REQUIRES the scoped username: postgres.<project-ref>.
$pgUser = "postgres.$ref"
$pgDb = 'postgres'
$pgPort = 5432
# Host: taken from the saved pooler configuration (never printed).
$poolerUrl = (Get-Content (Join-Path $projectRoot 'supabase\.temp\pooler-url') -Raw).Trim()
try {
    $u = [uri]$poolerUrl
    $pgHost = $u.Host
    if ($u.Port -gt 0) { $pgPort = $u.Port }
    # Cross-check: the saved config's username must equal the scoped username.
    if ($u.UserInfo -and $u.UserInfo -ne $pgUser) {
        Write-Host "FAIL: saved pooler username does not match the required scoped username - STOP." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host 'FAIL: could not parse the saved pooler configuration.' -ForegroundColor Red
    exit 1
}
if (-not $pgHost -or $pgHost -notmatch '\.pooler\.supabase\.com$') {
    Write-Host 'FAIL: pooler host missing or unexpected - STOP.' -ForegroundColor Red
    exit 1
}
Write-Host 'OK: pooler parameters loaded (scoped username postgres.<ref>, host hidden, TLS required)'

# ---- 3. Masked password + verification + secure cleanup --------------
$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
$cliCode = 0
$psqlCode = 0
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:SUPABASE_DB_PASSWORD = $plain   # consumed by the Supabase CLI
    $env:PGPASSWORD = $plain             # passed into the container via `-e PGPASSWORD` (host-env passthrough, no inline value)
    $plain = $null

    # ---- 0. Read-only connection test (must succeed before anything else) ----
    Write-Host ''
    Write-Host '=== 0. Connection test (read-only) ===' -ForegroundColor Cyan
    'SELECT current_user, current_database();' | & docker run --rm -i `
        -e PGPASSWORD `
        -e PGHOST=$pgHost -e PGPORT=$pgPort -e PGUSER=$pgUser -e PGDATABASE=$pgDb -e PGSSLMODE=require `
        postgres:17-alpine psql -v ON_ERROR_STOP=1 -X -t
    $testCode = $LASTEXITCODE
    if ($testCode -ne 0) {
        Write-Host "FAIL: connection test failed (exit $testCode). Stopping - no retries, no password resets." -ForegroundColor Red
        Write-Host 'Check: the password typed must be the plantai-dev PostgreSQL database password (from Supabase dashboard > Database or the password used for the earlier dump).'
        exit $testCode
    }
    Write-Host 'OK: connection test passed.' -ForegroundColor Green

    # ---- 1. Remote migration history (CLI, read-only) ----
    Write-Host ''
    Write-Host '=== A. Remote migration history (CLI, read-only) ===' -ForegroundColor Cyan
    & npx supabase migration list --remote
    $cliCode = $LASTEXITCODE
    Write-Host "(migration list exit code: $cliCode)"

    # ---- 2. Catalog inspection (psql, SELECT-only, via Docker) ----
    Write-Host ''
    Write-Host '=== B. Catalog inspection (psql, SELECT-only, via Docker) ===' -ForegroundColor Cyan
    $queries = @'
\echo == 1. public tables (expect 10) ==
select tablename as table_name from pg_tables where schemaname = 'public' order by tablename;
\echo == 2. RLS status (rls + force columns) ==
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
\echo == 3. public functions (expect is_admin, touch_updated_at, guard_profile_role, handle_new_user, care_reminders_owner_check, care_reminders_complete_advance) ==
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;
\echo == 4. triggers on public tables ==
select c.relname as table_name, t.tgname as trigger_name, t.tgenabled as enabled
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal order by c.relname, t.tgname;
\echo == 5. auth.users trigger (expect 1 row) ==
select t.tgname as trigger_name from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'trg_on_auth_user_created' and not t.tgisinternal;
\echo == 6. storage buckets (expect request-images false, plant-images true) ==
select id, name, public from storage.buckets order by id;
\echo == 7. seed count: plant_library (expect 10) ==
select count(*) as plant_library_rows from public.plant_library;
\echo == 8. seed count: app_settings (expect 8) ==
select count(*) as app_settings_rows from public.app_settings;
\echo == 9. enums (expect 5) ==
select t.typname as enum_name from pg_type t join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typtype = 'e' order by t.typname;
\echo == 10. postgres role capabilities (informs FORCE-RLS behavior) ==
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = 'postgres';
'@
    $queries | & docker run --rm -i `
        -e PGPASSWORD `
        -e PGHOST=$pgHost -e PGPORT=$pgPort -e PGUSER=$pgUser -e PGDATABASE=$pgDb -e PGSSLMODE=require `
        postgres:17-alpine psql -v ON_ERROR_STOP=0 -X
    $psqlCode = $LASTEXITCODE
    Write-Host "(psql exit code: $psqlCode)"
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($secure -is [System.Security.SecureString]) { $secure.Dispose() }
    $secure = $null
    $bstr = $null
    Write-Host ''
    Write-Host 'Security cleanup: SUPABASE_DB_PASSWORD + PGPASSWORD removed, BSTR zeroed, SecureString disposed.'
}

Write-Host 'Verification complete - paste the ENTIRE output to the agent.'
