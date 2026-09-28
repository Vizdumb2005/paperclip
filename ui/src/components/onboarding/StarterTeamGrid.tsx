import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { teamCatalogApi } from "../../api/teamCatalog";
import { queryKeys } from "../../lib/queryKeys";
import {
  ApplyProgress,
  ApplySuccess,
  EMPTY_INSTALL_FORM,
  TeamCard,
  teamRoute,
  useInstallTeamCatalogEntry,
} from "../../pages/TeamCatalog";
import type { CatalogTeam } from "@paperclipai/shared";

/**
 * Starter set for the onboarding "Pick a starter team" grid: the
 * `defaultInstall` bundled teams plus every optional team (currently the
 * content-machine). Skipping the grid leaves the bundled defaults unchanged —
 * installation is always an explicit operator action.
 */
export function starterTeams(teams: CatalogTeam[]): CatalogTeam[] {
  return teams.filter(
    (team) => (team.kind === "bundled" && team.defaultInstall) || team.kind === "optional",
  );
}

/** Teams that cannot one-click install because they require operator secrets. */
export function teamNeedsFullInstaller(team: CatalogTeam): boolean {
  return team.envInputs.some((input) => input.kind === "secret" && input.requirement === "required");
}

function StarterTeamInstaller({
  companyId,
  team,
  onDone,
}: {
  companyId: string;
  team: CatalogTeam;
  onDone: (installed: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const entry = useInstallTeamCatalogEntry({
    companyId,
    team,
    simplified: true,
    onInstalled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamCatalog.installed(companyId) });
    },
  });

  if (entry.phase === "applying") {
    return <ApplyProgress team={team} />;
  }

  if (entry.phase === "done") {
    return <ApplySuccess team={team} result={entry.installResult} onClose={() => onDone(true)} />;
  }

  if (teamNeedsFullInstaller(team)) {
    const required = team.envInputs.filter((input) => input.kind === "secret" && input.requirement === "required");
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{team.name} needs secrets to install</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Required: {required.map((input) => input.key).join(", ")}. Finish setup in the Teams gallery.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to={teamRoute(team.id)}>Open in Teams gallery</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Installs {team.counts.agents} agent{team.counts.agents === 1 ? "" : "s"} ·{" "}
        {team.counts.projects} project{team.counts.projects === 1 ? "" : "s"} ·{" "}
        {team.counts.routines} routine{team.counts.routines === 1 ? "" : "s"} into your organization.
      </p>
      {entry.applyError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {entry.applyError}{" "}
          <Link to={teamRoute(team.id)} className="underline underline-offset-2">
            Open in Teams gallery
          </Link>
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => entry.runInstall(EMPTY_INSTALL_FORM)}>
          Install {team.name}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to={teamRoute(team.id)}>Details</Link>
        </Button>
      </div>
    </div>
  );
}

export function StarterTeamGrid({ companyId }: { companyId: string }) {
  const catalogQuery = useQuery({
    queryKey: queryKeys.teamCatalog.catalog({}),
    queryFn: () => teamCatalogApi.catalogList(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<string[]>([]);

  const teams = starterTeams(catalogQuery.data ?? []);
  const selected = teams.find((team) => team.id === selectedId) ?? null;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Start from a team <span className="font-normal text-muted-foreground">(optional)</span></h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Install a ready-made starter team, or skip and keep going — nothing is installed unless you choose it.
        </p>
      </div>
      {catalogQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading starter teams…</p>
      )}
      {catalogQuery.error && (
        <p role="alert" className="text-sm text-destructive">
          Could not load starter teams.{" "}
          <Link to="/teams-catalog" className="underline underline-offset-2">
            Browse the Teams gallery
          </Link>
        </p>
      )}
      {teams.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id} className="relative">
              <TeamCard
                team={team}
                selected={team.id === selectedId}
                onSelect={() => setSelectedId(team.id === selectedId ? null : team.id)}
              />
              {installedIds.includes(team.id) && (
                <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Installed
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {selected && (
        <StarterTeamInstaller
          companyId={companyId}
          team={selected}
          onDone={(installed) => {
            if (installed) setInstalledIds((current) => [...current, selected.id]);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
