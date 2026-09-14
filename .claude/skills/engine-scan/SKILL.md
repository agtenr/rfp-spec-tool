<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. This is an UNVERIFIED placeholder — the toolchain does not exist yet. -->
---
name: engine-scan
description: "(UNVERIFIED — toolchain not built yet) VA-14 engine-purity scan: prove the /engine folder contains no dossier-specific or SENSITIVE value (rates, licence costs, competitor entries, dossier ids). BLOCKs release when it finds one."
allowed-tools: Bash
---

# engine-scan — VA-14 engine-purity check

**Status: UNVERIFIED.** No engine or scan script exists yet. This captures the *intended* workflow.

Enforces **VA-14 / AR-02 / AR-03 / SC-07**: the `/engine` layer must contain **no** persisted,
defaulted or hard-coded dossier entity instances, and **no** SENSITIVE value (rates, licence costs,
competitor entries) — those live only under `/dossiers/<id>/`. A hit is a **release BLOCK**.

Intended workflow (once `/engine` exists):

```bash
# Fail if any dossier-specific / sensitive token appears under /engine.
# Refine the pattern to the real markers once the config schema is fixed.
grep -rniE 'dossier_id|VUB|ID915|licence.?cost|competitor|rate_set' engine/ && exit 1 || echo "engine clean"
```

**TODO: verify once the toolchain exists** — settle the exact patterns/markers that constitute a
dossier value, decide whether the scan runs in a git hook or CI, and replace the heuristic above.
