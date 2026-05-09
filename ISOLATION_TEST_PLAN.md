# Architecture Isolation Verification Plan

## 1. EngHub (localhost:3000)

**Expected Behavior:**
- [ ] App loads without errors
- [ ] No "Unexpected token '<'" errors (HTML in JS bundle)
- [ ] Dashboard visible
- [ ] Navigation menu shows EngHub features (Tasks, Drawings, etc.)
- [ ] NO Calculations Platform route or button visible
- [ ] Can view Calculations feature (Unit Converters, if present)

**Critical Check:**
- Inspect browser console: NO errors about missing calculations-platform files
- No red error boundaries

## 2. Calculations Platform (localhost:3001)

**Expected Behavior:**
- [ ] App loads independently on port 3001
- [ ] No shared imports from EngHub
- [ ] Shows "⚙️ Расчётная платформа" header
- [ ] Displays calculation cards (cable sizing, pipe stress, etc.)
- [ ] Can select a calculation and view workspace
- [ ] KaTeX formula rendering works
- [ ] Results display correctly

**Critical Checks:**
- Inspect browser console: NO errors
- Network tab: All requests from localhost:3001 (no localhost:3000 references)
- No bundle.js is HTML (Unexpected token '<' error is GONE)

## 3. Isolation Verification

**Check:**
- [ ] EngHub still works when Calculations Platform is closed
- [ ] Calculations Platform still works when EngHub is closed
- [ ] Can access both simultaneously in different browser tabs
- [ ] No local storage contamination (check localStorage keys)

## Success Criteria

✅ Both apps run independently
✅ No HTML-in-JS-bundle errors
✅ No shared webpack/vite cache
✅ No cross-app imports
✅ Each app has its own node_modules
✅ Each app runs on different port

---

**If Error:** "Unexpected token '<'"
- This means JavaScript bundle was replaced by HTML response
- Indicates Webpack served HTML instead of JS (usually port conflict or build issue)
- Check: ps aux | grep node | grep -v grep

