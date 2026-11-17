// Datenhaltung: alles liegt nur lokal im Browser des Geräts (localStorage).
// Nichts wird ins Internet gesendet.
import { monatKey, datumImMonat } from './geld.js';

export const SPEICHER_KEY = 'finanzen_v1';

export const KONTO_TYPEN = ['Privatkonto', 'Sparkonto', 'Kreditkarte', 'Bargeld', 'Andere'];
export const WAEHRUNGEN = ['CHF', 'EUR', 'USD', 'GBP'];

const STANDARD_KATEGORIEN = [
  ['Wohnen', '#5B7FDB'], ['Lebensmittel', '#3FA36B'], ['Verkehr', '#E0913A'],
  ['Versicherungen', '#8E6BD1'], ['Freizeit', '#D9577A'], ['Abos', '#2FA7B5'],
  ['Gesundheit', '#C0A030'], ['Steuern', '#7A7F8C'], ['Sonstiges', '#A0A4AD'],
];

export function neueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function leereDaten() {
  return {
    version: 1,
    einstellungen: { pinHash: null },
    konten: [{ id: neueId(), name: 'Privatkonto', typ: 'Privatkonto', waehrung: 'CHF', startSaldo: 0 }],
    kategorien: STANDARD_KATEGORIEN.map(([name, farbe]) => ({ id: neueId(), name, farbe, budget: 0 })),
    // Buchungen: { id, art: 'einnahme'|'ausgabe', datum: 'YYYY-MM-DD', betrag (Rappen), kontoId, kategorieId, notiz, wiederkehrendId }
    buchungen: [],
    // Vorlagen: { id, art, betrag, kontoId, kategorieId, notiz, tag (1–31), abMonat 'YYYY-MM', bisMonat|null }
    wiederkehrend: [],
    // Welche Vorlage wurde für welchen Monat schon angelegt: { [vorlageId]: ['2026-11', ...] }
    erzeugt: {},
  };
}

export function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER_KEY);
    if (!roh) return leereDaten();
    return { ...leereDaten(), ...JSON.parse(roh) };
  } catch {
    return leereDaten();
  }
}

export function speichern(daten) {
  localStorage.setItem(SPEICHER_KEY, JSON.stringify(daten));
}

export const konto = (d, id) => d.konten.find((k) => k.id === id);
export const kategorie = (d, id) => d.kategorien.find((k) => k.id === id);

/** Währung einer Buchung = Währung ihres Kontos. */
export function waehrungVon(d, b) {
  return konto(d, b.kontoId)?.waehrung || 'CHF';
}

export function buchungenImMonat(d, mk) {
  return d.buchungen
    .filter((b) => b.datum.startsWith(mk + '-'))
    .sort((a, b) => b.datum.localeCompare(a.datum) || b.id.localeCompare(a.id));
}

/** Aktueller Saldo eines Kontos über alle Monate. */
export function kontoSaldo(d, kontoId) {
  const k = konto(d, kontoId);
  let s = k ? k.startSaldo || 0 : 0;
  for (const b of d.buchungen) {
    if (b.kontoId !== kontoId) continue;
    s += b.art === 'einnahme' ? b.betrag : -b.betrag;
  }
  return s;
}

/**
 * Legt fällige wiederkehrende Zahlungen für einen Monat an (einmalig pro Monat).
 * Wird eine so erzeugte Buchung gelöscht, kommt sie nicht wieder.
 * Gibt true zurück, wenn etwas neu angelegt wurde.
 */
export function wiederkehrendeAnwenden(d, jahr, monat) {
  const mk = monatKey(jahr, monat);
  let neu = false;
  for (const v of d.wiederkehrend) {
    if (mk < v.abMonat) continue;
    if (v.bisMonat && mk > v.bisMonat) continue;
    const liste = (d.erzeugt[v.id] ||= []);
    if (liste.includes(mk)) continue;
    liste.push(mk);
    d.buchungen.push({
      id: neueId(), art: v.art, datum: datumImMonat(jahr, monat, v.tag), betrag: v.betrag,
      kontoId: v.kontoId, kategorieId: v.kategorieId, notiz: v.notiz, wiederkehrendId: v.id,
    });
    neu = true;
  }
  return neu;
}

/** Ausgaben eines Monats pro Kategorie (nur eine Währung). */
export function ausgabenProKategorie(d, mk, waehrung) {
  const map = new Map();
  for (const b of buchungenImMonat(d, mk)) {
    if (b.art !== 'ausgabe' || waehrungVon(d, b) !== waehrung) continue;
    map.set(b.kategorieId, (map.get(b.kategorieId) || 0) + b.betrag);
  }
  return [...map.entries()]
    .map(([id, betrag]) => ({ kat: kategorie(d, id) || { name: 'Ohne Kategorie', farbe: '#C8CBD2' }, betrag }))
    .sort((a, b) => b.betrag - a.betrag);
}

/** Einnahmen/Ausgaben pro Monat eines Jahres (eine Währung). */
export function jahresVerlauf(d, jahr, waehrung) {
  const out = Array.from({ length: 12 }, () => ({ ein: 0, aus: 0 }));
  for (const b of d.buchungen) {
    if (!b.datum.startsWith(jahr + '-') || waehrungVon(d, b) !== waehrung) continue;
    const m = Number(b.datum.slice(5, 7)) - 1;
    if (b.art === 'einnahme') out[m].ein += b.betrag; else out[m].aus += b.betrag;
  }
  return out;
}

/** Einfache Prüfsumme für den PIN (SHA-256, wenn verfügbar). */
export async function pinHash(pin) {
  const text = 'finanzen-app:' + pin;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return 'sha256:' + [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (z. B. unverschlüsseltes http im lokalen Netz beim Testen)
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return 'fnv:' + h.toString(16);
}
