// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogTeam } from "@paperclipai/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StarterTeamGrid } from "./StarterTeamGrid";

const mockTeamCatalogApi = vi.hoisted(() => ({
  catalogList: vi.fn(),
  catalogDetail: vi.fn(),
  catalogFile: vi.fn(),
  preview: vi.fn(),
  install: vi.fn(),
  installed: vi.fn(),
}));

vi.mock("../../api/teamCatalog", () => ({ teamCatalogApi: mockTeamCatalogApi }));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? ResizeObserverStub;
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: /min-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function makeTeam(overrides: Partial<CatalogTeam> = {}): CatalogTeam {
  return {
    id: "team-starter",
    key: "paperclipai/bundled/company-defaults/team-starter",
    kind: "bundled",
    category: "company-defaults",
    slug: "team-starter",
    name: "Core Exec Team",
    description: "A starter executive team.",
    path: "catalog/bundled/company-defaults/team-starter",
    entrypoint: "TEAM.md",
    schema: "agentcompanies/v1",
    defaultInstall: true,
    recommendedForCompanyTypes: [],
    tags: ["exec"],
    counts: { agents: 2, projects: 1, tasks: 0, routines: 1, localSkills: 0, catalogSkills: 0, externalSkillSources: 0 },
    rootAgentSlugs: [],
    agentSlugs: ["ceo", "cto"],
    projectSlugs: ["launch"],
    requiredSkills: [],
    envInputs: [],
    sourceRefs: [],
    files: [{ path: "TEAM.md", kind: "team", sizeBytes: 100, sha256: "abc" }],
    trustLevel: "markdown_only",
    compatibility: "compatible",
    contentHash: "sha256:deadbeefdeadbeefdeadbeef",
    ...overrides,
  };
}

const contentMachine = makeTeam({
  id: "paperclipai:optional:content:content-machine",
  key: "paperclipai/optional/content/content-machine",
  kind: "optional",
  category: "content",
  slug: "content-machine",
  name: "Content Machine",
  description: "An always-on content team.",
  defaultInstall: false,
  trustLevel: "markdown_only",
});

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

async function renderGrid() {
  mockTeamCatalogApi.catalogList.mockResolvedValue([makeTeam(), contentMachine]);
  mockTeamCatalogApi.install.mockResolvedValue({
    portabilityImport: { agents: [], projects: [] },
    skillPreparations: [],
    warnings: [],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <StarterTeamGrid companyId="company-1" />
      </QueryClientProvider>,
    );
  });
  await flushReact();
}

function findButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    (button.textContent ?? "").includes(label),
  ) as HTMLButtonElement | undefined;
}

describe("StarterTeamGrid", () => {
  it("lists the bundled starter and the content-machine team", async () => {
    await renderGrid();
    expect(document.body.textContent).toContain("Core Exec Team");
    expect(document.body.textContent).toContain("Content Machine");
  });

  it("installs the selected team with the simplified onboarding flow", async () => {
    await renderGrid();
    const tile = findButton("Content Machine");
    expect(tile).toBeTruthy();
    await act(async () => {
      tile!.click();
    });
    await flushReact();

    const installCta = findButton("Install Content Machine");
    expect(installCta).toBeTruthy();
    await act(async () => {
      installCta!.click();
    });
    await flushReact();

    expect(mockTeamCatalogApi.install).toHaveBeenCalledWith(
      "company-1",
      "paperclipai:optional:content:content-machine",
      expect.objectContaining({ targetManagerAgentId: null }),
    );
    expect(document.body.textContent).toContain("Team installed");
  });
});
