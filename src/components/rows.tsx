import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Occurrence, OneTime, Recurring } from '../lib/types';
import { isPaid, INTERVAL_LABEL, isActive } from '../lib/engine';
import { eur } from '../lib/money';
import { formatDate, formatDateShort, monthLabel, weekdayShort } from '../lib/dates';
import { Badge, CategoryIcon, cx, IconButton } from './ui';

export function OccurrenceRow({ o }: { o: Occurrence }) {
  const { state, today, category, togglePaid, openEditor } = useStore();
  const paid = isPaid(state.paid, o, today);
  const income = o.kind === 'income';
  const overdue = !paid && !income && o.date < today;
  return (
    <div className="group flex items-center gap-3 py-2.5">
      <button onClick={() => openEditor({ mode: 'edit', id: o.sourceId })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoryIcon category={category(o.categoryId)} />
        <div className="min-w-0 flex-1">
          <p className={cx('truncate font-medium', paid && !income && 'text-slate-500 dark:text-slate-400')}>{o.name}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="whitespace-nowrap">{weekdayShort(o.date)}, {formatDateShort(o.date)}</span>
            {o.total != null && o.index != null && <Badge tone="indigo">Rate {o.index}/{o.total}</Badge>}
            {o.source === 'oneTime' && !income && <Badge>einmalig</Badge>}
            {overdue && <Badge tone="red">überfällig</Badge>}
          </p>
        </div>
        <span className={cx('tabular shrink-0 font-semibold', income ? 'text-emerald-600 dark:text-emerald-400' : paid ? 'text-slate-500 dark:text-slate-400' : '')}>
          {income ? '+' : '−'}{eur(o.amountCents)}
        </span>
      </button>
      <button
        onClick={() => togglePaid(o.key, paid)}
        aria-label={paid ? 'Als offen markieren' : income ? 'Als erhalten markieren' : 'Als bezahlt markieren'}
        title={paid ? (income ? 'erhalten' : 'bezahlt') : 'offen'}
        className={cx('grid size-7 shrink-0 place-items-center rounded-full ring-2 transition active:scale-90', paid ? 'bg-emerald-500 text-white ring-emerald-500' : 'text-transparent ring-slate-300 hover:ring-slate-400 dark:ring-slate-600')}
      >
        <Check size={15} strokeWidth={3} />
      </button>
    </div>
  );
}

export function EntryRow({ e, meta }: { e: Recurring | OneTime; meta?: ReactNode }) {
  const { today, category, openEditor, duplicate, togglePause, remove } = useStore();
  const [menu, setMenu] = useState(false);
  const rec = 'interval' in e ? e : undefined;
  const paused = !!rec?.pausedFrom;
  const ended = rec && !paused && !isActive(rec, today);
  const income = e.kind === 'income';
  return (
    <div className={cx('relative flex items-center gap-3 py-2.5', (paused || ended) && 'opacity-60')}>
      <button onClick={() => openEditor({ mode: 'edit', id: e.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoryIcon category={category(e.categoryId)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{e.name}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {rec ? <span>{INTERVAL_LABEL[rec.interval]}{rec.interval !== 'weekly' && ` · am ${rec.dayOfMonth}.`}</span> : <span>{formatDate((e as OneTime).date)}</span>}
            {paused && <Badge tone="amber">pausiert</Badge>}
            {ended && <Badge>beendet</Badge>}
            {meta}
          </p>
        </div>
        <span className={cx('tabular shrink-0 font-semibold', income && 'text-emerald-600 dark:text-emerald-400')}>{income ? '+' : ''}{eur(e.amountCents)}</span>
      </button>
      <IconButton label="Aktionen" onClick={() => setMenu(!menu)}><MoreHorizontal size={18} /></IconButton>
      {menu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
          <div className="absolute top-12 right-0 z-40 w-48 animate-pop overflow-hidden rounded-2xl bg-white p-1 shadow-xl ring-1 ring-slate-200 dark:bg-panel-2 dark:ring-white/10">
            <MenuItem icon={<Pencil size={16} />} onClick={() => { setMenu(false); openEditor({ mode: 'edit', id: e.id }); }}>Bearbeiten</MenuItem>
            <MenuItem icon={<Copy size={16} />} onClick={() => { setMenu(false); duplicate(e.id); }}>Duplizieren</MenuItem>
            {rec && <MenuItem icon={paused ? <Play size={16} /> : <Pause size={16} />} onClick={() => { setMenu(false); togglePause(e.id); }}>{paused ? 'Fortsetzen' : 'Pausieren'}</MenuItem>}
            <MenuItem icon={<Trash2 size={16} />} danger onClick={() => { setMenu(false); remove(e.id); }}>Löschen</MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/8', danger && 'text-rose-600 dark:text-rose-400')}>
      {icon}{children}
    </button>
  );
}

export function MonthSwitcher({ y, m, onChange, isCurrent, onToday }: { y: number; m: number; onChange: (d: number) => void; isCurrent: boolean; onToday: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Vorheriger Monat" onClick={() => onChange(-1)}><ChevronLeft size={20} /></IconButton>
      <button onClick={onToday} className="min-w-[150px] text-center" title="Zum aktuellen Monat">
        <span className="block text-base font-bold tracking-tight">{monthLabel(y, m)}</span>
        {!isCurrent && <span className="block text-[11px] font-medium text-accent">zurück zu heute</span>}
      </button>
      <IconButton label="Nächster Monat" onClick={() => onChange(1)}><ChevronRight size={20} /></IconButton>
    </div>
  );
}

/** Horizontales Wischen erkennen (für Monatswechsel). */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x;
      const dy = e.changedTouches[0].clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}
