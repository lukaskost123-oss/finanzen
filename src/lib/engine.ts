import type { AppState, Interval, Occurrence, OneTime, Recurring } from './types';
import { addDays, addMonths, clampDay, diffDays, iso, monthIndex, monthRange, ymd } from './dates';

export const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: 'wöchentlich',
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  halfyearly: 'halbjährlich',
  yearly: 'jährlich',
  custom: 'individuell',
};

/** Monate zwischen zwei Zahlungen (0 = wöchentlich). */
export function stepMonths(r: Pick<Recurring, 'interval' | 'customMonths'>): number {
  switch (r.interval) {
    case 'weekly': return 0;
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'halfyearly': return 6;
    case 'yearly': return 12;
    case 'custom': return Math.max(1, Math.floor(r.customMonths ?? 1));
  }
}

export function periodsPerYear(r: Pick<Recurring, 'interval' | 'customMonths'>): number {
  const s = stepMonths(r);
  return s === 0 ? 52 : 12 / s;
}

/** Betrag auf den Monat umgerechnet (z. B. 120 €/Jahr → 10 €/Monat). */
export function monthlyEquivalent(r: Recurring): number {
  return Math.round((r.amountCents * periodsPerYear(r)) / 12);
}

/** Datum der k-ten Zahlung (k ab 0), ohne Rücksicht auf Ende oder Pause. */
function nthDate(r: Recurring, k: number): string {
  const step = stepMonths(r);
  if (step === 0) return addDays(r.startDate, k * 7);
  const [sy, sm, sd] = ymd(r.startDate);
  // Erste Zahlung = erster Zahlungstag am oder nach dem Startdatum
  const firstInStart = clampDay(sy, sm, r.dayOfMonth);
  const anchorShift = ymd(firstInStart)[2] < sd ? 1 : 0;
  const [y, m] = addMonths(sy, sm, anchorShift + k * step);
  return clampDay(y, m, r.dayOfMonth);
}

function endsBefore(r: Recurring, k: number, date: string): boolean {
  if (r.endMode === 'count' && r.count != null && k >= r.count) return true;
  if (r.endMode === 'date' && r.endDate && date > r.endDate) return true;
  return false;
}

/** Bekannte Gesamtzahl der Zahlungen (bei Anzahl, Enddatum oder Kredit). */
export function totalPayments(r: Recurring): number | undefined {
  if (r.endMode === 'count' && r.count) return r.count;
  if (r.endMode === 'date' && r.endDate) {
    let k = 0;
    while (k < 5000 && nthDate(r, k) <= r.endDate) k++;
    return k;
  }
  if (r.loan && r.loan.principalCents > 0) {
    return loanTerm(r.loan.principalCents, r.loan.ratePct, r.amountCents, periodsPerYear(r));
  }
  return undefined;
}

/** Datum der letzten Zahlung, falls ein Ende bekannt ist. */
export function lastPaymentDate(r: Recurring): string | undefined {
  const n = totalPayments(r);
  return n ? nthDate(r, n - 1) : undefined;
}

export function recurringOccurrences(r: Recurring, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  const step = stepMonths(r);
  const total = totalPayments(r);
  // Sprung nahe an den Zeitraum, statt ab Start alles durchzulaufen
  let k = 0;
  if (from > r.startDate) {
    const [fy, fm] = ymd(from);
    const [sy, sm] = ymd(r.startDate);
    k = step === 0
      ? Math.max(0, Math.floor(diffDays(r.startDate, from) / 7) - 1)
      : Math.max(0, Math.floor((monthIndex(fy, fm) - monthIndex(sy, sm)) / step) - 1);
  }
  for (; k < 100000; k++) {
    const date = nthDate(r, k);
    if (date > to || endsBefore(r, k, date) || (total != null && k >= total)) break;
    if (date < from) continue;
    if (r.pausedFrom && date >= r.pausedFrom) continue;
    out.push({
      key: `${r.id}@${date}`,
      sourceId: r.id,
      source: 'recurring',
      kind: r.kind,
      name: r.name,
      amountCents: r.amountCents,
      categoryId: r.categoryId,
      date,
      index: k + 1,
      total,
    });
  }
  return out;
}

function oneTimeOccurrence(o: OneTime): Occurrence {
  return { key: `${o.id}@${o.date}`, sourceId: o.id, source: 'oneTime', kind: o.kind, name: o.name, amountCents: o.amountCents, categoryId: o.categoryId, date: o.date };
}

export function occurrences(state: Pick<AppState, 'recurring' | 'oneTime'>, from: string, to: string): Occurrence[] {
  const list = state.recurring.flatMap((r) => recurringOccurrences(r, from, to));
  for (const o of state.oneTime) if (o.date >= from && o.date <= to) list.push(oneTimeOccurrence(o));
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Vergangene Zahlungen gelten als bezahlt, heutige und künftige als offen – solange nicht manuell geändert. */
export function isPaid(paid: AppState['paid'], o: Occurrence, today: string): boolean {
  return paid[o.key] ?? o.date < today;
}

export interface MonthSummary {
  year: number;
  month: number;
  incomeCents: number;
  fixedCents: number;
  oneTimeCents: number;
  expenseCents: number;
  remainingCents: number;
  openCents: number;
  byCategory: Record<string, number>;
  items: Occurrence[];
}

export function monthSummary(state: AppState, y: number, m: number, today: string): MonthSummary {
  const [from, to] = monthRange(y, m);
  const items = occurrences(state, from, to);
  const s: MonthSummary = { year: y, month: m, incomeCents: 0, fixedCents: 0, oneTimeCents: 0, expenseCents: 0, remainingCents: 0, openCents: 0, byCategory: {}, items };
  for (const o of items) {
    if (o.kind === 'income') { s.incomeCents += o.amountCents; continue; }
    if (o.source === 'recurring') s.fixedCents += o.amountCents;
    else s.oneTimeCents += o.amountCents;
    s.byCategory[o.categoryId] = (s.byCategory[o.categoryId] ?? 0) + o.amountCents;
    if (!isPaid(state.paid, o, today)) s.openCents += o.amountCents;
  }
  s.expenseCents = s.fixedCents + s.oneTimeCents;
  s.remainingCents = s.incomeCents - s.expenseCents;
  return s;
}

export type Health = 'good' | 'warn' | 'bad';

/** Grün ab 20 % Puffer, gelb bis 0, rot bei Minus. */
export function health(s: Pick<MonthSummary, 'incomeCents' | 'remainingCents'>): Health {
  if (s.remainingCents < 0) return 'bad';
  if (s.incomeCents === 0 || s.remainingCents < s.incomeCents * 0.2) return 'warn';
  return 'good';
}

export function forecast(state: AppState, y: number, m: number, months: number, today: string): MonthSummary[] {
  return Array.from({ length: months }, (_, i) => {
    const [yy, mm] = addMonths(y, m, i);
    return monthSummary(state, yy, mm, today);
  });
}

// ───────────── Kredite & Raten ─────────────

/** Annuitätenrate für Kreditsumme, Jahreszins und Anzahl Raten. */
export function annuity(principalCents: number, ratePct: number, n: number, perYear = 12): number {
  if (n <= 0) return 0;
  const i = ratePct / 100 / perYear;
  if (i === 0) return Math.ceil(principalCents / n);
  return Math.round((principalCents * i) / (1 - Math.pow(1 + i, -n)));
}

/** Anzahl Raten bis zur vollständigen Tilgung (undefined, wenn die Rate die Zinsen nicht deckt). */
export function loanTerm(principalCents: number, ratePct: number, rateCents: number, perYear = 12): number | undefined {
  if (rateCents <= 0) return undefined;
  const i = ratePct / 100 / perYear;
  if (i === 0) return Math.ceil(principalCents / rateCents);
  const x = 1 - (i * principalCents) / rateCents;
  if (x <= 0) return undefined;
  const n = Math.ceil(-Math.log(x) / Math.log(1 + i) - 1e-9);
  // Rundungsreste von wenigen Cent werden mit der letzten Rate beglichen statt als Extra-Rate
  if (n > 1 && loanBalance(principalCents, ratePct, rateCents, n - 1, perYear) <= 100) return n - 1;
  return n;
}

/** Restschuld nach k gezahlten Raten. */
export function loanBalance(principalCents: number, ratePct: number, rateCents: number, k: number, perYear = 12): number {
  const i = ratePct / 100 / perYear;
  let b = principalCents;
  for (let j = 0; j < k && b > 0; j++) b = Math.round(b * (1 + i)) - rateCents;
  return Math.max(0, b);
}

export interface InstallmentInfo {
  total?: number;
  paidCount: number;
  remainingCount?: number;
  remainingCents?: number; // Restschuld bzw. Summe offener Raten
  totalCents?: number; // Gesamtkosten aller Raten
  interestCents?: number; // Zinskosten (nur Kredit)
  lastDate?: string;
  nextDate?: string;
  progress?: number; // 0–1
}

export function installmentInfo(r: Recurring, today: string): InstallmentInfo {
  const total = totalPayments(r);
  // Bezahlte Raten = alle bis einschließlich heute
  let paidCount = 0;
  while (paidCount < (total ?? 100000) && nthDate(r, paidCount) <= today) paidCount++;
  const nextDate = total == null || paidCount < total ? nthDate(r, paidCount) : undefined;
  const info: InstallmentInfo = { total, paidCount, nextDate, lastDate: lastPaymentDate(r) };
  if (total != null) {
    info.remainingCount = total - paidCount;
    info.progress = total === 0 ? 1 : paidCount / total;
    info.totalCents = total * r.amountCents;
    info.remainingCents = info.remainingCount * r.amountCents;
  }
  if (r.loan && r.loan.principalCents > 0) {
    const ppy = periodsPerYear(r);
    info.remainingCents = loanBalance(r.loan.principalCents, r.loan.ratePct, r.amountCents, paidCount, ppy);
    if (total != null) {
      // letzte Rate ist meist kleiner: Gesamtkosten = Kredit + Zinsen exakt nachrechnen
      let b = r.loan.principalCents, paidSum = 0;
      const i = r.loan.ratePct / 100 / ppy;
      for (let j = 0; j < total && b > 0; j++) {
        const withInterest = Math.round(b * (1 + i));
        const pay = Math.min(r.amountCents, withInterest);
        paidSum += pay;
        b = withInterest - pay;
      }
      paidSum += b; // Rundungsrest mit der letzten Rate
      info.totalCents = paidSum;
      info.interestCents = paidSum - r.loan.principalCents;
    }
  }
  return info;
}

export interface ExpiringHint {
  item: Recurring;
  lastDate: string;
  freeFrom: [number, number]; // Monat, ab dem die Zahlung entfällt
  monthlyCents: number;
}

/** Ratenzahlungen, deren letzte Rate in den nächsten `months` Monaten fällig ist. */
export function expiringSoon(state: AppState, today: string, months = 3): ExpiringHint[] {
  const limit = (() => { const [y, m] = ymd(today); const [yy, mm] = addMonths(y, m, months); return iso(yy, mm, 31); })();
  return state.recurring
    .filter((r) => r.kind === 'expense' && !r.pausedFrom)
    .map((r) => ({ r, last: lastPaymentDate(r) }))
    .filter((x): x is { r: Recurring; last: string } => !!x.last && x.last >= today && x.last <= limit)
    .map(({ r, last }) => {
      const [y, m] = ymd(last);
      return { item: r, lastDate: last, freeFrom: addMonths(y, m, 1), monthlyCents: monthlyEquivalent(r) };
    })
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate));
}

/** Laufende Zahlungen = gestartet, nicht beendet, nicht pausiert. */
export function isActive(r: Recurring, today: string): boolean {
  if (r.pausedFrom && r.pausedFrom <= today) return false;
  const last = lastPaymentDate(r);
  return !last || last >= today;
}

export interface AboHint {
  item: Recurring;
  months: number;
  yearlyCents: number;
  reason: string;
}

/** Abos, die schon lange laufen oder viel kosten. */
export function aboCheck(state: AppState, today: string): AboHint[] {
  return state.recurring
    .filter((r) => r.kind === 'expense' && r.categoryId === 'abos' && isActive(r, today))
    .map((r) => {
      const months = Math.max(0, Math.floor(diffDays(r.startDate, today) / 30.44));
      const yearlyCents = monthlyEquivalent(r) * 12;
      const reasons: string[] = [];
      if (months >= 12) reasons.push(`läuft seit ${months} Monaten`);
      if (yearlyCents >= 15000) reasons.push('kostet über 150 € im Jahr');
      return { item: r, months, yearlyCents, reason: reasons.join(' und ') };
    })
    .filter((h) => h.reason)
    .sort((a, b) => b.yearlyCents - a.yearlyCents);
}

/** Zahlungen, die in den nächsten `days` Tagen fällig und noch offen sind. */
export function upcoming(state: AppState, today: string, days: number): Occurrence[] {
  return occurrences(state, today, addDays(today, days)).filter((o) => o.kind === 'expense' && state.paid[o.key] !== true);
}
