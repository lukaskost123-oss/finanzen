import { useMemo } from 'react';
import { CalendarCheck, Landmark, PartyPopper } from 'lucide-react';
import { useStore } from '../lib/store';
import { expiringSoon, installmentInfo, isActive, monthlyEquivalent } from '../lib/engine';
import { eur, formatPct } from '../lib/money';
import { formatDate, monthName } from '../lib/dates';
import { Badge, Card, CategoryIcon, Empty, Progress, SectionTitle, Stat } from '../components/ui';

export function Installments() {
  const { state, today, category, openEditor } = useStore();

  const list = useMemo(() => state.recurring
    .filter((r) => r.kind === 'expense' && (r.loan || r.endMode !== 'none'))
    .map((r) => ({ r, info: installmentInfo(r, today), active: isActive(r, today) }))
    .sort((a, b) => Number(b.active) - Number(a.active) || (a.info.lastDate ?? '').localeCompare(b.info.lastDate ?? '')),
  [state.recurring, today]);

  const active = list.filter((x) => x.active);
  const totalDebt = active.reduce((s, x) => s + (x.info.remainingCents ?? 0), 0);
  const monthly = active.reduce((s, x) => s + monthlyEquivalent(x.r), 0);
  const lastEnd = active.map((x) => x.info.lastDate).filter(Boolean).sort().at(-1);
  const expiring = useMemo(() => expiringSoon(state, today, 12), [state, today]);

  if (list.length === 0) {
    return (
      <Card>
        <Empty
          icon={<Landmark size={24} />}
          title="Keine Raten oder Kredite"
          text="Lege eine laufende Ausgabe mit „Anzahl Raten“, „Enddatum“ oder als „Kredit / Finanzierung“ an – hier siehst du dann Fortschritt und Restschuld."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-600 to-orange-500 p-6 text-white shadow-xl shadow-rose-900/20">
        <div className="pointer-events-none absolute -top-20 -right-10 size-56 rounded-full bg-white/15 blur-3xl" />
        <p className="text-sm font-medium text-white/80">Offene Schulden gesamt</p>
        <p className="tabular mt-1 text-4xl font-extrabold tracking-tight">{eur(totalDebt)}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/20 pt-4 text-sm">
          <div><p className="text-[11px] text-white/70">Laufend</p><p className="font-semibold">{active.length}</p></div>
          <div><p className="text-[11px] text-white/70">pro Monat</p><p className="tabular font-semibold">{eur(monthly)}</p></div>
          <div><p className="text-[11px] text-white/70">schuldenfrei ab</p><p className="font-semibold">{lastEnd ? formatDate(lastEnd).slice(3) : '–'}</p></div>
        </div>
      </div>

      {expiring.length > 0 && (
        <Card>
          <SectionTitle><span className="flex items-center gap-2"><PartyPopper size={17} className="text-emerald-500" /> Bald mehr Geld übrig</span></SectionTitle>
          <ol className="relative space-y-3 border-l-2 border-emerald-200 pl-5 dark:border-emerald-500/30">
            {expiring.map((e) => (
              <li key={e.item.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-panel" />
                <p className="text-sm">Ab <b>{monthName(e.freeFrom[1])} {e.freeFrom[0]}</b> hast du <b className="text-emerald-600 dark:text-emerald-400">{eur(e.monthlyCents)} mehr</b> pro Monat</p>
                <p className="text-xs text-slate-500">{e.item.name} · letzte Rate {formatDate(e.lastDate)}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {list.map(({ r, info, active: act }) => (
        <Card key={r.id} onClick={() => openEditor({ mode: 'edit', id: r.id })} className={act ? '' : 'opacity-60'}>
          <div className="flex items-start gap-3">
            <CategoryIcon category={category(r.categoryId)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{r.name}</p>
                {r.loan && <Badge tone="red">{formatPct(r.loan.ratePct, 2)}</Badge>}
                {!act && <Badge tone="green"><CalendarCheck size={11} /> abbezahlt</Badge>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{eur(r.amountCents)} pro Rate{r.provider && ` · ${r.provider}`}</p>
            </div>
            {info.progress != null && <p className="tabular text-sm font-bold text-accent">{formatPct(info.progress * 100)}</p>}
          </div>
          {info.total != null && (
            <>
              <Progress className="mt-4" value={info.progress ?? 0} color={category(r.categoryId).color} />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                <b>{info.paidCount} von {info.total}</b> Raten bezahlt{info.remainingCents != null && info.remainingCount ? <> – noch <b>{eur(info.remainingCents)}</b></> : null}
              </p>
            </>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
            <Stat label={r.loan ? 'Restschuld' : 'Offen'} value={<span className="text-base">{eur(info.remainingCents ?? 0)}</span>} />
            <Stat label="Nächste Rate" value={<span className="text-base">{info.nextDate ? formatDate(info.nextDate).slice(0, 6) : '–'}</span>} />
            <Stat label="Letzte Rate" value={<span className="text-base">{info.lastDate ? formatDate(info.lastDate).slice(3) : '–'}</span>} />
          </div>
          {info.interestCents != null && (
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/4 dark:text-slate-400">
              Kredit {eur(r.loan!.principalCents)} · Gesamtkosten {eur(info.totalCents ?? 0)} · davon Zinsen <b className="text-rose-600 dark:text-rose-400">{eur(info.interestCents)}</b>
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
