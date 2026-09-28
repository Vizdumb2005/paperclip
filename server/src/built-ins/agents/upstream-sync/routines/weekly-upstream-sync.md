---
routineKey: weekly-upstream-sync
title: Merge upstream paperclip into the fork (conflict-free files only)
description: Weekly merge of upstream paperclipai/paperclip into this fork. Commits only files that merge without conflicts, opens a PR for them, and files an issue listing every skipped file for manual review. Never overwrites local variation and never pushes to upstream.
assigneeRef:
  resourceKind: agent
  resourceKey: upstream-sync
status: paused
priority: medium
concurrencyPolicy: coalesce_if_active
catchUpPolicy: skip_missed
variables:
  - name: upstreamRemote
    label: Upstream remote name
    type: string
    defaultValue: upstream
    required: false
    options: []
  - name: upstreamBranch
    label: Upstream branch
    type: string
    defaultValue: master
    required: false
    options: []
triggers:
  - kind: schedule
    label: Weekly upstream sync
    enabled: false
    cronExpression: "0 9 * * 1"
    timezone: UTC
    signingMode: none
    replayWindowSec: 0
issueTemplate:
  surfaceVisibility: normal
---

# Weekly upstream sync

This routine is **paused by default** and spends no tokens until an operator
enables its schedule or triggers a manual run. When it runs, it merges
upstream into the fork on a branch — it never touches the fork's base branch
directly and never pushes anywhere except the fork.

## What this run must do

1. Confirm the workspace checkout is this fork with an `upstream` remote
   pointing at `paperclipai/paperclip`. Any other remote URL: stop and report.
2. Run the `upstream-sync` skill as the operating procedure, with
   `UPSTREAM_REMOTE={{upstreamRemote}}` and
   `UPSTREAM_BRANCH={{upstreamBranch}}`.
3. If the helper reports `up-to-date`, leave a run comment saying so and
   finish. No branch, no PR, no issue.
4. If the helper reports `merged`, push the branch to `origin`, open a PR
   against the fork base branch listing the merged files, and open a tracking
   issue listing every skipped path (or `none`) with links to the PR and the
   upstream head SHA.

## Hard limits for this routine

- Sync direction is upstream → fork only. `git push upstream`, PRs against
  `paperclipai/paperclip`, and history rewrites are forbidden.
- Conflicted files keep fork bytes via the helper's `--ours` resolution.
  Taking the upstream side or hand-editing a conflicted file is forbidden.
- The first run may pause on `approval_required` when exporting the GitHub
  credential for push/PR/issue calls. That is the governance gate working:
  resume after the board accepts; do not work around it. Budget hard-stop
  auto-pause applies like any other run.
- Keep every action inside the execution workspace and company-scoped.

## Output

A run comment with the helper's JSON report, plus (on `merged`) a PR against
the fork and a tracking issue for skipped files, or (on `up-to-date`) a
one-line confirmation. Nothing else.
