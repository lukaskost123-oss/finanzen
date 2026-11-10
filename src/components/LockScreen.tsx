import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Delete, Lock } from 'lucide-react';
import { cx } from './ui';

// SHA-256 des PINs – der PIN selbst steht nicht im Code.
const PIN_HASH = '2d87bf8c9d80ac79caa5553efc2ace391aebed8c986b665ddbbef87ad8a6f6cf';
const PIN_LENGTH = 4;
const SESSION_KEY = 'finanzen.unlocked';
const MAX_TRIES = 5;
const LOCKOUT_MS = 30_000;

/** Kompaktes SHA-256, da crypto.subtle im WLAN über http nicht verfügbar ist. */
export function sha256(text: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = Array.from(new TextEncoder().encode(text));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

function isUnlocked(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === PIN_HASH; } catch { return false; }
}

/** PIN-Abfrage beim Öffnen der App; gilt bis der Tab bzw. die App geschlossen wird. */
export function LockScreen({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, setTick] = useState(0);
  const waiting = lockedUntil > Date.now();

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [waiting]);

  const press = useCallback((digit: string) => {
    if (waiting) return;
    setError(false);
    setPin((p) => {
      const next = (p + digit).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) {
        if (sha256(next) === PIN_HASH) {
          try { sessionStorage.setItem(SESSION_KEY, PIN_HASH); } catch { /* privat */ }
          setTimeout(() => setUnlocked(true), 120);
        } else {
          setTimeout(() => {
            setError(true);
            setPin('');
            setTries((t) => {
              if (t + 1 >= MAX_TRIES) { setLockedUntil(Date.now() + LOCKOUT_MS); return 0; }
              return t + 1;
            });
          }, 150);
        }
      }
      return next;
    });
  }, [waiting]);

  const back = useCallback(() => { setError(false); setPin((p) => p.slice(0, -1)); }, []);

  useEffect(() => {
    if (unlocked) return;
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [unlocked, press, back]);

  if (unlocked) return <>{children}</>;

  const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
  return (
    <div className="pt-safe pb-safe fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#0b1020] px-6 text-white">
      <div className="pointer-events-none absolute top-10 -right-20 size-72 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 size-64 rounded-full bg-emerald-500/15 blur-3xl" />
      <img src="icon.svg" alt="" className="relative mb-5 size-16 drop-shadow-xl" />
      <h1 className="relative text-xl font-bold tracking-tight">Finanzen</h1>
      <p className="relative mt-1 flex items-center gap-1.5 text-sm text-slate-400">
        <Lock size={14} />
        {waiting ? `Zu viele Versuche – warte ${seconds} s` : error ? 'Falscher PIN, bitte erneut' : 'PIN eingeben'}
      </p>

      <div className={cx('relative my-8 flex gap-4', error && 'animate-[shake_.35s]')} aria-label={`${pin.length} von ${PIN_LENGTH} Ziffern`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={cx('size-3.5 rounded-full border-2 transition', i < pin.length ? 'scale-110 border-white bg-white' : error ? 'border-rose-400' : 'border-white/40')} />
        ))}
      </div>

      <div className="relative grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} onClick={() => press(d)} disabled={waiting}>{d}</Key>)}
        <span />
        <Key onClick={() => press('0')} disabled={waiting}>0</Key>
        <button onClick={back} aria-label="Löschen" className="grid size-18 place-items-center rounded-full text-slate-300 active:bg-white/10"><Delete size={24} /></button>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid size-18 place-items-center rounded-full bg-white/10 text-2xl font-medium backdrop-blur transition active:scale-95 active:bg-white/25 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
