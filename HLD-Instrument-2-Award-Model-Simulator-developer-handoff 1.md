# Functional High-Level Design — Award Model Simulator

**Version:** 3.0 — developer hand-off
**Document type:** Functional analysis / High-Level Design
**Status:** Ready for implementation
**Supersedes:** v2.0 (functional design), incorporating the accepted findings of the steelman review
**Upstream dependency:** Instrument 1 — Source Dossier Consolidator
**First application dossier:** VUB ID915 — intranet framework agreement

---

## How to read this document

| If you are | Read |
|---|---|
| The developer | §1.3, §2, §3, §4, §5, §6, §9, §10, §11 |
| The bid manager | §1, §7, §8, §10, §12 |
| Reviewing scope | §1.3 and §11 — what is in the first build and what is deliberately not |

**Two rules govern everything below.**

1. **Build the vertical slice, not the library.** One archetype implemented exactly, behind a generic contract interface. The library grows one archetype per dossier.
2. **Where the specification is silent, the model does not decide.** Silent resolution of an ambiguity is the failure mode this instrument exists to prevent.

---

# 1. Objective and boundary

## 1.1 Purpose

The simulator reproduces a procurement's published award methodology and replays it against the bidder's own cost structure, so that the decisive question can be answered before the response is written:

> Not *"what is our price"*, but *"which solution architecture can we afford in points"*.

## 1.2 The question this build must answer

For the first dossier, one question governs the design:

> At which user population does a licence-bearing product architecture stop being affordable in points, and does that point fall above or below the grown-state population?

Everything not needed to answer that question is deferred (§11).

## 1.3 MVP boundary — what the first build contains

**In the first build:**

1. Dossier configuration loaded from file; no dossier value in engine code.
2. One formula archetype, implemented against the generic calculation-contract interface of §4.
3. Comparison-price roll-up: fixed components, imposed basket, per-user components, recurring components.
4. Evaluation horizon and per-component periodicity.
5. Population states as segment sets; snapshot semantics only.
6. Up to three bid variants.
7. One competitive field containing the own variants and one or more competitor entries.
8. Weighted quality score from assumed inputs, with exclusion threshold.
9. Scenario comparison table across variants × population states.
10. Quality-compensation calculation.
11. Registered ambiguity readings, one-at-a-time execution.
12. Budget-envelope test on a fixed expected-consumption profile.
13. Golden worked example reproduced exactly at every intermediate step, plus invariant tests.
14. One machine-readable and one human-readable output.

**Not in the first build:** see §11. The architecture must not preclude those items; the first release must not implement them.

## 1.4 Validation gates

| Gate | Condition | Status conferred |
|---|---|---|
| **Gate 1** | The golden worked example of §9.3 reproduces exactly at every intermediate step, and all invariant tests pass. | The engine computes correctly. Every output is labelled `engine_validated_configuration_provisional`. |
| **Gate 2** | The dossier's real price-scoring arithmetic and quality weightings have been transcribed from the specification, a dossier-specific worked example reproduces exactly, and a second reader has signed off the transcription. | Outputs may be relied upon for the architecture and pricing decisions. Label becomes `validated`. |

Gate 1 is achievable with a provisional archetype and placeholder weightings. **The developer is not blocked by the unresolved items in §10.**

## 1.5 Success criteria

| ID | Criterion |
|---|---|
| SC-01 | The golden worked example reproduces exactly, at every specified intermediate step. |
| SC-02 | All invariant tests of §9.2 pass. |
| SC-03 | Every scenario is computed in each configured population state. |
| SC-04 | Each registered ambiguity is run under every reading, with the spread reported. |
| SC-05 | For every pair of bid variants, the required quality-point compensation is computed and reported alongside the assumed delta. |
| SC-06 | The numbered assumption register is exportable. |
| SC-07 | No dossier-specific value is present in the engine layer. |
| SC-08 | Every output carries run identity, configuration version, provenance and validation gate. |

---

# 2. Architecture and layering

```
/engine                        generic — reusable across dossiers
    calculation_contracts      archetype interface + implementations
    cost_engine                periodicity, segment and horizon expansion
    quality_model              weighting, thresholds, exclusion
    field_evaluator            competitive field -> price scores
    scenario_runner            variants x population states x readings
    compensation               quality-point break-even between variants
    envelope                   deliverability test
    validation                 golden example, invariants, config checks
    reporters                  machine-readable and human-readable output

/dossiers/<procurement-id>     per dossier — disposable
    config/                    methodology, cost schema, populations,
                               quality criteria, ambiguities, envelope
    rates/                     own rates and licence costs   [SENSITIVE]
    competitors/               modelled field entries        [SENSITIVE]
    output/                    scenario results, reports, register
```

**Layering rules (functional, not preference):**

| ID | Rule |
|---|---|
| AR-01 | Formula *selection* and all dossier parameters are configuration. Generic formula *evaluation logic* is engine code. |
| AR-02 | The engine layer shall not contain persisted, defaulted or hard-coded dossier entity instances. It processes dossier instances supplied at runtime. |
| AR-03 | Rates, licence costs and competitor entries exist only in the dossier folder. They are never copied into engine code, shared templates or test fixtures. |
| AR-04 | Test fixtures use synthetic values only. The golden example of §9.3 is the reference fixture. |
| AR-05 | A new archetype is added to the engine as a new implementation of the calculation-contract interface. A dossier-specific branch inside an existing archetype is not acceptable. |

---

# 3. Data contract

All monetary values are `Money`. All quantities are `Quantity`. Neither is a bare number.

## 3.1 Value objects

```
Money
- amount            decimal
- currency          ISO code

Quantity
- value             decimal
- unit              enum: HOUR | USER | ITEM | PERIOD
- period_basis      optional enum: PER_PERIOD | ONCE
```

## 3.2 Configuration and run identity

```
DossierConfiguration
- dossier_id                 string
- configuration_version      string
- source_methodology_version string        (from Instrument 1)
- created_at, created_by
- currency                   ISO code
- calculation_precision      integer       (internal decimal places)
- display_precision          integer
- rounding_mode              enum: HALF_UP | HALF_EVEN | DOWN
- evaluation_horizon         integer       (number of periods)
- period_unit                enum: YEAR | MONTH
- validation_gate            enum: GATE_1 | GATE_2

Run
- run_id                     string
- configuration_version      string
- input_hash                 string
- engine_version             string
- started_at, completed_at
- status                     enum: OK | FAILED | BLOCKED
- validation_gate            enum
- warnings[]                 string
```

## 3.3 Methodology

```
AwardMethodology
- archetype_reference        string        (see §4)
- price_points_max           decimal
- quality_points_max         decimal
- total_points_max           decimal
- exclusion_rule             ExclusionRule
- source_layer               string        (base | annex | corrigendum | qa)

ExclusionRule
- level                      enum: TOTAL_QUALITY | PER_CRITERION | SPECIFIC_CRITERION
- criterion_reference        optional
- threshold_value            decimal
- threshold_basis            enum: ABSOLUTE_POINTS | PERCENT_OF_MAX
- operator                   enum: GTE | GT        (value required to pass)

QualityCriterion
- id, name
- input_scale_max            decimal       (scale on which assumptions are entered)
- weighted_points_max        decimal       (contribution to quality_points_max)
- is_exclusion_criterion     boolean
- threshold_value            optional decimal
- source_layer               string
```

`weighted_contribution = (assumed_raw_score / input_scale_max) × weighted_points_max`

## 3.4 Cost structure

```
CostComponent
- id, name
- type                       enum: FIXED | BASKET | PER_USER | OTHER
- periodicity                enum: ONE_OFF | PER_PERIOD | PER_USER | PER_USER_PER_PERIOD
- applicable_segments[]      segment ids, or ALL
- amount                     Money            (unit amount; see §5.2)
- obligation                 enum: REQUIRED_BY_SPEC | OPTIONAL
- provenance                 enum: MEASURED | DERIVED | SIMULATED

Rate                          [SENSITIVE]
- profile_category           string
- amount                     Money            (per hour)
- outside_business_hours     boolean
- provenance                 enum

ImposedBasket
- periodicity                enum: ONCE_OVER_HORIZON | PER_PERIOD
- lines[]                    BasketLine

BasketLine
- profile_category           string
- quantity                   Quantity
```

## 3.5 Population

```
Segment
- id, name
- count                      integer
- entitlement_notes          string

PopulationState                (snapshot — used for scoring and break-even)
- id, name
- segments[]                 Segment
- is_applicable_to_all_periods  boolean
```

**Snapshot semantics.** A `PopulationState` is evaluated as if it held for every period of the evaluation horizon. It is a comparison device, not a forecast. A per-period projection (`PopulationSchedule`) is deferred — see §11, DF-02 — and until it exists, no output may be presented as a multi-period cost projection unless `is_applicable_to_all_periods` is true.

## 3.6 Bids, field and quality assumptions

```
BidVariant
- id, name
- cost_component_values[]    CostComponent
- rate_set[]                 Rate
- quality_assumptions[]      QualityAssumption

CompetitorEntry                [SENSITIVE]
- id, name                   archetype label, never a firm name
- pricing_mode               enum: DIRECT_PRICE | COST_STRUCTURE
- comparison_price           optional Money      (when DIRECT_PRICE)
- cost_component_values[]    optional            (when COST_STRUCTURE)
- quality_assumptions[]      QualityAssumption

CompetitiveField
- id, name
- population_state_reference
- entries[]                  FieldEntry
- own_variant_counts_in_reference_set   boolean
- excluded_bids_count_in_reference_set  boolean

FieldEntry
- participant_reference      BidVariant or CompetitorEntry
- multiplicity               integer, default 1
- eligibility_status         enum: ELIGIBLE | EXCLUDED | INVALID

QualityAssumption
- criterion_reference
- assumed_raw_score          decimal      (on the criterion's input scale)
- owner                      string
```

## 3.7 Ambiguity, assumption, envelope, result

```
Ambiguity
- id, description, owner
- readings[]                 Reading
- baseline_reading_reference

Reading
- id, description
- parameter_overrides[]      key/value pairs against DossierConfiguration

Assumption
- number, text
- source_ambiguity_reference
- selected_reading_reference
- owner

ExpectedConsumption            (envelope test only — not a scoring input)
- lines[]                    (profile_category, Quantity per period)
- other_recurring[]          Money per period

ScenarioResult
- run_id, dossier_id, configuration_version, engine_version
- own_variant, competitive_field, population_state, reading_set[]
- comparison_price           Money
- cost_contributions[]       (component id, Money)      — must sum to comparison_price
- segment_contributions[]    (segment id, Money)        — must sum to per-user total
- reference_price            Money
- price_score_raw            decimal
- price_score                decimal      (rounded, labelled CALCULATED)
- quality_contributions[]    (criterion id, decimal)    — must sum to quality_score
- quality_score              decimal      (labelled ASSUMED)
- exclusion_status           enum: OK | EXCLUDED_QUALITY
- total_score                decimal
- rank                       integer
- score_margin               decimal      (own total minus best other total)
- envelope_status            enum: WITHIN | EXCEEDS | NOT_ASSESSED
- validation_gate            enum
- warnings[]
```

---

# 4. Calculation contract

## 4.1 The contract interface

Every archetype implements this interface. The interface is generic; each implementation is a self-contained specification.

```
CalculationContract
- archetype_id
- inputs                     named, typed
- preconditions              conditions under which the contract is defined
- reference_set_rule         which field entries form the reference
- formula                    the exact equation
- bounds                     minimum and maximum score
- rounding                   when rounding occurs and at which step
- exclusion_handling         effect of an excluded or invalid entry
- tie_handling               behaviour when two prices are equal
- error_behaviour            behaviour when a precondition fails
- worked_example             inputs and expected outputs, step by step
```

**Rounding rule, applying to all contracts unless the published methodology states otherwise:**

| ID | Rule |
|---|---|
| NUM-01 | Monetary calculation uses fixed-decimal arithmetic. Binary floating-point is not used for monetary values. |
| NUM-02 | Intermediate values are not rounded. Rounding occurs once, when a score is produced for output. |
| NUM-03 | Precision and rounding mode come from `DossierConfiguration`, never from code defaults. |
| NUM-04 | A percentage is stored as a decimal fraction, not as a whole number. |

## 4.2 Archetype to implement in the first build

```
Archetype: LOWEST_PRICE_RATIO

Inputs
- eligible comparison prices P = {p_1 ... p_n}, from the competitive field
- maximum price points M

Preconditions
- n >= 1
- every p_i > 0

Reference set
- entries with eligibility_status = ELIGIBLE
- the own variant is included if own_variant_counts_in_reference_set is true
- entries with eligibility_status = EXCLUDED are included only if
  excluded_bids_count_in_reference_set is true
- an entry with multiplicity m contributes m identical prices

Reference price
- p_ref = min(P)

Raw score for participant i
- raw_i = M × p_ref / p_i

Final score
- score_i = round(raw_i, display_precision, rounding_mode)

Bounds
- 0 <= score_i <= M

Ties
- equal prices receive equal scores and share a rank; the next rank is skipped

Errors
- n = 0            -> status BLOCKED, warning "empty reference set"
- any p_i <= 0     -> status BLOCKED, warning "non-positive comparison price"
```

**The archetype currently configured for the first dossier is provisional.** It is a placeholder until the real arithmetic is transcribed (§10, OQ-A). Replacing it must require a configuration change and a new contract implementation — never an edit inside an existing one.

---

# 5. Processing logic

## 5.1 Order of operations

```
1. Load and validate configuration                      (§8 blocks on failure)
2. For each ambiguity reading in scope:
3.   For each population state:
4.     For each participant in the competitive field:
5.       Expand cost components  -> comparison price     (§5.2)
6.     Build the reference set, apply the contract       (§4.2) -> price scores
7.     Compute weighted quality and exclusion            (§5.3)
8.     Compute total score, rank, margin
9.     Compute quality compensation per variant pair     (§5.4)
10.    Run the envelope test                             (§5.5)
11. Emit results, register and reports                   (§6)
```

## 5.2 Comparison-price expansion

For each cost component, in this order:

| Periodicity | Expansion |
|---|---|
| `ONE_OFF` | `amount` counted once |
| `PER_PERIOD` | `amount × evaluation_horizon` |
| `PER_USER` | `amount × Σ(count of each applicable segment)` |
| `PER_USER_PER_PERIOD` | `amount × Σ(count of each applicable segment) × evaluation_horizon` |

Segments outside `applicable_segments` contribute zero and are still reported as a zero line.

The imposed basket expands as `Σ(line quantity × matching rate)`, multiplied by `evaluation_horizon` when `periodicity = PER_PERIOD`, counted once when `ONCE_OVER_HORIZON`.

`comparison_price = Σ all expanded cost components + expanded basket`

Every expansion step is recorded in `cost_contributions` and, for per-user components, in `segment_contributions`.

## 5.3 Quality and exclusion

```
weighted_contribution_c = (assumed_raw_score_c / input_scale_max_c) × weighted_points_max_c
quality_score           = Σ weighted_contribution_c
```

Exclusion is evaluated per `ExclusionRule`:

- `TOTAL_QUALITY` — compare `quality_score` against the threshold.
- `PER_CRITERION` — compare each criterion's weighted contribution against its own threshold; failing any one excludes.
- `SPECIFIC_CRITERION` — compare the named criterion only.

`threshold_basis = PERCENT_OF_MAX` resolves against the relevant maximum before comparison. The `operator` states what passing requires; equality passes only under `GTE`.

An excluded participant reports `exclusion_status = EXCLUDED_QUALITY`, retains its computed `price_score` and `quality_score` for diagnostic purposes, and reports **no rank and no total_score** in the comparison table.

## 5.4 Quality compensation

For an ordered pair (cheaper variant `L`, higher-priced variant `H`) within the same field and population state:

```
required_quality_delta = price_score_L − price_score_H
assumed_quality_delta  = quality_score_H − quality_score_L
compensation_gap       = assumed_quality_delta − required_quality_delta
```

Defined behaviours:

| Case | Output |
|---|---|
| `required_quality_delta <= 0` | Status `NO_COMPENSATION_NEEDED`; H is not disadvantaged on price. |
| `required_quality_delta > quality_points_max` | Status `NOT_ACHIEVABLE`; the gap exceeds all quality points available. |
| Either variant excluded | Status `INDETERMINATE_EXCLUSION`; no delta reported. |
| Otherwise | Status `COMPUTED`; report required delta, assumed delta, gap, and the delta as a proportion of `quality_points_max`. |

## 5.5 Envelope test

The envelope test uses `ExpectedConsumption`, **never the imposed basket**. The basket is a scoring construct and does not represent forecast consumption.

```
per_period_cost = Σ(expected consumption line quantity × matching rate)
                + Σ(other_recurring)
                + Σ(PER_PERIOD and PER_USER_PER_PERIOD components at this population state)

envelope_status = WITHIN if per_period_cost <= annual_ceiling
                            and total over horizon <= total_ceiling
                  else EXCEEDS
```

Every envelope output carries the label: **nominal values; price revision excluded.**

---

# 6. Outputs

Two outputs are required in the first build. Both carry the metadata block of §6.1.

## 6.1 Mandatory metadata on every output

`run_id`, `dossier_id`, `configuration_version`, `engine_version`, `input_hash`, `generated_at`, `validation_gate`, `confidentiality_classification`, and the statement that figures marked `DERIVED` or `SIMULATED` are not measured.

## 6.2 Machine-readable — scenario results

One row per `ScenarioResult`, with the columns listed in §3.7, in that order. Sorted by population state, then reading set, then descending total score. Excluded rows sort last with empty rank and total score.

## 6.3 Human-readable — decision report

Sections, in order:

1. **Header** — metadata block, validation gate prominently stated.
2. **Scenario comparison** — per population state: variant, comparison price, price score (marked *calculated*), quality score (marked *assumed*), exclusion status, total, rank, margin.
3. **Quality compensation** — per variant pair, per population state: required delta, assumed delta, gap, status, and the required delta as a percentage of total quality points.
4. **Ambiguity spread** — per ambiguity, per reading: comparison price and total score for each own variant, and the spread between readings.
5. **Envelope** — per variant, per population state: per-period cost, ceiling, headroom, status, with the nominal-values label.
6. **Assumption register** — numbered assumptions, each with its source ambiguity, selected reading and owner.
7. **Warnings** — all warnings raised during the run.

The one-page decision memo is written by the bid manager from this report. It is not generated.

---

# 7. Business rules

| ID | Rule |
|---|---|
| BR-01 | Formula selection and dossier parameters are configuration; generic formula evaluation logic is engine code. |
| BR-02 | Where a population is scheduled to grow, every scenario is computed in the grown state as well as the initial state. The end state governs the architecture decision. |
| BR-03 | Ambiguity is an output. Every registered reading is executed and the spread reported. |
| BR-04 | The model never selects a reading. A human selects it, owns it, and the selection becomes a numbered assumption. |
| BR-05 | Competitors are modelled as archetype profiles, never as named firms. |
| BR-06 | The price score is reported as calculated; the quality score is reported as assumed. The two are never merged into a single undifferentiated figure. |
| BR-07 | The comparison price includes every cost component the specification obliges the bidder to declare, expanded by segment and horizon. |
| BR-08 | A participant below the exclusion threshold reports no rank and no total score. |
| BR-09 | The budget envelope is a constraint separate from the score. A variant may score well and still be undeliverable; both verdicts are reported. |
| BR-10 | The envelope test uses expected consumption, never the imposed basket. |
| BR-11 | A snapshot population state is not presented as a multi-period projection unless it is configured as applicable to all periods. |
| BR-12 | A variant comparison is only decision-relevant when expressed as a required quality delta. Comparing variants at equal assumed quality merely restates the cost difference. |
| BR-13 | Rates, licence costs and competitor entries never leave the dossier folder. Test fixtures contain no real dossier values. Sensitive values are not placed in AI prompts outside an approved environment. |
| BR-14 | Every figure carries provenance. Derived or simulated figures are never presented as measured. |
| BR-15 | Where the specification does not state the time basis of a cost component or of the basket, the uncertainty is registered as an ambiguity with horizon or periodicity readings. No default is applied. |
| BR-16 | The model runs only against a consolidated methodology from Instrument 1. Any re-run of Instrument 1 triggers a re-run here. |

---

# 8. Configuration validations

All are checked before any scenario executes. `BLOCK` prevents the run; `WARN` allows it and is recorded in `warnings[]` and reproduced in every output.

| ID | Check | Action |
|---|---|---|
| VA-01 | `price_points_max + quality_points_max = total_points_max` | BLOCK |
| VA-02 | Quality criteria `weighted_points_max` sum to `quality_points_max` | BLOCK |
| VA-03 | `evaluation_horizon`, `period_unit`, `calculation_precision`, `display_precision` and `rounding_mode` are configured | BLOCK |
| VA-04 | Every cost component has a type, a periodicity and a provenance | BLOCK |
| VA-05 | Every per-user component resolves against every segment of every population state — segment rate, universal rate, or explicit zero | BLOCK |
| VA-06 | Every basket line maps to a declared rate category | BLOCK |
| VA-07 | Every monetary value is non-negative and carries the configured currency | BLOCK |
| VA-08 | Every quality assumption lies within its criterion's input scale | BLOCK |
| VA-09 | Every competitive field contains at least one eligible entry | BLOCK |
| VA-10 | Identifiers are unique within their entity type | BLOCK |
| VA-11 | Every registered ambiguity has at least two readings, a baseline and a named owner | WARN; ambiguity report marked incomplete |
| VA-12 | Conflicting parameter overrides between readings in one run | BLOCK |
| VA-13 | Every cost component marked `REQUIRED_BY_SPEC` is present and priced in every bid variant. Where the specification includes an open-ended "all other costs" component, a completeness attestation flag is required instead of an enumeration. | BLOCK for enumerable; WARN plus attestation for open-ended |
| VA-14 | Engine folder contains no dossier-specific value (automated scan) | BLOCK release |
| VA-15 | Source methodology version is no older than the latest known publication date | WARN: output may be stale |
| VA-16 | Second-reader sign-off recorded | WARN on every output until present; required for Gate 2 |

---

# 9. Validation and test requirements

## 9.1 Requirement

The build is not complete until §9.2 and §9.3 both pass. Until they do, every output is labelled `unvalidated` and must not be circulated.

## 9.2 Invariant tests

| ID | Invariant |
|---|---|
| IN-01 | `Σ cost_contributions = comparison_price` |
| IN-02 | `Σ segment_contributions = total of per-user components` |
| IN-03 | `Σ quality_contributions = quality_score` |
| IN-04 | `price_score + quality_score = total_score` for non-excluded participants |
| IN-05 | Under a monotone archetype, a higher comparison price never yields a higher price score |
| IN-06 | Identical inputs produce identical outputs (same `input_hash` → same results) |
| IN-07 | `0 <= price_score <= price_points_max` |

## 9.3 Golden worked example

Synthetic values. This is the reference fixture; it contains no real dossier data.

**Configuration**

| Parameter | Value |
|---|---|
| Evaluation horizon | 6 periods (YEAR) |
| Price points max | 40 |
| Quality points max | 60 |
| Exclusion rule | TOTAL_QUALITY, 50 PERCENT_OF_MAX, operator GTE → pass at ≥ 30 |
| Display precision | 2 |
| Rounding mode | HALF_UP |
| Archetype | LOWEST_PRICE_RATIO |
| Reference set | own variants included; excluded bids not included |

**Rates**

| Profile | Rate |
|---|---|
| Project manager | 100.00 |
| Consultant | 90.00 |
| Developer junior | 60.00 |
| Developer senior | 110.00 |
| Outside business hours | 150.00 |

**Imposed basket** — periodicity `ONCE_OVER_HORIZON`: 150 PM, 150 consultant, 500 junior, 350 senior, 100 outside hours.

```
Basket = 150×100 + 150×90 + 500×60 + 350×110 + 100×150
       = 15,000 + 13,500 + 30,000 + 38,500 + 15,000
       = 112,000.00
```

**Population states**

| State | Segments |
|---|---|
| INITIAL | staff 4,000 |
| GROWN | staff 4,000; students 20,000 |

**Bid variants**

| Component | Variant A (platform-native) | Variant B (product-based) |
|---|---|---|
| Implementation, ONE_OFF | 100,000.00 | 80,000.00 |
| Basket | as above | as above |
| Licence, PER_USER_PER_PERIOD, all segments | 0.00 | 2.00 |
| Other recurring, PER_PERIOD | 5,000.00 | 3,000.00 |

**Competitor** — entry C, `DIRECT_PRICE` 230,000.00 in both states, multiplicity 1, ELIGIBLE.

**Expected comparison prices**

```
A, INITIAL and GROWN
  100,000 + 112,000 + 0 + (5,000 × 6 = 30,000)                 = 242,000.00

B, INITIAL
   80,000 + 112,000 + (2.00 × 4,000 × 6 = 48,000) + 18,000     = 258,000.00

B, GROWN
   80,000 + 112,000 + (2.00 × 24,000 × 6 = 288,000) + 18,000   = 498,000.00
     segment_contributions: staff 48,000.00; students 240,000.00
```

**Expected price scores** — reference price 230,000.00 in both states.

| State | Participant | raw | rounded |
|---|---|---|---|
| INITIAL | A | 40 × 230,000 / 242,000 = 38.016528… | **38.02** |
| INITIAL | B | 40 × 230,000 / 258,000 = 35.658914… | **35.66** |
| INITIAL | C | 40 × 230,000 / 230,000 = 40.000000 | **40.00** |
| GROWN | A | 38.016528… | **38.02** |
| GROWN | B | 40 × 230,000 / 498,000 = 18.473895… | **18.47** |
| GROWN | C | 40.000000 | **40.00** |

**Quality assumptions** — single criterion, input scale 100, weighted max 60.

| Participant | Raw | Weighted | Exclusion |
|---|---|---|---|
| A | 70 | 42.00 | OK |
| B | 80 | 48.00 | OK |
| C | 55 | 33.00 | OK |

**Expected totals**

| State | Participant | Price | Quality | Total | Rank |
|---|---|---|---|---|---|
| INITIAL | B | 35.66 | 48.00 | **83.66** | 1 |
| INITIAL | A | 38.02 | 42.00 | **80.02** | 2 |
| INITIAL | C | 40.00 | 33.00 | **73.00** | 3 |
| GROWN | A | 38.02 | 42.00 | **80.02** | 1 |
| GROWN | C | 40.00 | 33.00 | **73.00** | 2 |
| GROWN | B | 18.47 | 48.00 | **66.47** | 3 |

**Expected quality compensation**, pair (L = A, H = B):

| State | Required delta | Assumed delta | Gap | Status |
|---|---|---|---|---|
| INITIAL | 38.02 − 35.66 = **2.36** | 6.00 | **+3.64** | COMPUTED |
| GROWN | 38.02 − 18.47 = **19.55** | 6.00 | **−13.55** | COMPUTED |

Interpretation the engine must make reproducible: the product-based architecture is defensible at the initial population and is not defensible at the grown population, where it would need over 19 of 60 quality points more than the platform-native variant to draw level.

## 9.4 Boundary and failure tests

| Case | Expected behaviour |
|---|---|
| Single cost component only | Comparison price equals that component |
| One-off plus recurring | Recurring multiplied by horizon; IN-01 holds |
| Per-user component applicable to one segment only | Other segments contribute an explicit zero line |
| Basket `PER_PERIOD` | Basket multiplied by horizon |
| Zero-cost component | Included as a zero line, not omitted |
| Quality exactly at threshold, operator GTE | Passes |
| Quality just below threshold | `EXCLUDED_QUALITY`; no rank, no total |
| Two equal comparison prices | Equal scores, shared rank, next rank skipped |
| Empty reference set | Run status BLOCKED, warning raised |
| Non-positive comparison price | Run status BLOCKED, warning raised |
| Missing periodicity | Configuration BLOCK (VA-04) |
| Unknown segment on a per-user component | Configuration BLOCK (VA-05) |
| Quality assumption above input scale | Configuration BLOCK (VA-08) |
| Weightings not summing to maximum | Configuration BLOCK (VA-02) |

---

# 10. Dossier configuration — first application

*This section is dossier-specific and is replaced when the instrument is reused. Values marked **provisional** are placeholders until transcription from the specification; they do not block the build (§1.4).*

| Parameter | Value |
|---|---|
| Award split | Price 40 points; quality 60 points; total 100 |
| Exclusion rule | Below 50% on quality excludes. **Level provisional** — TOTAL_QUALITY assumed; confirm whether it applies to the total or per criterion (OQ-C) |
| Quality criteria | Solution block; profiles and expertise (carries the conformity-matrix assessment); project approach and collaboration; maintenance intensity. **Weightings provisional** — the derived source material does not sum to the quality maximum and fails VA-02 (OQ-B) |
| Archetype | **Provisional** — LOWEST_PRICE_RATIO configured pending transcription (OQ-A) |
| Comparison price composition | Fixed implementation price; total licence cost of additional licences required by the offered solution; the imposed basket; all other recurring or one-off costs necessary to make the solution fully operational |
| Imposed basket | 150 h project manager; 150 h SharePoint consultant; 500 h developer junior; 350 h developer senior; 100 h outside business hours |
| Basket note | Junior and senior developer hours account for 850 of 1,250 imposed hours; rate structure across profiles moves the score differently from a flat reduction |
| Basket periodicity | **Ambiguity AMB-2** — readings: ONCE_OVER_HORIZON, PER_PERIOD |
| Evaluation horizon | **Ambiguity AMB-1** — readings: 1 period, 6 periods |
| Period unit | YEAR |
| Population INITIAL | staff and PhD students ≈ 4,000 |
| Population GROWN | staff and PhD students ≈ 4,000; students ≈ 20,000; activated simultaneously |
| Segment rationale | Platform entitlements are not uniform across the population; a single blended per-user rate would misstate the comparison price in the grown state — the state that decides the architecture question |
| Budget envelope | ≈ EUR 100,000 excl. VAT per period; ≈ EUR 600,000 over 6 periods |
| Price revision | Index formula weighted 20% fixed / 80% indexed, on written request only. **Not modelled**; envelope output carries the nominal-values label |
| AMB-1 | "Total licence cost" is not stated as annual or full-term. Question round closed. Modelled as an evaluation-horizon ambiguity |
| AMB-2 | Basket periodicity is not stated |
| AMB-3 | The inventory annex has a limited number of lines while the amended pricing article introduces licence and other costs. Where a cost is declared determines whether it counts as declared |
| Competitive field | One field: variants A/B/C plus competitor archetypes. **Composition provisional** (OQ-D) |

## 10.1 Items the developer must not decide

These are configuration or human decisions. Where unresolved, the build proceeds with the provisional value and the Gate 1 label.

| ID | Item | Owner |
|---|---|---|
| OQ-A | The arithmetic converting comparison price into price points | Bid manager, from the specification |
| OQ-B | The actual quality sub-criterion weightings | Bid manager, from the specification |
| OQ-C | The level at which the 50% exclusion threshold applies | Bid manager |
| OQ-D | Which competitor archetypes are plausible, and their cost profiles | Bid manager |
| OQ-E | Which licences count as "additional licences required by the offered solution" | Architect and pricing owner |
| OQ-F | Which segments each per-user component applies to, and at what rate | Architect and pricing owner |
| OQ-G | Whether the own variant and excluded bids count in the reference set | Bid manager |
| OQ-H | Expected consumption quantities per period for the envelope test | Delivery lead |
| OQ-I | Which reading of each ambiguity is adopted, and its assumption text | Bid manager |

---

# 11. Deferred — deliberately not in the first build

| ID | Item | Why deferred |
|---|---|---|
| DF-01 | Additional formula archetypes (relative to mean, absolute threshold variants, combined archetypes) | One archetype per dossier; the library is harvested from real cases |
| DF-02 | `PopulationSchedule` — per-period population application | Snapshot semantics answer the architecture question; BR-11 prevents misreading in the meantime |
| DF-03 | Full-combination ambiguity execution | One-at-a-time is sufficient at the current ambiguity count; a configuration switch may be added later |
| DF-04 | Sensitivity sweep and tornado ranking | Valuable but not required to answer §1.2. When built, the decision metric must be configurable — total score, score margin, rank or compensation gap — because a parameter can barely move the score while materially moving the margin |
| DF-05 | Generic break-even root finder | The quality-compensation output answers the architecture question directly; a numeric root finder needs defined behaviour for no, multiple and discontinuous break-even points |
| DF-06 | Price indexation across the horizon | Affects the envelope verdict only; the nominal-values label covers the gap |
| DF-07 | Quality assumptions as ranges | Improves exclusion-risk honesty; does not change the architecture conclusion |
| DF-08 | Charts, run delta view, generated decision memo, archiving and purging workflow, simulated distributions, multiple competitive fields | Productisation |

The architecture must not preclude these. The first release must not implement them.

---

# 12. Relationship to Instrument 1

| Aspect | Statement |
|---|---|
| Sequencing | Hard dependency. Instrument 1 establishes *what is asked*; Instrument 2 establishes *what it costs in points to answer it one way rather than another*. |
| Received | Consolidated award methodology with publication dates; imposed volumes; pricing-related tightenings; unresolved ambiguity list. |
| Returned | Per ambiguity, the modelled score spread — which tells the team whether it warrants a documented assumption or can merely be noted. |
| Trigger | Any re-run of Instrument 1 triggers a re-run here, and a review of every decision and assumption already taken. |
| Prohibition | Running against unconsolidated sources (BR-16). Pricing articles are among the most frequently amended clauses in any procurement. |

---

# 13. Change record — v2.0 to v3.0

| Change | Origin |
|---|---|
| `CompetitiveField` and `FieldEntry` introduced; scoring evaluates a field rather than a variant-competitor pair | Review §2.3 — accepted as a modelling error |
| Envelope contradiction resolved: `ExpectedConsumption` is a mandatory MVP input, distinct from the imposed basket | Review §2.7 — accepted as self-inflicted |
| Snapshot semantics made explicit; `PopulationSchedule` deferred with BR-11 as the guard | Review §2.5 — accepted |
| `QualityCriterion` extended with input scale, weighted maximum and threshold level; `ExclusionRule` introduced | Review §2.4 — accepted |
| Calculation-contract interface defined; one archetype specified in full | Review §2.1 — accepted, scope reduced to one archetype |
| Numeric rules NUM-01 to NUM-04 added | Review §2.2 — accepted, full numeric contract deferred to Gate 2 |
| `DossierConfiguration`, `Run`, `Money`, `Quantity` added | Review §4.2–4.4 — accepted |
| Quality-compensation edge cases defined as statuses | Review §7.2 — accepted; `VariantQualityLever` entity not adopted |
| Invariant and boundary tests added alongside the golden example | Review §8 — accepted, scope reduced |
| BR-01 and the engine-instance rule reworded; both were factually wrong as written | Review §11.1–11.2 — accepted |
| Nominal-values labelling; output metadata reworded away from "page" | Review §11.5–11.6 — accepted |
| MVP reduced to a vertical slice; explicit deferral list | Review §3 and §15 — accepted |
| Full attribute sets on all entities, detailed `SourceReference`, `VariantQualityLever`, eight break-even statuses, full sensitivity apparatus, eleven additional open questions | Not adopted — disproportionate to a four-hour internal instrument; recorded as backlog |
