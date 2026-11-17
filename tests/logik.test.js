import { describe, it, expect } from 'vitest';
import { parseBetrag, formatBetrag, datumImMonat } from '../src/geld.js';
import { leereDaten, wiederkehrendeAnwenden, kontoSaldo } from '../src/store.js';

describe('Beträge', () => {
  it('liest verschiedene Schreibweisen', () => {
    expect(parseBetrag('12')).toBe(1200);
    expect(parseBetrag('12.5')).toBe(1250);
    expect(parseBetrag('12,50')).toBe(1250);
    expect(parseBetrag("1'234.50")).toBe(123450);
    expect(parseBetrag('1’234,05')).toBe(123405);
    expect(parseBetrag('CHF 9.90')).toBe(990);
  });
  it('lehnt Ungültiges ab', () => {
    for (const t of ['', 'abc', '1.234', '-5', '1,2,3']) expect(parseBetrag(t)).toBeNull();
  });
  it('formatiert schweizerisch', () => {
    expect(formatBetrag(123450, 'CHF')).toBe('CHF 1’234.50');
    expect(formatBetrag(-5, 'EUR')).toBe('EUR −0.05');
  });
  it('kürzt Tag auf Monatsende', () => {
    expect(datumImMonat(2026, 2, 31)).toBe('2026-02-28');
  });
});

describe('Wiederkehrende Zahlungen', () => {
  it('legt pro Monat genau einmal an, auch nach Löschen nicht erneut', () => {
    const d = leereDaten();
    const k = d.konten[0];
    d.wiederkehrend.push({ id: 'm', art: 'ausgabe', betrag: 150000, kontoId: k.id, kategorieId: null, notiz: 'Miete', tag: 31, abMonat: '2026-01', bisMonat: '2026-03' });
    expect(wiederkehrendeAnwenden(d, 2025, 12)).toBe(false);
    expect(wiederkehrendeAnwenden(d, 2026, 2)).toBe(true);
    expect(d.buchungen[0].datum).toBe('2026-02-28');
    expect(wiederkehrendeAnwenden(d, 2026, 2)).toBe(false);
    d.buchungen = [];
    expect(wiederkehrendeAnwenden(d, 2026, 2)).toBe(false);
    expect(wiederkehrendeAnwenden(d, 2026, 4)).toBe(false);
    expect(kontoSaldo(d, k.id)).toBe(0);
  });
});
