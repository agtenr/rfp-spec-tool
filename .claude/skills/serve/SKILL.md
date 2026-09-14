<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. This is an UNVERIFIED placeholder — the toolchain does not exist yet. -->
---
name: serve
description: "(UNVERIFIED — toolchain not built yet) Run the Award Model Simulator locally by serving the static site over http, as native ES modules and fetch-based config loading require an http origin (not file://)."
allowed-tools: Bash
---

# serve — run the app locally

**Status: UNVERIFIED.** No app or server config exists yet. This captures the *intended* command.

The app is plain HTML/CSS/JS with **native ES modules**, so it must be served over **http**, never
opened as `file://` (ES-module imports and `fetch`-based config loading fail on the file scheme).

Intended command (pick whichever runtime is available; confirm once the app exists):

```bash
# Python (usually present on Windows dev boxes):
python -m http.server 8000
# or Node, if adopted:
npx serve .
```

Then open http://localhost:8000/ (the app entry HTML, once created).

**TODO: verify once the toolchain exists** — decide the entry HTML path, the port, and the chosen
static server; then replace the command above with the real one and drop this banner.
