<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Calculation contracts — the core abstraction

> Functional / domain lens. The single most important abstraction in the system. Source: HLD §4,
> AR-05. Related: [[award-simulator-domain]], [[numeric-and-money]].

## The contract interface (§4.1)

Every archetype **must** implement one generic interface; each implementation is a self-contained
specification. The interface is generic — the implementation is where a specific award formula lives.

A `CalculationContract` implementation must declare: `archetype_id`; `inputs` (named, typed);
`preconditions`; `reference_set_rule` (which field entries form the reference); `formula` (the exact
equation); `bounds` (min/max score); `rounding` (when, and at which step); `exclusion_handling`;
`tie_handling`; `error_behaviour`; and a `worked_example` (inputs + step-by-step expected outputs).

## Extension recipe — how a new archetype is added (AR-05)

- A new archetype is added as a **new implementation** of the contract interface in the engine layer.
- **A dossier-specific branch inside an existing archetype is not acceptable.** No `if dossier == …`.
- Formula *selection* is configuration (`AwardMethodology.archetype_reference`); the generic formula
  *evaluation logic* is engine code (AR-01 / BR-01).
- Grow the library **one archetype per real dossier** — never speculatively (governing rule 1).

## The one archetype in the first build: `LOWEST_PRICE_RATIO` (§4.2)

```
Inputs        eligible comparison prices P = {p_1 … p_n}; maximum price points M
Preconditions n >= 1; every p_i > 0
Reference set entries with eligibility_status = ELIGIBLE;
              own variant included iff own_variant_counts_in_reference_set;
              EXCLUDED entries included iff excluded_bids_count_in_reference_set;
              an entry with multiplicity m contributes m identical prices
Reference     p_ref = min(P)
Raw score     raw_i = M × p_ref / p_i
Final score   score_i = round(raw_i, display_precision, rounding_mode)
Bounds        0 <= score_i <= M
Ties          equal prices → equal scores, shared rank, next rank skipped
Errors        n = 0        → status BLOCKED, warning "empty reference set"
              any p_i <= 0 → status BLOCKED, warning "non-positive comparison price"
```

Rounding follows [[numeric-and-money]]: intermediates are **not** rounded; rounding happens once, at
score output, using the configured precision and mode.

## Provisional-archetype rule (§4.2, OQ-A)

`LOWEST_PRICE_RATIO` is **provisional** — a placeholder until the real price-scoring arithmetic is
transcribed from the specification (OQ-A, a bid-manager decision). Replacing it **must** require a
**configuration change and a new contract implementation** — never an edit inside an existing one.
This is exactly what lets Gate 1 be reached with the provisional archetype without blocking on §10.1.
