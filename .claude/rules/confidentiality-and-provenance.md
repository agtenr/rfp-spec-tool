<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Confidentiality & provenance

> Cross-cutting concern with a hard, security-relevant rule set. Source: HLD BR-05, BR-13, BR-14,
> AR-03, AR-04, §6.1. Related: [[engine-architecture]], [[testing]].

## SENSITIVE data — where it may live (BR-13, AR-03)

The following are marked **[SENSITIVE]** in the data contract and **must never leave the dossier
folder** (`/dossiers/<id>/rates/`, `/competitors/`):

- Own **rates** and **licence costs**.
- **Competitor entries** (cost structures and any comparison prices).

Hard directives:

- These values are **never** copied into engine code, shared templates, or **test fixtures**
  (AR-03/AR-04) — fixtures use synthetic values only (see [[testing]]).
- Sensitive values are **never placed in AI prompts outside an approved environment** (BR-13). When
  working a story, do not paste real rates / licence costs / competitor data into any prompt.
- **Competitors are modelled as archetype profiles, never named firms** (BR-05) — `CompetitorEntry`
  carries an archetype label, never a firm name.

## Provenance — every figure is labelled (BR-14)

- Every figure carries **provenance**: `MEASURED`, `DERIVED`, or `SIMULATED`.
- Derived or simulated figures are **never presented as measured**.
- Cost components additionally carry an `obligation` (`REQUIRED_BY_SPEC` | `OPTIONAL`).

## Output confidentiality & gate labelling (§6.1)

Every output carries `confidentiality_classification` and the explicit statement that figures marked
`DERIVED` or `SIMULATED` are not measured, alongside the validation-gate label
(`unvalidated` → `engine_validated_configuration_provisional` → `validated`; see
[[award-simulator-domain]]). The envelope output additionally carries the label **"nominal values;
price revision excluded"** (§5.5, BR-06 context).

## Enforcement hook

VA-14 requires an automated scan proving the engine folder holds no dossier-specific value — see the
`engine-scan` skill and [[configuration-validation]].
