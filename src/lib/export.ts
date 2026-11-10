import type { AppState, Interval, OneTime, Recurring } from './types';
import { forecast, INTERVAL_LABEL, isPaid, monthSummary, recurringOccurrences, stepMonths } from './engine';
import { num, parseEuro } from './money';
import { addDays, formatDate, iso, monthLabel, todayISO, ymd } from './dates';
import { uid } from './defaults';
import { COLORS } from './icons';

/** Datei speichern – auf dem iPhone über das Teilen-Menü, sonst als Download. */
export async function saveFile(filename: string, blob: Blob) {
  const file = new File([blob], filename, { type: blob.type });
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => todayISO();

// ───────────── JSON-Backup ─────────────

export function backupJSON(state: AppState) {
  return saveFile(`finanzen-backup-${stamp()}.json`, new Blob([JSON.stringify({ app: 'finanzen', exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' }));
}

export function parseBackup(text: string): AppState {
  const data = JSON.parse(text);
  const s = data.state ?? data;
  if (!Array.isArray(s.recurring) || !Array.isArray(s.oneTime) || !Array.isArray(s.categories)) throw new Error('Keine gültige Sicherungsdatei');
  return s as AppState;
}

// ───────────── CSV ─────────────

const CSV_HEAD = ['Typ', 'Art', 'Name', 'Betrag', 'Kategorie', 'Datum/Beginn', 'Intervall', 'Zahlungstag', 'Anzahl Raten', 'Enddatum', 'Anbieter', 'Vertragsnummer', 'Notiz'];

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(state: AppState): string {
  const cat = (id: string) => state.categories.find((c) => c.id === id)?.name ?? id;
  const rows: unknown[][] = [CSV_HEAD];
  for (const r of state.recurring) {
    rows.push(['Laufend', r.kind === 'income' ? 'Einnahme' : 'Ausgabe', r.name, num(r.amountCents), cat(r.categoryId), formatDate(r.startDate), INTERVAL_LABEL[r.interval], r.dayOfMonth, r.endMode === 'count' ? r.count : '', r.endMode === 'date' && r.endDate ? formatDate(r.endDate) : '', r.provider, r.contractNo, r.note]);
  }
  for (const o of state.oneTime) {
    rows.push(['Einmalig', o.kind === 'income' ? 'Einnahme' : 'Ausgabe', o.name, num(o.amountCents), cat(o.categoryId), formatDate(o.date), '', '', '', '', '', '', o.note]);
  }
  return rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

export function exportCSV(state: AppState) {
  return saveFile(`finanzen-${stamp()}.csv`, new Blob(['﻿' + toCSV(state)], { type: 'text/csv;charset=utf-8' }));
}

function parseCSVRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const delim = (src.split('\n')[0].match(/;/g)?.length ?? 0) >= (src.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Datum aus „31.12.2026" oder „2026-12-31". */
function parseDate(s: string): string | undefined {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? t : undefined;
}

export interface ImportResult { state: AppState; added: number; skipped: number }

/** CSV im Exportformat einlesen. Spalten werden über die Kopfzeile erkannt. */
export function importCSV(text: string, state: AppState): ImportResult {
  const rows = parseCSVRows(text);
  if (rows.length < 2) throw new Error('Die Datei enthält keine Daten.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.startsWith(n)));
  const ix = { typ: col('typ'), art: col('art'), name: col('name', 'bezeichnung'), betrag: col('betrag'), kat: col('kategorie'), datum: col('datum', 'beginn'), intervall: col('intervall'), tag: col('zahlungstag'), anzahl: col('anzahl'), ende: col('enddatum'), anbieter: col('anbieter'), vertrag: col('vertrag'), notiz: col('notiz') };
  if (ix.name < 0 || ix.betrag < 0) throw new Error('Spalten „Name" und „Betrag" werden benötigt.');

  const categories = [...state.categories];
  const catId = (name: string) => {
    const n = name.trim();
    if (!n) return 'sonstiges';
    const found = categories.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (found) return found.id;
    const c = { id: uid(), name: n, icon: 'package', color: COLORS[categories.length % COLORS.length] };
    categories.push(c);
    return c.id;
  };
  const intervalFrom = (s: string): Interval => (Object.entries(INTERVAL_LABEL).find(([, l]) => l === s.trim().toLowerCase())?.[0] as Interval) ?? 'monthly';

  const recurring: Recurring[] = [], oneTime: OneTime[] = [];
  let skipped = 0;
  const now = todayISO();
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? r[i]?.trim() ?? '' : '');
    const cents = parseEuro(get(ix.betrag));
    const name = get(ix.name);
    if (!name || cents == null) { skipped++; continue; }
    const kind = get(ix.art).toLowerCase().startsWith('einn') ? 'income' : 'expense';
    const date = parseDate(get(ix.datum)) ?? now;
    const base = { id: uid(), kind, name, amountCents: Math.abs(cents), categoryId: catId(get(ix.kat)), note: get(ix.notiz) || undefined, createdAt: now } as const;
    if (get(ix.typ).toLowerCase().startsWith('lauf') || get(ix.intervall)) {
      const count = parseInt(get(ix.anzahl));
      const endDate = parseDate(get(ix.ende));
      recurring.push({
        ...base, interval: intervalFrom(get(ix.intervall)), dayOfMonth: parseInt(get(ix.tag)) || ymd(date)[2], startDate: date,
        endMode: count > 0 ? 'count' : endDate ? 'date' : 'none', count: count > 0 ? count : undefined, endDate,
        provider: get(ix.anbieter) || undefined, contractNo: get(ix.vertrag) || undefined,
      });
    } else oneTime.push({ ...base, date });
  }
  return { state: { ...state, categories, recurring: [...state.recurring, ...recurring], oneTime: [...state.oneTime, ...oneTime] }, added: recurring.length + oneTime.length, skipped };
}

// ───────────── Excel ─────────────

export async function exportXLSX(state: AppState, y: number, m: number) {
  const XLSX = await import('xlsx');
  const today = todayISO();
  const cat = (id: string) => state.categories.find((c) => c.id === id)?.name ?? id;
  const s = monthSummary(state, y, m, today);
  const wb = XLSX.utils.book_new();

  const month = XLSX.utils.aoa_to_sheet([
    [`Monatsübersicht ${monthLabel(y, m)}`], [],
    ['Einnahmen', s.incomeCents / 100], ['Fixkosten & Raten', s.fixedCents / 100], ['Einmalige Ausgaben', s.oneTimeCents / 100],
    ['Ausgaben gesamt', s.expenseCents / 100], ['Frei verfügbar', s.remainingCents / 100], ['Noch offen', s.openCents / 100], [],
    ['Datum', 'Name', 'Kategorie', 'Art', 'Betrag (€)', 'Rate', 'Status'],
    ...s.items.map((o) => [formatDate(o.date), o.name, cat(o.categoryId), o.kind === 'income' ? 'Einnahme' : o.source === 'recurring' ? 'Laufend' : 'Einmalig', (o.kind === 'income' ? 1 : -1) * o.amountCents / 100, o.total ? `${o.index}/${o.total}` : '', isPaid(state.paid, o, today) ? 'erledigt' : 'offen']),
  ]);
  month['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 11 }, { wch: 12 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, month, 'Monat');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.recurring.map((r) => ({
    Name: r.name, Art: r.kind === 'income' ? 'Einnahme' : 'Ausgabe', 'Betrag (€)': r.amountCents / 100, Kategorie: cat(r.categoryId), Intervall: INTERVAL_LABEL[r.interval],
    Zahlungstag: r.dayOfMonth, Beginn: formatDate(r.startDate), 'Anzahl Raten': r.count ?? '', Enddatum: r.endDate ? formatDate(r.endDate) : '', Anbieter: r.provider ?? '', Vertragsnummer: r.contractNo ?? '', Pausiert: r.pausedFrom ? 'ja' : '',
  }))), 'Laufende Zahlungen');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...state.oneTime].sort((a, b) => a.date.localeCompare(b.date)).map((o) => ({
    Datum: formatDate(o.date), Name: o.name, Art: o.kind === 'income' ? 'Einnahme' : 'Ausgabe', 'Betrag (€)': o.amountCents / 100, Kategorie: cat(o.categoryId), Notiz: o.note ?? '',
  }))), 'Einmalige Buchungen');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(forecast(state, y, m, 12, today).map((f) => ({
    Monat: monthLabel(f.year, f.month), 'Einnahmen (€)': f.incomeCents / 100, 'Ausgaben (€)': f.expenseCents / 100, 'Frei (€)': f.remainingCents / 100,
  }))), 'Prognose');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await saveFile(`finanzen-${y}-${String(m).padStart(2, '0')}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// ───────────── PDF ─────────────

export async function exportPDF(state: AppState, y: number, m: number) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const today = todayISO();
  const cat = (id: string) => state.categories.find((c) => c.id === id)?.name ?? id;
  const s = monthSummary(state, y, m, today);
  const e = (c: number) => `${num(c)} €`;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(`Monatsbericht ${monthLabel(y, m)}`, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Erstellt am ${formatDate(today)}`, 14, 27);

  const boxes: [string, number, [number, number, number]][] = [
    ['Einnahmen', s.incomeCents, [16, 185, 129]], ['Ausgaben', s.expenseCents, [244, 63, 94]], ['Frei verfügbar', s.remainingCents, s.remainingCents < 0 ? [244, 63, 94] : [99, 102, 241]],
  ];
  const bw = (W - 28 - 8) / 3;
  boxes.forEach(([label, v, c], i) => {
    const x = 14 + i * (bw + 4);
    doc.setFillColor(246, 247, 251);
    doc.roundedRect(x, 46, bw, 22, 3, 3, 'F');
    doc.setTextColor(100, 116, 139); doc.setFontSize(9); doc.text(label, x + 4, 53);
    doc.setTextColor(...c); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(e(v), x + 4, 63);
    doc.setFont('helvetica', 'normal');
  });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Fixkosten & Raten: ${e(s.fixedCents)}   ·   Einmalige Ausgaben: ${e(s.oneTimeCents)}   ·   Noch offen: ${e(s.openCents)}`, 14, 77);

  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  autoTable(doc, {
    startY: 84,
    head: [['Kategorie', 'Betrag', 'Anteil']],
    body: cats.map(([id, v]) => [cat(id), e(v), `${((v / (s.expenseCents || 1)) * 100).toFixed(1).replace('.', ',')} %`]),
    theme: 'striped', headStyles: { fillColor: [99, 102, 241] }, styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Datum', 'Name', 'Kategorie', 'Art', 'Betrag', 'Status']],
    body: s.items.map((o) => [formatDate(o.date), o.name + (o.total ? ` (${o.index}/${o.total})` : ''), cat(o.categoryId), o.kind === 'income' ? 'Einnahme' : o.source === 'recurring' ? 'Laufend' : 'Einmalig', (o.kind === 'income' ? '+' : '−') + e(o.amountCents), isPaid(state.paid, o, today) ? 'erledigt' : 'offen']),
    theme: 'striped', headStyles: { fillColor: [30, 27, 75] }, styles: { fontSize: 8.5 }, columnStyles: { 4: { halign: 'right' } },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Finanzen · Seite ${i} von ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }
  await saveFile(`monatsbericht-${y}-${String(m).padStart(2, '0')}.pdf`, doc.output('blob'));
}

// ───────────── Kalender (Erinnerungen) ─────────────

const icsDate = (d: string) => d.replace(/-/g, '');
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** Kalenderdatei mit allen Zahlungen als Termine samt Erinnerung – funktioniert in der iPhone-Kalender-App. */
export function exportICS(state: AppState) {
  const days = state.settings.reminderDays;
  const today = todayISO();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finanzen//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Zahlungen'];
  const alarm = (name: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(name)} ist fällig`, `TRIGGER:-P${days}D`, 'END:VALARM'];
  const stampLine = `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

  for (const r of state.recurring.filter((x) => x.kind === 'expense' && !x.pausedFrom)) {
    const step = stepMonths(r);
    // Tage 29–31: BYSETPOS=-1 nimmt den letzten existierenden Tag, wie die App (31. → 28./29./30.)
    const byDay = r.dayOfMonth >= 29 ? `BYMONTHDAY=${Array.from({ length: r.dayOfMonth - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1` : `BYMONTHDAY=${r.dayOfMonth}`;
    let rule = step === 0 ? 'FREQ=WEEKLY' : `FREQ=MONTHLY;INTERVAL=${step};${byDay}`;
    if (r.endMode === 'count' && r.count) rule += `;COUNT=${r.count}`;
    if (r.endMode === 'date' && r.endDate) rule += `;UNTIL=${icsDate(r.endDate)}`;
    const first = recurringOccurrences({ ...r, pausedFrom: undefined }, r.startDate, addDays(r.startDate, 400))[0]?.date;
    if (!first) continue;
    lines.push('BEGIN:VEVENT', `UID:${r.id}@finanzen`, stampLine, `DTSTART;VALUE=DATE:${icsDate(first)}`, `RRULE:${rule}`,
      `SUMMARY:${icsText(`💶 ${r.name}: ${num(r.amountCents)} €`)}`, ...alarm(r.name), 'END:VEVENT');
  }
  for (const o of state.oneTime.filter((x) => x.kind === 'expense' && x.date >= today)) {
    lines.push('BEGIN:VEVENT', `UID:${o.id}@finanzen`, stampLine, `DTSTART;VALUE=DATE:${icsDate(o.date)}`, `SUMMARY:${icsText(`💶 ${o.name}: ${num(o.amountCents)} €`)}`, ...alarm(o.name), 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return saveFile('zahlungen.ics', new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}
