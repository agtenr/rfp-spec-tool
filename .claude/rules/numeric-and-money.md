<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Numeric & money rules

> Cross-cutting concern with a non-standard approach a planner **must** respect. Source: HLD §3.1,
> §4.1 (NUM-01…04). Related: [[calculation-contracts]], [[award-simulator-domain]].

## Value objects — never bare numbers (§3.1)

- All monetary values are **`Money`** (`amount` decimal, `currency` ISO code). All quantities are
  **`Quantity`** (`value`, `unit` HOUR|USER|ITEM|PERIOD, optional `period_basis` PER_PERIOD|ONCE).
- Neither `Money` nor `Quantity` is a bare number anywhere in engine or UI code.

## Numeric contract (NUM-01…04)

- **NUM-01** Monetary calculation uses **fixed-decimal arithmetic. Binary floating-point is not used
  for monetary values.**
- **NUM-02** Intermediate values are **not rounded**. Rounding occurs **once**, when a score is
  produced for output.
- **NUM-03** Precision and rounding mode come from **`DossierConfiguration`** (`calculation_precision`,
  `display_precision`, `rounding_mode` ∈ HALF_UP|HALF_EVEN|DOWN) — **never from code defaults**.
- **NUM-04** A percentage is stored as a **decimal fraction**, not a whole number (e.g. 50% → 0.5;
  `threshold_basis = PERCENT_OF_MAX` resolves against the relevant maximum before comparison).

## Convention decision (resolved at kickstart)

> **Money is represented as integer minor units.** Because plain JS `number` is IEEE-754 double,
> Money is stored and computed as **integer minor units** (the smallest currency unit), formatted to
> a decimal string only for display. Chosen: integer-minor-units arithmetic. Alternatives considered:
> a vendored decimal library (decimal.js / big.js); deferring the decision. This directly satisfies
> NUM-01 (no binary float touches a monetary value).

Implications the planner/coder must honour:

- Do arithmetic on integers; convert to a display decimal only at the output boundary, applying
  `display_precision` + `rounding_mode` **once** (NUM-02).
- Watch products that can overflow / lose exactness: `PER_USER_PER_PERIOD = amount × Σsegments ×
  evaluation_horizon` (§5.2). Keep unit amounts in minor units and multiply by integer counts.
- `calculation_precision` governs internal minor-unit granularity if a currency/step needs sub-unit
  precision; do not silently truncate — round once, at output, by the configured mode.
- Never introduce a code-level default precision, rounding mode, or currency (NUM-03; see also
  VA-03/VA-07 in [[configuration-validation]]).
