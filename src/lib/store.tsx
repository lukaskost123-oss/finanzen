import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, Category, OneTime, Recurring } from './types';
import { demoState, emptyState, uid } from './defaults';
import { todayISO } from './dates';

const KEY = 'finanzen.v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch { /* beschädigte Daten → neu starten */ }
  return demoState();
}

export interface Toast { id: number; message: string; undo?: boolean }

interface Store {
  state: AppState;
  today: string;
  /** Zustand ändern; mit `toast` erscheint eine Meldung, optional mit „Rückgängig". */
  update: (fn: (s: AppState) => AppState, toast?: string, undoable?: boolean) => void;
  undo: () => void;
  toast: Toast | null;
  dismissToast: () => void;
  notify: (message: string) => void;
  // Einträge
  saveRecurring: (r: Recurring) => void;
  saveOneTime: (o: OneTime) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  togglePause: (id: string) => void;
  togglePaid: (key: string, current: boolean) => void;
  category: (id: string) => Category;
  // Formular
  editor: EditorTarget | null;
  openEditor: (t: EditorTarget) => void;
  closeEditor: () => void;
}

export type EditorTarget =
  | { mode: 'new'; preset?: 'recurring' | 'oneTime' | 'income' }
  | { mode: 'edit'; id: string };

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const history = useRef<AppState | null>(null);
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Speicher voll / privat */ }
  }, [state]);

  // Datumswechsel um Mitternacht oder beim Zurückkehren in die App
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);

  const notify = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  const update = useCallback((fn: (s: AppState) => AppState, message?: string, undoable = true) => {
    setState((prev) => {
      history.current = prev;
      return fn(prev);
    });
    if (message) setToast({ id: Date.now(), message, undo: undoable });
  }, []);

  const undo = useCallback(() => {
    if (history.current) setState(history.current);
    history.current = null;
    setToast({ id: Date.now(), message: 'Rückgängig gemacht' });
  }, []);

  const store = useMemo<Store>(() => {
    const catMap = new Map(state.categories.map((c) => [c.id, c]));
    const fallback: Category = { id: 'sonstiges', name: 'Sonstiges', icon: 'package', color: '#64748b' };
    return {
      state, today, update, undo, toast, notify,
      dismissToast: () => setToast(null),
      category: (id) => catMap.get(id) ?? fallback,
      saveRecurring: (r) => update((s) => {
        const exists = s.recurring.some((x) => x.id === r.id);
        const oneTime = s.oneTime.filter((o) => o.id !== r.id); // Typwechsel im Formular
        return { ...s, oneTime, recurring: exists ? s.recurring.map((x) => (x.id === r.id ? r : x)) : [...s.recurring, r] };
      }, `„${r.name}" gespeichert`),
      saveOneTime: (o) => update((s) => {
        const exists = s.oneTime.some((x) => x.id === o.id);
        const recurring = s.recurring.filter((r) => r.id !== o.id);
        return { ...s, recurring, oneTime: exists ? s.oneTime.map((x) => (x.id === o.id ? o : x)) : [...s.oneTime, o] };
      }, `„${o.name}" gespeichert`),
      remove: (id) => {
        const name = state.recurring.find((r) => r.id === id)?.name ?? state.oneTime.find((o) => o.id === id)?.name ?? 'Eintrag';
        update((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id), oneTime: s.oneTime.filter((o) => o.id !== id) }), `„${name}" gelöscht`);
      },
      duplicate: (id) => update((s) => {
        const r = s.recurring.find((x) => x.id === id);
        if (r) return { ...s, recurring: [...s.recurring, { ...r, id: uid(), name: `${r.name} (Kopie)`, createdAt: todayISO() }] };
        const o = s.oneTime.find((x) => x.id === id);
        if (o) return { ...s, oneTime: [...s.oneTime, { ...o, id: uid(), name: `${o.name} (Kopie)`, createdAt: todayISO() }] };
        return s;
      }, 'Eintrag dupliziert'),
      togglePause: (id) => {
        const r = state.recurring.find((x) => x.id === id);
        if (!r) return;
        update((s) => ({ ...s, recurring: s.recurring.map((x) => (x.id === id ? { ...x, pausedFrom: x.pausedFrom ? undefined : today } : x)) }),
          r.pausedFrom ? `„${r.name}" fortgesetzt` : `„${r.name}" pausiert`);
      },
      togglePaid: (key, current) => update((s) => ({ ...s, paid: { ...s.paid, [key]: !current } })),
      editor,
      openEditor: setEditor,
      closeEditor: () => setEditor(null),
    };
  }, [state, today, toast, editor, update, undo, notify]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore außerhalb von StoreProvider');
  return s;
}
