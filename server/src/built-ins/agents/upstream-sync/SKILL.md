---
name: upstream-sync
description: Merge upstream paperclipai/paperclip into the fork, committing only conflict-free files and reporting the rest.
key: paperclipai/bundled/paperclip-operations/upstream-sync
---

# Upstream Sync

Merge the upstream repository into this fork without ever overwriting local
variation.

## Procedure

1. Confirm the `upstream` remote URL points at `paperclipai/paperclip`
   (`git remote get-url upstream`). Any other URL: stop and report.
2. Confirm a clean worktree (`git status --porcelain` empty). Any output:
   stop and report.
3. Run the deterministic helper from the repo root:
   `node scripts/upstream-sync.mjs` (honors `UPSTREAM_REMOTE` /
   `UPSTREAM_BRANCH`). Do not improvise git steps; the script is the
   procedure. It creates `chore/upstream-sync-*`, merges with `--no-commit`,
   keeps local bytes for every conflicted file, commits the rest, and prints
   a JSON report.
4. If the report says `up-to-date`, say so in the run comment and finish.
   No branch, no PR, no issue.
5. If the report says `merged`, push the branch to `origin` (the fork) and
   open a PR against the fork's base branch with the merged file list.
6. Open a tracking issue titled `Upstream sync <date>: <N> files need manual
   review`, listing every path in the report's `skipped` array (or `none`),
   plus links to the PR and the upstream head SHA.

## Hard limits

- Never push to the `upstream` remote. `git push` targets `origin` only.
- Never resolve a conflict by taking the upstream side or by hand-editing a
  merged file. Skipped files keep fork bytes and go on the issue.
- A failed helper run leaves no branch behind (it cleans up after itself).
  Report the failure instead of retrying with different git commands.
