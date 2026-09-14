<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Testing & validation requirements

> Source: HLD §9. Testing is central — the build is **not complete** until §9.2 and §9.3 both pass;
> until then every output is labelled `unvalidated` and must not be circulated. Related:
> [[calculation-contracts]], [[numeric-and-money]], [[confidentiality-and-provenance]].

## How tests run (kickstart decision)

- **Browser test page** — a `tests.html` that loads the engine ES modules plus a tiny assertion
  harness; open it in a browser to run the golden example, invariants, and boundary cases. No build
  step, no external test dependency.
- Served over http via the `serve` skill (ES-module imports need an http origin).

## Fixtures (AR-03 / AR-04)

- **Synthetic values only.** No real rates, licence costs, or competitor data in any fixture (see
  [[confidentiality-and-provenance]]).
- The **§9.3 golden worked example is the reference fixture.**

## Golden worked example (§9.3) — must reproduce EXACTLY at every intermediate step

Key expected values the tests must assert (synthetic; full table in the HLD):

- Basket (`ONCE_OVER_HORIZON`) = **112,000.00**.
- Comparison prices — A: **242,000.00** (both states); B INITIAL: **258,000.00**; B GROWN:
  **498,000.00** (segment_contributions staff 48,000.00 / students 240,000.00).
- Price scores (ref price 230,000.00): A **38.02**; B INITIAL **35.66**, GROWN **18.47**; C **40.00**.
- Totals & ranks per state, and quality compensation pair (L=A, H=B): INITIAL gap **+3.64**, GROWN
  gap **−13.55**, both `COMPUTED`.

## Invariant tests (§9.2 — IN-01…07)

- **IN-01** `Σ cost_contributions = comparison_price`
- **IN-02** `Σ segment_contributions = total of per-user components`
- **IN-03** `Σ quality_contributions = quality_score`
- **IN-04** `price_score + quality_score = total_score` (non-excluded participants)
- **IN-05** monotone archetype: a higher comparison price never yields a higher price score
- **IN-06** identical inputs → identical outputs (same `input_hash` → same results)
- **IN-07** `0 <= price_score <= price_points_max`

## Boundary & failure tests (§9.4)

Cover: single component; one-off + recurring (recurring × horizon, IN-01 holds); per-user applicable
to one segment (others → explicit zero line); basket `PER_PERIOD` (× horizon); zero-cost component
included as a zero line; quality exactly at threshold under GTE **passes**; just below →
`EXCLUDED_QUALITY`, no rank/total; two equal prices → equal scores, shared rank, next skipped; empty
reference set / non-positive price → `BLOCKED` + warning; missing periodicity → VA-04 BLOCK; unknown
segment → VA-05 BLOCK; assumption above scale → VA-08 BLOCK; weightings not summing → VA-02 BLOCK.

## Done means

§9.2 (all invariants) **and** §9.3 (golden example, every intermediate step) pass → outputs may leave
the `unvalidated` label and carry the Gate 1 label. See the gates in [[award-simulator-domain]].
