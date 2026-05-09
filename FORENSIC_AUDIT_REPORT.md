# 🔍 FORENSIC ARCHITECTURE ISOLATION AUDIT

**Date:** 2026-05-09  
**Projects:** EngHub (enghub-main) vs. Calculations Platform (calculations-platform)  
**Status:** ⚠️ **CONTAMINATED** — Significant cross-project artifacts found

---

## EXECUTIVE SUMMARY

**Verdict: CRITICALLY CONTAMINATED**

While calculations-platform is clean and properly isolated, **enghub-main contains significant calculation-related artifacts** that should not exist:
- Entire Python Flask backend (cable-calc) 
- HTML build artifacts
- Report files

These are architectural violations that compromise clean separation.

---

## AUDIT RESULTS BY CATEGORY

### 1️⃣ IMPORT CONTAMINATION ✅ CLEAN
- ✅ calculations-platform: NO imports from EngHub or EngHub APIs
- ✅ enghub-main source: NO imports from calculations-platform  
- ✅ All relative imports within project boundaries

### 2️⃣ CONFIG CONTAMINATION ✅ CLEAN
- ✅ Separate package.json files (no shared dependencies)
- ✅ Separate tsconfig.json (independent compilation)
- ✅ NO npm/yarn/pnpm workspace configs at root
- ✅ Separate PORT configuration (3001 vs 3000)

### 3️⃣ NODE/NPM CONTAMINATION ✅ CLEAN
- ✅ Separate node_modules directories
- ✅ NO symlinks between projects
- ✅ NO npm linked packages

### 4️⃣ GIT CONTAMINATION ✅ CLEAN
- ✅ NO git submodules
- ✅ NO nested .git repositories
- ✅ Default git hooks only

### 5️⃣ TYPESCRIPT/MONOREPO CONTAMINATION ✅ CLEAN
- ✅ NO path aliases crossing projects
- ✅ NO tsconfig extends to other projects

### 6️⃣ ENVIRONMENT CONTAMINATION ✅ CLEAN
- ✅ calculations-platform .env: Only PORT=3001
- ✅ enghub-main .env: Only Supabase/Railway URLs
- ✅ NO hardcoded cross-project API references

### 7️⃣ RUNTIME CONTAMINATION ✅ CLEAN
- ✅ Separate ports (3000 vs 3001)
- ✅ NO HMR/WebSocket overlap
- ✅ NO React runtime conflicts

### 8️⃣ FILESYSTEM CONTAMINATION 🔴 **CONTAMINATED**

#### CRITICAL: Calculation Backend in EngHub
```
enghub-main/api/cable-calc/          ← SHOULD NOT EXIST (32 files)
├── app.py
├── calc.py
├── engine/ (4 files)
├── excel/ (batch processing)
├── models/ (data models)
├── parsers/ (parse logic)
├── report.py & report-xlsx.py
├── test_phase1.py, test_phase2.py, test_phase3.py
└── requirements.txt
```

#### Build Artifacts Contaminating EngHub
```
enghub-main/build/cable-calc.html     ← 70 KB (SHOULD NOT EXIST)
enghub-main/public/cable-calc.html    ← Source HTML (SHOULD NOT EXIST)
```

#### Report & PID Files
```
enghub-main/cable_calc_report.docx    ← Leftover test artifact
enghub-main/cable_calc_report.xlsx    ← Leftover test artifact
enghub-main/calcplatform.pid          ← Stale process ID file
```

### 9️⃣ BUILD CONTAMINATION 🔴 **CONTAMINATED**
- cable-calc.html bundled in EngHub build (should be separate)

### 1️⃣0️⃣ PROCESS CONTAMINATION ✅ CLEAN
- ✅ Only 1 Node process (EngHub on 3000)
- ✅ NO process conflicts

---

## CONTAMINATION INVENTORY

| Path | Type | Status | Action |
|------|------|--------|--------|
| `api/cable-calc/` | Directory (32 files) | 🔴 CRITICAL | DELETE |
| `build/cable-calc.html` | Build artifact | 🔴 CRITICAL | DELETE |
| `public/cable-calc.html` | Source file | 🟡 MEDIUM | DELETE |
| `cable_calc_report.docx` | Test artifact | 🟡 MEDIUM | DELETE |
| `cable_calc_report.xlsx` | Test artifact | 🟡 MEDIUM | DELETE |
| `calcplatform.pid` | PID file | 🟡 MEDIUM | DELETE |

---

## CROSS-PROJECT DEPENDENCY MAP

```
calculations-platform (CLEAN ✅)
├── Dependencies: react, recharts, exceljs, docx, katex
├── Port: 3001
├── NO EngHub imports
└── Status: FULLY ISOLATED

enghub-main (CONTAMINATED 🔴)
├── Dependencies: @supabase, @dnd-kit, livekit
├── Port: 3000
├── Contains: cable-calc backend (SHOULD NOT EXIST)
└── Status: NEEDS CLEANUP
```

---

## RISK ASSESSMENT

### If `/api/cable-calc` Endpoints Are Active:
- **CRITICAL:** Users may call wrong service
- **CRITICAL:** Maintenance split across two projects
- **CRITICAL:** Deployment includes unnecessary code

### Build Impact:
- EngHub frontend unnecessarily larger
- Old outdated UI bundled into build

---

## REMEDIATION REQUIRED

### Phase 1: Verify Functionality
1. Confirm calculations-platform fully replaces cable-calc
2. Check if `/api/cable-calc` endpoints are actually used

### Phase 2: Remove Contamination
1. DELETE: `/enghub-main/api/cable-calc/`
2. DELETE: `/enghub-main/build/cable-calc.html`
3. DELETE: `/enghub-main/public/cable-calc.html`
4. DELETE: `/enghub-main/cable_calc_report.docx`
5. DELETE: `/enghub-main/cable_calc_report.xlsx`
6. DELETE: `/enghub-main/calcplatform.pid`

### Phase 3: Verify Cleanup
1. Rebuild EngHub (should work without cable-calc)
2. Test both services independently
3. Verify no import errors

### Phase 4: Commit
1. Commit with: `chore: remove calculation-platform contamination from enghub-main`
2. Update STATE.md with audit findings
3. Verify Railway deployment works

---

## FINAL VERDICT

### calculations-platform: ✅ **CLEAN**
- Zero contamination found
- Fully isolated and independent
- Ready for standalone deployment

### enghub-main: 🔴 **CONTAMINATED**
- Cable-calc backend + build artifacts present
- Must remove before declaring isolation complete

---

**Status:** AWAITING REMEDIATION  
**Next Step:** Remove all contaminated artifacts per Phase 2
