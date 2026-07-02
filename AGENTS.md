# AGENTS.md

## Project Rules

- This repository is a local Windows test build for PEPS LIVE Drone RTMP Bridge.
- Do not deploy to GitHub, GitHub Pages, or any cloud server in this phase.
- Do not add API keys, credentials, or external service secrets.
- Do not create fake drone telemetry.
- Use the phrase `รับสัญญาณภาพโดรนแล้ว` only when a real RTMP publisher is detected.
- Never use the phrase `เชื่อมต่อโดรนแล้ว`; the bridge cannot prove aircraft connection state.
- Keep MediaMTX Control API bound to `127.0.0.1`.
- Do not modify Windows Firewall without an explicit user confirmation path.

## Local Commands

```powershell
npm install
npm run setup:mediamtx
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:bridge
```

## Structure

```text
frontend/   React + Vite dashboard
server/     Express local bridge/API
mediamtx/   MediaMTX runtime location
config/     Generated settings and MediaMTX config
scripts/    Local setup helpers
docs/       Architecture, test, and troubleshooting notes
```
