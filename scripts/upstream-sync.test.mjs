import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncUpstream } from "./upstream-sync.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function commitFile(cwd, name, content, message) {
  writeFileSync(path.join(cwd, name), content);
  git(cwd, "add", name);
  git(cwd, "commit", "-q", "-m", message);
}

/** Builds {upstream, fork}: fork cloned from upstream, then diverged. */
function makeFixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "upstream-sync-test-"));
  const upstream = path.join(dir, "upstream");
  mkdirSync(upstream);
  git(upstream, "init", "-q", "-b", "master");
  git(upstream, "config", "user.email", "test@paperclip.local");
  git(upstream, "config", "user.name", "test");
  git(upstream, "config", "core.autocrlf", "false");
  commitFile(upstream, "shared.txt", "line1\nline2\n", "base");
  commitFile(upstream, "conflict.txt", "fork line\n", "base conflict file");
  const fork = path.join(dir, "fork");
  execFileSync("git", ["-c", "core.autocrlf=false", "clone", "-q", upstream, fork], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  git(fork, "config", "user.email", "test@paperclip.local");
  git(fork, "config", "user.name", "test");
  git(fork, "config", "core.autocrlf", "false");
  // Rename the clone source remote to `upstream` (clone names it `origin`).
  git(fork, "remote", "rename", "origin", "upstream");
  return { dir, upstream, fork };
}

test("merges clean upstream files and reports them", () => {
  const { dir, upstream, fork } = makeFixture();
  try {
    commitFile(upstream, "clean.txt", "from upstream\n", "upstream adds file");
    const report = syncUpstream({ cwd: fork });
    assert.equal(report.status, "merged");
    assert.deepEqual(report.skipped, []);
    assert.ok(report.merged.includes("clean.txt"));
    assert.equal(readFileSync(path.join(fork, "clean.txt"), "utf8"), "from upstream\n");
    assert.match(report.branch, /^chore\/upstream-sync-/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps local bytes for conflicted files and lists them as skipped", () => {
  const { dir, upstream, fork } = makeFixture();
  try {
    commitFile(upstream, "clean.txt", "from upstream\n", "upstream adds file");
    commitFile(upstream, "conflict.txt", "upstream line\n", "upstream changes line");
    commitFile(fork, "conflict.txt", "fork line changed locally\n", "fork changes same line");
    const report = syncUpstream({ cwd: fork });
    assert.equal(report.status, "merged");
    assert.deepEqual(report.skipped, ["conflict.txt"]);
    assert.ok(report.merged.includes("clean.txt"));
    assert.equal(
      readFileSync(path.join(fork, "conflict.txt"), "utf8"),
      "fork line changed locally\n",
    );
    assert.equal(readFileSync(path.join(fork, "clean.txt"), "utf8"), "from upstream\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports up-to-date when there is nothing to merge", () => {
  const { dir, fork } = makeFixture();
  try {
    const report = syncUpstream({ cwd: fork });
    assert.equal(report.status, "up-to-date");
    assert.deepEqual(report.merged, []);
    assert.deepEqual(report.skipped, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("aborts on a dirty worktree without creating a branch", () => {
  const { dir, upstream, fork } = makeFixture();
  try {
    commitFile(upstream, "clean.txt", "from upstream\n", "upstream adds file");
    writeFileSync(path.join(fork, "dirty.txt"), "uncommitted\n");
    git(fork, "add", "dirty.txt");
    assert.throws(() => syncUpstream({ cwd: fork }), /clean worktree/i);
    const branches = git(fork, "branch", "--list", "chore/upstream-sync-*");
    assert.equal(branches, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
