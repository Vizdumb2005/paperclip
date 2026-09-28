import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useEffect } from "react";
import { telemetryAdoptionApi } from "../api/telemetryAdoption";
import { Card } from "@/components/ui/card";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import type { TelemetryAdoptionEventEntry, TelemetryAdoptionSummary } from "@paperclipai/shared";

export function isAdoptionEmpty(summary: TelemetryAdoptionSummary): boolean {
  return summary.events.every((entry) => entry.total === 0);
}

function AdoptionRow({ entry }: { entry: TelemetryAdoptionEventEntry }) {
  const max = Math.max(1, ...entry.byDay.map((bucket) => bucket.count));
  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm text-foreground">{entry.event}</span>
        <span className="shrink-0 text-sm font-semibold text-foreground">{entry.total}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {entry.proxySource ?? "instance-level event · no company proxy"}
      </p>
      <div
        className="mt-2 flex h-10 items-end gap-1"
        role="img"
        aria-label={`${entry.event}: ${entry.total} total in window`}
      >
        {entry.byDay.map((bucket) => (
          <div
            key={bucket.date}
            title={`${bucket.date}: ${bucket.count}`}
            style={{ height: `${Math.max(4, Math.round((bucket.count / max) * 100))}%` }}
            className={bucket.count > 0 ? "flex-1 rounded-sm bg-primary" : "flex-1 rounded-sm bg-muted"}
          />
        ))}
      </div>
    </div>
  );
}

export function TelemetryAdoption() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Adoption & health" },
    ]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-adoption", selectedCompanyId],
    queryFn: () => telemetryAdoptionApi.summary(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Activity} message="Create or select an organization to view adoption & health." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load adoption & health: {error.message}</p>;
  }

  if (!data || isAdoptionEmpty(data)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Adoption & health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Event counts by type and day, derived read-only from this organization&apos;s existing data.
          </p>
        </div>
        <EmptyState
          icon={Activity}
          message="No adoption data yet. Counts appear here as agents, tasks, routines, skills, and interactions are created."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Adoption & health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only counts over the 15 telemetry events, derived from this organization&apos;s existing data
          (last {data.windowDays} days).
        </p>
      </div>
      <Card className="block overflow-hidden py-0">
        {data.events.map((entry) => (
          <AdoptionRow key={entry.event} entry={entry} />
        ))}
      </Card>
    </div>
  );
}
