// Alle Datumswerte sind lokale Kalenderdaten als 'YYYY-MM-DD'-Strings.
// Gerechnet wird über UTC, damit Sommerzeit-Umstellungen keine Tage verschieben.

const pad = (n: number) => String(n).padStart(2, '0');

export function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function ymd(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Monat verschieben, m ist 1–12. */
export function addMonths(y: number, m: number, n: number): [number, number] {
  const idx = y * 12 + (m - 1) + n;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

export function monthIndex(y: number, m: number): number {
  return y * 12 + (m - 1);
}

/** Tag im Monat auf den letzten gültigen Tag kürzen (31. → 28./29./30.). */
export function clampDay(y: number, m: number, d: number): string {
  return iso(y, m, Math.min(d, daysInMonth(y, m)));
}

function toUTC(s: string): number {
  const [y, m, d] = ymd(s);
  return Date.UTC(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const t = new Date(toUTC(s) + n * 86400000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function todayISO(): string {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function monthRange(y: number, m: number): [string, string] {
  return [iso(y, m, 1), iso(y, m, daysInMonth(y, m))];
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export const monthName = (m: number) => MONTHS[m - 1];
export const monthShort = (m: number) => MONTHS_SHORT[m - 1];
export const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;

export function formatDate(s: string): string {
  const [y, m, d] = ymd(s);
  return `${pad(d)}.${pad(m)}.${y}`;
}

export function formatDateShort(s: string): string {
  const [, m, d] = ymd(s);
  return `${d}. ${MONTHS_SHORT[m - 1]}`;
}

export function weekdayShort(s: string): string {
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(toUTC(s)).getUTCDay()];
}
