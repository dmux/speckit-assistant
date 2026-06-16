# ADR 002: State Synchronization and Agent Dispatch

## Status

Approved

## Context

The visual assistant needs to manage the state of the SDD phases. The system design document (SDD) phases are:

1. **Constitution** (Project-wide principles)
2. **Specification** (Requirements for a feature)
3. **Planning** (Technical implementation choices for a feature)
4. **Tasks** (Deconstructed checklist for execution)
5. **Implementation** (Executing the task list and generating code)

The source of truth is always the local workspace directory's files:

- `.specify/memory/constitution.md` for Constitution.
- `specs/[feature]/spec.md` for Specification.
- `specs/[feature]/plan.md` for Planning.
- `specs/[feature]/tasks.md` for Tasks.

We must support running these phases using any AI agent (Claude, Gemini, Copilot, Codex, or native specify CLI) and detect progress updates (e.g., ticking checkboxes in tasks.md, detecting phase completions).

## Decision

We will implement the following mechanics:

### 1. File System State Synchronization

- **Startup Reconciliation**: The system scans the workspace at `process.env.WORKSPACE_PATH` to discover existing features and read the status of each phase.
  - If `.specify/memory/constitution.md` exists, the Constitution phase is marked `approved` or `awaiting_review`.
  - For each feature in `specs/`, the system checks for `spec.md`, `plan.md`, and `tasks.md`.
- **Checkbox Parsing**: The tasks phase reads `tasks.md` and parses the Markdown checkboxes:
  - Total tasks = count of `- [ ]` and `- [x]`.
  - Done tasks = count of `- [x]`.
- **Downstream Staleness Propagation**:
  - If a developer edits or discards a phase, downstream phases are flagged as `stale`.
  - If `spec.md` is modified, then `plan`, `tasks`, and `implementation` become `stale`.
  - If `plan.md` is modified, then `tasks` and `implementation` become `stale`.
  - If `tasks.md` is modified, `implementation` becomes `stale`.

### 2. Agnostic Agent Execution Engine

- We will implement an execution engine that can run agent CLI binaries via standard Node.js `child_process.spawn`.
- The UI exposes a configuration dropdown to select the agent CLI (`claude`, `gemini`, `copilot`, `openai`, or a custom command).
- **Execution CLI mapping**:
  - **Claude**: `claude --permission-mode bypassPermissions "<slashCommand>"`
  - **Gemini**: `printf '%s' '<slashCommand>' | gemini`
  - **Copilot**: `ghcs "<slashCommand>"`
  - **OpenAI**: `printf '%s' '<slashCommand>' | codex exec -`
- **Phase Done Signaling**: The spawned execution wraps the command in a subshell:

  ```bash
  (command); __exit=$?; mkdir -p .specify/.runtime; printf '%s:%s' "phase" "$__exit" > .specify/.runtime/phase-done.txt
  ```

- The backend watches `.specify/.runtime/phase-done.txt` or listens to the child process close event to transition the phase status to `awaiting_review` once completed.

### 3. Server-Sent Events (SSE) or Polling

- Since Next.js API Routes run in a local server, we will expose a Server-Sent Events (SSE) endpoint or simple long-polling endpoint to stream the console logs and phase transitions directly to the UI, ensuring real-time feedback.

## Consequences

- Developers get immediate visual feedback on the progress of their AI agents.
- The UI allows the developers to view and edit the generated markdown files natively.
- Changes made inside the UI markdown editor are saved directly to the disk, which triggers the file reconciliation logic, ensuring the files are the single source of truth.
