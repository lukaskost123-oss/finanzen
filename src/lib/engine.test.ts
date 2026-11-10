import { describe, expect, it } from 'vitest';
import type { AppState, Recurring } from './types';
import { annuity, expiringSoon, installmentInfo, loanBalance, loanTerm, monthSummary, monthlyEquivalent, recurringOccurrences } from './engine';
import { parseEuro } from './money';

const base = (p: Partial<Recurring>): Recurring => ({
  id: 'x', kind: 'expense', name: 'Test', amountCents: 1000, categoryId: 'sonstiges', interval: 'monthly',
  dayOfMonth: 1, startDate: '2026-01-01', endMode: 'none', createdAt: '2026-01-01', ...p,
});

const state = (recurring: Recurring[], extra: Partial<AppState> = {}): AppState => ({
  version: 1, categories: [], recurring, oneTime: [], budgets: [], goals: [], paid: {},
  settings: { theme: 'system', reminderDays: 3, demo: false }, ...extra,
});

describe('Zahlungstermine', () => {
  it('kürzt den 31. auf das Monatsende, auch im Schaltjahr', () => {
    const r = base({ dayOfMonth: 31, startDate: '2028-01-01' });
    const dates = recurringOccurrences(r, '2028-01-01', '2028-04-30').map((o) => o.date);
    expect(dates).toEqual(['2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30']);
    const dates27 = recurringOccurrences({ ...r, startDate: '2027-01-01' }, '2027-02-01', '2027-02-28').map((o) => o.date);
    expect(dates27).toEqual(['2027-02-28']);
  });

  it('beginnt im Folgemonat, wenn der Zahlungstag vor dem Startdatum liegt', () => {
    const r = base({ dayOfMonth: 5, startDate: '2026-03-20' });
    expect(recurringOccurrences(r, '2026-03-01', '2026-04-30').map((o) => o.date)).toEqual(['2026-04-05']);
  });

  it('beachtet die Anzahl der Raten', () => {
    const r = base({ endMode: 'count', count: 3 });
    const all = recurringOccurrences(r, '2025-01-01', '2027-12-31');
    expect(all.map((o) => o.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(all[2].index).toBe(3);
    expect(all[2].total).toBe(3);
  });

  it('vierteljährlich über den Jahreswechsel und mit Enddatum', () => {
    const r = base({ interval: 'quarterly', dayOfMonth: 15, startDate: '2026-11-01', endMode: 'date', endDate: '2027-08-15' });
    expect(recurringOccurrences(r, '2026-01-01', '2028-12-31').map((o) => o.date)).toEqual(['2026-11-15', '2027-02-15', '2027-05-15', '2027-08-15']);
  });

  it('wöchentlich: 4 oder 5 Termine pro Monat', () => {
    const r = base({ interval: 'weekly', startDate: '2026-12-01' });
    expect(recurringOccurrences(r, '2026-12-01', '2026-12-31')).toHaveLength(5);
    expect(recurringOccurrences(r, '2027-02-01', '2027-02-28')).toHaveLength(4);
  });

  it('springt bei späten Zeiträumen korrekt (Ratennummer bleibt richtig)', () => {
    const r = base({ startDate: '2020-01-01' });
    const [o] = recurringOccurrences(r, '2026-06-01', '2026-06-30');
    expect(o.date).toBe('2026-06-01');
    expect(o.index).toBe(78);
  });

  it('pausierte Zahlungen fallen ab dem Pausendatum weg', () => {
    const r = base({ pausedFrom: '2026-03-01' });
    expect(recurringOccurrences(r, '2026-01-01', '2026-06-30')).toHaveLength(2);
  });
});

describe('Beträge', () => {
  it('Monatsäquivalent', () => {
    expect(monthlyEquivalent(base({ interval: 'yearly', amountCents: 12000 }))).toBe(1000);
    expect(monthlyEquivalent(base({ interval: 'quarterly', amountCents: 9000 }))).toBe(3000);
    expect(monthlyEquivalent(base({ interval: 'weekly', amountCents: 1200 }))).toBe(5200);
  });

  it('Eingaben im deutschen und englischen Format', () => {
    expect(parseEuro('1.234,56')).toBe(123456);
    expect(parseEuro('49,99 €')).toBe(4999);
    expect(parseEuro('12.5')).toBe(1250);
    expect(parseEuro('1.234')).toBe(123400);
    expect(parseEuro('0,1')).toBe(10);
    expect(parseEuro('abc')).toBeNull();
  });

  it('Monatsübersicht ohne Rundungsfehler (0,10 + 0,20)', () => {
    const s = state([
      base({ id: 'a', amountCents: 10 }),
      base({ id: 'b', amountCents: 20 }),
      base({ id: 'c', kind: 'income', amountCents: 250000 }),
    ]);
    const m = monthSummary(s, 2026, 5, '2026-05-15');
    expect(m.expenseCents).toBe(30);
    expect(m.remainingCents).toBe(249970);
  });

  it('offene Beträge: Zukunft offen, manuell bezahlt zählt nicht', () => {
    const s = state([base({ id: 'a', dayOfMonth: 1 }), base({ id: 'b', dayOfMonth: 28, amountCents: 500 })]);
    expect(monthSummary(s, 2026, 5, '2026-05-15').openCents).toBe(500);
    s.paid['b@2026-05-28'] = true;
    expect(monthSummary(s, 2026, 5, '2026-05-15').openCents).toBe(0);
  });
});

describe('Kredite und Raten', () => {
  it('Annuität: 10.000 € über 48 Monate zu 5 %', () => {
    expect(annuity(1_000_000, 5, 48)).toBe(23029); // 230,29 €
  });

  it('Laufzeit und Restschuld passen zur Annuität', () => {
    expect(loanTerm(1_000_000, 5, 23029)).toBe(48);
    expect(loanBalance(1_000_000, 5, 23029, 48)).toBeLessThan(100);
    expect(loanBalance(1_000_000, 0, 25000, 10)).toBe(750000);
  });

  it('Fortschritt: 14 von 24 Raten', () => {
    const r = base({ amountCents: 4999, endMode: 'count', count: 24, startDate: '2025-09-01' });
    const info = installmentInfo(r, '2026-10-15');
    expect(info.paidCount).toBe(14);
    expect(info.remainingCount).toBe(10);
    expect(info.remainingCents).toBe(49990);
    expect(info.lastDate).toBe('2027-08-01');
  });

  it('Hinweis auf auslaufende Raten', () => {
    const s = state([base({ amountCents: 8900, endMode: 'count', count: 6, startDate: '2026-09-01' })]);
    const [h] = expiringSoon(s, '2026-11-10');
    expect(h.lastDate).toBe('2027-02-01');
    expect(h.freeFrom).toEqual([2027, 3]);
    expect(h.monthlyCents).toBe(8900);
  });
});
