import { PersonaConfig, PersonaId } from './types';

// Fixed execution order of the implementation review gate. Tech Lead runs last
// so it can aggregate the findings of the preceding personas and sign off.
export const PERSONA_ORDER: PersonaId[] = ['qa', 'code-review', 'security', 'tech-lead'];

// Default persona registry. Each persona is backed by a Spec Kit extension
// slash command (see extensions/spec-kit-personas). Users can override the
// command or disable a persona from the Agent Config UI.
export const DEFAULT_PERSONAS: PersonaConfig[] = [
  {
    id: 'qa',
    label: 'QA',
    command: '/speckit.personas.qa',
    enabled: true,
    model: 'gemini-2.5-flash',
    description: 'Automated quality assurance agent. Runs tests, verifies regression suite, and inspects validation logs.',
    systemPrompt: 'You are the QA persona in a Spec-Driven Development cycle. Your goal is to run unit/integration tests and check that code changes do not break existing features. Output verification reports with a clear VERDICT: PASS or FAIL.',
    capabilities: ['Runs Vitest/Jest test suites', 'Generates coverage reports', 'Checks edge cases in inputs', 'Identifies code regressions'],
    tools: ['vitest', 'npm test', 'coverage-reporter', 'test-generator']
  },
  {
    id: 'code-review',
    label: 'Code Review',
    command: '/speckit.personas.code',
    enabled: true,
    model: 'gemini-2.5-pro',
    description: 'Automated code standard and architectural reviewer. Validates SOLID patterns and code complexity.',
    systemPrompt: 'You are the Code Reviewer persona. Analyze source code diffs for adherence to architectural standards, clean code practices (SOLID, DRY), and formatting. Output feedback with a final VERDICT: PASS or FAIL.',
    capabilities: ['Analyzes design pattern compliance', 'Checks cyclomatic complexity', 'Identifies redundant code blocks', 'Ensures type safety'],
    tools: ['eslint', 'typescript-compiler', 'complexity-analyzer', 'stylelint']
  },
  {
    id: 'security',
    label: 'Security',
    command: '/speckit.personas.security',
    enabled: true,
    model: 'claude-3-5-sonnet',
    description: 'Automated security compliance agent. Scans for hardcoded credentials, dependency CVEs, and OWASP vulnerabilities.',
    systemPrompt: 'You are the Security Auditor persona. Scan changes for exposed credentials, API keys, dependency vulnerabilities, injection flaws, and other OWASP Top 10 risks. Output a final VERDICT: PASS or FAIL.',
    capabilities: ['Scans for exposed secrets', 'Identifies dependency CVEs', 'Detects injection vulnerabilities', 'Verifies authentication protocols'],
    tools: ['git-secrets', 'npm audit', 'owasp-scanner', 'trivy']
  },
  {
    id: 'tech-lead',
    label: 'Tech Lead',
    command: '/speckit.personas.techlead',
    enabled: true,
    model: 'gemini-2.5-pro',
    description: 'Tech Lead agent responsible for final signature sign-off. Aggregates reviews and signs the implementation gate.',
    systemPrompt: 'You are the Tech Lead persona. You represent the final automated validation step. Aggregate findings from previous agents, confirm architecture completeness, and sign the gate. Output a final VERDICT: PASS or FAIL.',
    capabilities: ['Aggregates reviews and signals', 'Confirms architecture patterns', 'Approves merge readiness', 'Performs final API signature verification'],
    tools: ['git-merge-dryrun', 'dependency-checker', 'signature-verifier']
  }
];

// Relative path (from the feature dir) where a persona writes its review report.
export function personaReportPath(featureName: string, id: PersonaId): string {
  return `specs/${featureName}/reviews/${id}.md`;
}

// Sort an arbitrary persona list into the canonical gate order.
export function orderPersonas<T extends { id: PersonaId }>(personas: T[]): T[] {
  return [...personas].sort(
    (a, b) => PERSONA_ORDER.indexOf(a.id) - PERSONA_ORDER.indexOf(b.id)
  );
}
