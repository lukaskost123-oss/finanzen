import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FlaskConical, Goal as GoalIcon, PiggyBank, Plus, Target, Trash2, Wallet } from 'lucide-react';
import { useStore } from '../lib/store';
import type { AppState, Goal, Recurring } from '../lib/types';
import { forecast, isActive, monthSummary, monthlyEquivalent } from '../lib/engine';
import { centsToInput, eur, formatPct, parseEuro, pct, signedEur } from '../lib/money';
import { diffDays, formatDate, monthShort, todayISO, ymd } from '../lib/dates';
import { COLORS } from '../lib/icons';
import { uid } from '../lib/defaults';
import { Badge, Button, Card, CategoryIcon, cx, Field, IconButton, Input, Progress, SectionTitle, Segmented, Select, Sheet } from '../components/ui';
import { ChartTooltip, useChartTheme } from './Analysis';

export function Planning() {
  const { state, today } = useStore();
  const t = useChartTheme();
  const [y, m] = ymd(today);
  const fc = useMemo(() => forecast(state, y, m, 12, today), [state, y, m, today]);
  let cum = 0;
  const data = fc.map((s) => { cum += s.remainingCents; return { name: monthShort(s.month), Einnahmen: s.incomeCents, Ausgaben: s.expenseCents, Kumuliert: cum }; });

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle action={<Badge tone={cum >= 0 ? 'green' : 'red'}>{signedEur(cum)}</Badge>}>Prognose nächste 12 Monate</SectionTitle>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: -12, right: 4, top: 8 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity={0.35} /><stop offset="1" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f43f5e" stopOpacity={0.3} /><stop offset="1" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey="name" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 100)}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Einnahmen" stroke="#10b981" strokeWidth={2} fill="url(#gIn)" />
              <Area type="monotone" dataKey="Ausgaben" stroke="#f43f5e" strokeWidth={2} fill="url(#gOut)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {fc.map((s) => (
            <div key={`${s.year}-${s.month}`} className="w-24 shrink-0 rounded-2xl bg-slate-50 p-3 dark:bg-white/4">
              <p className="text-xs font-medium text-slate-500">{monthShort(s.month)} {String(s.year).slice(2)}</p>
              <p className={cx('tabular mt-1 text-sm font-bold', s.remainingCents < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{eur(s.remainingCents)}</p>
              <p className="tabular text-[11px] text-slate-400">−{eur(s.expenseCents)}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">Berücksichtigt alle laufenden Zahlungen und bereits eingetragene einmalige Buchungen.</p>
      </Card>

      <WhatIf />
      <Budgets />
      <Goals />
    </div>
  );
}

interface Hypo { id: string; name: string; cents: number; kind: 'expense' | 'income' }

function WhatIf() {
  const { state, today } = useStore();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [hypos, setHypos] = useState<Hypo[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [y, m] = ymd(today);

  const activeExp = state.recurring.filter((r) => isActive(r, today)).sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));

  const sim = useMemo(() => {
    const extra: Recurring[] = hypos.map((h) => ({ id: h.id, kind: h.kind, name: h.name, amountCents: h.cents, categoryId: 'sonstiges', interval: 'monthly', dayOfMonth: 1, startDate: today, endMode: 'none', createdAt: today }));
    const simState: AppState = { ...state, recurring: [...state.recurring.filter((r) => !excluded.has(r.id)), ...extra] };
    const sum = (s: AppState) => forecast(s, y, m, 12, today).reduce((a, x) => a + x.remainingCents, 0);
    const base = sum(state), next = sum(simState);
    return { base, next, monthlyDiff: Math.round((next - base) / 12) };
  }, [state, excluded, hypos, today, y, m]);

  const add = () => {
    const c = parseEuro(amount);
    if (!name.trim() || !c) return;
    setHypos([...hypos, { id: uid(), name: name.trim(), cents: c, kind }]);
    setName(''); setAmount('');
  };
  const changed = excluded.size > 0 || hypos.length > 0;

  return (
    <Card>
      <SectionTitle action={changed && <button className="text-xs font-semibold text-accent" onClick={() => { setExcluded(new Set()); setHypos([]); }}>Zurücksetzen</button>}>
        <span className="flex items-center gap-2"><FlaskConical size={17} className="text-violet-500" /> Was wäre wenn?</span>
      </SectionTitle>
      <p className="mb-3 text-sm text-slate-500">Teste Änderungen, ohne deine Daten zu verändern.</p>

      <div className={cx('mb-4 grid grid-cols-2 gap-3 rounded-3xl p-4 transition', sim.monthlyDiff > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : sim.monthlyDiff < 0 ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-slate-50 dark:bg-white/4')}>
        <div>
          <p className="text-xs text-slate-500">Pro Monat</p>
          <p className={cx('tabular text-xl font-bold', sim.monthlyDiff > 0 && 'text-emerald-600 dark:text-emerald-400', sim.monthlyDiff < 0 && 'text-rose-600 dark:text-rose-400')}>{signedEur(sim.monthlyDiff)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">In 12 Monaten übrig</p>
          <p className="tabular text-xl font-bold">{eur(sim.next)}</p>
          {changed && <p className="tabular text-[11px] text-slate-400">statt {eur(sim.base)}</p>}
        </div>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-500">Hinzufügen (monatlich)</p>
      <div className="flex gap-2">
        <Input className="flex-1" placeholder="z. B. Neues Auto" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="!w-24" inputMode="decimal" placeholder="€" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add} aria-label="Hinzufügen" className="!px-3"><Plus size={18} /></Button>
      </div>
      <Segmented className="mt-2" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Neue Ausgabe' }, { value: 'income', label: 'Neue Einnahme' }]} />
      {hypos.map((h) => (
        <div key={h.id} className="mt-2 flex items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-sm dark:bg-violet-500/10">
          <span className="flex-1">{h.name}</span>
          <span className={cx('tabular font-semibold', h.kind === 'income' && 'text-emerald-600')}>{h.kind === 'income' ? '+' : '−'}{eur(h.cents)}</span>
          <button onClick={() => setHypos(hypos.filter((x) => x.id !== h.id))} aria-label="Entfernen" className="text-slate-400"><Trash2 size={15} /></button>
        </div>
      ))}

      <p className="mt-5 mb-2 text-xs font-medium text-slate-500">Laufende Zahlungen weglassen (z. B. kündigen)</p>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {activeExp.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/4">
            <input type="checkbox" className="size-4 accent-indigo-500" checked={!excluded.has(r.id)} onChange={() => { const n = new Set(excluded); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setExcluded(n); }} />
            <span className={cx('flex-1 truncate text-sm', excluded.has(r.id) && 'text-slate-400 line-through')}>{r.name}</span>
            <span className={cx('tabular text-sm', r.kind === 'income' ? 'text-emerald-600' : 'text-slate-500')}>{eur(monthlyEquivalent(r))}/M</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

function Budgets() {
  const { state, today, update, category } = useStore();
  const [y, m] = ymd(today);
  const s = useMemo(() => monthSummary(state, y, m, today), [state, y, m, today]);
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState('');
  const free = state.categories.filter((c) => !['gehalt', 'nebeneinkunft'].includes(c.id) && !state.budgets.some((b) => b.categoryId === c.id));

  const save = () => {
    const c = parseEuro(limit);
    if (!cat || !c) return;
    update((st) => ({ ...st, budgets: [...st.budgets.filter((b) => b.categoryId !== cat), { categoryId: cat, limitCents: c }] }), 'Budget gespeichert');
    setAdding(false); setCat(''); setLimit('');
  };

  return (
    <Card>
      <SectionTitle action={free.length > 0 && <button onClick={() => { setAdding(true); setCat(free[0].id); }} className="text-xs font-semibold text-accent">+ Budget</button>}>
        <span className="flex items-center gap-2"><Wallet size={17} className="text-sky-500" /> Budgets diesen Monat</span>
      </SectionTitle>
      {state.budgets.length === 0 && !adding && <p className="text-sm text-slate-500">Lege Monatsbudgets pro Kategorie fest. Bei 80 % und 100 % wirst du gewarnt.</p>}
      <div className="space-y-4">
        {state.budgets.map((b) => {
          const spent = s.byCategory[b.categoryId] ?? 0;
          const p = pct(spent, b.limitCents);
          const color = p >= 100 ? '#f43f5e' : p >= 80 ? '#f59e0b' : category(b.categoryId).color;
          return (
            <div key={b.categoryId} className="flex items-center gap-3">
              <CategoryIcon category={category(b.categoryId)} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{category(b.categoryId).name}</span>
                  <span className="tabular text-xs text-slate-500"><b className="text-slate-800 dark:text-slate-200">{eur(spent)}</b> / {eur(b.limitCents)}</span>
                </div>
                <Progress className="mt-1.5" value={p / 100} color={color} />
                <p className="mt-1 text-[11px] text-slate-400">
                  {p >= 100 ? `${eur(spent - b.limitCents)} überschritten` : `noch ${eur(b.limitCents - spent)} frei · ${formatPct(p)}`}
                </p>
              </div>
              <IconButton label="Budget löschen" onClick={() => update((st) => ({ ...st, budgets: st.budgets.filter((x) => x.categoryId !== b.categoryId) }), 'Budget gelöscht')}><Trash2 size={15} /></IconButton>
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="mt-4 flex animate-fade gap-2">
          <Select className="flex-1" value={cat} onChange={(e) => setCat(e.target.value)}>
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input className="!w-28" inputMode="decimal" placeholder="Limit €" value={limit} onChange={(e) => setLimit(e.target.value)} autoFocus />
          <Button onClick={save}>OK</Button>
        </div>
      )}
    </Card>
  );
}

function Goals() {
  const { state, update } = useStore();
  const [edit, setEdit] = useState<Goal | null>(null);
  const [deposit, setDeposit] = useState<{ goal: Goal; value: string } | null>(null);
  const today = todayISO();

  return (
    <Card>
      <SectionTitle action={<button className="text-xs font-semibold text-accent" onClick={() => setEdit({ id: uid(), name: '', targetCents: 0, savedCents: 0, color: COLORS[state.goals.length % COLORS.length] })}>+ Sparziel</button>}>
        <span className="flex items-center gap-2"><Target size={17} className="text-emerald-500" /> Sparziele</span>
      </SectionTitle>
      {state.goals.length === 0 && <p className="text-sm text-slate-500">Lege ein Ziel an, z. B. Notgroschen oder Urlaub, und verfolge deinen Fortschritt.</p>}
      <div className="space-y-3">
        {state.goals.map((g) => {
          const p = g.targetCents ? g.savedCents / g.targetCents : 0;
          const monthsLeft = g.deadline ? Math.max(1, Math.ceil(diffDays(today, g.deadline) / 30.44)) : 0;
          const perMonth = g.deadline && g.targetCents > g.savedCents ? Math.ceil((g.targetCents - g.savedCents) / monthsLeft) : 0;
          return (
            <div key={g.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-white/4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-2xl" style={{ background: `${g.color}22`, color: g.color }}>{p >= 1 ? <GoalIcon size={20} /> : <PiggyBank size={20} />}</span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(g)}>
                  <p className="font-semibold">{g.name}</p>
                  <p className="tabular text-xs text-slate-500">{eur(g.savedCents)} von {eur(g.targetCents)}{g.deadline && ` · bis ${formatDate(g.deadline)}`}</p>
                </button>
                <Button variant="secondary" className="!min-h-9 !px-3 !text-xs" onClick={() => setDeposit({ goal: g, value: '' })}>+ Einzahlen</Button>
              </div>
              <Progress className="mt-3" value={p} color={g.color} />
              <p className="mt-1.5 text-[11px] text-slate-500">
                {p >= 1 ? '🎉 Ziel erreicht!' : `${formatPct(p * 100)} erreicht${perMonth ? ` · ${eur(perMonth)} pro Monat nötig` : ''}`}
              </p>
            </div>
          );
        })}
      </div>

      <Sheet open={!!deposit} onClose={() => setDeposit(null)} title={`Einzahlung: ${deposit?.goal.name ?? ''}`}
        footer={<Button className="w-full" onClick={() => {
          const c = parseEuro(deposit!.value);
          if (c) update((s) => ({ ...s, goals: s.goals.map((x) => (x.id === deposit!.goal.id ? { ...x, savedCents: Math.max(0, x.savedCents + c) } : x)) }), `${eur(c)} eingezahlt`);
          setDeposit(null);
        }}>Buchen</Button>}>
        <Field label="Betrag (negativ für Entnahme)"><Input autoFocus inputMode="decimal" placeholder="100,00" value={deposit?.value ?? ''} onChange={(e) => setDeposit(deposit && { ...deposit, value: e.target.value })} /></Field>
      </Sheet>

      {edit && <GoalEditor goal={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function GoalEditor({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { state, update } = useStore();
  const exists = state.goals.some((g) => g.id === goal.id);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(goal.targetCents ? centsToInput(goal.targetCents) : '');
  const [saved, setSaved] = useState(goal.savedCents ? centsToInput(goal.savedCents) : '');
  const [deadline, setDeadline] = useState(goal.deadline ?? '');
  const [color, setColor] = useState(goal.color);

  const save = () => {
    const t = parseEuro(target);
    if (!name.trim() || !t) return;
    const g: Goal = { ...goal, name: name.trim(), targetCents: t, savedCents: parseEuro(saved) ?? 0, deadline: deadline || undefined, color };
    update((s) => ({ ...s, goals: exists ? s.goals.map((x) => (x.id === g.id ? g : x)) : [...s.goals, g] }), 'Sparziel gespeichert');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={exists ? 'Sparziel bearbeiten' : 'Neues Sparziel'}
      footer={<div className="flex gap-3">
        {exists && <Button variant="danger" aria-label="Löschen" onClick={() => { update((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== goal.id) }), 'Sparziel gelöscht'); onClose(); }}><Trash2 size={18} /></Button>}
        <Button className="flex-1" onClick={save}>Speichern</Button>
      </div>}>
      <div className="space-y-3">
        <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Urlaub" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zielbetrag (€)"><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Bereits gespart (€)"><Input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} /></Field>
        </div>
        <Field label="Zieldatum (optional)"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => <button key={c} aria-label={`Farbe ${c}`} onClick={() => setColor(c)} className={cx('size-8 rounded-full transition', color === c && 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-panel')} style={{ background: c }} />)}
        </div>
      </div>
    </Sheet>
  );
}
