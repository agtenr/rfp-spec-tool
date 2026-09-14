# Plan — Implement the RFP tool (Award Model Simulator, Instrument 2)

Work item: **#1** · Story status at planning: Intake approved → Generating plan

## Context

Build the Award Model Simulator specified in the governing HLD v3.0
(`HLD-Instrument-2-Award-Model-Simulator-developer-handoff 1.md`). It reproduces a procurement's
published award methodology and replays it against the bidder's own cost structure to answer *"which
solution architecture can we afford in points"*. This is a **greenfield** build — no code exists yet;
the plan is grounded in the HLD and the project rules in `.claude/rules/`.

Intended outcome: a browser app (plain HTML/CSS/JS, no build, native ES modules) with a generic
`/engine` strictly separated from disposable `/dossiers/<id>` data, that reaches **Gate 1** — the
§9.3 golden worked example reproduces exactly and all §9.2 invariants pass — and produces the two
required outputs (§6).

- *(dev-seeded)* The developer chose a **single flat plan covering every acceptance criterion at
  once** (no staged Gate-1-first boundary), while accepting the governing rule "build the vertical
  slice, not the library". The task breakdown below is therefore dependency-ordered across the whole
  MVP, with no stage gates; the §11 deferred items remain out of scope.

## Keep it simple

Non-goals (each fences off **unrequested** scope — no stated AC is narrowed here):

- **No second archetype.** Only `LOWEST_PRICE_RATIO` (provisional), behind the contract interface
  (AR-05, DF-01). No other scoring formula.
- **No `PopulationSchedule`.** Snapshot semantics only; BR-11 guards misreading (DF-02).
- **No build toolchain, framework, or bundler.** Plain ES modules served over http.
- **No real VUB ID915 dossier values.** Only the synthetic §9.3 golden fixture; SENSITIVE data and
  OQ-A…I are out (see Assumptions Q1).
- **No sensitivity sweep / break-even root finder / price indexation / charts / generated memo /
  multiple fields / ranged assumptions** (DF-04…08).
- **No full-combination ambiguity execution** — one-at-a-time only (DF-03).

## AC coverage

| AC | Status | Where |
|---|---|---|
| SC-01 golden example reproduces exactly | covered | Tasks 3–10, 13 (`tests.html`) |
| SC-02 invariants IN-01…07 pass | covered | Task 13 |
| SC-03 every scenario in each population state | covered | Task 9 (scenario runner) |
| SC-04 each ambiguity run under every reading, spread reported | covered | Tasks 9, 12 |
| SC-05 quality-compensation per variant pair | covered | Task 10 |
| SC-06 numbered assumption register exportable | covered | Task 12 |
| SC-07 no dossier value in engine (VA-14) | covered | Tasks 2, 14 + `engine-scan` skill |
| SC-08 outputs carry run identity, config version, provenance, gate | covered | Task 12 |
| Gate 1 (golden + invariants; provisional label) | covered | Tasks 3–13 |
| Gate 2 (real arithmetic/weightings + 2nd-reader sign-off) | deferred | Assumptions Q1 — human/config, not code; VA-16 |

> Gate 2 is a human transcription + sign-off milestone (OQ-A/OQ-B, VA-16), not an engineering task —
> the code must *support* it (provisional→validated labelling, second-reader flag), which Tasks 2/12
> deliver. Listed under Assumptions so the reviewer consciously accepts that this plan reaches Gate 1,
> not Gate 2.

## Implementation approach

Mirror the §2 layout exactly. Author `/engine/*` as pure ES modules (data in, data out, **no DOM** —
`engine-architecture.md`), one module per §2 component. `Money`/`Quantity` are value objects backed by
**integer minor units** (`numeric-and-money.md`); no bare numbers, no IEEE-754 for money. A thin
`/app` UI layer loads a dossier config via `fetch`, runs the engine, and renders the two §6 outputs
(`frontend-ui.md`). Configuration validation (§8) runs first and blocks/warns per `configuration-
validation.md`. Tests are a `tests.html` browser page (`testing.md`) with a tiny assertion harness,
using the synthetic §9.3 fixture only (AR-04).

## Data contracts

The §3 data contract is the shared shape crossing every module boundary (`config → validation →
cost_engine/quality_model → field_evaluator → scenario_runner → compensation/envelope → reporters`).
Pin these once, in JS terms, and have every module agree:

- **`Money`** `{ minor: integer, currency: string /* ISO */ }` — `minor` is the amount in units of
  `10^calculation_precision`. Never a bare number. Arithmetic on `minor` (integers); format to a
  decimal string only at output using `display_precision` + `rounding_mode`.
- **`Quantity`** `{ value: number|integer, unit: 'HOUR'|'USER'|'ITEM'|'PERIOD', periodBasis?:
  'PER_PERIOD'|'ONCE' }`.
- **`DossierConfiguration`**, **`Run`**, **`AwardMethodology`**, **`ExclusionRule`**,
  **`QualityCriterion`**, **`CostComponent`**, **`Rate`**, **`ImposedBasket`**/`BasketLine`,
  **`Segment`**, **`PopulationState`**, **`BidVariant`**, **`CompetitorEntry`**,
  **`CompetitiveField`**/`FieldEntry`, **`QualityAssumption`**, **`Ambiguity`**/`Reading`,
  **`Assumption`**, **`ExpectedConsumption`**, **`ScenarioResult`** — field names/types exactly as
  §3.1–3.7 (camelCase JS keys mapping 1:1 to the HLD snake_case; keep a documented mapping in the
  config loader). `ScenarioResult` column order for output follows §3.7 verbatim.
- **`CalculationContract`** interface — the object shape of §4.1 (`archetypeId`, `inputs`,
  `preconditions`, `referenceSetRule`, `formula`, `bounds`, `rounding`, `exclusionHandling`,
  `tieHandling`, `errorBehaviour`, `workedExample`).

## Task breakdown

Dependency-ordered; each task cites the rule(s) whose conventions and "done" bar govern it.

1. **Scaffold layout + value objects.** Create `/engine/` module tree per §2, `/app/` (entry HTML,
   config load, render), and `Money`/`Quantity` with integer-minor-unit arithmetic + display
   formatting. Rules: `engine-architecture.md`, `numeric-and-money.md`.
2. **Config model + loader + validation gate (§8).** Define the §3 shapes; load a config JSON via
   `fetch`; implement VA-01…16 with BLOCK/WARN semantics and `warnings[]` surfaced to every output;
   no code defaults. Rules: `configuration-validation.md`, `award-simulator-domain.md`,
   `numeric-and-money.md`, `confidentiality-and-provenance.md`.
3. **Cost engine — comparison-price expansion (§5.2).** ONE_OFF/PER_PERIOD/PER_USER/
   PER_USER_PER_PERIOD expansion; basket expansion; zero lines for non-applicable segments;
   `cost_contributions` + `segment_contributions`. Rules: `award-simulator-domain.md`,
   `numeric-and-money.md`.
4. **Calculation-contract interface + `LOWEST_PRICE_RATIO` (§4.2).** Generic interface; the one
   provisional archetype as a self-contained implementation; reference-set rule, ties, errors
   (BLOCKED cases). Rules: `calculation-contracts.md`, `numeric-and-money.md`.
5. **Field evaluator.** Build the reference set from `CompetitiveField`/`FieldEntry` (eligibility,
   multiplicity, own/excluded membership) and apply the contract → price scores. Rules:
   `calculation-contracts.md`, `award-simulator-domain.md`.
6. **Quality model + exclusion (§5.3).** Weighted contributions; TOTAL_QUALITY/PER_CRITERION/
   SPECIFIC_CRITERION; PERCENT_OF_MAX resolution; GTE/GT; excluded → no rank/total. Rules:
   `award-simulator-domain.md`.
7. **Compensation (§5.4).** Ordered variant pairs; required/assumed delta, gap, and the four statuses
   (NO_COMPENSATION_NEEDED / NOT_ACHIEVABLE / INDETERMINATE_EXCLUSION / COMPUTED). Rules:
   `award-simulator-domain.md`.
8. **Envelope (§5.5).** `ExpectedConsumption`-based per-period cost (never the basket, BR-10);
   WITHIN/EXCEEDS/NOT_ASSESSED; nominal-values label. Rules: `award-simulator-domain.md`,
   `numeric-and-money.md`, `confidentiality-and-provenance.md`.
9. **Scenario runner (§5.1).** Order of operations: per ambiguity reading → per population state →
   per participant; produce `ScenarioResult` incl. rank, margin; run every reading (one-at-a-time),
   both population states (BR-02). Rules: `award-simulator-domain.md`.
10. **Assumption register + `Run` identity + provenance/gate labelling.** Numbered assumptions from
    selected readings; `run_id`/`engine_version`; **`input_hash` = SHA-256 (`crypto.subtle`) over a
    canonical JSON of inputs**; provenance carried; validation-gate label. Rules:
    `award-simulator-domain.md`, `confidentiality-and-provenance.md`.
11. **Reporters — machine-readable CSV (§6.2).** One CSV row per `ScenarioResult`, §3.7 column order,
    sort rule, excluded rows last. Rules: `frontend-ui.md`, `confidentiality-and-provenance.md`.
12. **Reporters — human-readable decision report (§6.3) + metadata block (§6.1).** All seven sections
    in order; price *calculated* / quality *assumed*; assumption register; warnings; confidentiality +
    gate. Rules: `frontend-ui.md`, `confidentiality-and-provenance.md`, `award-simulator-domain.md`.
13. **Tests — `tests.html` (§9).** Golden example every intermediate step (§9.3), IN-01…07 (§9.2),
    boundary/failure cases (§9.4); synthetic fixture only. Rules: `testing.md`,
    `confidentiality-and-provenance.md`.
14. **`engine-scan` wiring (VA-14).** Make the `engine-scan` skill runnable against `/engine`; confirm
    zero dossier/SENSITIVE tokens. Rules: `confidentiality-and-provenance.md`,
    `configuration-validation.md`.

## Decisions (resolved in planning with the dev)

- **Dossier scope:** ship **only the synthetic §9.3 golden fixture + a provisional config skeleton**;
  no real VUB ID915 SENSITIVE values, OQ-A…I left to the humans (matches BR-13/AR-04, Gate 1 boundary).
- **Money representation:** `Money.minor` at a **config-driven scale of 10^`calculation_precision`**
  (satisfies NUM-03; no hard-coded 2dp).
- **`input_hash`:** **SHA-256 via Web Crypto `crypto.subtle`** over a canonical JSON of the inputs
  (async; relies on the http/localhost secure context the `serve` skill provides).
- **Machine-readable output:** **CSV** — one row per `ScenarioResult`, columns in §3.7 order.

## Assumptions & open questions

- **Gate scope — this plan reaches Gate 1, not Gate 2.** Gate 2 (real price-scoring arithmetic +
  quality weightings transcribed, dossier-specific worked example, second-reader sign-off) is a
  human/config milestone (OQ-A, OQ-B, VA-16), not code in this story. Accept that #1 is **done at
  Gate 1** with outputs labelled `engine_validated_configuration_provisional`, Gate 2 tracked
  separately **or** should Gate 2 transcription be pulled into this story's scope now? Reply "Gate 1
  is the bar" or "pull Gate 2 in".

## Considerations

- ES modules + `fetch` require serving over **http**, not `file://` — the `serve` skill covers this;
  the `test` page has the same constraint (FYI, already handled by the skills).
- **VA-02 is expected to fail** for a real VUB config until OQ-B weightings are transcribed; the
  golden synthetic fixture is internally consistent and passes. This is a known provisional state, not
  a bug.
- Per-user × horizon products (e.g. `2.00 × 24,000 × 6 = 288,000`) stay exact under integer minor
  units — a risk only if floats are ever reintroduced (NUM-01 forbids it).

## Testing recommendations

- **Whether to test:** yes — the project has a defined test practice (`testing.md`, the `test` skill,
  a browser test page). The build is not complete until §9.2 + §9.3 pass.
- **Altitude:** unit-level for engine modules (expansion, contract, quality, compensation, envelope)
  and a behavioral end-to-end run of the §9.3 fixture through the scenario runner.
- **Must-cover (beyond the ACs' own statements), each with expected outcome:** empty reference set →
  run `BLOCKED` + "empty reference set" warning; non-positive comparison price → `BLOCKED` +
  "non-positive comparison price"; quality exactly at threshold under GTE → passes; just below →
  `EXCLUDED_QUALITY`, no rank/total; two equal prices → equal scores, shared rank, next skipped;
  per-user component applicable to one segment → other segments emit an explicit zero line; basket
  `PER_PERIOD` → ×horizon; zero-cost component → included as a zero line; missing periodicity → VA-04
  BLOCK; unknown segment → VA-05 BLOCK; assumption above scale → VA-08 BLOCK; weightings not summing →
  VA-02 BLOCK.

## Definition of done

- [ ] §9.3 golden worked example reproduces exactly at every intermediate step (SC-01).
- [ ] IN-01…07 all pass (SC-02).
- [ ] Every scenario computed in both INITIAL and GROWN states (SC-03, BR-02).
- [ ] Each ambiguity run under every reading, spread reported (SC-04).
- [ ] Quality compensation computed for every variant pair with the correct status (SC-05).
- [ ] Numbered assumption register is exportable (SC-06).
- [ ] `engine-scan` reports zero dossier/SENSITIVE values under `/engine` (SC-07, VA-14).
- [ ] Every output carries run_id, configuration_version, engine_version, input_hash, provenance,
      confidentiality, and validation gate (SC-08, §6.1).
- [ ] Both §6 outputs produced; machine-readable columns in §3.7 order; report sections in §6.3 order.
- [ ] Money never a bare number; no IEEE-754 in any monetary path; rounding once at output (NUM-01/02).
- [ ] §9.4 boundary/failure cases behave as specified.
- [ ] Outputs labelled `engine_validated_configuration_provisional` once the above pass (Gate 1).

## Files/areas affected

- `/engine/` — `value_objects/`, `config/`, `validation/`, `cost_engine/`, `calculation_contracts/`,
  `quality_model/`, `field_evaluator/`, `scenario_runner/`, `compensation/`, `envelope/`, `reporters/`.
- `/app/` — entry HTML, config loader, output rendering.
- `/dossiers/golden/` (synthetic fixture) — and, per Q1, possibly a provisional config skeleton.
- `tests.html` + a small assertion harness.
- `.claude/skills/engine-scan/` — verify against real `/engine` (VA-14).
