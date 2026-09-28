// Weekly upstream sync helper (used by the upstream-sync routine).
//
// Merges upstream/<branch> into the current checkout on a fresh
// `chore/upstream-sync-*` branch. Files that merge cleanly are committed.
// Files with conflicts keep the LOCAL bytes (`--ours`) and are reported as
// skipped so the routine can file them for manual review. Local variation is
// never overwritten.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function lines(output) {
  return output.length === 0 ? [] : output.split("\n").filter((l) => l.length > 0);
}

function hasMergeHead(cwd) {
  try {
    git(cwd, "rev-parse", "--verify", "--quiet", "MERGE_HEAD");
    return true;
  } catch {
    return false;
  }
}

export function syncUpstream({ cwd = process.cwd(), upstreamRemote = "upstream", upstreamBranch = "master" } = {}) {
  const dirty = git(cwd, "status", "--porcelain");
  if (dirty.length > 0) {
    throw new Error(`Refusing upstream sync: clean worktree required, found:\n${dirty}`);
  }
  const startBranch = git(cwd, "branch", "--show-current");
  git(cwd, "fetch", upstreamRemote);
  const base = git(cwd, "rev-parse", "HEAD");
  const upstream = git(cwd, "rev-parse", `${upstreamRemote}/${upstreamBranch}`);
  if (base === upstream) {
    return { status: "up-to-date", base, upstream, branch: null, merged: [], skipped: [] };
  }

  const branch = `chore/upstream-sync-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${upstream.slice(0, 7)}`;
  git(cwd, "checkout", "-q", "-b", branch);
  try {
    try {
      git(cwd, "merge", "--no-commit", "--no-ff", `${upstreamRemote}/${upstreamBranch}`);
    } catch {
      // Non-zero exit = conflicts (or other merge failure); resolve below.
    }
    if (!hasMergeHead(cwd)) {
      git(cwd, "checkout", "-q", startBranch);
      git(cwd, "branch", "-q", "-D", branch);
      return { status: "up-to-date", base, upstream, branch: null, merged: [], skipped: [] };
    }
    const skipped = lines(git(cwd, "diff", "--name-only", "--diff-filter=U"));
    for (const file of skipped) {
      git(cwd, "checkout", "--ours", "--", file);
      git(cwd, "add", "--", file);
    }
    const trailer =
      skipped.length === 0
        ? "All files merged cleanly."
        : `Conflicted files kept at local version:\n${skipped.map((f) => `- ${f}`).join("\n")}`;
    git(cwd, "commit", "-q", "--no-edit", "-m", `chore: weekly upstream merge (conflict-free files only)\n\n${trailer}`);
    const merged = lines(git(cwd, "diff", "--name-only", `${base}`, "HEAD"));
    return { status: "merged", base, upstream, branch, merged, skipped };
  } catch (err) {
    git(cwd, "merge", "--abort");
    git(cwd, "checkout", "-q", startBranch);
    git(cwd, "branch", "-q", "-D", branch);
    throw err;
  }
}

const invokedAsCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsCli) {
  const report = syncUpstream({
    upstreamRemote: process.env.UPSTREAM_REMOTE ?? "upstream",
    upstreamBranch: process.env.UPSTREAM_BRANCH ?? "master",
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
