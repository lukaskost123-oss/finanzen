import { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronDown, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import type { EndMode, Interval, Kind, OneTime, Recurring } from '../lib/types';
import { annuity, installmentInfo, INTERVAL_LABEL, periodsPerYear } from '../lib/engine';
import { centsToInput, eur, parseEuro } from '../lib/money';
import { formatDate, todayISO, ymd } from '../lib/dates';
import { uid } from '../lib/defaults';
import { Button, CategoryIcon, cx, Field, Input, Segmented, Select, Sheet } from './ui';

type EntryType = 'recurring' | 'oneTime';

export function EntryEditor() {
  const { editor, closeEditor } = useStore();
  if (!editor) return null;
  // key erzwingt frischen Formularzustand pro Öffnung
  return <EntryForm key={editor.mode === 'edit' ? editor.id : `new-${editor.preset}`} onClose={closeEditor} />;
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { editor, state, saveRecurring, saveOneTime, remove, notify, category } = useStore();
  const existing = editor?.mode === 'edit'
    ? state.recurring.find((r) => r.id === editor.id) ?? state.oneTime.find((o) => o.id === editor.id)
    : undefined;
  const existingRec = existing && 'interval' in existing ? existing : undefined;
  const preset = editor?.mode === 'new' ? editor.preset : undefined;
  const today = todayISO();

  const [type, setType] = useState<EntryType>(existing ? (existingRec ? 'recurring' : 'oneTime') : preset === 'recurring' ? 'recurring' : 'oneTime');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? (preset === 'income' ? 'income' : 'expense'));
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amountCents) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? (preset === 'income' ? 'gehalt' : 'sonstiges'));
  const [date, setDate] = useState(existing && !existingRec ? (existing as OneTime).date : today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [interval, setInterval] = useState<Interval>(existingRec?.interval ?? 'monthly');
  const [customMonths, setCustomMonths] = useState(String(existingRec?.customMonths ?? 2));
  const [day, setDay] = useState(String(existingRec?.dayOfMonth ?? ymd(today)[2]));
  const [startDate, setStartDate] = useState(existingRec?.startDate ?? today);
  const [endMode, setEndMode] = useState<EndMode>(existingRec?.endMode ?? 'none');
  const [endDate, setEndDate] = useState(existingRec?.endDate ?? '');
  const [count, setCount] = useState(String(existingRec?.count ?? 12));
  const [isLoan, setIsLoan] = useState(!!existingRec?.loan);
  const [principal, setPrincipal] = useState(existingRec?.loan ? centsToInput(existingRec.loan.principalCents) : '');
  const [rate, setRate] = useState(existingRec?.loan ? String(existingRec.loan.ratePct).replace('.', ',') : '');
  const [provider, setProvider] = useState(existingRec?.provider ?? '');
  const [contractNo, setContractNo] = useState(existingRec?.contractNo ?? '');
  const [showMore, setShowMore] = useState(!!(existingRec?.provider || existingRec?.contractNo || existing?.note));
  const [error, setError] = useState('');

  const amountCents = parseEuro(amount);
  const principalCents = parseEuro(principal);
  const ratePct = parseFloat(rate.replace(',', '.')) || 0;

  // Kategorie passend zur Art vorschlagen
  useEffect(() => {
    if (existing) return;
    if (kind === 'income' && !['gehalt', 'nebeneinkunft'].includes(categoryId)) setCategoryId('gehalt');
    if (kind === 'expense' && ['gehalt', 'nebeneinkunft'].includes(categoryId)) setCategoryId('sonstiges');
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const knownNames = useMemo(() => {
    const m = new Map<string, string>();
    [...state.recurring, ...state.oneTime].forEach((e) => m.set(e.name, e.categoryId));
    return m;
  }, [state.recurring, state.oneTime]);

  const build = (): Recurring | OneTime | null => {
    if (!name.trim()) { setError('Bitte einen Namen eingeben.'); return null; }
    if (amountCents == null || amountCents <= 0) { setError('Bitte einen gültigen Betrag eingeben, z. B. 49,99.'); return null; }
    const common = { id: existing?.id ?? uid(), kind, name: name.trim(), amountCents, categoryId, note: note.trim() || undefined, createdAt: existing?.createdAt ?? today };
    if (type === 'oneTime') return { ...common, date };
    const d = Math.min(31, Math.max(1, parseInt(day) || 1));
    if (endMode === 'date' && (!endDate || endDate < startDate)) { setError('Das Enddatum muss nach dem Startdatum liegen.'); return null; }
    if (endMode === 'count' && !(parseInt(count) > 0)) { setError('Bitte die Anzahl der Raten angeben.'); return null; }
    return {
      ...common,
      interval,
      customMonths: interval === 'custom' ? Math.max(1, parseInt(customMonths) || 1) : undefined,
      dayOfMonth: d,
      startDate,
      endMode,
      endDate: endMode === 'date' ? endDate : undefined,
      count: endMode === 'count' ? parseInt(count) : undefined,
      loan: isLoan && principalCents ? { principalCents, ratePct } : undefined,
      provider: provider.trim() || undefined,
      contractNo: contractNo.trim() || undefined,
      pausedFrom: existingRec?.pausedFrom,
    };
  };

  const preview = useMemo(() => {
    if (type !== 'recurring' || amountCents == null || amountCents <= 0) return null;
    const r: Recurring = {
      id: 'p', kind, name, amountCents, categoryId, interval, customMonths: parseInt(customMonths) || 1, dayOfMonth: parseInt(day) || 1, startDate,
      endMode, endDate: endDate || undefined, count: parseInt(count) || undefined, createdAt: today,
      loan: isLoan && principalCents ? { principalCents, ratePct } : undefined,
    };
    return installmentInfo(r, today);
  }, [type, amountCents, kind, name, categoryId, interval, customMonths, day, startDate, endMode, endDate, count, isLoan, principalCents, ratePct, today]);

  const calcRate = () => {
    const n = parseInt(count);
    if (!principalCents || !(n > 0)) { notify('Für die Berechnung Kreditsumme und Anzahl der Raten angeben'); setEndMode('count'); return; }
    setAmount(centsToInput(annuity(principalCents, ratePct, n, periodsPerYear({ interval, customMonths: parseInt(customMonths) || 1 }))));
  };

  const save = () => {
    const e = build();
    if (!e) return;
    if ('interval' in e) saveRecurring(e); else saveOneTime(e);
    onClose();
  };

  const cats = state.categories.filter((c) => kind === 'income' ? ['gehalt', 'nebeneinkunft'].includes(c.id) || !DEFAULT_EXPENSE.has(c.id) : !['gehalt', 'nebeneinkunft'].includes(c.id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Eintrag bearbeiten' : kind === 'income' ? 'Neue Einnahme' : 'Neue Ausgabe'}
      footer={
        <div className="flex gap-3">
          {existing && (
            <Button variant="danger" onClick={() => { remove(existing.id); onClose(); }} aria-label="Löschen"><Trash2 size={18} /></Button>
          )}
          <Button className="flex-1" onClick={save}>{existing ? 'Änderungen speichern' : 'Speichern'}</Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid grid-cols-2 gap-2">
          <Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Ausgabe' }, { value: 'income', label: 'Einnahme' }]} />
          <Segmented value={type} onChange={setType} options={[{ value: 'oneTime', label: 'Einmalig' }, { value: 'recurring', label: 'Laufend' }]} />
        </div>

        <div className="rounded-3xl bg-slate-50 px-4 py-5 text-center dark:bg-white/4">
          <label htmlFor="amount" className="text-xs font-medium text-slate-500">Betrag{type === 'recurring' ? ` (${INTERVAL_LABEL[interval]})` : ''}</label>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <input
              id="amount"
              autoFocus={!existing}
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
              className={cx('tabular max-w-[240px] bg-transparent text-center text-4xl font-bold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600', kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : '')}
            />
            <span className="text-2xl font-semibold text-slate-400">€</span>
          </div>
        </div>

        <Field label="Bezeichnung">
          <Input
            list="known-names"
            placeholder={kind === 'income' ? 'z. B. Gehalt' : type === 'recurring' ? 'z. B. Miete, Handyvertrag' : 'z. B. Einkauf'}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
              const c = knownNames.get(e.target.value);
              if (c && !existing) setCategoryId(c);
            }}
          />
          <datalist id="known-names">{[...knownNames.keys()].map((n) => <option key={n} value={n} />)}</datalist>
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Kategorie</span>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {cats.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cx('flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pr-3 pl-1.5 text-sm font-medium ring-1 transition', categoryId === c.id ? 'bg-white ring-2 dark:bg-white/10' : 'ring-slate-200 text-slate-600 dark:ring-white/10 dark:text-slate-300')}
                style={categoryId === c.id ? { boxShadow: `0 0 0 2px ${c.color}` } : undefined}
              >
                <CategoryIcon category={c} size="sm" />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {type === 'oneTime' ? (
          <Field label="Datum"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Intervall">
                <Select value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
                  {(Object.keys(INTERVAL_LABEL) as Interval[]).map((i) => <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>)}
                </Select>
              </Field>
              {interval === 'custom' ? (
                <Field label="Alle … Monate"><Input inputMode="numeric" value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} /></Field>
              ) : interval === 'weekly' ? (
                <Field label="Wochentag" hint="ergibt sich aus dem Startdatum"><Input disabled value={new Date(startDate).toLocaleDateString('de-DE', { weekday: 'long' })} /></Field>
              ) : (
                <Field label="Zahlungstag" hint="31 = immer Monatsende"><Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
              )}
            </div>
            <Field label="Beginn"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ende</span>
              <Segmented value={endMode} onChange={setEndMode} options={[{ value: 'none', label: 'Unbefristet' }, { value: 'count', label: 'Anzahl Raten' }, { value: 'date', label: 'Enddatum' }]} />
              {endMode === 'count' && <Input className="mt-2" inputMode="numeric" placeholder="z. B. 24" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} />}
              {endMode === 'date' && <Input className="mt-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
            </div>

            {kind === 'expense' && (
              <div className="rounded-3xl ring-1 ring-slate-200 dark:ring-white/10">
                <label className="flex cursor-pointer items-center justify-between px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold">Kredit / Finanzierung</span>
                    <span className="text-xs text-slate-500">Restschuld und Zinsen automatisch berechnen</span>
                  </span>
                  <input type="checkbox" checked={isLoan} onChange={(e) => setIsLoan(e.target.checked)} className="size-5 accent-indigo-500" />
                </label>
                {isLoan && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Kreditsumme (€)"><Input inputMode="decimal" placeholder="10.000" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
                      <Field label="Zinssatz p. a. (%)"><Input inputMode="decimal" placeholder="4,9" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
                    </div>
                    <Button type="button" variant="secondary" className="w-full" onClick={calcRate}><Calculator size={16} /> Monatsrate aus Laufzeit berechnen</Button>
                  </div>
                )}
              </div>
            )}

            {preview && (preview.total != null || isLoan) && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-3xl bg-indigo-50/70 p-4 text-sm dark:bg-indigo-500/10">
                {preview.total != null && <Info label="Raten gesamt" value={`${preview.total}`} />}
                {preview.lastDate && <Info label="Letzte Rate" value={formatDate(preview.lastDate)} />}
                {preview.totalCents != null && <Info label="Gesamtkosten" value={eur(preview.totalCents)} />}
                {preview.interestCents != null && <Info label="davon Zinsen" value={eur(preview.interestCents)} />}
                {preview.remainingCents != null && <Info label="Restschuld heute" value={eur(preview.remainingCents)} />}
                {isLoan && preview.total == null && <p className="col-span-2 text-rose-600">Die Rate deckt die Zinsen nicht – der Kredit würde nie getilgt.</p>}
              </div>
            )}
          </>
        )}

        <button type="button" onClick={() => setShowMore(!showMore)} className="flex items-center gap-1 text-sm font-medium text-accent">
          Weitere Angaben <ChevronDown size={16} className={cx('transition', showMore && 'rotate-180')} />
        </button>
        {showMore && (
          <div className="space-y-3">
            {type === 'recurring' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Anbieter"><Input value={provider} onChange={(e) => setProvider(e.target.value)} /></Field>
                <Field label="Vertragsnummer"><Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} /></Field>
              </div>
            )}
            <Field label="Notiz"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></Field>
          </div>
        )}

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" role="alert">{error}</p>}
        <p className="sr-only">Kategorie: {category(categoryId).name}</p>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

const DEFAULT_EXPENSE = new Set(['wohnen', 'mobilitaet', 'versicherungen', 'abos', 'kredite', 'lebensmittel', 'freizeit', 'gesundheit', 'sonstiges']);

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}
