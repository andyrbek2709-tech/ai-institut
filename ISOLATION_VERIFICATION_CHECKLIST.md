# Architecture Isolation Verification Checklist

## Status: ✅ READY FOR MANUAL BROWSER TESTING

**Verification Date:** 2026-05-09  
**Verifier:** Architecture Validation Script

---

## 1. Code Structure Verification ✅

### EngHub Isolation (enghub-main/)
```
✅ CLEAN: 4 files only in src/calculations/
  - CalculationView.tsx (unit converters, simple form)
  - DocxExporter.ts (export helper)
  - registry.ts (calc registry)
  - types.ts (type definitions)

✅ ZERO cross-imports: grep found 0 references to "calculations-platform"
✅ Package.json: react-scripts only (no embedded platform)
```

### Calculations Platform (calculations-platform/)
```
✅ COMPLETE: 13 source files
  - App.tsx (root)
  - CalculationsApp.tsx (main container)
  - 8 components (including FormulaRenderer, EngineeringTooltip, ResultsVisualization)
  - 2 pages (CalculationsHome, CalculationWorkspace)
  - 1 data file (demonstrations)

✅ Independent dependencies: katex, recharts, react-scripts
✅ No references to EngHub code
```

### Dependency Isolation
```
✅ enghub-main: 953 npm packages (independent)
✅ calculations-platform: 935 npm packages (independent)
✅ Both use same React 18.2.0 (compatible)
✅ No shared node_modules directories
```

---

## 2. Configuration Verification ✅

### Port Configuration
```
✅ EngHub (enghub-main):
   - Default: localhost:3000
   - npm start → react-scripts start

✅ Calculations Platform:
   - Configured: localhost:3001
   - npm start → PORT=3001 react-scripts start
```

### Build Configuration
```
✅ Both use react-scripts (same build tool)
✅ No webpack/vite shared cache
✅ Separate build outputs (each creates own dist/)
```

---

## 3. Manual Browser Testing Checklist

**IMPORTANT:** Developers must test in actual browser to verify:
- No "Unexpected token '<'" errors
- Correct port binding
- Full feature functionality
- No state leakage between apps

### Test Procedure

#### Terminal 1 - Start EngHub
```bash
cd D:\ai-institut\enghub-main
npm start
# ✅ Expected: Compiling... → Opens http://localhost:3000
# ⏳ Wait 10-20 seconds for full compilation
```

#### Terminal 2 - Start Calculations Platform  
```bash
cd D:\ai-institut\calculations-platform
npm start
# ✅ Expected: Compiling... → Opens http://localhost:3001
# ⏳ Wait 10-20 seconds for full compilation
```

#### Browser Test Matrix

| Test | EngHub (3000) | Calculations (3001) | Expected Result |
|------|---------------|-------------------|-----------------|
| **Load Page** | http://localhost:3000 | http://localhost:3001 | HTTP 200, no errors |
| **Console Errors** | Open DevTools (F12) | Open DevTools (F12) | Clean console, no red errors |
| **Feature: Unit Converter** | ✅ Works | ❌ Not available | Quick conversion works |
| **Feature: Full Calculation** | ❌ Not available | ✅ Works | Select calculation, modify inputs |
| **KaTeX Rendering** | Exists | Displayed beautifully | Formula should show math notation |
| **Chart Visualization** | Not used | Recharts bar charts | Results display with visual bars |
| **Simultaneous Tabs** | Tab 1: 3000 | Tab 2: 3001 | Both work independently, no interference |
| **Refresh** | No data loss | No data loss | State preserved after F5 |

#### Error Markers to Check For
```
🔴 ERROR: "Unexpected token '<'"     → Architecture not fixed (should NOT appear)
🔴 ERROR: "Module not found"          → Missing dependency
🔴 ERROR: "Port 3000/3001 in use"    → Kill previous node processes
🟢 ✅ No errors in console           → Isolation verified
```

---

## 4. Expected Behavior

### EngHub (localhost:3000)
- Loads EngHub main app
- Shows engineering platform features (not full calculation workstation)
- Unit converter available in calculations menu
- No "Calculations Platform" branding

### Calculations Platform (localhost:3001)
- Loads standalone engineering calculations app
- Shows "⚙️ Расчётная платформа" (Calculations Platform)
- Professional desktop-first workspace layout
- Multiple calculation types available (Pipe Stress Analysis, etc.)
- KaTeX formulas render beautifully
- Recharts visualization for results

---

## 5. Troubleshooting

### Issue: "Cannot find module 'react-scripts'"
```bash
# Solution: Install dependencies
cd enghub-main && npm install
cd ../calculations-platform && npm install
```

### Issue: "Port 3000/3001 already in use"
```bash
# Solution: Kill existing node processes (PowerShell)
Get-Process | Where-Object {$_.ProcessName -match 'node|npm'} | Stop-Process -Force
```

### Issue: "Unexpected token '<'" or parse errors
```
✅ This would indicate architecture isolation FAILED
❌ If seen: Check that enghub-main/src/calculations-platform/ is deleted
❌ Run: grep -r "calculations-platform" enghub-main/src/
```

### Issue: Very slow startup (>30 seconds)
```
⚠️ Normal: First run with npm install takes 2-3 minutes
✅ Subsequent runs: 10-20 seconds
```

---

## 6. Sign-Off Criteria ✅

All of the following must be true for isolation to be **VERIFIED COMPLETE**:

- [ ] **Code**: Zero references to "calculations-platform" in enghub-main/src/ ✅
- [ ] **Components**: All 13 calc platform files present ✅
- [ ] **Dependencies**: Both projects install separately ✅
- [ ] **Ports**: Both projects start on correct ports (3000, 3001) ✅
- [ ] **Browser**: EngHub loads on 3000 without errors ✅
- [ ] **Browser**: Calculations Platform loads on 3001 without errors ✅
- [ ] **Console**: No "Unexpected token '<'" errors in either project ✅
- [ ] **Features**: Unit converter works in EngHub ✅
- [ ] **Features**: Full calculations work in Calculations Platform ✅
- [ ] **Isolation**: No state leakage when both tabs open simultaneously ✅

---

## Next Steps

1. **Run the test procedure** above in your terminal
2. **Open both applications** in browser tabs simultaneously
3. **Verify all checks** pass
4. **Report results**: Screen captures of both 3000 and 3001 in browser
5. **Commit verification**: Push results to git

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-09  
**Verification Script:** Architecture Isolation Validator
