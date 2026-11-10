import { useMemo, useState } from 'react';
import { ListFilter, Plus, Search, SearchX, X } from 'lucide-react';
import { useStore } from '../lib/store';
import type { OneTime, Recurring } from '../lib/types';
import { isActive, lastPaymentDate, monthlyEquivalent } from '../lib/engine';
import { eur, parseEuro } from '../lib/money';
import { Badge, Button, Card, cx, Empty, Field, Input, Segmented, Select, SectionTitle } from '../components/ui';
import { EntryRow } from '../components/rows';

type TypeFilter = 'all' | 'recurring' | 'oneTime' | 'income';

export function Entries() {
  const { state, today, openEditor } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [cat, setCat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const minC = parseEuro(min);
  const maxC = parseEuro(max);
  const activeFilters = [cat, from, to, min, max].filter(Boolean).length;

  const match = (e: Recurring | OneTime) => {
    const needle = q.trim().toLowerCase();
    if (needle && ![e.name, e.note, 'provider' in e ? e.provider : '', 'contractNo' in e ? e.contractNo : ''].some((v) => v?.toLowerCase().includes(needle))) return false;
    if (type === 'income' && e.kind !== 'income') return false;
    if ((type === 'recurring' || type === 'oneTime') && e.kind === 'income') return false;
    if (cat && e.categoryId !== cat) return false;
    if (minC != null && e.amountCents < minC) return false;
    if (maxC != null && e.amountCents > maxC) return false;
    if ('date' in e) {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
    } else {
      // Laufende Zahlung überschneidet sich mit dem Zeitraum
      const last = lastPaymentDate(e);
      if (to && e.startDate > to) return false;
      if (from && last && last < from) return false;
    }
    return true;
  };

  const recurring = useMemo(() => (type === 'oneTime' ? [] : state.recurring.filter(match))
    .sort((a, b) => Number(isActive(b, today)) - Number(isActive(a, today)) || a.kind.localeCompare(b.kind) || b.amountCents - a.amountCents),
  [state.recurring, q, type, cat, from, to, minC, maxC, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const oneTime = useMemo(() => (type === 'recurring' ? [] : state.oneTime.filter(match)).sort((a, b) => b.date.localeCompare(a.date)),
    [state.oneTime, q, type, cat, from, to, minC, maxC]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthlyFixed = recurring.filter((r) => r.kind === 'expense' && isActive(r, today)).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const oneTimeSum = oneTime.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amountCents, 0);
  const reset = () => { setCat(''); setFrom(''); setTo(''); setMin(''); setMax(''); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
          <Input className="!bg-white !pl-11 shadow-sm ring-1 !ring-slate-200 dark:!bg-panel dark:!ring-white/5" placeholder="Suchen (Name, Anbieter, Notiz)" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" onClick={() => setQ('')} aria-label="Suche leeren"><X size={18} /></button>}
        </div>
        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className={cx('relative !bg-white ring-1 ring-slate-200 dark:!bg-panel dark:ring-white/5', showFilters && '!ring-accent')} aria-label="Filter">
          <ListFilter size={18} />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] text-white">{activeFilters}</span>}
        </Button>
      </div>

      <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Alle' }, { value: 'recurring', label: 'Laufend' }, { value: 'oneTime', label: 'Einmalig' }, { value: 'income', label: 'Einnahmen' }]} />

      {showFilters && (
        <Card className="animate-fade space-y-3">
          <Field label="Kategorie">
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Von"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Bis"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Betrag ab (€)"><Input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" /></Field>
            <Field label="Betrag bis (€)"><Input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" /></Field>
          </div>
          {activeFilters > 0 && <Button variant="ghost" className="w-full" onClick={reset}>Filter zurücksetzen</Button>}
        </Card>
      )}

      {recurring.length === 0 && oneTime.length === 0 ? (
        <Card>
          {state.recurring.length + state.oneTime.length === 0 ? (
            <Empty icon={<Plus size={24} />} title="Noch keine Einträge" text="Lege Raten, Fixkosten, Einnahmen oder einmalige Ausgaben an." action={<Button onClick={() => openEditor({ mode: 'new' })}><Plus size={18} /> Erster Eintrag</Button>} />
          ) : (
            <Empty icon={<SearchX size={24} />} title="Keine Treffer" text="Passe Suche oder Filter an." action={<Button variant="secondary" onClick={() => { setQ(''); reset(); setType('all'); }}>Alles anzeigen</Button>} />
          )}
        </Card>
      ) : null}

      {recurring.length > 0 && (
        <Card>
          <SectionTitle action={<span className="tabular text-sm font-semibold text-slate-500">{eur(monthlyFixed)} / Monat</span>}>Laufende Zahlungen</SectionTitle>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {recurring.map((r) => (
              <EntryRow key={r.id} e={r} meta={r.interval !== 'monthly' && r.kind === 'expense' && <Badge>≈ {eur(monthlyEquivalent(r))}/Mon.</Badge>} />
            ))}
          </div>
        </Card>
      )}

      {oneTime.length > 0 && (
        <Card>
          <SectionTitle action={<span className="tabular text-sm font-semibold text-slate-500">{eur(oneTimeSum)}</span>}>Einmalige Buchungen</SectionTitle>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {oneTime.map((o) => <EntryRow key={o.id} e={o} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
