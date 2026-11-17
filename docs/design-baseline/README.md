# Adventure Island — Design Baseline Reset

> **Effective date: 2026-11-17.** This is the single current entry point for design status on this branch. It supersedes earlier documents that described the legacy `cms-*` component ABI or the 2026-11-16 Product-First proposals as the active product baseline.

## 1. Baseline status

This branch is in a **design reset**, not a new runtime implementation phase.

- `ms-avatar` and `ms-action` remain the only current, reviewable component design candidates.
- Their existing fields, data shapes, playback semantics and parent/child relationship are preserved in this cleanup. They are **not approved, frozen, normative or implemented**.
- No complete Scene ABI, world draw-order contract, Camera, Movement, Portal, cross-component Renderer service or production scene root is currently approved.
- The LoomRealm Submodule remains pinned to `93648192323bf5f57996b7b54cbae641d8a53fdb`. This cleanup does not change the gitlink or add game code to LoomRealm.

## 2. Read these documents first

1. [Current design summary](../../DESIGN.md) — current scope, status and approval gates.
2. [ms-avatar candidate](../../design/ms-components/ms-avatar.md) — current avatar design candidate; unchanged interface.
3. [ms-action candidate](../../design/ms-components/ms-action.md) — current action Clip design candidate; unchanged interface.
4. [MS component index](../../design/ms-components/README.md) — status of candidate component documents and archived architecture proposals.
5. [Legacy runtime boundary](../../components/README.md) — what remains executable and why it is not the new baseline.

## 3. Legacy executable path

The repository still contains a working historical vertical slice:

- root Game Entry: `game.json`, `launch.pwa.json`, `launch.hostra.json`;
- `systems/base` and `systems/adventure-map`;
- legacy `cms-*` component contracts and `components/cms-actor`;
- `presentation.json`, which still registers the `cms-actor` classic script;
- PWA bundle/staging scripts and legacy Node/Chromium tests.

This path is retained for reproducibility and compatibility maintenance. Its tests do not validate the ms component candidates or any new Scene architecture. No new feature should depend on the old Adventure Island `cms-*` ABI or MapScenePlanV1. Do not delete this path until a separately approved replacement has a migration plan and equivalent regression coverage.

The five-field RenderNode shape owned by LoomRealm is an upstream platform transport contract. It is distinct from the old Adventure Island project-level `cms-*` ABI in `components/RENDER-NODE-ABI-V1.md`.

## 4. Preserved evidence and technical assets

The cleanup intentionally preserves, without upgrading their claims:

- CMS079 research tasks, source-of-truth, Claims / Evidence / Gaps and extraction reports under `research/`;
- the 13-map coverage matrix and Portal Graph under `docs/product-first/`;
- the OpenMS source-path and GPL-3.0 license matrix;
- the CMS079 WZ→FSDB real-closure report and its explicitly recorded anomalies;
- the pinned LoomRealm API and platform integration evidence.

The Portal Graph currently records 54 non-sentinel target entries: 46 unique in-closure targets and 8 out-of-closure targets; the 13-map internal graph is strongly reachable in the static audit. These are research facts, not permission to enable every edge or a claim that all target resources are complete.

The CMS079 WZ→FSDB report remains bounded by its own evidence. It explicitly records unresolved decodes and a confirmed converter omission; do not summarize it as lossless full-client conversion or complete client integrity.

## 5. Archived proposals — not implementation instructions

- [OpenMS-Guided Product-First archive](../product-first/README.md): 65 requirement proposals, ADR-001..016, module contracts and roadmap. None is approved by this reset.
- [Scene / RenderNode architecture proposal](../../design/ms-components/RENDERNODE-ARCHITECTURE.md): global Draw List, `ms-world-layer`, `ms-entity`, ProjectionBatch, decoded-resource cache, RenderClockProvider and Domain topology are candidate ideas only.
- [Historical RenderNode audit](../../design/ms-components/RENDERNODE-BASELINE-AUDIT.md): read-only snapshot against an earlier HEAD; not an independent acceptance review.
- [Legacy project-level RenderNode ABI](../../components/RENDER-NODE-ABI-V1.md) and [MapScenePlanV1](../../components/MAP-SCENE-PLAN-V1.md): retained for the legacy runtime only.

None of these documents should be treated as a current architectural MUST. In particular, the fixed LoomRealm pin does not provide a RenderProjectionBatch API merely because a proposal describes one.

## 6. Gates before implementation

Before building a new scene or renderer, obtain explicit review and record decisions for:

1. scene root and render-domain lifecycle;
2. world drawable representation and deterministic cross-object depth ordering;
3. ms-avatar surface composition and ownership;
4. Content versus decoded-resource cache ownership, leases, budgets and disposal;
5. Render Clock versus Simulation Clock;
6. atomic parent/child projection and any required LoomRealm integration;
7. PWA / Hostra registration parity, errors, and reproducible browser tests.

Each decision must be backed by source evidence, a trade-off analysis, a versioned contract and a test plan. If a decision requires a LoomRealm capability not present in the pinned commit, treat it as an upstream integration proposal; do not silently upgrade the Submodule or invent a local shim and call it platform support.

## 7. Non-negotiable preservation rules

- Do not run the original CMS079 client.
- Do not commit client binaries, WZ files, full FSDB exports, or unlicensed game assets.
- Do not copy or vendor OpenMS GPL-3.0 source. Record provenance for any independently implemented behavior.
- Do not change the LoomRealm gitlink in this reset.
- Preserve the research archive and legacy executable path; archive status is not deletion.
