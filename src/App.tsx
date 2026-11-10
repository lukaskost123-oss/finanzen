import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Home, Landmark, List, Plus, Settings as SettingsIcon, Target, Undo2, X } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store';
import { addMonths, ymd } from './lib/dates';
import { upcoming } from './lib/engine';
import { eur } from './lib/money';
import { Dashboard } from './pages/Dashboard';
import { Entries } from './pages/Entries';
import { Installments } from './pages/Installments';
import { Analysis } from './pages/Analysis';
import { Planning } from './pages/Planning';
import { Settings } from './pages/Settings';
import { EntryEditor } from './components/EntryForm';
import { LockScreen } from './components/LockScreen';
import { MonthSwitcher, useSwipe } from './components/rows';
import { cx, IconButton } from './components/ui';

type Page = 'home' | 'entries' | 'installments' | 'analysis' | 'planning' | 'settings';

const PAGES: { id: Page; label: string; title: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Übersicht', title: 'Übersicht', icon: Home },
  { id: 'entries', label: 'Einträge', title: 'Alle Einträge', icon: List },
  { id: 'installments', label: 'Raten', title: 'Raten & Kredite', icon: Landmark },
  { id: 'analysis', label: 'Analyse', title: 'Auswertungen', icon: BarChart3 },
  { id: 'planning', label: 'Planung', title: 'Planung', icon: Target },
];

export interface MonthNav { y: number; m: number; isCurrent: boolean }

function usePage(): [Page, (p: Page) => void] {
  const read = () => (location.hash.slice(1) as Page) || 'home';
  const [page, setPage] = useState<Page>(read);
  useEffect(() => {
    const on = () => { setPage(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [page, (p) => { location.hash = p; }];
}

function useTheme() {
  const { state } = useStore();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1020' : '#f1f5f9');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.settings.theme]);
}

/** Einmal täglich eine Mitteilung über bald fällige Zahlungen (falls erlaubt). */
function useDailyReminder() {
  const { state, today } = useStore();
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (localStorage.getItem('finanzen.notified') === today) return;
      const due = upcoming(state, today, state.settings.reminderDays);
      if (!due.length) return;
      new Notification('Bald fällig', { body: due.slice(0, 4).map((o) => `${o.name}: ${eur(o.amountCents)}`).join('\n'), icon: 'icon-192.png' });
      localStorage.setItem('finanzen.notified', today);
    } catch { /* manche Browser erlauben new Notification() nicht */ }
  }, [state, today]);
}

function Shell() {
  const { today, openEditor, editor } = useStore();
  const [page, go] = usePage();
  const [ty, tm] = ymd(today);
  const [offset, setOffset] = useState(0);
  const [y, m] = addMonths(ty, tm, offset);
  const nav: MonthNav = { y, m, isCurrent: offset === 0 };
  const monthPage = page === 'home' || page === 'analysis';
  const swipe = useSwipe((d) => monthPage && setOffset((o) => o + d));
  useTheme();
  useDailyReminder();

  // Tastenkürzel: „n" = neuer Eintrag, Pfeile = Monat wechseln
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (editor || (e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === 'n') { e.preventDefault(); openEditor({ mode: 'new' }); }
      if (monthPage && e.key === 'ArrowLeft') setOffset((o) => o - 1);
      if (monthPage && e.key === 'ArrowRight') setOffset((o) => o + 1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [editor, monthPage, openEditor]);

  const current = PAGES.find((p) => p.id === page) ?? { title: 'Einstellungen' };
  const content: Record<Page, ReactNode> = {
    home: <Dashboard nav={nav} />,
    entries: <Entries />,
    installments: <Installments />,
    analysis: <Analysis nav={nav} />,
    planning: <Planning />,
    settings: <Settings nav={nav} />,
  };

  return (
    <div className="min-h-dvh lg:flex">
      {/* Seitenleiste (Desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/60 p-5 backdrop-blur lg:flex dark:border-white/5 dark:bg-panel/40">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <img src="icon.svg" alt="" className="size-9" />
          <span className="text-lg font-extrabold tracking-tight">Finanzen</span>
        </div>
        <button onClick={() => openEditor({ mode: 'new' })} className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-accent-strong active:scale-[.98]">
          <Plus size={18} /> Neuer Eintrag <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[10px]">N</kbd>
        </button>
        <nav className="space-y-1">
          {[...PAGES, { id: 'settings' as Page, label: 'Einstellungen', title: '', icon: SettingsIcon }].map((p) => (
            <button key={p.id} onClick={() => go(p.id)} className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition', page === p.id ? 'bg-indigo-50 text-accent dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5')}>
              <p.icon size={19} />{p.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1" {...swipe}>
        <header className="pt-safe sticky top-0 z-20 border-b border-transparent bg-slate-100/80 backdrop-blur-xl dark:bg-night/80">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
            {monthPage ? (
              <MonthSwitcher y={y} m={m} isCurrent={offset === 0} onChange={(d) => setOffset((o) => o + d)} onToday={() => setOffset(0)} />
            ) : (
              <h1 className="text-xl font-extrabold tracking-tight">{current.title}</h1>
            )}
            <IconButton label="Einstellungen" onClick={() => go('settings')} className={cx('lg:hidden', page === 'settings' && 'text-accent')}><SettingsIcon size={20} /></IconButton>
          </div>
        </header>

        <main key={page} className="mx-auto max-w-2xl animate-fade px-4 pt-2 pb-36 lg:pb-12">
          {content[page]}
        </main>
      </div>

      {/* Schnelleingabe */}
      <button
        onClick={() => openEditor({ mode: 'new' })}
        aria-label="Neuer Eintrag"
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-accent text-white shadow-xl shadow-indigo-500/40 transition hover:bg-accent-strong active:scale-90 lg:hidden"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Tab-Leiste (Handy) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/85 backdrop-blur-xl lg:hidden dark:border-white/5 dark:bg-panel/85">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {PAGES.map((p) => (
            <button key={p.id} onClick={() => go(p.id)} className={cx('flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[10px] font-semibold transition', page === p.id ? 'text-accent dark:text-indigo-300' : 'text-slate-400')}>
              <p.icon size={22} strokeWidth={page === p.id ? 2.4 : 2} />
              {p.label}
            </button>
          ))}
        </div>
      </nav>

      <EntryEditor />
      <ToastView />
    </div>
  );
}

function ToastView() {
  const { toast, dismissToast, undo } = useStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, toast.undo ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-8" role="status">
      <div key={toast.id} className="pointer-events-auto flex animate-pop items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pr-2 pl-4 text-sm text-white shadow-2xl dark:bg-white dark:text-slate-900">
        <span>{toast.message}</span>
        {toast.undo && (
          <button onClick={undo} className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-semibold text-indigo-300 hover:bg-white/10 dark:text-accent dark:hover:bg-slate-100">
            <Undo2 size={15} /> Rückgängig
          </button>
        )}
        <button onClick={dismissToast} aria-label="Schließen" className="rounded-lg p-1 text-slate-400"><X size={15} /></button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LockScreen>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </LockScreen>
  );
}
