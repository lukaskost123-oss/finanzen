import type { AppState, Category, OneTime, Recurring } from './types';
import { addMonths, clampDay, iso, todayISO, ymd } from './dates';
import { annuity } from './engine';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'wohnen', name: 'Wohnen', icon: 'home', color: '#6366f1' },
  { id: 'mobilitaet', name: 'Mobilität', icon: 'car', color: '#0ea5e9' },
  { id: 'versicherungen', name: 'Versicherungen', icon: 'shield', color: '#14b8a6' },
  { id: 'abos', name: 'Abos', icon: 'repeat', color: '#a855f7' },
  { id: 'kredite', name: 'Kredite', icon: 'landmark', color: '#ef4444' },
  { id: 'lebensmittel', name: 'Lebensmittel', icon: 'cart', color: '#f97316' },
  { id: 'freizeit', name: 'Freizeit', icon: 'game', color: '#ec4899' },
  { id: 'gesundheit', name: 'Gesundheit', icon: 'heart', color: '#10b981' },
  { id: 'sonstiges', name: 'Sonstiges', icon: 'package', color: '#64748b' },
  { id: 'gehalt', name: 'Gehalt', icon: 'briefcase', color: '#10b981' },
  { id: 'nebeneinkunft', name: 'Nebeneinkünfte', icon: 'coins', color: '#84cc16' },
];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function emptyState(): AppState {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    recurring: [],
    oneTime: [],
    budgets: [],
    goals: [],
    paid: {},
    settings: { theme: 'system', reminderDays: 3, demo: false },
  };
}

/** Beispieldaten relativ zum heutigen Monat, damit die App sofort lebendig aussieht. */
export function demoState(): AppState {
  const [y, m] = ymd(todayISO());
  const monthsAgo = (n: number, d = 1) => { const [yy, mm] = addMonths(y, m, -n); return clampDay(yy, mm, d); };
  const now = todayISO();
  const tag = 'demo-';
  const R = (p: Partial<Recurring> & Pick<Recurring, 'name' | 'amountCents' | 'categoryId'>): Recurring => ({
    id: tag + uid(), kind: 'expense', interval: 'monthly', dayOfMonth: 1, startDate: monthsAgo(18), endMode: 'none', createdAt: now, ...p,
  });
  const O = (p: Pick<OneTime, 'name' | 'amountCents' | 'categoryId' | 'date'> & Partial<OneTime>): OneTime => ({
    id: tag + uid(), kind: 'expense', createdAt: now, ...p,
  });
  const carLoan = { principalCents: 1_500_000, ratePct: 4.9 };
  return {
    ...emptyState(),
    settings: { theme: 'system', reminderDays: 3, demo: true },
    recurring: [
      R({ name: 'Gehalt', kind: 'income', amountCents: 324000, categoryId: 'gehalt', dayOfMonth: 28, provider: 'Arbeitgeber' }),
      R({ name: 'Miete', amountCents: 89000, categoryId: 'wohnen', dayOfMonth: 1, provider: 'Hausverwaltung' }),
      R({ name: 'Strom', amountCents: 7400, categoryId: 'wohnen', dayOfMonth: 15 }),
      R({ name: 'Internet & Telefon', amountCents: 3999, categoryId: 'wohnen', dayOfMonth: 5 }),
      R({ name: 'Autokredit', amountCents: annuity(carLoan.principalCents, carLoan.ratePct, 48), categoryId: 'kredite', dayOfMonth: 10, startDate: monthsAgo(20), endMode: 'count', count: 48, loan: carLoan, provider: 'Hausbank', contractNo: 'KR-2025-4471' }),
      R({ name: 'Smartphone-Raten', amountCents: 4999, categoryId: 'kredite', dayOfMonth: 20, startDate: monthsAgo(21), endMode: 'count', count: 24, provider: 'Mobilfunkanbieter' }),
      R({ name: 'Kfz-Versicherung', amountCents: 64800, categoryId: 'versicherungen', interval: 'yearly', dayOfMonth: 1, startDate: monthsAgo(10) }),
      R({ name: 'Haftpflicht', amountCents: 2100, categoryId: 'versicherungen', interval: 'quarterly', dayOfMonth: 1, startDate: monthsAgo(14) }),
      R({ name: 'Streaming', amountCents: 1799, categoryId: 'abos', dayOfMonth: 12, startDate: monthsAgo(30) }),
      R({ name: 'Musik-Abo', amountCents: 1099, categoryId: 'abos', dayOfMonth: 3, startDate: monthsAgo(26) }),
      R({ name: 'Fitnessstudio', amountCents: 3490, categoryId: 'gesundheit', dayOfMonth: 1, startDate: monthsAgo(8) }),
      R({ name: 'Cloud-Speicher', amountCents: 2999, categoryId: 'abos', interval: 'yearly', dayOfMonth: 18, startDate: monthsAgo(15) }),
      R({ name: 'Deutschlandticket', amountCents: 5800, categoryId: 'mobilitaet', dayOfMonth: 1, startDate: monthsAgo(12) }),
    ],
    oneTime: [
      O({ name: 'Wocheneinkauf', amountCents: 8743, categoryId: 'lebensmittel', date: clampDay(y, m, 3) }),
      O({ name: 'Wocheneinkauf', amountCents: 6420, categoryId: 'lebensmittel', date: clampDay(y, m, 10) }),
      O({ name: 'Konzertkarten', amountCents: 11800, categoryId: 'freizeit', date: clampDay(y, m, 7) }),
      O({ name: 'Werkstatt', amountCents: 34950, categoryId: 'mobilitaet', date: clampDay(y, m, 22), note: 'Inspektion' }),
      O({ name: 'Wocheneinkauf', amountCents: 9120, categoryId: 'lebensmittel', date: monthsAgo(1, 6) }),
      O({ name: 'Geburtstagsgeschenk', amountCents: 4500, categoryId: 'sonstiges', date: monthsAgo(1, 14) }),
      O({ name: 'Zahnarzt', amountCents: 12000, categoryId: 'gesundheit', date: monthsAgo(1, 19) }),
      O({ name: 'Wocheneinkauf', amountCents: 7810, categoryId: 'lebensmittel', date: monthsAgo(2, 9) }),
      O({ name: 'Wochenendtrip', amountCents: 28900, categoryId: 'freizeit', date: monthsAgo(2, 17) }),
      O({ name: 'Bonus', kind: 'income', amountCents: 50000, categoryId: 'nebeneinkunft', date: monthsAgo(3, 25) }),
    ],
    budgets: [
      { categoryId: 'lebensmittel', limitCents: 40000 },
      { categoryId: 'freizeit', limitCents: 15000 },
      { categoryId: 'abos', limitCents: 5000 },
    ],
    goals: [
      { id: tag + uid(), name: 'Notgroschen', targetCents: 500000, savedCents: 215000, color: '#10b981' },
      { id: tag + uid(), name: 'Urlaub', targetCents: 180000, savedCents: 62000, color: '#0ea5e9', deadline: iso(y + 1, 7, 1) },
    ],
  };
}

/** Beispieldaten entfernen, eigene Einträge behalten. */
export function stripDemo(s: AppState): AppState {
  const keep = (id: string) => !id.startsWith('demo-');
  return {
    ...s,
    recurring: s.recurring.filter((r) => keep(r.id)),
    oneTime: s.oneTime.filter((o) => keep(o.id)),
    goals: s.goals.filter((g) => keep(g.id)),
    budgets: [],
    paid: Object.fromEntries(Object.entries(s.paid).filter(([k]) => keep(k))),
    settings: { ...s.settings, demo: false },
  };
}
