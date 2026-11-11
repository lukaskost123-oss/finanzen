import { COLORS } from './icons';
import { uid } from './defaults';
import { todayISO } from './dates';

export interface Profile { id: string; name: string; color: string; createdAt: string }

const LIST_KEY = 'finanzen.profiles';
const ACTIVE_KEY = 'finanzen.activeProfile';
const LEGACY_KEY = 'finanzen.v1';

export const dataKey = (profileId: string) => `finanzen.v1.${profileId}`;

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (raw) return JSON.parse(raw);
    // Daten aus der Zeit vor den Profilen übernehmen (Beispieldaten werden verworfen)
    const legacy = localStorage.getItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_KEY);
    if (legacy && !JSON.parse(legacy).settings?.demo) {
      const p: Profile = { id: uid(), name: 'Mein Profil', color: COLORS[0], createdAt: todayISO() };
      localStorage.setItem(dataKey(p.id), legacy);
      saveProfiles([p]);
      return [p];
    }
  } catch { /* beschädigt → leer starten */ }
  return [];
}

export function saveProfiles(list: Profile[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* Speicher voll / privat */ }
}

export function newProfile(name: string, existing: Profile[]): Profile {
  return { id: uid(), name: name.trim(), color: COLORS[existing.length % COLORS.length], createdAt: todayISO() };
}

export function deleteProfileData(id: string) {
  try { localStorage.removeItem(dataKey(id)); localStorage.removeItem(`finanzen.notified.${id}`); } catch { /* egal */ }
}

/** Das gewählte Profil gilt bis die App bzw. der Tab geschlossen wird – wie die PIN-Sperre. */
export function getActiveId(): string | null {
  try { return sessionStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function setActiveId(id: string | null) {
  try { if (id) sessionStorage.setItem(ACTIVE_KEY, id); else sessionStorage.removeItem(ACTIVE_KEY); } catch { /* privat */ }
}
