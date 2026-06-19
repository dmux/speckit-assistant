import { AgentType, CostMetadata } from '../models/types';
import { AGENT_DEFAULT_MODEL, priceFor } from './pricing';

// Strip ANSI escape sequences (colors, cursor moves, OSC) so length-based token
// estimates and regex parsing aren't skewed by terminal control chars.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

// Coarse token estimate: ~4 characters per token.
export function estimateTokens(text: string): number {
  return Math.ceil(stripAnsi(text).length / 4);
}

const toInt = (s: string): number => parseInt(s.replace(/,/g, ''), 10);

// Find a token count for the given label, accepting both orders the CLIs use:
// "input tokens: 1,234" (label-first) and "1,234 input tokens" (number-first).
function matchTokens(text: string, label: string): number | undefined {
  const labelFirst = text.match(new RegExp(`(?:${label})\\s*tokens?\\s*[:=]\\s*([\\d,]+)`, 'i'));
  if (labelFirst) return toInt(labelFirst[1]);
  const numberFirst = text.match(new RegExp(`([\\d,]+)\\s*(?:${label})\\s*tokens`, 'i'));
  if (numberFirst) return toInt(numberFirst[1]);
  return undefined;
}

// Best-effort, CLI-agnostic scrape of explicit usage/cost that some CLIs print.
// Returns only the fields it can find; absent fields stay undefined.
export function parseUsage(raw: string): Partial<CostMetadata> {
  const text = stripAnsi(raw);
  const out: Partial<CostMetadata> = {};

  const cost = text.match(/(?:total_cost_usd|total\s*cost|cost)["']?\s*[:=]\s*\$?\s*([\d.]+)/i);
  if (cost) out.costUSD = parseFloat(cost[1]);

  const input = matchTokens(text, 'input|prompt');
  if (input !== undefined) out.inputTokens = input;

  const output = matchTokens(text, 'output|completion');
  if (output !== undefined) out.outputTokens = output;

  // Only an explicit "total tokens" / "tokens used" — avoid matching the bare
  // "tokens:" inside "input tokens: N".
  const total = text.match(/(?:total\s*tokens|tokens\s*used)\s*[:=]\s*([\d,]+)/i);
  if (total) out.totalTokens = toInt(total[1]);

  const model = text.match(/model["']?\s*[:=]\s*["']?([\w.\-:]+)/i);
  if (model) out.model = model[1];

  return out;
}

export type MeterInput = {
  agentType: AgentType;
  model?: string;
  promptText: string;
  outputText: string;
  durationMs: number;
};

// Combine opportunistic parsing with estimation to always produce a CostMetadata.
export function meter(input: MeterInput): CostMetadata {
  const { agentType, model, promptText, outputText, durationMs } = input;
  const parsed = parseUsage(outputText);

  // Any explicitly-parsed token/cost figure makes this 'parsed'; otherwise 'estimated'.
  const hasParsed =
    parsed.costUSD !== undefined ||
    parsed.inputTokens !== undefined ||
    parsed.outputTokens !== undefined ||
    parsed.totalTokens !== undefined;

  const inputTokens = parsed.inputTokens ?? estimateTokens(promptText);
  const outputTokens = parsed.outputTokens ?? estimateTokens(outputText);
  const totalTokens = parsed.totalTokens ?? inputTokens + outputTokens;

  const resolvedModel = parsed.model || model || AGENT_DEFAULT_MODEL[agentType];

  let costUSD = parsed.costUSD;
  if (costUSD === undefined) {
    const price = priceFor(resolvedModel);
    costUSD = (inputTokens / 1_000_000) * price.inputPerM + (outputTokens / 1_000_000) * price.outputPerM;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUSD,
    model: resolvedModel,
    durationMs,
    source: hasParsed ? 'parsed' : 'estimated',
  };
}
