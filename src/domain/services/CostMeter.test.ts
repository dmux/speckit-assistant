import { describe, it, expect } from 'vitest';
import { stripAnsi, estimateTokens, parseUsage, meter } from './CostMeter';
import { normalizeModel, priceFor, DEFAULT_PRICE, MODEL_PRICES } from './pricing';

describe('CostMeter', () => {
  describe('stripAnsi', () => {
    it('removes ANSI escape sequences but keeps markdown brackets', () => {
      const colored = '\x1b[36mhello\x1b[0m [link](url)';
      expect(stripAnsi(colored)).toBe('hello [link](url)');
    });
  });

  describe('estimateTokens', () => {
    it('estimates ~1 token per 4 chars (ANSI-stripped)', () => {
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('\x1b[31mabcdefgh\x1b[0m')).toBe(2);
    });
  });

  describe('parseUsage', () => {
    it('extracts explicit tokens and cost printed by a CLI', () => {
      const out = 'Done. input tokens: 1,234  output tokens: 567  total_cost_usd: 0.0321';
      const u = parseUsage(out);
      expect(u.inputTokens).toBe(1234);
      expect(u.outputTokens).toBe(567);
      expect(u.costUSD).toBeCloseTo(0.0321);
    });

    it('returns nothing when the output has no usage info', () => {
      expect(parseUsage('just some logs, nothing useful here')).toEqual({});
    });
  });

  describe('meter', () => {
    it('marks source=parsed and uses the exact cost when the CLI prints it', () => {
      const m = meter({
        agentType: 'claude',
        promptText: 'hello',
        outputText: 'input tokens: 100 output tokens: 200 total_cost_usd: 0.05',
        durationMs: 1500,
      });
      expect(m.source).toBe('parsed');
      expect(m.costUSD).toBeCloseTo(0.05);
      expect(m.inputTokens).toBe(100);
      expect(m.outputTokens).toBe(200);
      expect(m.durationMs).toBe(1500);
    });

    it('falls back to estimation + pricing table when nothing is printed', () => {
      const prompt = 'x'.repeat(400); // ~100 tokens
      const output = 'y'.repeat(800);  // ~200 tokens
      const m = meter({ agentType: 'claude', model: 'claude-sonnet', promptText: prompt, outputText: output, durationMs: 2000 });
      expect(m.source).toBe('estimated');
      expect(m.inputTokens).toBe(100);
      expect(m.outputTokens).toBe(200);
      expect(m.totalTokens).toBe(300);
      // sonnet: 100/1e6*3 + 200/1e6*15 = 0.0003 + 0.003 = 0.0033
      expect(m.costUSD).toBeCloseTo(0.0033, 6);
      expect(m.model).toBe('claude-sonnet');
    });

    it('assumes a default model per agentType when none is given', () => {
      const m = meter({ agentType: 'gemini', promptText: 'hi', outputText: 'there', durationMs: 10 });
      expect(m.model).toBe('gemini-2.5-flash');
    });
  });
});

describe('pricing', () => {
  it('normalizes model strings to table keys by substring', () => {
    expect(normalizeModel('claude-3-5-sonnet-20241022')).toBe('claude-sonnet');
    expect(normalizeModel('claude-sonnet-4-6')).toBe('claude-sonnet');
    expect(normalizeModel('claude-haiku-4-5-20251001')).toBe('claude-haiku');
    expect(normalizeModel('claude-opus-4-8')).toBe('claude-opus');
    expect(normalizeModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    expect(normalizeModel('gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(normalizeModel('totally-unknown')).toBeUndefined();
  });

  it('falls back to DEFAULT_PRICE for unknown models', () => {
    expect(priceFor('totally-unknown')).toEqual(DEFAULT_PRICE);
    expect(priceFor('claude-opus')).toEqual(MODEL_PRICES['claude-opus']);
  });
});
