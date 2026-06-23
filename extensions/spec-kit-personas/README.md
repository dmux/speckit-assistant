# Spec Kit Review Personas

A Spec Kit extension that adds a **review gate** to the implementation phase. After
`/speckit.implement` runs, `speckit-assistant` executes these persona sub-agents **in order** —
QA → Code Review → Security → **Tech Lead** (final sign-off) — each as its own tracked agent run.

## Commands

| Command | Persona | Report written to |
| --- | --- | --- |
| `/speckit.personas.qa` | QA Engineer | `specs/<feature>/reviews/qa.md` |
| `/speckit.personas.code` | Senior Code Reviewer | `specs/<feature>/reviews/code-review.md` |
| `/speckit.personas.security` | Security Engineer | `specs/<feature>/reviews/security.md` |
| `/speckit.personas.techlead` | Tech Lead | `specs/<feature>/reviews/tech-lead.md` |

## The `VERDICT:` contract

Each command must end its report with a single line:

```
VERDICT: PASS
```
or
```
VERDICT: FAIL
```

`speckit-assistant` reads this marker to decide pass/fail (falling back to the process exit code if
the marker is absent). The gate **stops at the first FAIL**; the implementation phase only advances to
`awaiting_review` once every enabled persona — ending with Tech Lead — passes.

## Installation

Install into a Spec Kit workspace like any other extension (the slash commands must be available to
the agent CLI you run, e.g. Claude Code):

```bash
specify extension add --dev /path/to/spec-kit-personas
```

The persona commands (and whether each is enabled) are configurable in the speckit-assistant
**Agent Config → Review Gate** panel.
