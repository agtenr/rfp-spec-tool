<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Frontend / UI & reporters

> Technical-layer lens (the thinnest — the UI surface is deliberately small in the MVP). Source: HLD
> §6. Stack: plain HTML/CSS/JS. Related: [[engine-architecture]], [[numeric-and-money]].

## Responsibilities

The browser layer **loads configuration**, invokes the engine, and **renders the two required
outputs**. It holds **no calculation logic** — all scoring, expansion and validation lives in
`/engine` (see [[engine-architecture]]). If a number is being computed in the UI, it is in the wrong
layer.

## Configuration loading

- Dossier configuration is **loaded from file, not embedded** (§1.3.1) — no dossier value in the app
  code.
- Load via `fetch` from a served path, or via a file-picker (`<input type="file">`) for local files.
  Because ES modules + `fetch` need an http origin, run through the `serve` skill (not `file://`).

## The two required outputs (§6) — first build

1. **Machine-readable — scenario results** (§6.2): one row per `ScenarioResult` with the §3.7 columns
   **in that order**; sorted by population state, then reading set, then descending total score;
   excluded rows sort last with empty rank and total score.
2. **Human-readable — decision report** (§6.3), sections in order: Header (metadata block, validation
   gate prominent) · Scenario comparison (price marked *calculated*, quality marked *assumed*) ·
   Quality compensation · Ambiguity spread · Envelope (with the nominal-values label) · Assumption
   register · Warnings.

The one-page decision memo is written by the bid manager **from** this report — it is **not**
generated (§6.3). Charts and a generated memo are deferred (DF-08).

## Mandatory metadata on every output (§6.1)

`run_id`, `dossier_id`, `configuration_version`, `engine_version`, `input_hash`, `generated_at`,
`validation_gate`, `confidentiality_classification`, and the statement that figures marked `DERIVED`
or `SIMULATED` are not measured (see [[confidentiality-and-provenance]]).

## Display rules

- Price score is shown as **calculated**, quality score as **assumed** — never merged (BR-06).
- Display precision comes from `DossierConfiguration`; formatting Money for display is a UI concern,
  but the underlying value stays in integer minor units until formatted (see [[numeric-and-money]]).

**TODO (undecided):** no CSS framework or component approach chosen; keep it plain until a need
appears.
