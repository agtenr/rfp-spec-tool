---
name: serve
description: "Run the Award Model Simulator locally by serving the static site over http (native ES modules + fetch-based config loading require an http origin, not file://). Then open the app entry page."
allowed-tools: Bash
---

# serve — run the app locally

The app is plain HTML/CSS/JS with **native ES modules**, so it must be served over **http**, never
opened as `file://`. From the repo root:

```bash
python -m http.server 8000
# or, if Node is preferred:
# npx serve -l 8000 .
```

Then open **http://localhost:8000/app/index.html** — it auto-runs the synthetic golden dossier and
lets you load another config by URL or file, and download the machine-readable CSV.
