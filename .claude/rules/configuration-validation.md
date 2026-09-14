<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Configuration validation — the pre-run gate

> Cross-cutting concern. Source: HLD §8 (VA-01…16). Related: [[engine-architecture]],
> [[numeric-and-money]], [[confidentiality-and-provenance]].

## Principle

**All checks run before any scenario executes** (§5.1 step 1). `BLOCK` prevents the run; `WARN`
allows it but is recorded in `warnings[]` and **reproduced in every output**. Validation is
config-driven — there are no code defaults to fall back on (see NUM-03 in [[numeric-and-money]]).

## The checks (VA-01…16)

| ID | Check | Action |
|---|---|---|
| VA-01 | `price_points_max + quality_points_max = total_points_max` | BLOCK |
| VA-02 | Quality criteria `weighted_points_max` sum to `quality_points_max` | BLOCK |
| VA-03 | `evaluation_horizon`, `period_unit`, `calculation_precision`, `display_precision`, `rounding_mode` configured | BLOCK |
| VA-04 | Every cost component has a type, a periodicity and a provenance | BLOCK |
| VA-05 | Every per-user component resolves against every segment of every population state (segment rate, universal rate, or explicit zero) | BLOCK |
| VA-06 | Every basket line maps to a declared rate category | BLOCK |
| VA-07 | Every monetary value is non-negative and carries the configured currency | BLOCK |
| VA-08 | Every quality assumption lies within its criterion's input scale | BLOCK |
| VA-09 | Every competitive field contains at least one eligible entry | BLOCK |
| VA-10 | Identifiers are unique within their entity type | BLOCK |
| VA-11 | Every registered ambiguity has ≥2 readings, a baseline and a named owner | WARN; ambiguity report marked incomplete |
| VA-12 | Conflicting parameter overrides between readings in one run | BLOCK |
| VA-13 | Every `REQUIRED_BY_SPEC` component present & priced in every variant; open-ended "all other costs" needs a completeness-attestation flag instead of enumeration | BLOCK for enumerable; WARN + attestation for open-ended |
| VA-14 | Engine folder contains no dossier-specific value (automated scan) | BLOCK release |
| VA-15 | Source methodology version no older than the latest known publication date | WARN: output may be stale |
| VA-16 | Second-reader sign-off recorded | WARN on every output until present; required for Gate 2 |

## Notes for the planner

- **VA-02 is currently expected to fail** for the first dossier — the derived quality weightings do
  not sum to the maximum (OQ-B). This is a known provisional state, surfaced not silently patched.
- **VA-14** is enforced by the `engine-scan` skill (see [[confidentiality-and-provenance]] and
  [[engine-architecture]]); it BLOCKs *release*, not local iteration.
- **VA-16** keeps a WARN on every output until a second reader signs off — a precondition for Gate 2.
- Boundary/failure behaviour for these checks is covered by the §9.4 tests (see [[testing]]).
