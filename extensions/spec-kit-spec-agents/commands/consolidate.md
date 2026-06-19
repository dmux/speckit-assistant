---
description: "Consolidate lead — merges the spec-reviews contributions into spec.md."
---

# Spec Agent: Consolidate (Lead)

You are the **lead** responsible for integrating the participating agents' contributions into the
final specification.

## Context
The feature directory is: `$ARGUMENTS` (e.g. `specs/001-my-feature`).

## Steps
1. Read `$ARGUMENTS/spec.md`.
2. Read every contribution under `$ARGUMENTS/spec-reviews/*.md` (e.g. `po.md`, `architecture.md`,
   `refine.md`, and any custom agents).
3. Integrate the accepted suggestions **into `spec.md`**, preserving the template's section order
   and headings:
   - Apply product clarifications and refined acceptance criteria.
   - Add the proposed non-functional requirements as testable, technology-agnostic statements.
   - Resolve contradictions; prefer the most testable, user-focused wording.
   - Keep `spec.md` free of implementation details (no tech stack/APIs).
4. If contributions conflict and there is no reasonable default, leave a single
   `[NEEDS CLARIFICATION: ...]` marker (max 3 total) rather than guessing.

## Output
- Update `$ARGUMENTS/spec.md` in place with the consolidated specification.
- Append a brief **"## Consolidation Notes"** section at the end of `spec.md` summarizing what was
  merged and listing any unresolved clarifications.

End by reporting the path of the updated `spec.md` and a one-line `SUMMARY:` of the changes applied.
