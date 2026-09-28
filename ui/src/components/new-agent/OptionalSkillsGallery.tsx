import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { companySkillsApi } from "../../api/companySkills";
import { queryKeys } from "../../lib/queryKeys";
import type { CatalogSkill, CompanySkillListItem } from "@paperclipai/shared";

export interface OptionalSkillState {
  skill: CatalogSkill;
  installed: boolean;
}

export function optionalSkillStates(
  catalog: CatalogSkill[],
  installed: CompanySkillListItem[],
): OptionalSkillState[] {
  const installedKeys = new Set(installed.map((skill) => skill.key));
  return catalog.map((skill) => ({ skill, installed: installedKeys.has(skill.key) }));
}

/**
 * Optional-skills gallery for the agent-hire flow. Lists the optional catalog
 * skills with per-skill Install buttons that install into the organization
 * library (POST install-catalog). Bundled defaults are untouched — this
 * surface only adds optional skills on explicit operator action.
 */
export function OptionalSkillsGallery({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: queryKeys.companySkills.catalog({ kind: "optional" }),
    queryFn: () => companySkillsApi.catalogList({ kind: "optional" }),
  });
  const installedQuery = useQuery({
    queryKey: queryKeys.companySkills.list(companyId),
    queryFn: () => companySkillsApi.list(companyId),
  });

  const install = useMutation({
    mutationFn: (skill: CatalogSkill) =>
      companySkillsApi.installCatalog(companyId, { catalogSkillId: skill.id, slug: skill.slug }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(companyId) });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Install failed.");
    },
  });

  if (catalogQuery.isLoading || installedQuery.isLoading) {
    return (
      <section className="space-y-5" aria-label="Optional skills">
        <h3 className="text-sm font-semibold">Optional skills</h3>
        <p className="text-sm text-muted-foreground">Loading optional skills…</p>
      </section>
    );
  }

  if (catalogQuery.error) {
    return (
      <section className="space-y-5" aria-label="Optional skills">
        <h3 className="text-sm font-semibold">Optional skills</h3>
        <p role="alert" className="text-sm text-destructive">
          Could not load optional skills.
        </p>
      </section>
    );
  }

  const states = optionalSkillStates(catalogQuery.data ?? [], installedQuery.data ?? []);

  return (
    <section className="space-y-5" aria-label="Optional skills">
      <div>
        <h3 className="text-sm font-semibold">Optional skills</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add capabilities to your organization library. Your new agent can use installed skills on its next run.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border">
        {states.map(({ skill, installed }) => (
          <li key={skill.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{skill.name}</p>
              <p className="truncate text-xs text-muted-foreground">{skill.description}</p>
            </div>
            {installed ? (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Installed</span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={install.isPending}
                onClick={() => install.mutate(skill)}
              >
                {install.isPending ? "Installing…" : "Install"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
