export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
