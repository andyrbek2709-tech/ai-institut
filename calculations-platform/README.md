# Calculations Platform — Standalone Frontend

A completely isolated, independent React application for engineering calculations. Runs on **localhost:3001**, separate from EngHub.

## Architecture

- **Framework:** React 18.2.0 with Create React App (react-scripts)
- **Port:** 3001 (via `cross-env` for Windows compatibility)
- **Components:** 13 self-contained components with KaTeX and Recharts visualization
- **Isolation:** Zero dependencies on EngHub or other shared runtimes

## Installation

```bash
npm install
```

## Development

```bash
npm start
```

Opens automatically on `http://localhost:3001`

## Building

```bash
npm run build
```

Outputs to `build/` directory.

## Key Components

- **CalculationsApp.tsx** — Main application container
- **FormulaRenderer.tsx** — KaTeX formula rendering
- **ResultsVisualization.tsx** — Recharts-based result charts
- **EngineeringTooltip.tsx** — Input hints with ranges
- **FileUpload.tsx** — File/CSV import
- **ReportGenerator.tsx** — Export to DOCX/Excel

## Port Configuration

The application runs on port **3001** by default using `cross-env PORT=3001` in `npm start`.

On Windows, the `.env` file can also be used:
```
PORT=3001
```

## Isolation Verification

This application is completely isolated from EngHub:
- ✅ Separate `node_modules` (1430 packages)
- ✅ Separate `package.json` with independent dependencies
- ✅ No imports from `enghub-main/`
- ✅ Independent React runtime on port 3001
- ✅ Self-contained routing and state management

## Testing Both Platforms Simultaneously

**Terminal 1 — EngHub (port 3000):**
```bash
cd ../enghub-main
npm start
```

**Terminal 2 — Calculations Platform (port 3001):**
```bash
cd calculations-platform
npm start
```

Both will run independently without conflicts.
