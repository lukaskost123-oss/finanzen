export type Kind = 'expense' | 'income';
export type Interval = 'weekly' | 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'custom';
export type EndMode = 'none' | 'date' | 'count';

export interface Category {
  id: string;
  name: string;
  icon: string; // Schlüssel aus ICONS
  color: string; // Hex
}

export interface Loan {
  principalCents: number; // Kreditsumme
  ratePct: number; // effektiver Jahreszins in %
}

export interface Recurring {
  id: string;
  kind: Kind;
  name: string;
  amountCents: number;
  categoryId: string;
  interval: Interval;
  customMonths?: number; // nur bei interval = custom: alle N Monate
  dayOfMonth: number; // 1–31, wird in kurzen Monaten auf den letzten Tag gekürzt
  startDate: string; // YYYY-MM-DD
  endMode: EndMode;
  endDate?: string;
  count?: number;
  loan?: Loan;
  provider?: string;
  contractNo?: string;
  note?: string;
  pausedFrom?: string; // ab diesem Datum ausgesetzt
  createdAt: string;
}

export interface OneTime {
  id: string;
  kind: Kind;
  name: string;
  amountCents: number;
  categoryId: string;
  date: string;
  note?: string;
  createdAt: string;
}

export interface Budget {
  categoryId: string;
  limitCents: number;
}

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  color: string;
  deadline?: string;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  reminderDays: number;
  demo: boolean; // Beispieldaten aktiv
}

export interface AppState {
  version: 1;
  categories: Category[];
  recurring: Recurring[];
  oneTime: OneTime[];
  budgets: Budget[];
  goals: Goal[];
  paid: Record<string, boolean>; // manuelle Status-Overrides, Schlüssel = Occurrence.key
  settings: Settings;
}

export interface Occurrence {
  key: string; // `${sourceId}@${date}`
  sourceId: string;
  source: 'recurring' | 'oneTime';
  kind: Kind;
  name: string;
  amountCents: number;
  categoryId: string;
  date: string;
  index?: number; // 1-basierte Ratennummer
  total?: number; // Gesamtzahl Raten, falls bekannt
}
