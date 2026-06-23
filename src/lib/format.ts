// Cost/usage/time formatting helpers shared across run-cost UIs (review portal,
// executions view).

export const fmtUSD = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;

export const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

export const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

// Compact clock time for a run's start (e.g. "14:03").
export const fmtClock = (epochMs: number) =>
  new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
