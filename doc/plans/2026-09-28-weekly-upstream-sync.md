# Implementation Plan: Weekly Upstream Sync + Onboarding "More options"

## Overview
Two workstreams. (1) A weekly Paperclip routine that merges `upstream/master`
(paperclipai/paperclip) into this fork, committing only cleanly-merging files
and filing a GitHub issue listing skipped conflicted files. (2) A third
"More options" tile in onboarding step 4 that reveals the full adapter list
(`moreAdapters`, already computed but never rendered), keeping Claude/Codex
quick-picks as-is.

## Assumptions
1. Sync direction is upstream → fork `master` only; never pushes to upstream.
2. The routine ships as a built-in bundle, opt-in and paused by default (like
   existing routines), so no company gets surprise weekly PRs.
3. "Clean merge" = whole-file granularity: conflicted files keep OUR version
   and are listed in the issue. No hunk-level partial merges.
4. The agent running the routine uses the company's connected GitHub credential
   (trust-gated, per `github-operation-credentials.ts`); first run may pause
   on `approval_required`, which is correct behavior.
5. Onboarding tile reuses `ModelSourceTiles` + token layer; no new component.

## Architecture Decisions
- **Sync mechanism: merge, not cherry-pick.** Routine agent creates branch
  `chore/upstream-sync-YYYY-MM-DD` from fork `master`, `git merge --no-commit
  upstream/master`; for each conflicted path, `git checkout --ours -- <path>`
  and record it; commit the rest; open PR + issue via `gh`. Merge preserves
  upstream history; `--ours` resolution guarantees zero local variation is
  ever overwritten.
- **Routine shipping: new `DEFINITIONS` entry in
  `server/src/services/built-in-agents.ts`** + routine `.md` under
  `server/src/built-ins/agents/<key>/routines/` (cron `0 9 * * 1` UTC,
  `enabled:false`). Choice of agent key: new `upstream-sync` key recommended
  over attaching to reflection-coach/summarizer (unrelated concerns; separate
  assignee = separate budget/approval scope).
- **Deterministic merge helper script** (`scripts/upstream-sync.sh`) so the
  agent executes fixed git steps instead of improvising; routine `.md`
  instructs: run script, open PR, open issue. Script is unit-testable;
  agent judgment stays on the report text.
- **Onboarding: third tile expands, not navigates.** A "More options" tile in
  the same `ModelSourceTiles` radiogroup toggles rendering of `moreAdapters`
  tiles below (revives the removed "Advanced settings" disclosure pattern
  the old tests describe). Wires up the dead `showMoreAdapters` state.
  No change to `recommended` flags, `AgentConfigForm`, or hire-agent forms.

## Task List

### Phase 1 — Weekly sync routine (done: 0dcdd018c, 3af6ef945)
- [x] Task 1: `scripts/upstream-sync.sh` — fetch upstream, merge --no-commit,
  ours-resolve conflicts, emit `sync-report.json` {merged, skipped, base, head}.
  (Shipped as `scripts/upstream-sync.mjs` + `syncUpstream()` export: cross-platform,
  matches repo .mjs script/test conventions. Report printed as JSON.)
  Acceptance: exits 0 on clean tree; conflicted run keeps local bytes identical
  (`git diff` empty for skipped paths); report lists every skipped path.
  Files: `scripts/upstream-sync.sh`, `scripts/upstream-sync.test.mjs` (new).
  Scope: S. Skill: `incremental-implementation`, `test-driven-development`.
- [x] Task 2: Routine bundle — `.md` + `DEFINITIONS` entry + weekly cron,
  paused by default; instructions: run script, `gh pr create`, `gh issue
  create` with skipped list, never push to upstream. (New `upstream-sync`
  agent key per approval.)
  Acceptance:
  `reconcileBuiltInAgentsOnStartup` materializes routine + trigger;
  dry-run materialization test passes. (`built-in-agents.test.ts`: 33/33 green,
  pinned key list updated.)
  Files:
  `server/src/built-ins/agents/upstream-sync/routines/weekly-upstream-sync.md`
  (+`AGENTS.md`), `server/src/services/built-in-agents.ts`.
  Scope: M. Depends: Task 1.
- [x] Task 3: Guardrail notes — budget/approval expectations documented in the
  routine `.md` (first run may pause on approval; resume to proceed).
  Acceptance: `.md` states credential + approval behavior explicitly.
  Scope: XS. Depends: Task 2.

### Checkpoint: sync routine
- [x] `pnpm test` (repo default), `pnpm -r typecheck` for touched packages
- [x] Script tested on scratch clones: clean merge commits, conflicted files
      byte-identical to local, report complete
- [x] Human review before onboarding work starts (plan approved 2026-09-28)

### Phase 2 — Onboarding third option (done)
- [x] Task 4: "More options" tile in step 4 rendering `moreAdapters` via
  existing `ModelSourceTiles`; token-only styling; radiogroup/keyboard
  behavior preserved. (Disclosure button + second row; shared `handleSourceSelect`;
  dead `showMoreAdapters` state wired; non-picked row unmounts on collapse.)
  Acceptance: 2 tiles + "More options" disclosure render; expanding shows all
  non-excluded adapters; selecting one flows through existing connect/probe/
  hire path unchanged (shared pick handler + `sourceSelected` gate). Files: `ui/src/components/OnboardingWizard.tsx`,
  possibly `ui/src/adapters/adapter-display-registry.ts` (label only).
  (No registry change needed.)
  Scope: M. Skills: `frontend-ui-engineering`, repo `design-guide`.
  Depends: Checkpoint 1.
- [x] Task 5: Update `OnboardingWizard.test.tsx` count/selection assertions
  (2→3 tiles) + new cases: expand shows `moreAdapters`; non-recommended
  selection enables CTA. (2 new tests; existing 2-tile count assertion unaffected —
  disclosure is not a radio. Full suites: 100/100 green.)
  Scope: S. Depends: Task 4.

### Checkpoint: complete
- [x] `pnpm test`, `pnpm -r typecheck`, `pnpm build`, `pnpm check:token-gates`
  (Focused suites + typechecks + token gates green; full `pnpm build` not rerun —
  no build-input changes beyond ui/server sources already typechecked. Say so if a
  full build gate is required.)
- [ ] Manual: onboarding step 4 screenshot (3 tiles + expanded list)
- [ ] Ready for review (`code-review-and-quality`)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| New built-in agent key needs assignee/budget wiring | Med | Follow reflection-coach bundle shape exactly; paused-by-default |
| `gh` auth missing in routine workspace | Med | Routine `.md` fails loudly with setup steps; approval gate surfaces it |
| Upstream force-pushes/rewrites history | Low | Merge (not rebase); abort on non-fast-forward fetch anomalies |
| Test churn in OnboardingWizard suite | Low | Update pinned counts in same PR; run full ui suite |
| Weekly PR noise | Low | Paused by default; only enabled companies get PRs |

## Open Questions
- New `upstream-sync` agent key vs attaching to an existing bundle? (Recommend: new key.)
- Weekly run time: Monday 09:00 UTC OK?
