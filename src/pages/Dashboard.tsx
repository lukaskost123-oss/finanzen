import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, CalendarClock, PartyPopper, Plus, Receipt, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { expiringSoon, health, isPaid, monthSummary, upcoming } from '../lib/engine';
import { eur, formatPct, pct, signedEur } from '../lib/money';
import { addMonths, formatDateShort, monthName } from '../lib/dates';
import { stripDemo } from '../lib/defaults';
import { Badge, Button, Card, cx, Empty, Progress, Segmented, SectionTitle } from '../components/ui';
import { OccurrenceRow } from '../components/rows';
import type { MonthNav } from '../App';

type Filter = 'all' | 'open' | 'paid';

export function Dashboard({ nav }: { nav: MonthNav }) {
  const { state, today, update, openEditor, category } = useStore();
  const { y, m } = nav;
  const [filter, setFilter] = useState<Filter>('all');
  const s = useMemo(() => monthSummary(state, y, m, today), [state, y, m, today]);
  const prev = useMemo(() => { const [py, pm] = addMonths(y, m, -1); return monthSummary(state, py, pm, today); }, [state, y, m, today]);
  const h = health(s);
  const delta = s.expenseCents - prev.expenseCents;
  const deltaPct = pct(delta, prev.expenseCents);
  const due = useMemo(() => upcoming(state, today, state.settings.reminderDays), [state, today]);
  const expiring = useMemo(() => expiringSoon(state, today, 4), [state, today]);
  const budgetAlerts = state.budgets
    .map((b) => ({ b, spent: s.byCategory[b.categoryId] ?? 0 }))
    .filter(({ b, spent }) => spent >= b.limitCents * 0.8);

  const items = s.items.filter((o) => filter === 'all' || (filter === 'open') !== isPaid(state.paid, o, today));
  const spentShare = s.incomeCents ? Math.min(1, s.expenseCents / s.incomeCents) : 0;

  const healthText = { good: 'Alles im grünen Bereich', warn: 'Wenig Puffer', bad: 'Ausgaben übersteigen Einnahmen' }[h];
  const healthColor = { good: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-rose-300' }[h];
  const barColor = { good: '#34d399', warn: '#fbbf24', bad: '#fb7185' }[h];

  return (
    <div className="space-y-4">
      {state.settings.demo && (
        <Card className="flex items-center gap-3 !p-4">
          <Sparkles className="shrink-0 text-accent" size={20} />
          <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">Das sind <b>Beispieldaten</b>, damit du alles ausprobieren kannst.</p>
          <Button variant="secondary" className="!min-h-9 !px-3 !text-xs" onClick={() => update(stripDemo, 'Beispieldaten entfernt')}>Entfernen</Button>
        </Card>
      )}

      {/* Hauptkarte */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1e1b4b] via-[#1e293b] to-[#0f172a] p-6 text-white shadow-xl shadow-indigo-950/20">
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-slate-300">Frei verfügbar im {monthName(m)}</p>
          <p className={cx('tabular mt-1 text-[44px] leading-none font-extrabold tracking-tight', h === 'bad' && 'text-rose-300')}>{eur(s.remainingCents)}</p>
          {s.incomeCents || s.expenseCents ? (
            <p className={cx('mt-2 flex items-center gap-1.5 text-sm font-medium', healthColor)}>
              <span className="size-2 rounded-full" style={{ background: barColor }} />{healthText}
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-400">Tippe auf + und trag deine erste Zahlung ein</p>
          )}
          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${spentShare * 100}%`, background: barColor }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{s.incomeCents ? `${formatPct(spentShare * 100)} der Einnahmen verplant` : 'Noch keine Einnahmen eingetragen'}</p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
            <HeroStat label="Einnahmen" value={eur(s.incomeCents)} />
            <HeroStat label="Ausgaben" value={eur(s.expenseCents)} />
            <HeroStat label="Noch fällig" value={eur(s.openCents)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fixkosten & Raten</p>
          <p className="tabular mt-1 text-xl font-bold tracking-tight">{eur(s.fixedCents)}</p>
          <Progress className="mt-3" value={s.expenseCents ? s.fixedCents / s.expenseCents : 0} color="#6366f1" />
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Einmalige Ausgaben</p>
          <p className="tabular mt-1 text-xl font-bold tracking-tight">{eur(s.oneTimeCents)}</p>
          <Progress className="mt-3" value={s.expenseCents ? s.oneTimeCents / s.expenseCents : 0} color="#f97316" />
        </Card>
      </div>

      <Card className="flex items-center gap-4 !p-4">
        <div className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', delta > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400')}>
          {delta > 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ausgaben im Vergleich zum {monthName(addMonths(y, m, -1)[1])}</p>
          <p className="tabular font-semibold">
            {signedEur(delta)}
            {prev.expenseCents > 0 && <span className="ml-1.5 text-sm font-medium text-slate-500">({delta > 0 ? '+' : ''}{formatPct(deltaPct, 1)})</span>}
          </p>
        </div>
      </Card>

      {(due.length > 0 || expiring.length > 0 || budgetAlerts.length > 0) && nav.isCurrent && (
        <div className="space-y-2">
          {due.length > 0 && (
            <Hint tone="indigo" icon={<BellRing size={18} />}>
              <b>{due.length === 1 ? '1 Zahlung' : `${due.length} Zahlungen`} in den nächsten {state.settings.reminderDays} Tagen:</b>{' '}
              {due.slice(0, 3).map((o) => `${o.name} (${eur(o.amountCents)}, ${formatDateShort(o.date)})`).join(', ')}{due.length > 3 && ' …'}
            </Hint>
          )}
          {expiring.map((e) => (
            <Hint key={e.item.id} tone="green" icon={<PartyPopper size={18} />}>
              <b>{e.item.name}</b> endet mit der Rate am {formatDateShort(e.lastDate)}. Ab {monthName(e.freeFrom[1])} {e.freeFrom[0]} hast du <b>{eur(e.monthlyCents)} mehr</b> pro Monat.
            </Hint>
          ))}
          {budgetAlerts.map(({ b, spent }) => (
            <Hint key={b.categoryId} tone={spent >= b.limitCents ? 'red' : 'amber'} icon={<AlertTriangle size={18} />}>
              Budget <b>{category(b.categoryId).name}</b>: {eur(spent)} von {eur(b.limitCents)} ({formatPct(pct(spent, b.limitCents))}){spent >= b.limitCents ? ' – überschritten!' : ''}
            </Hint>
          ))}
        </div>
      )}

      <Card>
        <SectionTitle action={<Badge tone="slate">{s.items.length}</Badge>}>
          <span className="flex items-center gap-2"><CalendarClock size={17} className="text-accent" /> Zahlungen im {monthName(m)}</span>
        </SectionTitle>
        <Segmented className="mb-2" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'open', label: 'Offen' }, { value: 'paid', label: 'Erledigt' }]} />
        {items.length === 0 ? (
          <Empty
            icon={<Receipt size={24} />}
            title={s.items.length ? 'Nichts in dieser Ansicht' : 'Noch keine Zahlungen'}
            text={s.items.length ? 'Wechsle den Filter, um alle Zahlungen zu sehen.' : 'Trage deine erste Rate, Fixkosten oder Ausgabe ein – das dauert nur ein paar Sekunden.'}
            action={!s.items.length && <Button onClick={() => openEditor({ mode: 'new' })}><Plus size={18} /> Eintrag hinzufügen</Button>}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((o) => <OccurrenceRow key={o.key} o={o} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="tabular truncate text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}

function Hint({ tone, icon, children }: { tone: 'indigo' | 'green' | 'amber' | 'red'; icon: React.ReactNode; children: React.ReactNode }) {
  const t = {
    indigo: 'bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200 [&_svg]:text-indigo-500',
    green: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200 [&_svg]:text-emerald-500',
    amber: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 [&_svg]:text-amber-500',
    red: 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200 [&_svg]:text-rose-500',
  }[tone];
  return (
    <div className={cx('flex animate-fade gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed', t)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
