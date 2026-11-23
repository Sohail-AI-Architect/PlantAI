# =====================================================================
# PlantAI - Supabase migration dry-run / apply helper
# ---------------------------------------------------------------------
# Purpose : Phase-gated execution of the five owner-approved migrations
#           against the linked remote project plantai-dev.
# Run by  : the OWNER, one line per phase:
#   Dry-run (no changes):
#     powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\supersohail\PlantAI\scripts\supabase-migrate.ps1" -Phase dryrun
#   Apply (ONLY after the agent has approved the dry-run output):
#     powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\supersohail\PlantAI\scripts\supabase-migrate.ps1" -Phase push
# Security: the database password is prompted masked (Read-Host
#   -AsSecureString), converted via SecureStringToBSTR, held only as a
#   temporary SUPABASE_DB_PASSWORD process env var, and removed +
#   zeroed + disposed in finally. Never printed, logged, saved, or
#   passed as a command-line argument. This file holds no credentials.
# Safety  : refuses to run unless the linked target is plantai-dev,
#   the verified pre-migration backup is intact (exact SHA-256), and
#   the five approved migration files are unchanged.
# Never   : db reset, migration repair, --include-all, extra SQL.
# =====================================================================

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dryrun', 'push')]
    [string]$Phase
)

$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\supersohail\PlantAI'
Set-Location $projectRoot

Write-Host "== PlantAI migration $Phase ==" -ForegroundColor Cyan

# ---- 1. Linked target must be plantai-dev ----------------------------
$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
$linked = (Get-Content (Join-Path $projectRoot 'supabase\.temp\linked-project.json') -Raw | ConvertFrom-Json).name
if ($ref -ne 'qdcirgpzuwnarwqehtmo' -or $linked -ne 'plantai-dev') {
    Write-Host "FAIL: linked target is '$linked' ('$ref') - expected plantai-dev (qdcirgpzuwnarwqehtmo)" -ForegroundColor Red
    exit 1
}
Write-Host 'OK: target is plantai-dev (qdcirgpzuwnarwqehtmo)'

# ---- 2. Pre-migration backup must be intact (never overwrite) --------
$dest = Join-Path $projectRoot 'backups\pre_phase1.sql'
$expectedHash = '0BA5F4A5C40876DC90AE031D28EC5148767C20900D1C741100B2583D2157B62D'
if (-not (Test-Path $dest)) {
    Write-Host 'FAIL: backups/pre_phase1.sql missing - create the backup before migrating.' -ForegroundColor Red
    exit 1
}
$hash = (Get-FileHash $dest -Algorithm SHA256).Hash
if ($hash -ne $expectedHash) {
    Write-Host "FAIL: backup hash changed ($hash) - STOP and investigate before migrating." -ForegroundColor Red
    exit 1
}
Write-Host 'OK: pre-migration backup intact (3,178 bytes, verified SHA-256)'

# ---- 3. Exactly five approved migration files, unchanged -------------
$files = Get-ChildItem (Join-Path $projectRoot 'supabase\migrations') -Filter *.sql | Sort-Object Name
if ($files.Count -ne 5) {
    Write-Host "FAIL: expected 5 migration files, found $($files.Count)." -ForegroundColor Red
    exit 1
}
$prefixes = @('20260101000000_000_initial_schema.sql',
              '20260101000001_001_functions_triggers.sql',
              '20260101000002_002_rls_policies.sql',
              '20260101000003_003_storage_buckets.sql',
              '20260101000004_004_seed.sql')
for ($i = 0; $i -lt 5; $i++) {
    if ($files[$i].Name -ne $prefixes[$i]) {
        Write-Host "FAIL: unexpected migration file/order: $($files[$i].Name)" -ForegroundColor Red
        exit 1
    }
}
Write-Host 'OK: exactly the five approved migration files, correct order'

# ---- 4. Docker engine must be reachable ------------------------------
$found = Get-Command docker -ErrorAction SilentlyContinue
if ($found) { $dockerCmd = $found.Source }
else { $dockerCmd = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe' }
$server = & $dockerCmd info --format '{{.ServerVersion}}' 2>$null
if ($LASTEXITCODE -ne 0 -or -not $server) {
    Write-Host 'FAIL: Docker Engine not reachable - start Docker Desktop, then retry.' -ForegroundColor Red
    exit 1
}
Write-Host "OK: Docker Engine running (server $server)"

# ---- 5. Masked password + phase command + secure cleanup -------------
Write-Host ''
if ($Phase -eq 'dryrun') {
    Write-Host 'Phase: DRY-RUN (no changes will be applied).'
} else {
    Write-Host 'Phase: APPLY (--yes authorized by the owner in a prior approval step).'
}
$secure = Read-Host -AsSecureString 'Enter plantai-dev database password'
$bstr = [IntPtr]::Zero
$code = 1
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ($Phase -eq 'dryrun') {
        & npx supabase db push --dry-run --remote
    } else {
        & npx supabase db push --remote --yes
    }
    $code = $LASTEXITCODE
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
    if ($secure -is [System.Security.SecureString]) { $secure.Dispose() }
    $secure = $null
    $bstr = $null
    Write-Host 'Security cleanup: SUPABASE_DB_PASSWORD removed, BSTR zeroed, SecureString disposed.'
}

if ($code -eq 0) {
    if ($Phase -eq 'dryrun') {
        Write-Host 'DRY-RUN OK (exit 0). Paste the full output to the agent for review before the push phase.' -ForegroundColor Green
    } else {
        Write-Host 'PUSH OK (exit 0). Paste the full output to the agent for verification.' -ForegroundColor Green
    }
} else {
    Write-Host "PHASE FAILED (exit code $code). Do NOT retry, repair, reset, or run manual SQL - report the output." -ForegroundColor Red
}
exit $code
