import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PieChart as PieIcon, TrendingUp, Trophy } from 'lucide-react';
import { useStore } from '../lib/store';
import { aboCheck, forecast, isActive, monthlyEquivalent } from '../lib/engine';
import { eur, eurRound, formatPct, pct } from '../lib/money';
import { addMonths, monthName, monthShort } from '../lib/dates';
import { Badge, Card, CategoryIcon, Empty, Progress, SectionTitle } from '../components/ui';
import type { MonthNav } from '../App';

export function useChartTheme() {
  const dark = document.documentElement.classList.contains('dark');
  return { grid: dark ? 'rgba(255,255,255,.06)' : '#eef2f7', axis: dark ? '#64748b' : '#94a3b8' };
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl bg-white px-3 py-2 text-xs shadow-xl ring-1 ring-slate-200 dark:bg-panel-2 dark:ring-white/10">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="tabular flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <b>{eur(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

export function Analysis({ nav }: { nav: MonthNav }) {
  const { state, today, category } = useStore();
  const t = useChartTheme();
  const { y, m } = nav;

  const year = useMemo(() => { const [sy, sm] = addMonths(y, m, -11); return forecast(state, sy, sm, 12, today); }, [state, y, m, today]);
  const cur = year[11];

  const donut = Object.entries(cur.byCategory)
    .map(([id, v]) => ({ id, name: category(id).name, value: v, fill: category(id).color }))
    .sort((a, b) => b.value - a.value);

  const bars = year.map((s) => ({ name: monthShort(s.month), Fixkosten: s.fixedCents, Einmalig: s.oneTimeCents }));
  let cum = 0;
  const line = year.map((s) => { cum += s.remainingCents; return { name: monthShort(s.month), 'Frei verfügbar': s.remainingCents, Kumuliert: cum }; });

  const fixedYearly = state.recurring.filter((r) => r.kind === 'expense' && isActive(r, today)).map((r) => ({ r, yearly: monthlyEquivalent(r) * 12 })).sort((a, b) => b.yearly - a.yearly);
  const fixedYearlySum = fixedYearly.reduce((s, x) => s + x.yearly, 0);

  const top5 = [...cur.items].filter((o) => o.kind === 'expense').sort((a, b) => b.amountCents - a.amountCents).slice(0, 5);
  const abos = aboCheck(state, today);
  const avg = Math.round(year.reduce((s, x) => s + x.expenseCents, 0) / 12);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle><span className="flex items-center gap-2"><PieIcon size={17} className="text-accent" /> Ausgaben nach Kategorie · {monthName(m)}</span></SectionTitle>
        {donut.length === 0 ? (
          <Empty icon={<PieIcon size={24} />} title="Keine Ausgaben" text="In diesem Monat gibt es noch keine Ausgaben." />
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div className="relative h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="95%" paddingAngle={2} cornerRadius={6} stroke="none" animationDuration={700}>
                    {donut.map((d) => <Cell key={d.id} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><p className="text-xs text-slate-500">Gesamt</p><p className="tabular text-xl font-bold">{eurRound(cur.expenseCents)}</p></div>
              </div>
            </div>
            <ul className="space-y-2">
              {donut.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tabular text-slate-500">{formatPct(pct(d.value, cur.expenseCents))}</span>
                  <span className="tabular w-24 text-right font-semibold">{eur(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle action={<span className="text-xs text-slate-500">Ø {eur(avg)} / Monat</span>}>Ausgaben der letzten 12 Monate</SectionTitle>
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ left: -12, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey="name" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 100)}`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: t.grid }} />
              <Bar dataKey="Fixkosten" stackId="a" fill="#6366f1" />
              <Bar dataKey="Einmalig" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#6366f1]" />Fixkosten</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#f97316]" />Einmalig</span>
        </div>
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><TrendingUp size={17} className="text-emerald-500" /> Entwicklung des verfügbaren Geldes</span></SectionTitle>
        <div className="h-60">
          <ResponsiveContainer>
            <LineChart data={line} margin={{ left: -12, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey="name" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 100)}`} />
              <ReferenceLine y={0} stroke={t.axis} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="Frei verfügbar" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Kumuliert" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">Grün: pro Monat übrig · Lila gestrichelt: aufsummiert über 12 Monate ({eur(cum)})</p>
      </Card>

      <Card>
        <SectionTitle action={<span className="tabular text-sm font-bold">{eur(fixedYearlySum)}</span>}>Fixkosten pro Jahr</SectionTitle>
        <div className="space-y-3">
          {fixedYearly.slice(0, 8).map(({ r, yearly }) => (
            <div key={r.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{r.name}</span>
                <span className="tabular font-semibold">{eur(yearly)}</span>
              </div>
              <Progress className="mt-1.5 !h-1.5" value={fixedYearlySum ? yearly / fixedYearly[0].yearly : 0} color={category(r.categoryId).color} />
            </div>
          ))}
          {fixedYearly.length > 8 && <p className="text-xs text-slate-500">+ {fixedYearly.length - 8} weitere</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Trophy size={17} className="text-amber-500" /> Top 5 Kostenpunkte · {monthName(m)}</span></SectionTitle>
        <ol className="space-y-2">
          {top5.map((o, i) => (
            <li key={o.key} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
              <CategoryIcon category={category(o.categoryId)} size="sm" />
              <span className="flex-1 truncate text-sm font-medium">{o.name}</span>
              <span className="tabular text-sm font-semibold">{eur(o.amountCents)}</span>
            </li>
          ))}
        </ol>
      </Card>

      {abos.length > 0 && (
        <Card>
          <SectionTitle>Abo-Check</SectionTitle>
          <p className="mb-3 text-sm text-slate-500">Brauchst du diese Abos noch? Kündigen spart pro Jahr:</p>
          <div className="space-y-2">
            {abos.map((a) => (
              <div key={a.item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-white/4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.item.name}</p>
                  <p className="text-xs text-slate-500">{a.reason}</p>
                </div>
                <Badge tone="amber">{eur(a.yearlyCents)}/Jahr</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
