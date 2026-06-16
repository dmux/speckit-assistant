# ADR 001: Hexagonal Architecture (Ports and Adapters)

## Status

Approved

## Context

We are building a standalone visual assistant for Spec-Driven Development (SDD) called `speckit-assistant`. It must be executed via `npx` and expose a Next.js 16 web interface utilizing ReactFlow and Tailwind. The application needs to be agnostic of the specific AI agent (Claude, Gemini, Copilot, Codex, etc.) and should keep the local repository's files as the single source of truth.

To maintain a clean separation between the core logic (workflow management, state transition rules, Markdown parsing, and agent command generation) and external technical concerns (Next.js routing, node-run terminal child processes, React state, ReactFlow node rendering, and the file system), we need an architectural pattern that supports loose coupling and mockability.

## Decision

We will employ **Hexagonal Architecture (Ports and Adapters)**.

The system is organized into three distinct layers:

1. **Core Domain**: Contains business entities (e.g., `Feature`, `Phase`, `Task`), state transition logic, and domain rules. It has zero external dependencies on framework-specific packages (Next.js, ReactFlow, or local file system modules).
2. **Ports (Interfaces)**: Defines how the domain interacts with the outside.
   - **Inbound Ports (Use Cases)**: APIs exposed by the domain for primary adapters (e.g., `GetWorkflowStateUseCase`, `CreateFeatureUseCase`, `RunPhaseUseCase`).
   - **Outbound Ports (SPIs)**: Interfaces that the domain requires to execute actions, implemented by secondary adapters (e.g., `WorkspaceRepositoryPort`, `AgentRunnerPort`).
3. **Adapters**: Concrete implementations of ports.
   - **Primary Adapters**:
     - Next.js API router handlers that call Inbound Ports.
     - React components that capture user actions (e.g., clicking "Approve Phase", clicking a task checkbox, typing a spec) and trigger primary adapters.
   - **Secondary Adapters**:
     - `FSWorkspaceRepository`: Syncs state directly with the local folder structure, parsing `.specify/memory/constitution.md` and `specs/[feature]/(spec.md|plan.md|tasks.md)`.
     - `ProcessAgentRunner`: Spawns local terminals or processes for AI agents, executing the respective slash commands (e.g., `/speckit.specify`).

### Folder Structure

```text
speckit-assistant/
├── docs/                       # Architecture Decisions
├── src/
│   ├── domain/                 # Core domain layer
│   │   ├── models/             # Domain entities and state definitions
│   │   └── ports/
│   │       ├── in/             # Use cases
│   │       └── out/            # SPIs (Services/Repositories)
│   ├── adapters/               # Adapters layer
│   │   ├── primary/            # UI, HTTP/REST API controllers
│   │   └── secondary/          # File system, Shell executions
```

## Consequences

- **Testability**: The core business logic can be tested in isolation with 100% test coverage using standard test runners (Vitest), mocking out the file system and CLI agents.
- **Maintainability**: The web UI framework or ReactFlow styling can be completely refactored without touching domain state transition rules.
- **Flexibility**: We can easily swap out the process spawn execution engine for an API-based LLM adapter in the future by adding a new secondary adapter that implements the `AgentRunnerPort`.
