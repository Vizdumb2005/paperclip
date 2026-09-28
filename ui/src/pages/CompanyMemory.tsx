import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { companyMemoryApi, type MemorySearchResult, type CompanyPlaybook } from "../api/companyMemory";
import { useToast } from "../context/ToastContext";
import { MarkdownBody } from "../components/MarkdownBody";
import {
  Brain,
  Search,
  BookOpen,
  Sparkles,
  Plus,
  FileText,
  Clock,
  Tag,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompanyMemory() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTier, setActiveTier] = useState<string>("all");
  const [selectedResult, setSelectedResult] = useState<MemorySearchResult | CompanyPlaybook | null>(null);

  // Ingest form modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("operational_playbook");
  const [newContent, setNewContent] = useState("");

  const { data: searchResults, isFetching: searchLoading } = useQuery<MemorySearchResult[]>({
    queryKey: ["company-memory-search", selectedCompanyId, searchQuery, activeTier],
    queryFn: async () => {
      if (!selectedCompanyId || !searchQuery.trim()) return [];
      return companyMemoryApi.search(selectedCompanyId, searchQuery, {
        tier: activeTier === "all" ? undefined : activeTier,
        limit: 15,
      });
    },
    enabled: !!selectedCompanyId && searchQuery.trim().length > 1,
  });

  const { data: playbooks, isLoading: playbooksLoading } = useQuery<CompanyPlaybook[]>({
    queryKey: ["company-playbooks", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      return companyMemoryApi.getPlaybooks(selectedCompanyId);
    },
    enabled: !!selectedCompanyId,
  });

  const ingestMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return companyMemoryApi.ingest(selectedCompanyId, {
        documentName: newTitle,
        category: newCategory,
        content: newContent,
        tier: "consolidated",
      });
    },
    onSuccess: () => {
      pushToast({
        title: "Playbook Ingested",
        body: "Document parsed into Stratum memory nodes and indexed.",
        tone: "success",
      });
      setShowAddModal(false);
      setNewTitle("");
      setNewContent("");
      queryClient.invalidateQueries({ queryKey: ["company-playbooks", selectedCompanyId] });
    },
    onError: (err) => {
      pushToast({
        title: "Ingestion Failed",
        body: err instanceof Error ? err.message : "Failed to ingest playbook",
        tone: "error",
      });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Company Memory & Stratum RAG
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Durable organizational memory, distilled playbooks, and hybrid BM25 + Reciprocal Rank Fusion search.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Ingest Knowledge
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organizational wisdom, past resolutions, bug playbooks, or client specs..."
            className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Tiers:</span>
          {(["all", "consolidated", "episodic"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTier(t)}
              className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                activeTier === t
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Results / Playbooks Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                {searchQuery.trim().length > 1 ? (
                  <>
                    <Sparkles className="h-4 w-4 text-primary" />
                    Stratum RRF Matches ({searchResults?.length ?? 0})
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 text-primary" />
                    Distilled Playbooks ({playbooks?.length ?? 0})
                  </>
                )}
              </h2>
            </div>

            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {searchLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Searching Stratum index...
                </div>
              ) : searchQuery.trim().length > 1 ? (
                !searchResults || searchResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No relevant memory entries matched your query.
                  </div>
                ) : (
                  searchResults.map((item: MemorySearchResult, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedResult(item)}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                        selectedResult === item ? "bg-muted/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">
                          {item.title}
                        </span>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                          RRF {(item.score ?? 0).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span className="capitalize bg-muted px-1.5 py-0.2 rounded font-mono">
                          {item.tier ?? "consolidated"}
                        </span>
                        {item.category && (
                          <span className="truncate">{item.category}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {item.content}
                      </p>
                    </div>
                  ))
                )
              ) : playbooksLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading distilled playbooks...
                </div>
              ) : !playbooks || playbooks.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No distilled playbooks yet. As agents complete tasks and resolve bugs, playbooks are automatically distilled into memory.
                </div>
              ) : (
                playbooks.map((pb: CompanyPlaybook) => (
                  <div
                    key={pb.id}
                    onClick={() => setSelectedResult(pb)}
                    className={`p-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                      selectedResult === pb ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate">
                        {pb.title}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        v{pb.version ?? 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span className="truncate">{pb.category}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail / Inspector Column */}
        <div className="lg:col-span-7">
          <div className="bg-card border border-border rounded-lg p-5 min-h-96">
            {selectedResult ? (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedResult.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {"category" in selectedResult && selectedResult.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {selectedResult.category}
                      </span>
                    )}
                    {"updatedAt" in selectedResult && selectedResult.updatedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(selectedResult.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-sm">
                  <MarkdownBody>
                    {"content" in selectedResult ? selectedResult.content : ""}
                  </MarkdownBody>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm">Select a playbook or search result to inspect memory contents.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ingest Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 space-y-4 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Ingest Knowledge Playbook
            </h2>
            <p className="text-xs text-muted-foreground">
              Stratum will parse layout, generate chunks, index BM25 tokens, and link to organizational memory.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Next.js Deployment Playbook"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. operational_playbook, code_conventions"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Markdown Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={8}
                  placeholder="# Steps to resolve..."
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newTitle || !newContent || ingestMutation.isPending}
                onClick={() => ingestMutation.mutate()}
              >
                {ingestMutation.isPending ? "Ingesting..." : "Ingest & Index"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
