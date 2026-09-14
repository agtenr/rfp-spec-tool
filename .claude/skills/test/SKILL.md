<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. This is an UNVERIFIED placeholder — the toolchain does not exist yet. -->
---
name: test
description: "(UNVERIFIED — toolchain not built yet) Run the HLD §9 validation suite — the golden worked example (§9.3), the IN-01…07 invariants (§9.2), and the §9.4 boundary/failure cases — via a browser test page (tests.html) served over http."
allowed-tools: Bash
---

# test — run the §9 validation suite

**Status: UNVERIFIED.** No tests exist yet. This captures the *intended* workflow.

Testing decided at kickstart: a **browser test page** (`tests.html`) that loads the engine ES
modules plus a tiny assertion harness. The build is **not complete** until §9.2 (invariants) and
§9.3 (golden example, every intermediate step) pass; until then outputs are labelled `unvalidated`.

Intended workflow:

```bash
# Serve, then open the test page in a browser (there is no CLI runner in the browser-page approach):
python -m http.server 8000   # or: npx serve .
# then open http://localhost:8000/tests.html and read the pass/fail results
```

Must cover: the §9.3 golden example (basket 112,000.00; comparison prices 242k / 258k / 498k; price
scores 38.02 / 35.66 / 18.47 / 40.00; compensation gaps +3.64 and −13.55), the IN-01…07 invariants,
and the §9.4 boundary/failure cases. Fixtures are **synthetic only** (AR-04).

**TODO: verify once the toolchain exists** — build `tests.html` + the harness; if the team later
adopts Node, add a headless/CI runner (e.g. `node --test`) and replace this stub.
