<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Engine architecture — layering & JS conventions

> Technical-layer lens. Source: HLD §2 (AR-01…05). Stack decided at kickstart: **plain HTML/CSS/JS,
> browser, no build step, native ES modules**. Related: [[frontend-ui]], [[configuration-validation]].

## Layer separation (the hard boundary)

```
/engine                    generic — reusable across dossiers, NO dossier data, NO DOM
    calculation_contracts  archetype interface + implementations   (see [[calculation-contracts]])
    cost_engine            periodicity, segment and horizon expansion  (§5.2)
    quality_model          weighting, thresholds, exclusion            (§5.3)
    field_evaluator        competitive field -> price scores
    scenario_runner        variants × population states × readings     (§5.1)
    compensation           quality-point break-even between variants    (§5.4)
    envelope               deliverability test                         (§5.5)
    validation             golden example, invariants, config checks   (see [[configuration-validation]])
    reporters              machine-readable + human-readable output    (see [[frontend-ui]])

/dossiers/<procurement-id> per dossier — DISPOSABLE
    config/                methodology, cost schema, populations, quality criteria, ambiguities, envelope
    rates/                 own rates and licence costs    [SENSITIVE — see [[confidentiality-and-provenance]]]
    competitors/           modelled field entries         [SENSITIVE]
    output/                scenario results, reports, register
```

## Layering rules — directives (AR-01…05)

- **AR-01 / BR-01** Formula *selection* and all dossier parameters are configuration; generic formula
  *evaluation logic* is engine code.
- **AR-02** The engine layer **must not** contain persisted, defaulted or hard-coded dossier entity
  instances. It processes dossier instances supplied at runtime (SC-07).
- **AR-03** Rates, licence costs and competitor entries exist **only** in the dossier folder — never
  copied into engine code, shared templates, or test fixtures.
- **AR-04** Test fixtures use **synthetic values only**; the §9.3 golden example is the reference
  fixture (see [[testing]]).
- **AR-05** A new archetype is a new contract implementation, never a dossier branch inside an
  existing one (see [[calculation-contracts]]).

## JavaScript / module conventions (kickstart decisions)

- **Native ES modules** — `import`/`export` across files; the module tree mirrors the `/engine`
  folder layout above. Load the app with `<script type="module">`.
- **Served over http, not `file://`** — ES-module imports and `fetch`-based config loading require an
  http origin. Use the `serve` skill to run locally.
- **The engine layer contains no DOM access** — no `document`, `window`, or event handling in
  `/engine`. It takes plain data in and returns plain data out; the browser/UI concerns live in the
  frontend layer (see [[frontend-ui]]).
- **No bundler / no build step.** Do not introduce a build toolchain without an explicit decision.
- **Money and Quantity are value objects, never bare numbers** — see [[numeric-and-money]].

## What "done" looks like for an engine change

- Stays inside the correct module; no dossier value or SENSITIVE data enters `/engine` (VA-14 scan
  passes — see [[configuration-validation]]).
- The relevant §9 invariants and golden-example steps still reproduce exactly (see [[testing]]).

**TODO (undecided):** lint/format tooling (e.g. ESLint / Prettier) is not chosen — add a rule and a
`format` skill here if/when the team adopts one.
