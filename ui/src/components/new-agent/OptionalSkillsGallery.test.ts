import { describe, expect, it } from "vitest";
import type { CatalogSkill, CompanySkillListItem } from "@paperclipai/shared";
import { optionalSkillStates } from "./OptionalSkillsGallery";

function catalogSkill(overrides: Partial<CatalogSkill>): CatalogSkill {
  return {
    id: "skill-1",
    key: "paperclipai/optional/finance/ramp",
    kind: "optional",
    category: "finance",
    slug: "ramp",
    name: "Ramp",
    description: "Finance skill",
    path: "catalog/optional/finance/ramp",
    entrypoint: "SKILL.md",
    trustLevel: "markdown_only",
    compatibility: "compatible",
    defaultInstall: false,
    recommendedForRoles: [],
    requires: [],
    tags: [],
    files: [],
    contentHash: "sha256:abc",
    ...overrides,
  };
}

function installedSkill(overrides: Partial<CompanySkillListItem>): CompanySkillListItem {
  return {
    id: "installed-1",
    companyId: "company-1",
    key: "paperclipai/optional/finance/ramp",
    slug: "ramp",
    name: "Ramp",
    description: null,
    sourceType: "catalog",
    sourceLocator: null,
    sourceRef: null,
    trustLevel: "markdown_only",
    compatibility: "compatible",
    fileInventory: [],
    iconUrl: null,
    color: null,
    tagline: null,
    authorName: null,
    homepageUrl: null,
    categories: [],
    sharingScope: "company",
    publicShareToken: null,
    forkedFromSkillId: null,
    forkedFromCompanyId: null,
    starCount: 0,
    installCount: 0,
    forkCount: 0,
    currentVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    attachedAgentCount: 0,
    editable: true,
    editableReason: null,
    sourceLabel: null,
    sourceBadge: "catalog",
    sourcePath: null,
    catalogKind: "optional",
    originHash: null,
    packageName: null,
    packageVersion: null,
    ...overrides,
  } as CompanySkillListItem;
}

describe("optionalSkillStates", () => {
  it("marks catalog skills installed when the library holds the same key", () => {
    const states = optionalSkillStates(
      [
        catalogSkill({ id: "a", key: "paperclipai/optional/finance/ramp", name: "Ramp" }),
        catalogSkill({ id: "b", key: "paperclipai/optional/browser/agent-browser", name: "Agent Browser" }),
      ],
      [installedSkill({ key: "paperclipai/optional/finance/ramp" })],
    );
    expect(states).toEqual([
      expect.objectContaining({ installed: true }),
      expect.objectContaining({ installed: false }),
    ]);
  });

  it("marks everything not-installed for an empty library", () => {
    const states = optionalSkillStates(
      [catalogSkill({ id: "a", key: "paperclipai/optional/finance/ramp" })],
      [],
    );
    expect(states).toEqual([expect.objectContaining({ installed: false })]);
  });
});
