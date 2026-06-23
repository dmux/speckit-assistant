# Spec Kit DevOps Agents

A Spec Kit extension that adds **operational (DevOps) agents** you run **on demand**
from the speckit-assistant **Executions** view — after the implementation gate is
approved. Unlike the review personas and specification agents, these are not wired as
lifecycle hooks; you trigger them explicitly.

## Commands

| Command | Agent | Report written to |
| --- | --- | --- |
| `/speckit.devops.deploy` | Deploy / Release Engineer | `specs/<feature>/devops/deploy.md` |
| `/speckit.devops.monitor` | Post-deploy Monitoring (SRE) | `specs/<feature>/devops/monitor.md` |
| `/speckit.devops.troubleshoot` | Incident Troubleshooting | `specs/<feature>/devops/troubleshoot.md` |

## The `STATUS:` contract

Each command ends its report with a single status line (e.g. `STATUS: OK`,
`STATUS: DEGRADED`, `STATUS: FAILED`, `STATUS: RESOLVED`). speckit-assistant surfaces
the run result; it falls back to the process exit code if the marker is absent.

## Installation

Install into a Spec Kit workspace like any other extension (or one click in the
speckit-assistant **Extensions** panel):

```bash
specify extension add --dev /path/to/spec-kit-devops
```

Per-agent model and system-prompt overrides are configured in the speckit-assistant
**Agents → DevOps** panel and passed to the agent CLI at run time.
