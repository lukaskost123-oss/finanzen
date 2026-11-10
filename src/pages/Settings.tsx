import { useRef, useState } from 'react';
import { Bell, CalendarPlus, Database, Download, FileSpreadsheet, FileText, Moon, Palette, RotateCcw, Share, Smartphone, Sun, SunMoon, Tags, Trash2, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Category } from '../lib/types';
import { backupJSON, exportCSV, exportICS, exportPDF, exportXLSX, importCSV, parseBackup } from '../lib/export';
import { demoState, emptyState, uid } from '../lib/defaults';
import { COLORS, ICONS } from '../lib/icons';
import { Button, Card, CategoryIcon, cx, Field, Input, Segmented, SectionTitle, Sheet } from '../components/ui';
import type { MonthNav } from '../App';

export function Settings({ nav }: { nav: MonthNav }) {
  const { state, update, notify } = useStore();
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState('');
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone);

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    try { await fn(); } catch (e) { notify(`Fehler: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const readFile = (f: File) => f.text();

  const askNotifications = async () => {
    if (!('Notification' in window)) { notify(standalone ? 'Mitteilungen werden auf diesem Gerät nicht unterstützt' : 'Mitteilungen gehen auf dem iPhone nur in der installierten App'); return; }
    const p = await Notification.requestPermission();
    notify(p === 'granted' ? 'Mitteilungen aktiviert' : 'Mitteilungen nicht erlaubt');
  };

  return (
    <div className="space-y-4">
      {!standalone && (
        <Card className="!bg-gradient-to-br from-indigo-500 to-violet-600 text-white !ring-0">
          <div className="flex gap-3">
            <Smartphone className="shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Als App aufs iPhone</p>
              <p className="mt-1 text-white/85">In Safari auf <Share size={14} className="inline -mt-0.5" /> <b>Teilen</b> tippen und <b>„Zum Home-Bildschirm"</b> wählen. Die App startet dann im Vollbild und funktioniert auch offline.</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Palette size={17} className="text-accent" /> Darstellung</span></SectionTitle>
        <Segmented
          value={state.settings.theme}
          onChange={(theme) => update((s) => ({ ...s, settings: { ...s.settings, theme } }))}
          options={[
            { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={15} /> Hell</span> },
            { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={15} /> Dunkel</span> },
            { value: 'system', label: <span className="flex items-center justify-center gap-1.5"><SunMoon size={15} /> System</span> },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Bell size={17} className="text-amber-500" /> Erinnerungen</span></SectionTitle>
        <Field label="Vorlauf für Hinweise auf fällige Zahlungen">
          <Segmented
            value={String(state.settings.reminderDays)}
            onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, reminderDays: Number(v) } }))}
            options={['1', '3', '5', '7'].map((d) => ({ value: d, label: `${d} ${d === '1' ? 'Tag' : 'Tage'}` }))}
          />
        </Field>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => run('ics', () => exportICS(state))}><CalendarPlus size={17} /> In Kalender übernehmen</Button>
          <Button variant="secondary" onClick={askNotifications}><Bell size={17} /> Mitteilungen erlauben</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Tipp: Die Kalenderdatei legt alle Zahlungen mit Erinnerung in deiner iPhone-Kalender-App an – so wirst du zuverlässig erinnert, auch wenn die App geschlossen ist.</p>
      </Card>

      <Card>
        <SectionTitle action={<button className="text-xs font-semibold text-accent" onClick={() => setEditCat({ id: uid(), name: '', icon: 'package', color: COLORS[state.categories.length % COLORS.length] })}>+ Kategorie</button>}>
          <span className="flex items-center gap-2"><Tags size={17} className="text-pink-500" /> Kategorien</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.categories.map((c) => (
            <button key={c.id} onClick={() => setEditCat(c)} className="flex items-center gap-2 rounded-2xl p-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/4">
              <CategoryIcon category={c} size="sm" /><span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Download size={17} className="text-emerald-500" /> Export</span></SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" disabled={!!busy} onClick={() => run('pdf', () => exportPDF(state, nav.y, nav.m))}><FileText size={17} /> {busy === 'pdf' ? 'Erstelle …' : 'PDF-Bericht'}</Button>
          <Button variant="secondary" disabled={!!busy} onClick={() => run('xlsx', () => exportXLSX(state, nav.y, nav.m))}><FileSpreadsheet size={17} /> {busy === 'xlsx' ? 'Erstelle …' : 'Excel'}</Button>
          <Button variant="secondary" disabled={!!busy} onClick={() => run('csv', () => exportCSV(state))}><FileText size={17} /> CSV</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">PDF und Excel beziehen sich auf den gewählten Monat in der Übersicht.</p>
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-2"><Database size={17} className="text-sky-500" /> Daten & Sicherung</span></SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={() => run('json', () => backupJSON(state))}><Download size={17} /> Backup speichern</Button>
          <Button variant="secondary" onClick={() => jsonRef.current?.click()}><Upload size={17} /> Backup laden</Button>
          <Button variant="secondary" onClick={() => csvRef.current?.click()}><Upload size={17} /> CSV importieren</Button>
        </div>
        <input ref={jsonRef} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) run('restore', async () => { const s = parseBackup(await readFile(f)); update(() => ({ ...emptyState(), ...s }), 'Backup wiederhergestellt'); });
        }} />
        <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) run('import', async () => {
            const r = importCSV(await readFile(f), state);
            update(() => r.state, `${r.added} Einträge importiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}`);
          });
        }} />
        <p className="mt-2 text-xs text-slate-500">Alle Daten bleiben nur auf diesem Gerät gespeichert – keine Anmeldung, keine Cloud. Speichere regelmäßig ein Backup (z. B. in iCloud Drive).</p>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-white/5">
          <Button variant="ghost" onClick={() => update(() => demoState(), 'Beispieldaten geladen')}><RotateCcw size={17} /> Beispieldaten laden</Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}><Trash2 size={17} /> Alle Daten löschen</Button>
        </div>
      </Card>

      <p className="pb-2 text-center text-xs text-slate-400">Finanzen 1.0 · Beträge werden centgenau berechnet</p>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Alle Daten löschen?"
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setConfirmReset(false)}>Abbrechen</Button><Button variant="danger" className="flex-1" onClick={() => { update(() => ({ ...emptyState(), settings: { ...state.settings, demo: false } }), 'Alle Daten gelöscht'); setConfirmReset(false); }}>Löschen</Button></div>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Alle Einträge, Budgets und Sparziele werden entfernt. Du kannst das direkt danach noch über „Rückgängig" zurückholen – sicherer ist vorher ein Backup.</p>
      </Sheet>

      {editCat && <CategoryEditor cat={editCat} onClose={() => setEditCat(null)} />}
    </div>
  );
}

function CategoryEditor({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const { state, update } = useStore();
  const exists = state.categories.some((c) => c.id === cat.id);
  const [name, setName] = useState(cat.name);
  const [icon, setIcon] = useState(cat.icon);
  const [color, setColor] = useState(cat.color);
  const used = state.recurring.some((r) => r.categoryId === cat.id) || state.oneTime.some((o) => o.categoryId === cat.id);
  const locked = ['sonstiges', 'gehalt'].includes(cat.id);

  const save = () => {
    if (!name.trim()) return;
    const c = { ...cat, name: name.trim(), icon, color };
    update((s) => ({ ...s, categories: exists ? s.categories.map((x) => (x.id === c.id ? c : x)) : [...s.categories, c] }), 'Kategorie gespeichert');
    onClose();
  };
  const del = () => {
    // Einträge der gelöschten Kategorie wandern nach „Sonstiges"
    update((s) => ({
      ...s,
      categories: s.categories.filter((x) => x.id !== cat.id),
      recurring: s.recurring.map((r) => (r.categoryId === cat.id ? { ...r, categoryId: 'sonstiges' } : r)),
      oneTime: s.oneTime.map((o) => (o.categoryId === cat.id ? { ...o, categoryId: 'sonstiges' } : o)),
      budgets: s.budgets.filter((b) => b.categoryId !== cat.id),
    }), `Kategorie „${cat.name}" gelöscht`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={exists ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      footer={<div className="flex gap-3">
        {exists && !locked && <Button variant="danger" onClick={del} aria-label="Löschen"><Trash2 size={18} /></Button>}
        <Button className="flex-1" onClick={save}>Speichern</Button>
      </div>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon category={{ ...cat, icon, color, name }} size="lg" />
          <Field label="Name" className="flex-1"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Haustier" /></Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Symbol</span>
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(ICONS).map(([k, I]) => (
              <button key={k} aria-label={k} onClick={() => setIcon(k)} className={cx('grid aspect-square place-items-center rounded-xl transition', icon === k ? 'text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/6 dark:text-slate-300')} style={icon === k ? { background: color } : undefined}>
                <I size={17} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Farbe</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => <button key={c} aria-label={`Farbe ${c}`} onClick={() => setColor(c)} className={cx('size-8 rounded-full transition', color === c && 'ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-panel')} style={{ background: c }} />)}
          </div>
        </div>
        {exists && used && !locked && <p className="text-xs text-slate-500">Beim Löschen werden zugehörige Einträge nach „Sonstiges" verschoben.</p>}
      </div>
    </Sheet>
  );
}

