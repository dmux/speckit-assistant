// Suggested model versions shown in the agent/persona configuration UIs.
// These are display suggestions only — any string is accepted, and pricing
// (see pricing.ts) matches by substring (opus/sonnet/haiku/gpt-4o/gemini…),
// so new dated variants still price correctly.
export type ModelOption = { value: string; label: string };

export const MODEL_GROUPS: { provider: string; models: ModelOption[] }[] = [
  {
    provider: 'Anthropic (Claude)',
    models: [
      { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { value: 'claude-fable-5', label: 'Claude Fable 5' },
    ],
  },
  {
    provider: 'Google (Gemini)',
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
  {
    provider: 'OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
];

export const MODEL_OPTIONS: ModelOption[] = MODEL_GROUPS.flatMap(g => g.models);

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
