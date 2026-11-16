# =====================================================================
# PlantAI - Data API REST smoke tests (READ-ONLY) - v2
# ---------------------------------------------------------------------
# Purpose : Verify public REST exposure after the approved privilege
#           configuration. READ-ONLY GET requests only.
# Tests   :
#   1. GET /rest/v1/plant_library?select=slug      -> expect HTTP 200, 10 rows,
#                                                     10 DISTINCT slugs
#   2. GET /rest/v1/identification_cache?select=*  -> expect non-200 with
#                                                     PostgreSQL code 42501
# v2 fix  : v1 counted `$r.Content | ConvertFrom-Json` through the
#           pipeline, which can collapse the deserialized array in
#           Windows PowerShell 5.1. v2 parses with
#           `ConvertFrom-Json -InputObject` (single-string parameter
#           form, no pipeline), counts via @(), and counts DISTINCT
#           slugs explicitly. Diagnostic prints the Content-Type only.
# Note    : the anonymous contact_messages INSERT smoke test is
#           deliberately NOT here - it creates a persistent record and
#           requires separate owner approval.
# Security: publishable key is read from .env.local and used ONLY in
#           request headers; it is never printed or echoed.
# Run by  : the OWNER or the agent (no password needed):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\welsohail\PlantAI\scripts\api-rest-smoke.ps1"
# =====================================================================

$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\welsohail\PlantAI'
Set-Location $projectRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ref = (Get-Content (Join-Path $projectRoot 'supabase\.temp\project-ref') -Raw).Trim()
if ($ref -ne 'qdcirgpzuwnarwqehtmo') { Write-Host "FAIL: unexpected ref '$ref'." -ForegroundColor Red; exit 1 }

# --- load publishable key without displaying it ----------------------
$key = $null
foreach ($line in Get-Content (Join-Path $projectRoot '.env.local')) {
    if ($line -match '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)$') {
        $key = $Matches[1].Trim().Trim('"').Trim("'")
        break
    }
}
if (-not $key) { Write-Host 'FAIL: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not found in .env.local.' -ForegroundColor Red; exit 1 }
Write-Host 'Publishable key loaded (value hidden).'
Write-Host '== REST smoke tests v2 (READ-ONLY GETs, target plantai-dev) ==' -ForegroundColor Cyan

$base = "https://$ref.supabase.co/rest/v1"
$headers = @{ apikey = $key; Authorization = "Bearer $key" }

# --- Test 1: plant_library anonymous read (expect 200 + 10 rows) -----
try {
    $r = Invoke-WebRequest -Uri "$base/plant_library?select=slug" -Headers $headers -UseBasicParsing
    Write-Host "TEST 1 plant_library : HTTP $($r.StatusCode)  (Content-Type: $($r.Headers['Content-Type']))"
    $parsed    = ConvertFrom-Json -InputObject $r.Content
    $parsed    = @($parsed)
    $slugs     = @($parsed | ForEach-Object { $_.slug })
    $distinct  = @($slugs | Sort-Object -Unique)
    Write-Host "  rows returned      : $($parsed.Count)"
    Write-Host "  non-empty slugs    : $(@($slugs | Where-Object { $_ }).Count)"
    Write-Host "  DISTINCT slugs     : $($distinct.Count)"
    Write-Host "  slugs (public data): $($distinct -join ', ')"
    if ($parsed.Count -eq 10 -and $distinct.Count -eq 10) {
        Write-Host '  TEST 1 VERDICT: PASS (exactly 10 rows, 10 distinct slugs)' -ForegroundColor Green
    } else {
        Write-Host '  TEST 1 VERDICT: MISMATCH - paste this output' -ForegroundColor Red
    }
} catch {
    $code = try { $_.Exception.Response.StatusCode.value__ } catch { '?' }
    Write-Host "TEST 1 plant_library : FAILED - HTTP $code (paste this output)" -ForegroundColor Red
}

# --- Test 2: identification_cache anonymous read (expect denial) -----
try {
    $r = Invoke-WebRequest -Uri "$base/identification_cache?select=*" -Headers $headers -UseBasicParsing
    Write-Host "TEST 2 identification_cache : UNEXPECTED HTTP $($r.StatusCode) - table is readable anonymously! Paste this output." -ForegroundColor Red
} catch {
    $httpCode = try { $_.Exception.Response.StatusCode.value__ } catch { '?' }
    $body = ''
    try {
        $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
    } catch { }
    $pgCode = $null
    try { $pgCode = (ConvertFrom-Json -InputObject $body).code } catch { }
    Write-Host "TEST 2 identification_cache : HTTP $httpCode (expected: non-200 denial)"
    Write-Host "  PostgreSQL error code : $pgCode (expected: 42501)"
    if ($pgCode -eq '42501') {
        Write-Host '  TEST 2 VERDICT: PASS (permission denied, code 42501 - server-only table sealed)' -ForegroundColor Green
    } else {
        Write-Host "  body: $body"
        Write-Host '  TEST 2 VERDICT: UNEXPECTED - paste this output' -ForegroundColor Red
    }
}

Write-Host 'Reminder: Dashboard - Integrations - Data API - Settings - "Automatically expose new tables" must remain OFF (visual check, no change).'
Write-Host 'Paste the ENTIRE output to the agent.'
