# Product Roadmap

## Overview & Development Milestones

The product roadmap bridges Paperclip's autonomous company control plane with the day-to-day operational needs of a solo freelancer managing multiple client contracts.

---

## Phase 1: MVP (Autonomous Virtual Agency Core)

*Goal: Deliver the complete end-to-end autonomous operating loop allowing a solo founder to govern virtual agent teams across multiple concurrent client projects with guaranteed budget and deliverable safety.*

### 1.1 Virtual Organization & Specialized Roles
- **Hierarchical Company Roster**: Support for executive CEO agent, lead architects, technical developers, and automated QA reviewers with persistent adapter configurations.
- **Atomic Single-Assignee Model**: Clear task ownership and execution locks preventing duplicate or conflicting agent actions.
- **Inter-Agent Task Delegation**: Automatic sub-task spawning with traceable ancestor-child goal linkages.

### 1.2 Multi-Client Workspace & Context Isolation
- **Client Project Boundaries**: Company-scoped data models ensuring complete segregation of client tasks, files, and secrets.
- **Isolated Execution Workspaces**: Git worktree branching and container sandbox isolation for every client codebase.
- **Company Secret Vault**: Secure management of client-specific API keys and credentials, injected into execution environments without leaking to logs or outer prompts.

### 1.3 Work Queues & Fast Triage Engine
- **Inbound Work Intake**: Configurable work queues for incoming client inquiries, support tickets, and feature backlogs.
- **Vigil Sliding-Window Rate Limiting**: Token-bucket sliding window to prevent ingestion flooding and external API quota exhaustion.
- **Dead-Letter Quarantine (DLQ)**: Automatic isolation and classification of malformed or unprocessable client inputs.
- **Laya Heuristic Fast Triage**: Automated priority and severity classifier that auto-dispatches standard requests directly to competent agents while escalating critical issues for human review.

### 1.4 Maximizer Mode (Autonomous Operating Loop)
- **High-Autonomy Follow-Through**: Autonomous agent loop empowering agents to iterate through code, run test suites, inspect diffs, and self-heal without prompting the operator for routine steps.
- **Stagnation Circuit Breaker**: Real-time detection tripwire that halts execution when 3 identical consecutive actions occur.
- **Strict Budget Ceilings**: Hard cost caps and token salary budgets with automatic pause mechanisms.
- **Run Requirement Verification Gate**: Mandatory verification check requiring automated test execution and deliverable proof before task closure.

### 1.5 Stratum RAG Institutional Memory Engine
- **Layout-Aware Markdown Parser**: Preserves atomic table integrity, heading hierarchies, and contextual breadcrumbs.
- **Hybrid Retrieval (BM25 + Exact RRF)**: High-precision search fusing sparse keyword matching and semantic overlap using exact Reciprocal Rank Fusion ($k=60$).
- **Tiered Memory System**: Episodic per-run history, project consolidated decisions, and company institutional knowledge.
- **Dynamic Context Hydration**: Automatic injection of client preferences, specifications, and style guides into heartbeat task assignment markdown.

### 1.6 Automatic Organizational Learning
- **Playbook Distillation**: Auto-extraction of completed issue threads and implementation decisions into reusable Markdown playbooks.
- **Knowledge Re-indexing**: Immediate indexing of distilled playbooks into Stratum memory, ensuring future client requests benefit from past lessons.

### 1.7 CEO Chat & Executive Steering
- **Natural Language Intent Classifier**: Recognizes executive intents (`draft_issue`, `plan_decomposition`, `approval_request`, `status_inquiry`).
- **Interactive Action Cards**: Structured UI widgets allowing the founder to inspect, edit, and approve agent initiatives with one click.

### 1.8 Bring-Your-Own-Ticket-System (On-Ramp Ingestion)
- **Multi-Platform Ticket Sync**: Bi-directional webhook/sync adapters for Linear, Jira, and Asana.
- **External Object Binding**: Links external client tickets with internal Paperclip issues and formats outbound mirroring comments.

### 1.9 Connected Apps Ecosystem
- **Vercel Integration**: Outbound remote MCP and API token connector adhering to the Apps v2 Connector Playbook.
- **Tool Access Governance**: Granular permissions and resource filters for external infrastructure deployment tools.

---

## Phase 2: Post-Launch & Scaling Capabilities

*Goal: Expand the platform from internal autonomous execution into client-facing transparency, automated client accounting, and self-improving agency structure.*

### 2.1 Multi-Tenant Client Portal & Guest Views
- **Scoped Client Transparency**: Restricted, white-labeled client dashboards allowing clients to view project progress, milestone burn-down charts, and active sprint items.
- **Client Approval Cards**: Secure, one-click approval links for clients to sign off on visual designs, staging deployments, and scope revisions without accessing internal agent deliberation.

### 2.2 Autonomous Client Billing & Margin Ledger
- **Per-Client Cost Attribution**: Real-time tracking of token expenses, model inference costs, and sandbox compute hours tagged by client and project.
- **Automated Invoicing**: Generation of itemized delivery statements and billing summaries reflecting agreed freelance rates versus actual compute margins.

### 2.3 Self-Organization & Adaptive Team Resourcing
- **Workload Evaluator**: Background analytical engine assessing agent backlog congestion, failure rates, and recurring manual tasks.
- **Automated Reorganization Proposals**: Generates actionable proposals to hire specialized agent roles, rebalance busy work queues, or schedule recurring health sweeps.
- **Human Approval Enforcement**: All structural mutations remain gated behind board approval before modifying company configuration.

### 2.4 Multi-Modal Deliverable Verification
- **Visual Regression Proofs**: Headless browser screenshot captures and visual diffing for web deliverables before human sign-off.
- **Automated Smoke Reports**: Generation of self-contained HTML/Markdown deliverable packages linking test evidence, generated artifacts, and verification audits.

---

## Phase 3: Ecosystem depth & cleanup (fork, interleaved by value)

1. **Telemetry adoption/health view.** Read-only dashboard over the 15
   already-emitted events (`agent.created`, `routine.run`, …). No new
   instrumentation.
2. **Optional skills gallery + content-machine.** Surface the ~9 optional
   catalog skills during hire and the `content-machine` team in onboarding.
3. **Chat + sandbox connect UIs.** Expose Discord/Teams/Telegram/GitHub
   connect tiles (adapters exist) and a sandbox-provider picker
   (daytona/modal/e2b/k8s manifests exist) in execution setup.
4. **Plugin `dashboardWidget` sample.** One shipped sample proving the slot
   system end to end.
5. **Dead-code deletion batch.** Orphan `MyIssues`/`ArtifactsPanel`, unrouted
   `InviteUxLab`/`IssueChatUxLab`, showcase-only components, dead `setCwd`,
   write-only `onboarding-seed` path.
