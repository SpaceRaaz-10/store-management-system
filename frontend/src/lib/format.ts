export function formatMoney(value: string | number | null | undefined, symbol = 'रु'): string {
  const n = Number(value ?? 0);
  return `${symbol} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQty(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  // Show up to 3 decimals, but strip trailing zeros: 5.000 -> 5, 5.500 -> 5.5
  const fixed = n.toFixed(3);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return trimmed || '0';
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}