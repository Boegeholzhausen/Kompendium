/**
 * Platzhalter-Inhalt fuer den Viewer.
 *
 * Der Viewer zeigt laut Handoff-Dokument eine WebView mit lokal gespeichertem
 * HTML. Der Dateicache entsteht erst mit dem Import (Schritt 6), bis dahin
 * erzeugt dieses Modul zu jedem Dokument eine Seite im Stil des Prototyps
 * (helles Papier, Georgia, ein Goldton als Akzent).
 *
 * Wichtig: das ist **Beispielinhalt, kein Designsystem**. Echte Dokumente
 * bringen ihre eigene Gestaltung mit; die App gestaltet dort nichts und legt
 * insbesondere kein Stylesheet ueber fremdes HTML. Genau deshalb stehen die
 * Farben in `theme/colors.ts` unter `sampleDocument` und nicht unter den
 * Tokens — sie gehoeren zum Inhalt, nicht zur App.
 *
 * Der Aufbau richtet sich nach dem erkannten Dokumenttyp, damit die generierte
 * Kachel und das geoeffnete Dokument dasselbe erzaehlen.
 */
import { sampleDocument as paper } from '../theme/colors';
import type { DocType } from '../theme/tile';

interface DocumentSource {
  id: string;
  title: string;
  docType: DocType;
  folderName: string | null;
}

/** Kopfzeile ueber dem Titel — dieselbe Zeile wie auf Blatt `2b`. */
function kicker(document: DocumentSource): string {
  const context = document.folderName ?? 'Nicht einsortiert';
  return `${context} · August 2026`;
}

function bars(values: number[], labels: string[], highlight: number): string {
  const columns = values
    .map(
      (value, index) =>
        `<div style="flex:1;height:${value}%;background:${
          index === highlight ? paper.accent : paper.bar
        };border-radius:3px 3px 0 0"></div>`
    )
    .join('');
  const legend = labels
    .map((label) => `<span style="flex:1;text-align:center">${label}</span>`)
    .join('');

  return `
    <div class="card">
      <div class="card-title">Rendite nach Quartal</div>
      <div style="margin-top:14px;height:120px;display:flex;align-items:flex-end;gap:10px">${columns}</div>
      <div class="axis">${legend}</div>
    </div>`;
}

function table(rows: [string, string][]): string {
  const body = rows
    .map(
      ([label, value], index) =>
        `<tr${index === rows.length - 1 ? ' class="last"' : ''}><td>${label}</td><td class="num">${value}</td></tr>`
    )
    .join('');
  return `<table>${body}</table>`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function bodyFor(document: DocumentSource): string {
  switch (document.docType) {
    case 'chart':
      return `
        <p>Die Quartalsrendite liegt bei 4,2 % gegenüber 2,8 % im Vorquartal. Der Anleiheanteil wurde von 22 % auf 18 % reduziert.</p>
        ${bars([42, 58, 36, 74], ['Q4', 'Q1', 'Q2', 'Q3'], 3)}
        ${table([
          ['Aktien global', '62 %'],
          ['Anleihen', '18 %'],
          ['Liquidität', '20 %'],
        ])}
        <h2>Annahmen</h2>
        <p>Gerechnet wird mit einer Inflation von 2,1 % und einer nominalen Zielrendite von 6 % vor Steuern.</p>
        <blockquote>Nächste Prüfung im Oktober, dann Rebalancing auf die Zielquote 60 / 20 / 20.</blockquote>`;

    case 'table':
      return `
        <p>Gegenüberstellung der geprüften Angebote. Preise ohne Umsatzsteuer, Stand August 2026.</p>
        ${table([
          ['Anbieter A', '42,00 €'],
          ['Anbieter B', '38,50 €'],
          ['Anbieter C', '51,20 €'],
          ['Anbieter D', '36,90 €'],
        ])}
        <h2>Bewertung</h2>
        <p>Der günstigste Anbieter deckt den Bedarf, bindet aber zwölf Monate. Der Preisunterschied über die Laufzeit beträgt 61,20 €.</p>
        <blockquote>Empfehlung: Anbieter B, weil er monatlich kündbar bleibt.</blockquote>`;

    case 'calculator':
      return `
        <p>Eingabe der Eckdaten oben, Ergebnis unten. Die Werte rechnen sich bei jeder Änderung neu.</p>
        <div class="card">
          <div class="card-title">Ergebnis</div>
          <div style="margin-top:12px;font-size:32px;line-height:38px;font-weight:700">1.284,60 €</div>
          <div style="margin-top:4px;color:${paper.inkMuted}">monatliche Rate</div>
        </div>
        ${table([
          ['Darlehenssumme', '280.000 €'],
          ['Sollzins', '3,45 %'],
          ['Tilgung', '2,00 %'],
          ['Zinsbindung', '15 Jahre'],
        ])}
        <h2>Restschuld</h2>
        <p>Nach Ablauf der Zinsbindung verbleiben 196.400 € Restschuld. Sondertilgungen sind mit 5 % jährlich eingerechnet.</p>`;

    case 'list':
      return `
        <p>Alles, was mit muss. Abgehakt wird auf Papier — die Liste ist bewusst kurz gehalten.</p>
        <h2>Kleidung</h2>
        ${list(['Regenjacke, wasserdicht', 'Zwei Fleecepullover', 'Wanderschuhe eingelaufen', 'Mütze und Handschuhe'])}
        <h2>Technik</h2>
        ${list(['Adapter Typ G', 'Powerbank 20.000 mAh', 'Stirnlampe mit Ersatzbatterien'])}
        <blockquote>Nicht vergessen: Reisepass gilt noch bis März 2027.</blockquote>`;

    case 'text':
    default:
      return `
        <p>Die Frist beginnt mit dem Zugang der Erklärung und richtet sich nach der Dauer des Verhältnisses. Maßgeblich ist der dritte Werktag des Monats.</p>
        <h2>Fristen im Überblick</h2>
        ${table([
          ['bis 5 Jahre', '3 Monate'],
          ['bis 8 Jahre', '6 Monate'],
          ['ab 8 Jahre', '9 Monate'],
        ])}
        <p>Abweichende Vereinbarungen sind nur zugunsten der schwächeren Partei wirksam. Eine kürzere Frist zulasten dieser Partei ist unwirksam, auch wenn sie ausdrücklich vereinbart wurde.</p>
        <blockquote>Im Zweifel gilt die gesetzliche Frist, nicht die vereinbarte.</blockquote>
        <p>Der Zugang ist im Streitfall von der Partei zu beweisen, die sich auf ihn beruft. Ein Einwurf-Einschreiben genügt dafür in der Regel.</p>`;
  }
}

/**
 * Derselbe Inhalt als reiner Text — die Grundlage der Volltextsuche (Blatt
 * `3d`), bis der Dateicache echte Dokumente liefert.
 *
 * Die Suche braucht zwei Dinge, die reines Markup nicht hergibt: eine Stelle,
 * an der der Begriff steht, und genug Text davor und dahinter fuer den
 * zweizeiligen Ausschnitt. Deshalb faellt hier alles Markup weg und der Titel
 * samt Ordner steht vorn — sonst saehe der Ausschnitt fuer alle Dokumente
 * desselben Typs gleich aus.
 */
export function sampleDocumentText(document: DocumentSource): string {
  const lead = `${document.title} — ${document.folderName ?? 'Nicht einsortiert'}.`;
  const body = bodyFor(document)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${lead} ${body}`;
}

/**
 * Vollstaendige HTML-Seite. `viewport-fit=cover` und ein grosszuegiger unterer
 * Innenabstand sorgen dafuer, dass Kopfzeile und Aktionsbalken beim Lesen
 * nichts verdecken — die Bedienung schwebt ueber dem Inhalt, sie verdraengt
 * ihn nicht.
 *
 * @param topInset   Hoehe der Viewer-Kopfzeile in dp
 * @param bottomInset Hoehe des Aktionsbalkens samt Abstand in dp
 */
export function sampleDocumentHtml(
  document: DocumentSource,
  topInset: number,
  bottomInset: number
): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${document.title}</title>
<style>
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    padding: ${topInset + 24}px 24px ${bottomInset + 24}px;
    background: ${paper.paper};
    color: ${paper.ink};
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    line-height: 26px;
  }
  .kicker {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${paper.accent};
  }
  h1 { margin: 10px 0 0; font-size: 28px; line-height: 34px; font-weight: 700; }
  h2 { margin: 24px 0 0; font-size: 20px; line-height: 28px; font-weight: 700; }
  p { margin: 12px 0 0; color: ${paper.inkSoft}; }
  ul { margin: 12px 0 0; padding-left: 22px; color: ${paper.inkSoft}; }
  li { margin: 6px 0; }
  blockquote {
    margin: 24px 0 0;
    padding: 16px;
    background: ${paper.quote};
    border-left: 3px solid ${paper.accent};
    border-radius: 0 8px 8px 0;
    font-size: 15px;
    line-height: 24px;
    color: ${paper.inkSoft};
  }
  .card {
    margin-top: 20px;
    padding: 16px;
    background: ${paper.card};
    border: 1px solid ${paper.rule};
    border-radius: 8px;
  }
  .card-title {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${paper.inkMuted};
  }
  .axis {
    margin-top: 8px;
    display: flex;
    gap: 10px;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    line-height: 16px;
    color: ${paper.inkMuted};
    font-variant-numeric: tabular-nums;
  }
  table {
    margin-top: 20px;
    width: 100%;
    border-collapse: collapse;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  td {
    padding: 10px 0;
    border-bottom: 1px solid ${paper.rule};
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }
  tr.last td { border-bottom: 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<div class="kicker">${kicker(document)}</div>
<h1>${document.title}</h1>
${bodyFor(document)}
</body>
</html>`;
}
