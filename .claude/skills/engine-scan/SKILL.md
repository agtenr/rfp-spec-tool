---
name: engine-scan
description: "VA-14 engine-purity scan: prove the /engine folder contains no dossier-specific or SENSITIVE value (dossier ids, rates, licence costs, competitor entries, real-value literals). Exits non-zero on a hit (release BLOCK)."
allowed-tools: Bash
---

# engine-scan — VA-14 engine-purity check

Enforces **VA-14 / AR-02 / AR-03 / SC-07**: the `/engine` layer must contain **no** dossier entity
instances and **no** SENSITIVE value — those live only under `/dossiers/<id>/`. A hit is a
**release BLOCK**. See `.claude/rules/configuration-validation.md` and
`.claude/rules/confidentiality-and-provenance.md`.

Run from the repo root:

```bash
# Dossier ids / sensitive markers, and real-value literals (>=4 digits) leaked into the engine.
grep -rnE 'VUB|ID915|GOLDEN' engine/ && { echo 'BLOCK: dossier id in engine/'; exit 1; }
grep -rnE '[0-9]{4,}' engine/ && { echo 'BLOCK: multi-digit value literal in engine/'; exit 1; }
echo "engine clean (no dossier ids, no >=4-digit value literals)"
```

The engine uses only small structural constants (scales, `100n`, `10n`); any 4+ digit literal or a
dossier id is a leaked dossier value. Extend the marker set as new dossiers are added.
