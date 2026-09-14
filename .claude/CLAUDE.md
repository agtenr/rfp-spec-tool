<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. The rules below are written as requirements to enforce once kept; this DRAFT status means
     YOU review and decide which to keep before relying on them. Re-run /aind:onboard once code
     exists to reconcile. -->

# Award Model Simulator (Instrument 2)

> Project guidance for AI agents in this repo, loaded automatically by the **aind** plugin. Keep
> this file about the *project*; the AIND workflow config sits below as a compact operational layer.

## Project context

A **procurement award-model simulator** that reproduces a tender's published award methodology and
replays it against the bidder's own cost structure, to answer *"which solution architecture can we
afford in points"* (not just "what is our price"). Built as **plain HTML/CSS/JS in the browser (no
build step, native ES modules)**: a generic reusable **`/engine`** (scoring, cost expansion, quality,
compensation, envelope, validation, reporters) is strictly separated from **disposable
`/dossiers/<id>`** config + SENSITIVE data. First dossier: VUB ID915. The governing HLD is
`HLD-Instrument-2-Award-Model-Simulator-developer-handoff 1.md`; it has a hard upstream dependency on
Instrument 1 (Source Dossier Consolidator). Two rules govern everything: **build the vertical slice
not the library**, and **where the specification is silent, the model does not decide**.

## Project rules

@rules/award-simulator-domain.md
@rules/calculation-contracts.md
@rules/engine-architecture.md
@rules/frontend-ui.md
@rules/numeric-and-money.md
@rules/confidentiality-and-provenance.md
@rules/configuration-validation.md
@rules/testing.md

## Project-specific guidance

- **Run/test locally over http, not `file://`** — ES modules + `fetch` config loading need an http
  origin. Use the `serve` skill; run §9 tests via the `test` skill (browser test page); check engine
  purity (VA-14) via the `engine-scan` skill. All three are **unverified stubs** until the toolchain
  exists.
- **Never resolve a §10.1 open question in code** — OQ-A…I are human decisions; carry them as
  numbered assumptions.
- **Never put SENSITIVE dossier data** (rates, licence costs, competitor entries) into engine code,
  fixtures, or AI prompts outside an approved environment.
- Integration branch: **`main`**. Code + PRs on **GitHub** (repo target to be set in
  `aind.settings.json`).

---

## AIND workflow layer

The sections below configure the **aind** plugin — operational scaffolding. Keep them, but the
project content above is the primary guidance.

### AIND operational rules (apply to every agent run here)

- **One status.** A work item carries exactly one AIND status. Only ever change it via the
  `aind-status` skill. Never edit the status by hand (on the ADO tracker that means never adding or
  removing the `AIND status - <state>` tag directly).
- **Sign every post.** Post work-item comments only via the `aind-comment` skill — it signs by agent
  name. On the ADO tracker, direct comment calls are blocked by a hook.
- **Plan location.** Plans live at `/plans/<work-item-id>/plan.md` and are permanent living
  documentation — never delete them after the code ships.
- **Reach branches through PRs.** Never construct or assume a branch name to find an artifact;
  resolve via the PR and the `AIND-LINKS` block. The work-item ID is the join value.
- **Don't author stories.** Intake suggests fixes; the human owns the story text.

### AIND configuration

Config lives in **two files** under `.claude/`, both auto-loaded (no manual `source` needed):

- **`.claude/aind.settings.json`** — shared, **checked in**. Source of truth for the work-item
  tracker (`tracker`: `ado` or `file`, + `trackerDir` for the file backend), ADO org/project (ADO
  tracker), code host + repo, integration branch, and the optional `worktree` / `telemetry` blocks.
  See `aind.settings.sample.json` for every key and its meaning.
- **`.claude/aind.env`** — secrets + per-user overrides, **gitignored**. Holds `AZURE_DEVOPS_EXT_PAT`
  (needed for the ADO tracker and/or the ADO code host) and optional `AIND_ACTOR`.

`/aind:onboard` (or `/aind:kickstart`) creates both and adds the gitignore line(s). This project uses
the **file tracker** — no work-item PAT is needed; create stories with `/aind:new-item` (or
`aind-tracker.sh new "<title>"`) under `trackerDir` (`.aind/items`).

**Work-item tracker.** `tracker: "ado"` keeps stories in Azure DevOps Boards. `tracker: "file"` keeps
one **markdown file per work item** under `trackerDir` (default `.aind/items`, may be an absolute path
outside the repo) — for projects with no ADO backlog / code-only access. Each item is a machine-owned
front-matter block (`state`, `dependsOn`, `links`, telemetry) plus human-owned `## Description` /
`## Acceptance Criteria` / `## Comments` sections; AIND updates the metadata and appends comments but
never edits your prose.

**Optional features** (all off by default, all configured in `aind.settings.json` — see the AIND
docs site at https://dlw-digitalworkplace.github.io/ai-native-dev/docs.html and the sample settings
file for details):
- **Worktrees** (`worktree.enabled: true`) — work several stories in parallel from one clone.
- **Usage telemetry** (`telemetry.enabled: true`) — per-phase raw token/time recorded onto the work
  item (raw numbers only; pricing done offline).
- **Native-State mirror** (`stateMap`, **ADO tracker only**) — not applicable to the file tracker
  (its `state` field *is* the status).
