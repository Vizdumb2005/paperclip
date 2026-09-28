# Tech Stack & System Architecture

## Architecture Overview

Paperclip is designed as a modular, high-performance monorepo separated into a centralized control plane (`server/`), a reactive operator board UI (`ui/`), a CLI client (`cli/`), shared contract packages (`packages/shared`, `packages/db`), and agent execution adapters (`packages/adapters/*`, `packages/paperclip-runner`).

---

## 1. Frontend Layer (`ui/`)

- **Core Framework**: React 19 (Single Page Application)
- **Build Tooling & Bundler**: Vite + Rolldown
- **Design System & Styling**:
  - Tailwind CSS with strict CSS custom property design token layer (`ui/src/index.css`).
  - **Zero Hardcoded Values**: Enforced via `pnpm check:token-gates` (no raw hex colors, arbitrary brackets, or inline pixel font sizes in components).
  - Modern dark-mode optimized aesthetic with polished typography, micro-interactions, and glassmorphic panels.
- **State Management & Data Fetching**:
  - TanStack React Query for caching, optimistic mutations, and real-time query invalidation.
  - React Router for client-side navigation.
- **UI Components & Visualizations**:
  - Radix UI accessible primitives (Dialogs, Popovers, Dropdowns, Tooltips).
  - Lucide React for consistent icon design.
  - Cytoscape.js & Mermaid.js for interactive rendering of company org charts, issue dependency trees, and workflow DAGs.
  - CodeMirror 6 for markdown authoring and code review diffs.

---

## 2. Backend Control Plane (`server/`)

- **Runtime**: Node.js (>= 24.11.0, ESM native)
- **Language**: TypeScript (strict mode)
- **HTTP Framework**: Express REST API (`/api/*`)
- **Key Services**:
  - **Heartbeat Coordinator** (`heartbeat.ts`): Orchestrates agent waking, execution lifecycle, lease locks, and status transitions.
  - **Stratum RAG Retrieval Engine** (`stratum-engine.ts`, `company-memory.ts`): Layout-aware markdown parser, BM25 scoring, and exact Reciprocal Rank Fusion ($k=60$) for prompt context hydration.
  - **Work Queue Pipeline** (`work-queues.ts`): Vigil sliding-window rate limiter, DLQ quarantine, and Laya fast triage heuristic classifier.
  - **Maximizer Orchestrator** (`maximizer-orchestrator.ts`): High-autonomy circuit breakers (3-step stagnation tripwire) and run requirement verification gates.
  - **Organizational Learning Service** (`organizational-learning.ts`): Automatic extraction of completed issue threads into Markdown playbooks and instant memory indexing.
  - **CEO Chat Service** (`ceo-chat.ts`): Natural language intent classifier outputting structured, interactive Action Cards (`draft_issue`, `plan_decomposition`, `approval_request`).
  - **Ticket On-Ramp Service** (`ticket-on-ramps.ts`): Bi-directional synchronization for Linear, Jira, and Asana with `external_objects` binding.
  - **Activity & Audit Logger** (`activity-log.ts`): Immutable audit logging for mutating actions, budget adjustments, and approvals.

---

## 3. Database & Storage Layer (`packages/db/`)

- **Primary Database**: PostgreSQL 16+ (Production)
- **Zero-Config Local Dev Database**: Embedded `@electric-sql/pglite` (requires no external PostgreSQL installation)
- **ORM**: Drizzle ORM (type-safe SQL builder and relations)
- **Migrations**: Automated schema migrations via Drizzle Kit (`packages/db/src/migrations/`)
- **Key Schema Entities**:
  - `companies`, `company_memberships`, `users`
  - `agents`, `agent_api_keys`
  - `projects`, `issues`, `issue_comments`, `issue_documents`
  - `approvals` (approval gates for proposals, deliverables, and budgets)
  - `work_queues`, `work_queue_items` (intake pipelines & DLQ)
  - `company_memory_providers`, `memory_records` (Stratum RAG storage)
  - `heartbeat_runs`, `heartbeat_run_events` (execution audit and run logs)
  - `external_objects` (on-ramp ticket linkage)

---

## 4. Agent Execution Substrate & Adapters

- **Local CLI / Session Adapters** (`packages/adapters/*`):
  - Claude Code (`@paperclipai/adapter-claude-local`)
  - Codex ACP (`@paperclipai/adapter-codex-local`)
  - Cursor Cloud & Local (`@paperclipai/adapter-cursor-*`)
  - Gemini (`@paperclipai/adapter-gemini-local`)
  - Grok (`@paperclipai/adapter-grok-local`)
  - Pi & OpenCode (`@paperclipai/adapter-pi-local`, `@paperclipai/adapter-opencode-local`)
  - Process Adapter (`server/src/adapters/process/`): Universal command / shell execution
- **Paperclip Runner** (`packages/paperclip-runner/`):
  - High-performance native Rust daemon (`paperclip-runnerd`)
  - Cross-platform process management, PTY allocation, container isolation, and Agent Client Protocol (ACP) sidecar bridge
- **Connected Apps & Remote MCP**:
  - Apps v2 catalog (`packages/shared/src/app-definitions/`)
  - Vercel, GitHub, Slack, Notion, Railway, PostHog integrations governed by `CONNECTOR-PLAYBOOK.md`

---

## 5. Shared Libraries & Contracts (`packages/shared/`, `packages/adapter-utils/`)

- **`@paperclipai/shared`**:
  - Isomorphic TypeScript type definitions for all domain entities.
  - API path constants and request/response contracts.
  - Zod and custom validators ensuring boundary correctness between backend and frontend.
  - Telemetry and event contracts.
- **`@paperclipai/adapter-utils`**:
  - Git workspace synchronization and worktree management.
  - Execution target bridges and secret redaction utilities.

---

## 6. Development & Quality Tooling

- **Package Manager**: pnpm workspaces
- **Testing Framework**: Vitest (fast, multi-project unit and integration test runner)
- **Token Verification**: Custom AST token validator (`scripts/check-token-gates.mjs`) ensuring 100% adherence to design tokens
- **Packaging & Containerization**: Multi-stage Dockerfile (`Dockerfile`) supporting PGlite dev and PostgreSQL production deployments
- **Cross-Platform Compatibility**: Full Windows, macOS, and Linux compatibility for scripts and native binaries
