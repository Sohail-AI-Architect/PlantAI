# PlantAI — Docker Desktop Pre-Installation Readiness Report

**Date:** 2026-11-11
**Task:** Read-only readiness check before installing Docker Desktop (needed to unblock the pre-migration schema backup `npx supabase db dump --remote -f backups/pre_phase1.sql`).
**Status:** ✅ **COMPATIBLE — installable with one prerequisite (WSL 2) and two caveats.** Nothing was installed or changed.

---

## 1. System compatibility

| Requirement (official Docker docs) | This machine | Verdict |
|---|---|---|
| Windows 10 64-bit: Enterprise / Pro / Education, **22H2 build 19045** | Windows 10 **Pro**, 22H2, build **19045.6466** | ✅ Exact match |
| 64-bit CPU with SLAT | Intel Core i3-5010U @ 2.10 GHz (Broadwell, 2c/4t, x64, Architecture code 9) | ✅ Broadwell supports SLAT/EPT in hardware. (CIM reported `VirtualizationFirmwareEnabled: False`, `SecondLevelAddressTranslationExtensions: False` — a known WMI quirk when a hypervisor is already running; see §3.) |
| 8 GB system RAM | **7.9 GB** reported (`Win32_ComputerSystem.TotalPhysicalMemory`) | ✅ Meets minimum (8 GB nominal; the 7.9 GB figure is GB/GiB rounding). **Tight** — see §4 |
| Windows Server service (LanmanServer) enabled/automatic | Standard Windows 10 Pro config; not separately probed (no indication of modification) | ⚠️ UNVERIFIED (routine; install itself will surface it if wrong) |

CPU is aging (2015-era, 2 cores / 4 threads), so builds and `pg_dump` container runs will be **slow but functional** — not a blocker.

## 2. Docker Desktop presence — confirmed absent

| Probe | Result |
|---|---|
| `docker` on PATH | ❌ not recognized |
| `C:\Program Files\Docker\Docker\Docker Desktop.exe` | ❌ absent |
| `C:\Program Files\Docker\Docker\resources\bin\docker.exe` | ❌ absent |
| `%LOCALAPPDATA%\Docker\Docker Desktop.exe` | ❌ absent |
| `com.docker.service` Windows service | ❌ not present |
| `\\.\pipe\docker_engine` named pipe | ❌ absent |
| Native `pg_dump` / `psql` on PATH | ❌ absent (no non-Docker fallback) |

## 3. Virtualization status

| Probe | Result | Interpretation |
|---|---|---|
| `Win32_ComputerSystem.HypervisorPresent` | **True** | A hypervisor is running. Hardware virtualization (VT-x) **must be enabled in BIOS/UEFI** for a hypervisor to be present — this is strong evidence BIOS virtualization is ON. |
| Services `vmcompute`, `HvHost`, `hns` | All **Running** | Host compute / hypervisor host / host network services active |
| `vmms` (Hyper-V management service) | not present | The full **Hyper-V feature is likely NOT enabled**; the running hypervisor is probably **Virtualization-Based Security / Core Isolation (Device Guard)** rather than Client Hyper-V |
| `bcdedit /enum {current}` → `hypervisorlaunchtype` | UNVERIFIED (requires elevation) | Owner can check in an admin terminal, or just proceed — the per-user WSL2 installer flow handles this |
| `Get-WindowsOptionalFeature` (Hyper-V, VirtualMachinePlatform, WSL, Containers states) | UNVERIFIED (requires elevation) | Not changed, per task restrictions |
| Device Guard registry (`EnableVirtualizationBasedSecurity`) | values empty → VBS **not explicitly enabled** by policy; state UNVERIFIED | Not a blocker for WSL 2 backend |

**Conclusion:** BIOS-level virtualization is almost certainly ON (hypervisor present). The Hyper-V *Windows feature* state is UNVERIFIED but irrelevant for the recommended WSL 2 backend path.

## 4. WSL 2 status — the one real prerequisite

| Probe | Result |
|---|---|
| `wsl --version` | Prints the old inbox usage help → **Store/modern WSL is NOT installed** |
| Store appx `WindowsSubsystemForLinux` | ❌ not installed |
| `wsl.exe` file version | 10.0.19041.3636 (legacy inbox binary, Windows 10 2004-era) |
| WSL 2 kernel / distros | None (`wsl -l -v` shows nothing usable) |

**Official Docker requirement (docs.docker.com, verified 2026-11-11):** the WSL 2 backend needs **WSL version ≥ 2.1.5**. The inbox WSL cannot be "updated in place" to a modern version without installing the Store/MSI package. Therefore:

> **WSL 2 must be installed before (or during) Docker Desktop setup.** This is a one-time, per-machine step that **requires administrator privileges** (`wsl --install` or `wsl --update` in an elevated terminal, or the MSI from github.com/microsoft/WSL/releases). It is free and Microsoft-official.

**Alternative if WSL 2 install fails:** Windows 10 **Pro** also supports the **Hyper-V backend** (all-users install; requires enabling the Hyper-V + Containers Windows features — admin, free). The hypervisor already running suggests this path would work, but it needs more setup; WSL 2 remains the recommended first choice.

## 5. RAM & disk

| Check | Value | Assessment |
|---|---|---|
| Total RAM | 7.9 GB | Meets the 8 GB minimum exactly. Docker's Linux VM + Supabase CLI's pg_dump tool container are lightweight (schema-only dump, no large images needed), so this is workable. Recommendation: cap Docker's memory usage (Settings → Resources, e.g. 2 GB) and avoid running heavy local stacks (`supabase start` full local cluster would be strained on 8 GB — not needed for `db dump`). |
| C: free space | **50.6 GB** free of 118.5 GB (67.9 GB used) | ✅ Ample. Docker Desktop installer ~500 MB; WSL2 distro + docker-desktop-data typically 1–3 GB initially. |

## 6. Free-tier / zero-budget eligibility

Verified from the official **Docker Subscription Service Agreement** (docker.com/legal, last updated 2026-08-26) and the official install docs (fetched 2026-11-11):

- Docker Desktop is **free for personal use, education, non-commercial open-source projects, and small businesses** with **fewer than 250 employees AND less than $10 million annual revenue**.
- PlantAI is a personal, zero-budget project → **Docker Personal plan is free. No paid subscription needed. No payment method required.**
- WSL 2 is free (Microsoft). The Supabase CLI's `pg_dump` container image is pulled from a public registry (free).

**Zero paid services are involved in this path.**

## 7. Exact installation steps (for the owner to run — agent did NOT execute these)

```powershell
# 1. (One-time, admin terminal) Install/update WSL 2 — free, Microsoft-official
wsl --install --no-distribution
#    ...or, if wsl --install is unavailable on the inbox version:
#    Download the WSL MSI from https://github.com/microsoft/WSL/releases and install it.
#    Restart the PC if prompted.

# 2. (Owner choice of installer method)
#    Option A — winget (no admin needed for per-user install):
winget install Docker.DockerDesktop
#    Option B — download the official installer:
#    https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
#    Per-user install (recommended, no admin):
Start-Process 'Docker Desktop Installer.exe' -Wait -ArgumentList 'install','--user'
#    Accept the Docker Subscription Service Agreement on first launch (Personal = free).

# 3. Start Docker Desktop (Start menu → Docker Desktop) and wait for the whale icon.

# 4. Verify (non-secret):
docker --version
docker info --format "{{.ServerVersion}}"
```

Then tell the agent to **retry the pre-migration backup** — everything else (CLI 3.1.0, pooler IPv4 path, target `plantai-dev`, git-ignored `backups/`) is already verified and ready.

## 8. Blockers & caveats summary

| # | Item | Severity | Notes |
|---|---|---|---|
| 1 | WSL 2 not installed (inbox WSL too old for ≥ 2.1.5 requirement) | **Blocker — resolves with one free admin step** | `wsl --install --no-distribution` (elevated) or WSL MSI; restart may be required |
| 2 | RAM 7.9 GB — exactly at minimum | Caveat | Workable for schema-only `db dump`; cap Docker memory in Settings; avoid heavy local stacks |
| 3 | CPU 2 cores, 2015-era | Caveat | Slow but functional; not a blocker |
| 4 | Hyper-V feature state, `hypervisorlaunchtype`, full SLAT/BIOS confirmation | UNVERIFIED (need elevation) | Not blocking the WSL 2 path; `HypervisorPresent: True` strongly implies BIOS virtualization is ON |
| 5 | Docker Desktop absent | Resolved by install (owner action) | Per-user install needs **no admin**; WSL enablement needs admin once |

## 9. What was NOT done (restriction boundary held)

- No Docker install, no download, no winget command.
- No Windows feature changes, no WSL install/update, no BIOS changes.
- No project changes, no database commands, no migrations, no backup attempt.
- All actions were read-only diagnostics plus this report.

## 10. Verdict

**Green light with one prerequisite:** this Windows 10 Pro 22H2 machine can run Docker Desktop (WSL 2 backend, per-user install, Docker Personal free tier) once **WSL 2 ≥ 2.1.5 is installed** (one-time, free, admin). RAM is at the minimum but sufficient for the lightweight schema-only backup use case.

**STOP — waiting for owner approval to proceed with installation.**

---

### Sources (official, fetched 2026-11-11)

- Docker docs — Install Docker Desktop on Windows (system requirements, backends, per-user install, license summary): https://docs.docker.com/desktop/setup/install/windows-install/
- Docker Subscription Service Agreement (free-tier definition): https://www.docker.com/legal/docker-subscription-service-agreement/
- Microsoft WSL install docs (referenced by Docker docs): https://learn.microsoft.com/en-us/windows/wsl/install
