import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { iconFor } from '../lib/icons';
import type { Category } from '../lib/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-12px_rgba(15,23,42,.12)] ring-1 ring-slate-200/70 dark:bg-panel dark:shadow-none dark:ring-white/5',
        onClick && 'cursor-pointer transition hover:ring-slate-300 dark:hover:ring-white/10',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-200">{children}</h2>
      {action}
    </div>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm shadow-indigo-500/20',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-100 dark:hover:bg-white/12',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/8',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
  };
  return (
    <button
      {...p}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-40', v[variant], className)}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...p}
      aria-label={label}
      title={label}
      className={cx('grid size-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:bg-white/8', className)}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-2xl border-0 bg-slate-100 px-4 py-2.5 text-slate-900 ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-accent focus:outline-none dark:bg-white/6 dark:text-slate-100 dark:focus:bg-white/10';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}

export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'appearance-none pr-8', p.className)}>{children}</select>;
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('flex rounded-2xl bg-slate-100 p-1 dark:bg-white/6', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl px-2 py-2 text-[13px] font-medium whitespace-nowrap transition sm:text-sm',
            value === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-panel-2 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8', className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${v * 100}%`, background: color ?? 'var(--color-accent)' }} />
    </div>
  );
}

export function CategoryIcon({ category, size = 'md' }: { category: Category; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = iconFor(category.icon);
  const s = { sm: 'size-8 rounded-xl', md: 'size-10 rounded-2xl', lg: 'size-12 rounded-2xl' }[size];
  const i = { sm: 16, md: 18, lg: 22 }[size];
  return (
    <span className={cx('grid shrink-0 place-items-center', s)} style={{ background: `${category.color}1f`, color: category.color }}>
      <Icon size={i} strokeWidth={2.2} />
    </span>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'indigo' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-400',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-400',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', t)}>{children}</span>;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-3xl bg-indigo-50 text-accent dark:bg-indigo-500/10">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Bottom-Sheet auf dem Handy, zentrierter Dialog auf dem Desktop. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full animate-sheet flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-w-lg sm:animate-pop sm:rounded-[28px] dark:bg-panel">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-white/15" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2 sm:pt-5">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <IconButton label="Schließen" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/5">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'green' | 'red' }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cx('tabular mt-0.5 text-lg font-bold tracking-tight', tone === 'green' && 'text-emerald-600 dark:text-emerald-400', tone === 'red' && 'text-rose-600 dark:text-rose-400')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
