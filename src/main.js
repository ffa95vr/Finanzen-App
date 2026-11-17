import './style.css';
import {
  parseBetrag, formatBetrag, monatKey, MONATE, MONATE_KURZ, formatDatum, summeProWaehrung,
} from './geld.js';
import {
  laden, speichern, neueId, leereDaten, konto, kategorie, waehrungVon, buchungenImMonat, kontoSaldo,
  wiederkehrendeAnwenden, ausgabenProKategorie, jahresVerlauf, pinHash, KONTO_TYPEN, WAEHRUNGEN,
} from './store.js';

// ---------- Zustand ----------
const heute = new Date();
let daten = laden();
const ui = {
  jahr: heute.getFullYear(),
  monat: heute.getMonth() + 1,
  tab: 'uebersicht',
  waehrung: 'CHF',
  entsperrt: !daten.einstellungen.pinHash,
};
let verstecktSeit = 0;

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mk = () => monatKey(ui.jahr, ui.monat);
const fmt = (r, w) => formatBetrag(r, w);

function sichern() {
  speichern(daten);
  render();
}

// Beim Monatswechsel fällige wiederkehrende Zahlungen anlegen
function monatOeffnen() {
  if (wiederkehrendeAnwenden(daten, ui.jahr, ui.monat)) speichern(daten);
}

/** Währungen, die in Konten verwendet werden (CHF zuerst). */
function genutzteWaehrungen() {
  const s = new Set(daten.konten.map((k) => k.waehrung));
  s.add('CHF');
  return [...s].sort((a, b) => (a === 'CHF' ? -1 : b === 'CHF' ? 1 : a.localeCompare(b)));
}

// ---------- Rendering ----------
function render() {
  if (!ui.entsperrt) return renderSperre();
  const tabs = [
    ['uebersicht', 'Übersicht', '◔'],
    ['buchungen', 'Buchungen', '☰'],
    ['konten', 'Konten', '▭'],
    ['budget', 'Budget', '◎'],
    ['mehr', 'Mehr', '⋯'],
  ];
  const inhalt = {
    uebersicht: renderUebersicht, buchungen: renderBuchungen, konten: renderKonten, budget: renderBudget, mehr: renderMehr,
  }[ui.tab]();
  const mitZeitraum = ['uebersicht', 'buchungen', 'budget'].includes(ui.tab);
  app.innerHTML = `
    <header class="kopf">
      <div class="kopf-zeile">
        <h1>Meine Finanzen</h1>
        ${daten.einstellungen.pinHash ? '<button class="icon-btn" data-a="sperren" aria-label="App sperren">🔒</button>' : ''}
      </div>
      ${mitZeitraum ? renderZeitraum() : ''}
    </header>
    <main class="inhalt">${inhalt}</main>
    ${['uebersicht', 'buchungen'].includes(ui.tab) ? '<button class="fab" data-a="neu" data-art="ausgabe" aria-label="Neue Buchung">+</button>' : ''}
    <nav class="tabs">
      ${tabs.map(([id, txt, ic]) => `<button class="${ui.tab === id ? 'aktiv' : ''}" data-a="tab" data-tab="${id}"><span>${ic}</span>${txt}</button>`).join('')}
    </nav>`;
  const aktiv = app.querySelector('.monat.aktiv');
  aktiv?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function renderZeitraum() {
  return `
    <div class="jahr-zeile">
      <button class="icon-btn" data-a="jahr" data-d="-1" aria-label="Vorheriges Jahr">‹</button>
      <label class="jahr-feld"><span class="sr">Jahr</span>
        <input id="jahr" type="number" inputmode="numeric" min="1990" max="2100" value="${ui.jahr}" />
      </label>
      <button class="icon-btn" data-a="jahr" data-d="1" aria-label="Nächstes Jahr">›</button>
    </div>
    <div class="monate" role="tablist">
      ${MONATE_KURZ.map((m, i) => `<button class="monat ${ui.monat === i + 1 ? 'aktiv' : ''}" data-a="monat" data-m="${i + 1}">${m}</button>`).join('')}
    </div>`;
}

function bilanzZeilen() {
  const liste = buchungenImMonat(daten, mk());
  const ein = summeProWaehrung(liste.filter((b) => b.art === 'einnahme').map((b) => ({ waehrung: waehrungVon(daten, b), betrag: b.betrag })));
  const aus = summeProWaehrung(liste.filter((b) => b.art === 'ausgabe').map((b) => ({ waehrung: waehrungVon(daten, b), betrag: b.betrag })));
  const ws = [...new Set([...Object.keys(ein), ...Object.keys(aus)])];
  if (!ws.length) ws.push('CHF');
  return ws.map((w) => ({ w, ein: ein[w] || 0, aus: aus[w] || 0, saldo: (ein[w] || 0) - (aus[w] || 0) }));
}

function renderUebersicht() {
  const zeilen = bilanzZeilen();
  const ws = genutzteWaehrungen();
  if (!ws.includes(ui.waehrung)) ui.waehrung = 'CHF';
  const w = ui.waehrung;
  return `
    <section class="karte">
      <h2>Bilanz ${MONATE[ui.monat - 1]} ${ui.jahr}</h2>
      ${zeilen.map((z) => `
        <div class="bilanz">
          ${zeilen.length > 1 ? `<div class="bilanz-w">${z.w}</div>` : ''}
          <div class="bilanz-reihe"><span>Einnahmen</span><b class="plus">${fmt(z.ein, z.w)}</b></div>
          <div class="bilanz-reihe"><span>Ausgaben</span><b class="minus">${fmt(z.aus, z.w)}</b></div>
          <div class="bilanz-reihe total"><span>${z.saldo >= 0 ? 'Überschuss' : 'Fehlbetrag'}</span><b class="${z.saldo >= 0 ? 'plus' : 'minus'}">${fmt(z.saldo, z.w)}</b></div>
          ${z.ein > 0 ? `<div class="sparquote">Sparquote: ${Math.round((z.saldo / z.ein) * 100)} %</div>` : ''}
        </div>`).join('')}
      <div class="knopf-reihe">
        <button class="btn ein" data-a="neu" data-art="einnahme">+ Einkommen</button>
        <button class="btn aus" data-a="neu" data-art="ausgabe">+ Ausgabe</button>
      </div>
    </section>

    ${ws.length > 1 ? `<div class="waehrung-wahl">Diagramme in: ${ws.map((x) => `<button class="chip ${x === w ? 'aktiv' : ''}" data-a="waehrung" data-w="${x}">${x}</button>`).join('')}</div>` : ''}

    <section class="karte">
      <h2>Ausgaben nach Kategorie</h2>
      ${renderDonut(ausgabenProKategorie(daten, mk(), w), w)}
    </section>

    <section class="karte">
      <h2>Jahresverlauf ${ui.jahr} <small>(${w})</small></h2>
      ${renderBalken(jahresVerlauf(daten, ui.jahr, w), w)}
    </section>

    <section class="karte">
      <h2>Kontostände</h2>
      ${daten.konten.map((k) => kontoZeile(k)).join('') || '<p class="leer">Noch keine Konten.</p>'}
    </section>`;
}

function renderDonut(teile, w) {
  const total = teile.reduce((s, t) => s + t.betrag, 0);
  if (!total) return '<p class="leer">Noch keine Ausgaben in diesem Monat.</p>';
  const R = 70, U = 2 * Math.PI * R;
  let offset = 0;
  const kreise = teile.map((t) => {
    const len = (t.betrag / total) * U;
    const c = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${t.kat.farbe}" stroke-width="28"
      stroke-dasharray="${len} ${U - len}" stroke-dashoffset="${-offset}" />`;
    offset += len;
    return c;
  }).join('');
  return `
    <div class="donut-box">
      <svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Ausgaben nach Kategorie">
        <g transform="rotate(-90 90 90)">${kreise}</g>
        <text x="90" y="86" text-anchor="middle" class="donut-klein">Total</text>
        <text x="90" y="106" text-anchor="middle" class="donut-gross">${fmt(total)}</text>
      </svg>
      <ul class="legende">
        ${teile.map((t) => `<li><i style="background:${t.kat.farbe}"></i><span>${esc(t.kat.name)}</span><b>${fmt(t.betrag, w)}</b><small>${Math.round((t.betrag / total) * 100)} %</small></li>`).join('')}
      </ul>
    </div>`;
}

function renderBalken(verlauf, w) {
  const max = Math.max(1, ...verlauf.flatMap((m) => [m.ein, m.aus]));
  if (max === 1) return '<p class="leer">Noch keine Buchungen in diesem Jahr.</p>';
  const B = 320, H = 150, sp = B / 12;
  const balken = verlauf.map((m, i) => {
    const x = i * sp;
    const he = (m.ein / max) * (H - 20), ha = (m.aus / max) * (H - 20);
    const akt = i + 1 === ui.monat;
    return `
      <g class="${akt ? 'akt' : ''}" data-a="monat" data-m="${i + 1}">
        ${akt ? `<rect x="${x + 1}" y="0" width="${sp - 2}" height="${H + 16}" rx="4" class="balken-markierung" />` : ''}
        <rect x="${x + 4}" y="${H - he}" width="${sp / 2 - 5}" height="${he}" rx="2" class="balken-ein" />
        <rect x="${x + sp / 2 + 1}" y="${H - ha}" width="${sp / 2 - 5}" height="${ha}" rx="2" class="balken-aus" />
        <text x="${x + sp / 2}" y="${H + 12}" text-anchor="middle" class="balken-text">${MONATE_KURZ[i][0]}</text>
      </g>`;
  }).join('');
  const jahr = verlauf.reduce((s, m) => ({ ein: s.ein + m.ein, aus: s.aus + m.aus }), { ein: 0, aus: 0 });
  return `
    <svg viewBox="0 0 ${B} ${H + 18}" class="balken" role="img" aria-label="Einnahmen und Ausgaben pro Monat">${balken}</svg>
    <div class="legende-zeile"><span><i class="ein"></i>Einnahmen</span><span><i class="aus"></i>Ausgaben</span></div>
    <div class="bilanz-reihe"><span>Jahr total Einnahmen</span><b class="plus">${fmt(jahr.ein, w)}</b></div>
    <div class="bilanz-reihe"><span>Jahr total Ausgaben</span><b class="minus">${fmt(jahr.aus, w)}</b></div>
    <div class="bilanz-reihe total"><span>Jahr Saldo</span><b class="${jahr.ein - jahr.aus >= 0 ? 'plus' : 'minus'}">${fmt(jahr.ein - jahr.aus, w)}</b></div>`;
}

function kontoZeile(k) {
  const s = kontoSaldo(daten, k.id);
  return `<button class="zeile" data-a="konto-bearbeiten" data-id="${k.id}">
    <span class="zeile-haupt"><b>${esc(k.name)}</b><small>${esc(k.typ)} · ${k.waehrung}</small></span>
    <b class="${s >= 0 ? '' : 'minus'}">${fmt(s, k.waehrung)}</b></button>`;
}

function buchungZeile(b) {
  const k = konto(daten, b.kontoId);
  const kat = kategorie(daten, b.kategorieId);
  const titel = b.notiz || (b.art === 'einnahme' ? 'Einkommen' : kat?.name || 'Ausgabe');
  return `<button class="zeile" data-a="buchung-bearbeiten" data-id="${b.id}">
    <i class="punkt" style="background:${b.art === 'einnahme' ? 'var(--plus)' : kat?.farbe || '#C8CBD2'}"></i>
    <span class="zeile-haupt"><b>${esc(titel)}${b.wiederkehrendId ? ' <span class="wdh" title="wiederkehrend">↻</span>' : ''}</b>
      <small>${formatDatum(b.datum)} · ${esc(k?.name || '–')}${b.art === 'ausgabe' && b.notiz && kat ? ' · ' + esc(kat.name) : ''}</small></span>
    <b class="${b.art === 'einnahme' ? 'plus' : 'minus'}">${b.art === 'einnahme' ? '+' : '−'}${fmt(b.betrag, k?.waehrung)}</b></button>`;
}

function renderBuchungen() {
  const liste = buchungenImMonat(daten, mk());
  const ein = liste.filter((b) => b.art === 'einnahme');
  const aus = liste.filter((b) => b.art === 'ausgabe');
  return `
    <section class="karte">
      <div class="titel-zeile"><h2>Einkommen</h2><button class="btn klein ein" data-a="neu" data-art="einnahme">+ Einkommen</button></div>
      ${ein.map(buchungZeile).join('') || '<p class="leer">Noch kein Einkommen erfasst.</p>'}
    </section>
    <section class="karte">
      <div class="titel-zeile"><h2>Ausgaben <small>(${aus.length})</small></h2><button class="btn klein aus" data-a="neu" data-art="ausgabe">+ Ausgabe</button></div>
      ${aus.map(buchungZeile).join('') || '<p class="leer">Noch keine Ausgaben erfasst.</p>'}
    </section>`;
}

function renderKonten() {
  const totals = summeProWaehrung(daten.konten.map((k) => ({ waehrung: k.waehrung, betrag: kontoSaldo(daten, k.id) })));
  return `
    <section class="karte">
      <div class="titel-zeile"><h2>Konten</h2><button class="btn klein" data-a="konto-neu">+ Konto</button></div>
      ${daten.konten.map(kontoZeile).join('') || '<p class="leer">Noch keine Konten.</p>'}
    </section>
    <section class="karte">
      <h2>Vermögen total</h2>
      ${Object.entries(totals).map(([w, s]) => `<div class="bilanz-reihe total"><span>${w}</span><b class="${s >= 0 ? 'plus' : 'minus'}">${fmt(s, w)}</b></div>`).join('')}
      <p class="hinweis">Kreditkarten mit offenem Betrag haben einen negativen Saldo und werden abgezogen.</p>
    </section>`;
}

function renderBudget() {
  const ausgaben = new Map(ausgabenProKategorie(daten, mk(), 'CHF').map((t) => [t.kat.id, t.betrag]));
  const mitBudget = daten.kategorien.filter((k) => k.budget > 0);
  const ohne = daten.kategorien.filter((k) => !(k.budget > 0));
  const zeile = (k) => {
    const ist = ausgaben.get(k.id) || 0;
    const p = k.budget ? ist / k.budget : 0;
    const klasse = p > 1 ? 'ueber' : p > 0.85 ? 'knapp' : '';
    return `<button class="zeile budget ${klasse}" data-a="kategorie-bearbeiten" data-id="${k.id}">
      <i class="punkt" style="background:${k.farbe}"></i>
      <span class="zeile-haupt"><b>${esc(k.name)}</b>
        ${k.budget ? `<span class="balken-voll"><span style="width:${Math.min(100, p * 100)}%"></span></span>
        <small>${fmt(ist, 'CHF')} von ${fmt(k.budget, 'CHF')} · ${p > 1 ? `<span class="minus">${fmt(ist - k.budget)} drüber</span>` : `noch ${fmt(k.budget - ist)}`}</small>`
        : `<small>${ist ? fmt(ist, 'CHF') + ' ausgegeben · ' : ''}kein Budget</small>`}
      </span></button>`;
  };
  const sumB = mitBudget.reduce((s, k) => s + k.budget, 0);
  const sumI = mitBudget.reduce((s, k) => s + (ausgaben.get(k.id) || 0), 0);
  return `
    <section class="karte">
      <h2>Budget ${MONATE[ui.monat - 1]} <small>(CHF)</small></h2>
      ${mitBudget.length ? `<div class="bilanz-reihe total"><span>Total</span><b>${fmt(sumI)} / ${fmt(sumB, 'CHF')}</b></div>` : '<p class="hinweis">Tippe auf eine Kategorie, um ein Monatsbudget festzulegen.</p>'}
      ${mitBudget.map(zeile).join('')}
    </section>
    <section class="karte">
      <div class="titel-zeile"><h2>Kategorien</h2><button class="btn klein" data-a="kategorie-neu">+ Kategorie</button></div>
      ${ohne.map(zeile).join('') || '<p class="leer">Alle Kategorien haben ein Budget.</p>'}
    </section>`;
}

function renderMehr() {
  const pin = !!daten.einstellungen.pinHash;
  return `
    <section class="karte">
      <div class="titel-zeile"><h2>Wiederkehrende Zahlungen</h2><button class="btn klein" data-a="wdh-neu">+ Neu</button></div>
      <p class="hinweis">Werden automatisch in jedem Monat eingetragen, sobald du ihn öffnest.</p>
      ${daten.wiederkehrend.map((v) => {
        const k = konto(daten, v.kontoId);
        const kat = kategorie(daten, v.kategorieId);
        return `<button class="zeile" data-a="wdh-bearbeiten" data-id="${v.id}">
          <i class="punkt" style="background:${v.art === 'einnahme' ? 'var(--plus)' : kat?.farbe || '#ccc'}"></i>
          <span class="zeile-haupt"><b>${esc(v.notiz || kat?.name || (v.art === 'einnahme' ? 'Einkommen' : 'Ausgabe'))}</b>
          <small>am ${v.tag}. · ab ${v.abMonat.split('-').reverse().join('.')}${v.bisMonat ? ' bis ' + v.bisMonat.split('-').reverse().join('.') : ''} · ${esc(k?.name || '–')}</small></span>
          <b class="${v.art === 'einnahme' ? 'plus' : 'minus'}">${fmt(v.betrag, k?.waehrung)}</b></button>`;
      }).join('') || '<p class="leer">Noch keine, z. B. Miete, Krankenkasse, Lohn.</p>'}
    </section>
    <section class="karte">
      <h2>Sperre</h2>
      <p class="hinweis">${pin ? 'Die App ist mit einem PIN geschützt.' : 'Ohne PIN kann jeder mit deinem entsperrten Handy die App öffnen.'}</p>
      <div class="knopf-reihe">
        <button class="btn" data-a="pin-setzen">${pin ? 'PIN ändern' : 'PIN festlegen'}</button>
        ${pin ? '<button class="btn grau" data-a="pin-entfernen">PIN entfernen</button>' : ''}
      </div>
    </section>
    <section class="karte">
      <h2>Datensicherung</h2>
      <p class="hinweis">Deine Daten liegen nur auf diesem Gerät. Wenn du den Browser-Speicher löschst, sind sie weg. Mache ab und zu eine Sicherung.</p>
      <div class="knopf-reihe">
        <button class="btn" data-a="export">Sicherung speichern</button>
        <label class="btn grau">Sicherung laden<input type="file" accept="application/json,.json" id="import" hidden /></label>
      </div>
    </section>
    <section class="karte">
      <h2>Datenschutz</h2>
      <p class="hinweis">Keine Anmeldung, kein Tracking, keine Übertragung ins Internet. Alle Einträge bleiben im Speicher dieses Browsers auf diesem Gerät.</p>
      <button class="btn rot" data-a="alles-loeschen">Alle Daten löschen</button>
    </section>`;
}

function renderSperre(fehler = '') {
  app.innerHTML = `
    <div class="sperre">
      <div class="sperre-logo">🔒</div>
      <h1>Meine Finanzen</h1>
      <form id="pin-form">
        <input id="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]*" maxlength="6" placeholder="PIN" aria-label="PIN" autofocus />
        <button class="btn" type="submit">Entsperren</button>
        <p class="fehler">${esc(fehler)}</p>
      </form>
    </div>`;
  app.querySelector('#pin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = app.querySelector('#pin').value;
    if ((await pinHash(pin)) === daten.einstellungen.pinHash) {
      ui.entsperrt = true;
      monatOeffnen();
      render();
    } else renderSperre('Falscher PIN');
  });
  setTimeout(() => app.querySelector('#pin')?.focus(), 50);
}

// ---------- Bottom Sheet (Formulare) ----------
function sheet(titel, html, onSubmit, extra) {
  const el = document.createElement('div');
  el.className = 'sheet-hg';
  el.innerHTML = `
    <form class="sheet" novalidate>
      <div class="titel-zeile"><h2>${titel}</h2><button type="button" class="icon-btn" data-zu aria-label="Schliessen">✕</button></div>
      ${html}
      <p class="fehler" data-fehler></p>
      <div class="knopf-reihe">
        ${extra?.loeschen ? '<button type="button" class="btn rot" data-loeschen>Löschen</button>' : ''}
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`;
  const zu = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-zu]')) zu(); });
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const fehler = await onSubmit(f, form);
    if (fehler) el.querySelector('[data-fehler]').textContent = fehler;
    else { zu(); sichern(); }
  });
  el.querySelector('[data-loeschen]')?.addEventListener('click', () => {
    if (confirm(extra.loeschenFrage || 'Wirklich löschen?')) { extra.loeschen(); zu(); sichern(); }
  });
  document.body.appendChild(el);
  extra?.onMount?.(form);
  return el;
}

const optionen = (liste, wert) => liste.map(([v, t]) => `<option value="${esc(v)}" ${v === wert ? 'selected' : ''}>${esc(t)}</option>`).join('');
const kontoOptionen = (wert) => optionen(daten.konten.map((k) => [k.id, `${k.name} (${k.waehrung})`]), wert);
const katOptionen = (wert) => optionen([['', '– ohne –'], ...daten.kategorien.map((k) => [k.id, k.name])], wert || '');

function buchungFormular(b, artNeu) {
  if (!daten.konten.length) { alert('Lege zuerst ein Konto an (Tab „Konten“).'); return; }
  const neu = !b;
  const art = b?.art || artNeu;
  const istHeuteMonat = ui.jahr === heute.getFullYear() && ui.monat === heute.getMonth() + 1;
  const datum = b?.datum || `${mk()}-${String(istHeuteMonat ? heute.getDate() : 1).padStart(2, '0')}`;
  const html = `
    <div class="segment">
      <label><input type="radio" name="art" value="ausgabe" ${art === 'ausgabe' ? 'checked' : ''}/><span>Ausgabe</span></label>
      <label><input type="radio" name="art" value="einnahme" ${art === 'einnahme' ? 'checked' : ''}/><span>Einkommen</span></label>
    </div>
    <label class="feld">Betrag<input name="betrag" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${b ? formatBetrag(b.betrag).replace(/’/g, '') : ''}" required /></label>
    <label class="feld">Beschreibung<input name="notiz" maxlength="80" placeholder="${art === 'einnahme' ? 'z. B. Lohn' : 'z. B. Migros'}" value="${esc(b?.notiz || '')}" /></label>
    <label class="feld" data-nur-ausgabe>Kategorie<select name="kategorieId">${katOptionen(b?.kategorieId)}</select></label>
    <div class="feld-paar">
      <label class="feld">Datum<input type="date" name="datum" value="${datum}" required /></label>
      <label class="feld">Konto<select name="kontoId">${kontoOptionen(b?.kontoId || daten.konten[0].id)}</select></label>
    </div>
    ${neu ? '<label class="check"><input type="checkbox" name="wdh" /> Jeden Monat wiederholen</label>' : ''}
    ${b?.wiederkehrendId ? '<p class="hinweis">↻ Aus einer wiederkehrenden Zahlung. Änderungen gelten nur für diesen Monat.</p>' : ''}`;
  sheet(neu ? (art === 'einnahme' ? 'Einkommen erfassen' : 'Ausgabe erfassen') : 'Buchung bearbeiten', html, (f) => {
    const betrag = parseBetrag(f.betrag);
    if (!betrag) return 'Bitte einen gültigen Betrag eingeben, z. B. 45.50';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.datum)) return 'Bitte ein Datum wählen.';
    const eintrag = {
      art: f.art, betrag, datum: f.datum, kontoId: f.kontoId,
      kategorieId: f.art === 'ausgabe' ? f.kategorieId || null : null, notiz: f.notiz.trim(),
    };
    if (neu) {
      const nb = { id: neueId(), ...eintrag, wiederkehrendId: null };
      if (f.wdh) {
        const v = { id: neueId(), art: f.art, betrag, kontoId: f.kontoId, kategorieId: eintrag.kategorieId, notiz: eintrag.notiz, tag: Number(f.datum.slice(8)), abMonat: f.datum.slice(0, 7), bisMonat: null };
        daten.wiederkehrend.push(v);
        daten.erzeugt[v.id] = [v.abMonat];
        nb.wiederkehrendId = v.id;
      }
      daten.buchungen.push(nb);
    } else Object.assign(b, eintrag);
    // Zum Monat der Buchung springen
    ui.jahr = Number(f.datum.slice(0, 4));
    ui.monat = Number(f.datum.slice(5, 7));
    monatOeffnen();
  }, {
    loeschen: neu ? null : () => { daten.buchungen = daten.buchungen.filter((x) => x !== b); },
    onMount: (form) => {
      const update = () => {
        const a = form.querySelector('[name=art]:checked').value;
        form.querySelector('[data-nur-ausgabe]').hidden = a !== 'ausgabe';
      };
      form.querySelectorAll('[name=art]').forEach((r) => r.addEventListener('change', update));
      update();
      if (neu) setTimeout(() => form.querySelector('[name=betrag]').focus(), 50);
    },
  });
}

function kontoFormular(k) {
  const neu = !k;
  const html = `
    <label class="feld">Name<input name="name" maxlength="40" placeholder="z. B. UBS Sparkonto" value="${esc(k?.name || '')}" required /></label>
    <div class="feld-paar">
      <label class="feld">Art<select name="typ">${optionen(KONTO_TYPEN.map((t) => [t, t]), k?.typ || 'Sparkonto')}</select></label>
      <label class="feld">Währung<select name="waehrung">${optionen(WAEHRUNGEN.map((w) => [w, w]), k?.waehrung || 'CHF')}</select></label>
    </div>
    <label class="feld">Anfangssaldo<input name="startSaldo" inputmode="decimal" placeholder="0.00" value="${k ? formatBetrag(k.startSaldo).replace(/’/g, '').replace('−', '-') : ''}" /></label>
    <p class="hinweis">Stand des Kontos vor der ersten Buchung. Bei Kreditkarten mit offenem Betrag ein Minus davor, z. B. -350.00</p>`;
  const anzahl = k ? daten.buchungen.filter((b) => b.kontoId === k.id).length : 0;
  sheet(neu ? 'Konto anlegen' : 'Konto bearbeiten', html, (f) => {
    const name = f.name.trim();
    if (!name) return 'Bitte einen Namen eingeben.';
    const s = f.startSaldo.trim();
    const minus = s.startsWith('-') || s.startsWith('−');
    const wert = s ? parseBetrag(s.replace(/^[-−]/, '')) : 0;
    if (wert === null) return 'Anfangssaldo ist ungültig.';
    const eintrag = { name, typ: f.typ, waehrung: f.waehrung, startSaldo: minus ? -wert : wert };
    if (neu) daten.konten.push({ id: neueId(), ...eintrag }); else Object.assign(k, eintrag);
  }, {
    loeschen: neu ? null : () => {
      daten.buchungen = daten.buchungen.filter((b) => b.kontoId !== k.id);
      daten.wiederkehrend = daten.wiederkehrend.filter((v) => v.kontoId !== k.id);
      daten.konten = daten.konten.filter((x) => x !== k);
    },
    loeschenFrage: anzahl ? `Konto „${k?.name}“ und seine ${anzahl} Buchungen wirklich löschen?` : 'Konto wirklich löschen?',
  });
}

function kategorieFormular(k) {
  const neu = !k;
  const html = `
    <label class="feld">Name<input name="name" maxlength="30" value="${esc(k?.name || '')}" required /></label>
    <div class="feld-paar">
      <label class="feld">Monatsbudget (CHF)<input name="budget" inputmode="decimal" placeholder="kein Budget" value="${k?.budget ? formatBetrag(k.budget).replace(/’/g, '') : ''}" /></label>
      <label class="feld">Farbe<input type="color" name="farbe" value="${k?.farbe || '#5B7FDB'}" /></label>
    </div>`;
  sheet(neu ? 'Kategorie anlegen' : 'Kategorie bearbeiten', html, (f) => {
    const name = f.name.trim();
    if (!name) return 'Bitte einen Namen eingeben.';
    if (daten.kategorien.some((x) => x !== k && x.name.toLowerCase() === name.toLowerCase())) return 'Diese Kategorie gibt es schon.';
    const budget = f.budget.trim() ? parseBetrag(f.budget) : 0;
    if (budget === null) return 'Budget ist ungültig.';
    const eintrag = { name, farbe: f.farbe, budget };
    if (neu) daten.kategorien.push({ id: neueId(), ...eintrag }); else Object.assign(k, eintrag);
  }, {
    loeschen: neu ? null : () => {
      daten.buchungen.forEach((b) => { if (b.kategorieId === k.id) b.kategorieId = null; });
      daten.wiederkehrend.forEach((v) => { if (v.kategorieId === k.id) v.kategorieId = null; });
      daten.kategorien = daten.kategorien.filter((x) => x !== k);
    },
    loeschenFrage: 'Kategorie löschen? Buchungen bleiben erhalten, aber ohne Kategorie.',
  });
}

function wdhFormular(v) {
  if (!daten.konten.length) { alert('Lege zuerst ein Konto an.'); return; }
  const neu = !v;
  const html = `
    <div class="segment">
      <label><input type="radio" name="art" value="ausgabe" ${(v?.art || 'ausgabe') === 'ausgabe' ? 'checked' : ''}/><span>Ausgabe</span></label>
      <label><input type="radio" name="art" value="einnahme" ${v?.art === 'einnahme' ? 'checked' : ''}/><span>Einkommen</span></label>
    </div>
    <label class="feld">Betrag<input name="betrag" inputmode="decimal" placeholder="0.00" value="${v ? formatBetrag(v.betrag).replace(/’/g, '') : ''}" required /></label>
    <label class="feld">Beschreibung<input name="notiz" maxlength="80" placeholder="z. B. Miete" value="${esc(v?.notiz || '')}" /></label>
    <div class="feld-paar">
      <label class="feld" data-nur-ausgabe>Kategorie<select name="kategorieId">${katOptionen(v?.kategorieId)}</select></label>
      <label class="feld">Konto<select name="kontoId">${kontoOptionen(v?.kontoId || daten.konten[0].id)}</select></label>
    </div>
    <div class="feld-paar">
      <label class="feld">Tag im Monat<input name="tag" type="number" inputmode="numeric" min="1" max="31" value="${v?.tag || 1}" /></label>
      <label class="feld">Ab Monat<input name="abMonat" type="month" value="${v?.abMonat || mk()}" /></label>
    </div>
    <label class="feld">Bis Monat (leer = unbegrenzt)<input name="bisMonat" type="month" value="${v?.bisMonat || ''}" /></label>
    <p class="hinweis">Änderungen gelten für Monate, die noch nicht eingetragen wurden.</p>`;
  sheet(neu ? 'Wiederkehrende Zahlung' : 'Wiederkehrende Zahlung bearbeiten', html, (f) => {
    const betrag = parseBetrag(f.betrag);
    if (!betrag) return 'Bitte einen gültigen Betrag eingeben.';
    const tag = Number(f.tag);
    if (!(tag >= 1 && tag <= 31)) return 'Tag muss zwischen 1 und 31 liegen.';
    if (!/^\d{4}-\d{2}$/.test(f.abMonat)) return 'Bitte „Ab Monat“ wählen.';
    if (f.bisMonat && f.bisMonat < f.abMonat) return '„Bis“ liegt vor „Ab“.';
    const eintrag = {
      art: f.art, betrag, kontoId: f.kontoId, kategorieId: f.art === 'ausgabe' ? f.kategorieId || null : null,
      notiz: f.notiz.trim(), tag, abMonat: f.abMonat, bisMonat: f.bisMonat || null,
    };
    if (neu) daten.wiederkehrend.push({ id: neueId(), ...eintrag }); else Object.assign(v, eintrag);
    monatOeffnen();
  }, {
    loeschen: neu ? null : () => {
      daten.wiederkehrend = daten.wiederkehrend.filter((x) => x !== v);
      delete daten.erzeugt[v.id];
      daten.buchungen.forEach((b) => { if (b.wiederkehrendId === v.id) b.wiederkehrendId = null; });
    },
    loeschenFrage: 'Wiederkehrende Zahlung beenden? Bereits eingetragene Buchungen bleiben.',
    onMount: (form) => {
      const update = () => { form.querySelector('[data-nur-ausgabe]').hidden = form.querySelector('[name=art]:checked').value !== 'ausgabe'; };
      form.querySelectorAll('[name=art]').forEach((r) => r.addEventListener('change', update));
      update();
    },
  });
}

function pinFormular() {
  sheet('PIN festlegen', `
    <label class="feld">Neuer PIN (4–6 Ziffern)<input name="p1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" /></label>
    <label class="feld">PIN wiederholen<input name="p2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" /></label>
    <p class="hinweis">Merke dir den PIN gut. Vergessen = Daten nur noch über eine Sicherung wiederherstellbar.</p>`, async (f) => {
    if (!/^\d{4,6}$/.test(f.p1)) return 'Der PIN muss 4 bis 6 Ziffern haben.';
    if (f.p1 !== f.p2) return 'Die beiden PINs stimmen nicht überein.';
    daten.einstellungen.pinHash = await pinHash(f.p1);
  });
}

// ---------- Sicherung ----------
function exportieren() {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finanzen-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importieren(datei) {
  try {
    const neu = JSON.parse(await datei.text());
    if (!Array.isArray(neu.konten) || !Array.isArray(neu.buchungen)) throw new Error();
    if (!confirm(`Sicherung laden? Die aktuellen Daten werden durch ${neu.buchungen.length} Buchungen und ${neu.konten.length} Konten ersetzt.`)) return;
    daten = { ...leereDaten(), ...neu };
    ui.entsperrt = true;
    sichern();
  } catch {
    alert('Diese Datei ist keine gültige Sicherung.');
  }
}

// ---------- Ereignisse ----------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.a) {
    case 'tab': ui.tab = el.dataset.tab; window.scrollTo(0, 0); render(); break;
    case 'monat': ui.monat = Number(el.dataset.m); monatOeffnen(); render(); break;
    case 'jahr': ui.jahr += Number(el.dataset.d); monatOeffnen(); render(); break;
    case 'waehrung': ui.waehrung = el.dataset.w; render(); break;
    case 'neu': buchungFormular(null, el.dataset.art); break;
    case 'buchung-bearbeiten': buchungFormular(daten.buchungen.find((b) => b.id === id)); break;
    case 'konto-neu': kontoFormular(); break;
    case 'konto-bearbeiten': kontoFormular(konto(daten, id)); break;
    case 'kategorie-neu': kategorieFormular(); break;
    case 'kategorie-bearbeiten': kategorieFormular(kategorie(daten, id)); break;
    case 'wdh-neu': wdhFormular(); break;
    case 'wdh-bearbeiten': wdhFormular(daten.wiederkehrend.find((v) => v.id === id)); break;
    case 'pin-setzen': pinFormular(); break;
    case 'pin-entfernen':
      if (confirm('PIN entfernen? Dann kann jeder mit deinem Handy die App öffnen.')) { daten.einstellungen.pinHash = null; sichern(); }
      break;
    case 'sperren': ui.entsperrt = false; render(); break;
    case 'export': exportieren(); break;
    case 'alles-loeschen':
      if (confirm('Wirklich ALLE Daten auf diesem Gerät löschen? Das kann nicht rückgängig gemacht werden.')
        && confirm('Ganz sicher? Hast du vorher eine Sicherung gespeichert?')) {
        daten = leereDaten();
        ui.entsperrt = true;
        sichern();
      }
      break;
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'jahr') {
    const j = Number(e.target.value);
    if (j >= 1990 && j <= 2100) { ui.jahr = j; monatOeffnen(); }
    render();
  }
  if (e.target.id === 'import' && e.target.files[0]) importieren(e.target.files[0]);
});

// Nach 60 s im Hintergrund wieder sperren
document.addEventListener('visibilitychange', () => {
  if (document.hidden) verstecktSeit = Date.now();
  else if (daten.einstellungen.pinHash && ui.entsperrt && Date.now() - verstecktSeit > 60_000 && verstecktSeit) {
    ui.entsperrt = false;
    document.querySelectorAll('.sheet-hg').forEach((s) => s.remove());
    render();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

if (ui.entsperrt) monatOeffnen();
render();
