<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Award Model Simulator — domain rules

> Functional / domain lens. This is the rule everything else serves. Source: HLD v3.0
> (`HLD-Instrument-2-Award-Model-Simulator-developer-handoff 1.md`). First dossier: VUB ID915.

## What the system is

The simulator reproduces a procurement's **published award methodology** and replays it against the
bidder's **own cost structure**, to answer — before the response is written — *not "what is our
price" but "which solution architecture can we afford in points"*. For the first dossier the one
governing question is: **at which user population does a licence-bearing product architecture stop
being affordable in points, and is that above or below the grown-state population?** (§1.1–1.2)

## The two governing rules (they override everything below)

1. **Build the vertical slice, not the library.** One archetype implemented exactly, behind a
   generic contract interface. The library grows one archetype per dossier — never speculatively.
2. **Where the specification is silent, the model does not decide.** Silent resolution of an
   ambiguity is the failure mode this instrument exists to prevent. An unstated time basis,
   periodicity, threshold level, etc. is registered as an **ambiguity**, never defaulted (BR-15).

## Core domain abstraction & extension model

The system is organised around the generic **`CalculationContract`** archetype interface — see
[[calculation-contracts]]. A new unit of the domain (a new scoring archetype) is added as a **new
implementation of that interface**, never as a branch inside an existing one (AR-05). All
dossier-specific data is configuration, never code — see [[engine-architecture]].

## Key entities (data contract §3 — see the HLD for full attribute lists)

- **`DossierConfiguration`** / **`Run`** — run identity, versions, precision, horizon, validation gate.
- **`Money`** / **`Quantity`** — value objects; **never bare numbers** (see [[numeric-and-money]]).
- **`AwardMethodology`**, **`ExclusionRule`**, **`QualityCriterion`** — the scoring rules.
- **`CostComponent`**, **`Rate`** *(SENSITIVE)*, **`ImposedBasket`**/`BasketLine` — the cost structure.
- **`Segment`**, **`PopulationState`** — population as segment sets, **snapshot semantics only**
  (BR-11; a per-period `PopulationSchedule` is deferred, DF-02).
- **`BidVariant`**, **`CompetitorEntry`** *(SENSITIVE)*, **`CompetitiveField`**/`FieldEntry`,
  **`QualityAssumption`** — bids and the competitive field.
- **`Ambiguity`**/`Reading`, **`Assumption`**, **`ExpectedConsumption`**, **`ScenarioResult`**.

## Business rules — every feature must respect these (BR-01…16)

Directives, condensed from §7 — read the HLD for the exact wording:

- **BR-01** Formula *selection* + dossier parameters are configuration; generic formula *evaluation*
  is engine code.
- **BR-02** Where population grows, every scenario is computed in the grown state **and** the initial
  state; the end state governs the architecture decision.
- **BR-03 / BR-04** Ambiguity is an output: every registered reading is executed and the spread
  reported; **the model never selects a reading** — a human selects, owns it, and it becomes a
  numbered assumption.
- **BR-05** Competitors are modelled as archetype profiles, **never named firms** (see
  [[confidentiality-and-provenance]]).
- **BR-06** Price score is reported **calculated**; quality score **assumed**; never merged into one
  undifferentiated figure.
- **BR-07** Comparison price includes every cost component the spec obliges the bidder to declare,
  expanded by segment and horizon.
- **BR-08** A participant below the exclusion threshold reports **no rank and no total score**.
- **BR-09 / BR-10** The budget envelope is a constraint separate from the score, and uses
  **expected consumption, never the imposed basket**.
- **BR-11** A snapshot population state is not presented as a multi-period projection unless
  configured `is_applicable_to_all_periods`.
- **BR-12** A variant comparison is decision-relevant only as a **required quality delta**.
- **BR-13** Rates, licence costs, competitor entries never leave the dossier folder; fixtures hold no
  real dossier values; sensitive values never go into AI prompts outside an approved environment
  (see [[confidentiality-and-provenance]]).
- **BR-14** Every figure carries **provenance**; derived/simulated figures are never presented as
  measured.
- **BR-15** Unstated time basis / periodicity → registered as an ambiguity; **no default applied**.
- **BR-16** The model runs only against a **consolidated methodology from Instrument 1**; any re-run
  of Instrument 1 triggers a re-run here.

## Processing order (§5.1 — do not reorder)

1. Load & validate configuration (blocks on failure — see [[configuration-validation]]).
2. For each ambiguity reading in scope → 3. for each population state → 4. for each participant:
   expand cost components → comparison price (§5.2). 6. Build reference set, apply the contract
   → price scores. 7. Weighted quality + exclusion (§5.3). 8. Total score, rank, margin.
   9. Quality compensation per variant pair (§5.4). 10. Envelope test (§5.5). 11. Emit results,
   register, reports.

## Validation gates & output labelling (§1.4)

- **Gate 1** — golden example reproduces exactly + all invariants pass → engine computes correctly;
  every output labelled `engine_validated_configuration_provisional`. Achievable with the provisional
  archetype and placeholder weightings; the developer is **not blocked** by the §10.1 open items.
- **Gate 2** — real arithmetic + weightings transcribed, a dossier-specific worked example reproduces
  exactly, and a **second reader** signs off → label becomes `validated`.
- Until §9 passes at all, outputs are labelled `unvalidated` and must not be circulated (see
  [[testing]]).

## Decisions the developer must NOT make (§10.1) — carry as assumptions, never resolve in code

| ID | Item | Owner |
|---|---|---|
| OQ-A | The arithmetic converting comparison price into price points | Bid manager |
| OQ-B | The actual quality sub-criterion weightings (currently fail VA-02) | Bid manager |
| OQ-C | The level at which the 50% exclusion threshold applies | Bid manager |
| OQ-D | Which competitor archetypes are plausible, and their cost profiles | Bid manager |
| OQ-E | Which licences count as "additional licences required" | Architect / pricing owner |
| OQ-F | Which segments each per-user component applies to, and at what rate | Architect / pricing owner |
| OQ-G | Whether own variant and excluded bids count in the reference set | Bid manager |
| OQ-H | Expected consumption quantities per period for the envelope test | Delivery lead |
| OQ-I | Which reading of each ambiguity is adopted, and its assumption text | Bid manager |

**TODO (undecided — dossier-level):** AMB-1 (evaluation horizon: 1 vs 6 periods) and AMB-2 (basket
periodicity: `ONCE_OVER_HORIZON` vs `PER_PERIOD`) are modelled as ambiguities with both readings run;
they are **not** to be resolved by a code default.

## Deferred — architecture must not preclude, first release must not implement (§11)

DF-01 more archetypes · DF-02 `PopulationSchedule` (per-period population) · DF-03 full-combination
ambiguity execution · DF-04 sensitivity sweep / tornado · DF-05 generic break-even root finder ·
DF-06 price indexation · DF-07 quality assumptions as ranges · DF-08 charts, run-delta, generated
memo, archiving/purging, simulated distributions, multiple competitive fields.
