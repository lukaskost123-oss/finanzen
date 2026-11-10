// Beträge werden durchgehend als ganze Cent gespeichert und gerechnet.

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmtCompact = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const eur = (cents: number) => fmt.format(cents / 100);
export const eurRound = (cents: number) => fmtCompact.format(Math.round(cents / 100));
export const num = (cents: number) => fmtNum.format(cents / 100);

export function signedEur(cents: number): string {
  return (cents > 0 ? '+' : '') + eur(cents);
}

/**
 * Eingabe in Cent umwandeln. Akzeptiert „1.234,56", „1234,56", „1234.56", „12" und „€ 12,5".
 * Gibt null zurück, wenn die Eingabe keine Zahl ist.
 */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[€\s]/g, '').replace(/^\+/, '');
  if (!s) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    // „1.234" oder „1.234.567" = Tausenderpunkte; „12.5" = Dezimalpunkt
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join('');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return neg ? -cents : cents;
}

/** Cent als Eingabetext ohne Währungszeichen, z. B. 123456 → „1234,56". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function formatPct(v: number, digits = 0): string {
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}
