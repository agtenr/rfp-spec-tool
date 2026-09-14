---
name: test
description: "Run the HLD §9 validation suite — the golden worked example (§9.3), the IN-01…07 invariants (§9.2), and the §9.4 boundary/failure cases. Headless via Node, or in a browser via tests.html."
allowed-tools: Bash
---

# test — run the §9 validation suite

The build is **not complete** until §9.2 (invariants) and §9.3 (golden example, every intermediate
step) pass; until then outputs are labelled `unvalidated` (see `.claude/rules/testing.md`). Fixtures
are **synthetic only** (AR-04).

Headless (Node 18+, for BigInt / structuredClone / crypto.subtle) — from the repo root:

```bash
node tests/run-node.js
```

In a browser (the primary test page) — serve, then open the page:

```bash
python -m http.server 8000    # or the `serve` skill
# then open http://localhost:8000/tests.html
```

Both entry points run the same tests: `tests/golden.test.js`, `tests/invariants.test.js`,
`tests/boundary.test.js`, `tests/ambiguity-envelope.test.js`, `tests/reporters.test.js`.
