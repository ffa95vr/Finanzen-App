// Hilfsfunktionen für Beträge und Datum.
// Beträge werden intern immer als ganze Rappen/Cents (Ganzzahl) gespeichert.

/**
 * Liest einen eingegebenen Betrag ein und gibt Rappen zurück (oder null bei ungültig).
 * Akzeptiert: "12", "12.5", "12,50", "1'234.50", "1’234,50", "1 234.50", "CHF 12.50".
 */
export function parseBetrag(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/^[A-Za-z]{3}\s*/, '').replace(/['’\s]/g, '');
  if (s === '') return null;
  // Komma als Dezimaltrenner zulassen
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [fr, rp = ''] = s.split('.');
  const rappen = Number(fr) * 100 + Number((rp + '00').slice(0, 2));
  return Number.isSafeInteger(rappen) ? rappen : null;
}

/** Formatiert Rappen als Schweizer Betrag, z. B. 123450 -> "1’234.50". */
export function formatBetrag(rappen, waehrung) {
  const neg = rappen < 0;
  const abs = Math.abs(Math.round(rappen));
  const fr = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  const rp = String(abs % 100).padStart(2, '0');
  const zahl = `${neg ? '−' : ''}${fr}.${rp}`;
  return waehrung ? `${waehrung} ${zahl}` : zahl;
}

/** Monatsschlüssel "2026-11" aus Jahr und Monat (1–12). */
export function monatKey(jahr, monat) {
  return `${jahr}-${String(monat).padStart(2, '0')}`;
}

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Anzahl Tage im Monat. */
export function tageImMonat(jahr, monat) {
  return new Date(jahr, monat, 0).getDate();
}

/** Datum für einen bestimmten Tag im Monat; zu grosse Tage werden auf den Monatsletzten gekürzt. */
export function datumImMonat(jahr, monat, tag) {
  const t = Math.min(Math.max(1, tag), tageImMonat(jahr, monat));
  return `${monatKey(jahr, monat)}-${String(t).padStart(2, '0')}`;
}

/** "2026-11-05" -> "05.11.2026" */
export function formatDatum(iso) {
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

/** Summen pro Währung: { CHF: 1200, EUR: 50 } */
export function summeProWaehrung(liste) {
  const out = {};
  for (const { waehrung, betrag } of liste) out[waehrung] = (out[waehrung] || 0) + betrag;
  return out;
}
