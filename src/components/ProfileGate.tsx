import { useState, type FormEvent } from 'react';
import { Check, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { StoreProvider } from '../lib/store';
import { deleteProfileData, getActiveId, loadProfiles, newProfile, saveProfiles, setActiveId, type Profile } from '../lib/profiles';
import { cx } from './ui';

export function Avatar({ profile, className }: { profile: Profile; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-bold text-white', className)} style={{ background: profile.color }}>
      {profile.name.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Profilauswahl nach dem PIN: jeder Benutzer hat seine eigenen Daten auf diesem Gerät. */
export function ProfileGate({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [activeId, setActive] = useState<string | null>(getActiveId);
  const active = profiles.find((p) => p.id === activeId);

  const choose = (id: string | null) => { setActiveId(id); setActive(id); window.scrollTo({ top: 0 }); };
  const store = (list: Profile[]) => { saveProfiles(list); setProfiles(list); };

  if (active) {
    return <StoreProvider key={active.id} profile={active} onSwitch={() => choose(null)}>{children}</StoreProvider>;
  }
  return (
    <Picker
      profiles={profiles}
      onChoose={choose}
      onCreate={(name) => { const p = newProfile(name, profiles); store([...profiles, p]); choose(p.id); }}
      onRename={(id, name) => store(profiles.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)))}
      onDelete={(id) => { deleteProfileData(id); store(profiles.filter((p) => p.id !== id)); }}
    />
  );
}

function Picker({ profiles, onChoose, onCreate, onRename, onDelete }: {
  profiles: Profile[];
  onChoose: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onCreate(name);
  };

  return (
    <div className="pt-safe pb-safe relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#0b1020] px-6 py-10 text-white">
      <div className="pointer-events-none absolute top-10 -right-20 size-72 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 size-64 rounded-full bg-emerald-500/15 blur-3xl" />
      <img src="icon.svg" alt="" className="relative mb-5 size-14 drop-shadow-xl" />
      <h1 className="relative text-xl font-bold tracking-tight">{profiles.length ? 'Wer bist du?' : 'Willkommen!'}</h1>
      <p className="relative mt-1 text-center text-sm text-slate-400">
        {profiles.length ? 'Wähle dein Profil – jedes hat seine eigenen Daten.' : 'Lege dein Profil an. Es startet leer bei 0 €.'}
      </p>

      <div className="relative mt-8 w-full max-w-sm space-y-2.5">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
            {renaming?.id === p.id ? (
              <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (renaming.name.trim()) { onRename(p.id, renaming.name); setRenaming(null); } }}>
                <Avatar profile={{ ...p, name: renaming.name }} className="size-10" />
                <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} maxLength={30}
                  className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-400" />
                <button type="submit" aria-label="Speichern" className="grid size-9 place-items-center rounded-full bg-indigo-500"><Check size={18} /></button>
              </form>
            ) : confirmDelete === p.id ? (
              <div className="flex flex-1 items-center gap-2">
                <p className="flex-1 text-sm">„{p.name}“ und alle Daten löschen?</p>
                <button onClick={() => setConfirmDelete(null)} className="rounded-xl px-3 py-2 text-sm text-slate-300">Nein</button>
                <button onClick={() => { onDelete(p.id); setConfirmDelete(null); }} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold">Löschen</button>
              </div>
            ) : (
              <>
                <button onClick={() => !editing && onChoose(p.id)} className="flex flex-1 items-center gap-3 text-left" disabled={editing}>
                  <Avatar profile={p} className="size-10" />
                  <span className="flex-1 truncate font-semibold">{p.name}</span>
                  {!editing && <ChevronRight size={18} className="text-slate-400" />}
                </button>
                {editing && (
                  <>
                    <button onClick={() => setRenaming({ id: p.id, name: p.name })} aria-label="Umbenennen" className="grid size-9 place-items-center rounded-full text-slate-300 active:bg-white/10"><Pencil size={17} /></button>
                    <button onClick={() => setConfirmDelete(p.id)} aria-label="Löschen" className="grid size-9 place-items-center rounded-full text-rose-400 active:bg-white/10"><Trash2 size={17} /></button>
                  </>
                )}
              </>
            )}
          </div>
        ))}

        {adding ? (
          <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-white/10 p-3 backdrop-blur">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" maxLength={30}
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400" />
            {profiles.length > 0 && (
              <button type="button" onClick={() => { setAdding(false); setName(''); }} aria-label="Abbrechen" className="grid size-10 place-items-center rounded-full text-slate-300"><X size={18} /></button>
            )}
            <button type="submit" disabled={!name.trim()} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40">Anlegen</button>
          </form>
        ) : !editing && (
          <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/20 p-3 text-slate-300 transition active:bg-white/5">
            <span className="grid size-10 place-items-center rounded-full bg-white/10"><Plus size={20} /></span>
            <span className="font-semibold">Neues Profil</span>
          </button>
        )}
      </div>

      {profiles.length > 0 && !adding && (
        <button onClick={() => { setEditing((e) => !e); setRenaming(null); setConfirmDelete(null); }} className="relative mt-6 text-sm font-semibold text-indigo-300">
          {editing ? 'Fertig' : 'Profile bearbeiten'}
        </button>
      )}
    </div>
  );
}
