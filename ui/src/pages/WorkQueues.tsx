import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { workQueuesApi } from "../api/workQueues";
import type { WorkQueue, WorkQueueItem } from "@paperclipai/shared";
import { useToast } from "../context/ToastContext";
import {
  Layers,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Sliders,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkQueues() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedQueueKey, setSelectedQueueKey] = useState<string>("all");
  const [submitQueueKey, setSubmitQueueKey] = useState("support_triage");
  const [itemPayloadText, setItemPayloadText] = useState('{\n  "title": "Production memory spike",\n  "priority": "high"\n}');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: queuesData, isLoading: queuesLoading, refetch: refetchQueues } = useQuery({
    queryKey: ["work-queues", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await workQueuesApi.list(selectedCompanyId);
      return res.queues ?? [];
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const queues: WorkQueue[] = queuesData ?? [];

  const { data: dlqData, isLoading: dlqLoading, refetch: refetchDlq } = useQuery({
    queryKey: ["work-queues-dlq", selectedCompanyId, selectedQueueKey],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      if (selectedQueueKey !== "all") {
        const res = await workQueuesApi.listItems(selectedCompanyId, selectedQueueKey, "dead_letter");
        return res.items ?? [];
      }
      // Gather DLQ items across all queues
      const allItems: WorkQueueItem[] = [];
      for (const q of queues) {
        try {
          const res = await workQueuesApi.listItems(selectedCompanyId, q.key, "dead_letter");
          allItems.push(...(res.items ?? []));
        } catch {
          // Ignore individual queue fetch error
        }
      }
      return allItems;
    },
    enabled: !!selectedCompanyId && queues.length >= 0,
    refetchInterval: 5000,
  });

  const dlqItems: WorkQueueItem[] = dlqData ?? [];

  const replayMutation = useMutation({
    mutationFn: async (item: WorkQueueItem) => {
      if (!selectedCompanyId) throw new Error("No company selected");
      const targetQueue = queues.find((q) => q.id === item.queueId);
      const queueKey = targetQueue?.key ?? selectedQueueKey;
      return workQueuesApi.replayDlq(selectedCompanyId, queueKey, item.id);
    },
    onSuccess: () => {
      pushToast({
        title: "DLQ Item Replayed",
        body: "Item has been requeued for automated execution.",
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["work-queues-dlq", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["work-queues", selectedCompanyId] });
    },
    onError: (err) => {
      pushToast({
        title: "Replay Failed",
        body: err instanceof Error ? err.message : "Failed to replay DLQ item",
        tone: "error",
      });
    },
  });

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    try {
      setIsSubmitting(true);
      let parsedPayload: Record<string, unknown> = {};
      try {
        parsedPayload = JSON.parse(itemPayloadText);
      } catch {
        pushToast({
          title: "Invalid JSON",
          body: "Payload must be valid JSON format",
          tone: "error",
        });
        return;
      }

      await workQueuesApi.ingest(selectedCompanyId, submitQueueKey, parsedPayload);

      pushToast({
        title: "Work Item Enqueued",
        body: `Item routed to ${submitQueueKey} queue.`,
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["work-queues", selectedCompanyId] });
    } catch (err) {
      pushToast({
        title: "Enqueue Error",
        body: err instanceof Error ? err.message : "Failed to enqueue item",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDlq = dlqItems.length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Work Queues
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated intake streams, rate-limited processing, and dead letter queue recovery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchQueues();
              refetchDlq();
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Queues</span>
            <Sliders className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold text-foreground mt-2">{queues.length}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Intake Health</span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground mt-2">Active</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dead Letter Queue</span>
            <AlertTriangle className={`h-4 w-4 ${totalDlq > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <p className={`text-2xl font-semibold mt-2 ${totalDlq > 0 ? "text-destructive" : "text-foreground"}`}>
            {totalDlq}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queues List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Registered Streams</h2>
              <span className="text-xs text-muted-foreground">Sliding-window rate control</span>
            </div>

            {queuesLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading queues...</div>
            ) : queues.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active work queues registered yet. Ingest a task to route work automatically.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {queues.map((q: WorkQueue) => (
                  <div key={q.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{q.name}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                          {q.key}
                        </span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                          {q.rateLimitPerMinute ?? 30} req/min
                        </span>
                      </div>
                      {q.description && (
                        <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedQueueKey(q.key)}
                        className="text-xs"
                      >
                        Filter DLQ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DLQ Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="font-semibold text-foreground">Dead Letter Queue (DLQ)</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedQueueKey === "all" ? "All queues" : `Filtered: ${selectedQueueKey}`}
              </span>
            </div>

            {dlqLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading DLQ...</div>
            ) : dlqItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                <span>Dead Letter Queue is clear. No poison messages.</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {dlqItems.map((item: WorkQueueItem) => (
                  <div key={item.id} className="p-4 space-y-2 hover:bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                        {item.queueId}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Retries: {item.retryCount}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={replayMutation.isPending}
                          onClick={() => replayMutation.mutate(item)}
                          className="text-xs h-7 px-2 flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Replay
                        </Button>
                      </div>
                    </div>
                    {item.errorMessage && (
                      <p className="text-xs font-mono text-destructive">{item.errorMessage}</p>
                    )}
                    <pre className="text-xs font-mono bg-muted/40 p-2 rounded overflow-x-auto text-muted-foreground max-h-32">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Intake Composer */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="border-b border-border pb-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Intake Work Item
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Route tasks directly into automated streams.
              </p>
            </div>

            <form onSubmit={handleEnqueue} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Queue Key</label>
                <input
                  type="text"
                  value={submitQueueKey}
                  onChange={(e) => setSubmitQueueKey(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. support_triage, backlog_intake"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Payload (JSON)</label>
                <textarea
                  value={itemPayloadText}
                  onChange={(e) => setItemPayloadText(e.target.value)}
                  rows={6}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enqueuing..." : "Submit to Stream"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
