import { describe, expect, it } from "vitest";
import { onboardingTeams } from "../../pages/TeamCatalog.fixtures";
import { starterTeams, teamNeedsFullInstaller } from "./StarterTeamGrid";
import type { CatalogTeam } from "@paperclipai/shared";

const base = onboardingTeams[0]!;

function team(overrides: Partial<CatalogTeam>): CatalogTeam {
  return { ...base, ...overrides };
}

describe("starterTeams", () => {
  it("keeps defaultInstall bundled teams and all optional teams", () => {
    const contentMachine = team({
      id: "paperclipai:optional:content:content-machine",
      key: "paperclipai/optional/content/content-machine",
      kind: "optional",
      slug: "content-machine",
      name: "Content Machine",
      defaultInstall: false,
    });
    const result = starterTeams([
      team({ id: "bundled-starter", kind: "bundled", defaultInstall: true }),
      team({ id: "bundled-extra", kind: "bundled", defaultInstall: false }),
      contentMachine,
    ]);
    expect(result.map((entry) => entry.id)).toEqual(["bundled-starter", contentMachine.id]);
  });

  it("includes the content-machine team from the live-shaped manifest", () => {
    const contentMachine = team({
      id: "paperclipai:optional:content:content-machine",
      key: "paperclipai/optional/content/content-machine",
      kind: "optional",
      slug: "content-machine",
      name: "Content Machine",
      defaultInstall: false,
    });
    expect(starterTeams([contentMachine])).toHaveLength(1);
  });
});

describe("teamNeedsFullInstaller", () => {
  it("is true when a required secret is missing", () => {
    expect(
      teamNeedsFullInstaller(
        team({ envInputs: [{ key: "OPENAI_API_KEY", agentSlug: "cto", projectSlug: null, kind: "secret", requirement: "required" }] }),
      ),
    ).toBe(true);
  });

  it("is false when secrets are optional or absent", () => {
    expect(team({ envInputs: [] }).envInputs).toEqual([]);
    expect(teamNeedsFullInstaller(team({ envInputs: [] }))).toBe(false);
    expect(
      teamNeedsFullInstaller(
        team({ envInputs: [{ key: "TZ", agentSlug: null, projectSlug: "launch", kind: "plain", requirement: "optional" }] }),
      ),
    ).toBe(false);
  });
});
