/**
 * Bildkontrolle der Screens aus Schritt 7 (Einstellungen, Papierkorb,
 * Darstellung, Offline-Liste) und des Imports gegen den Prototyp.
 *
 * Nicht Teil der App. Aufruf nach `expo export --platform web`, waehrend
 * `python3 -m http.server` auf dist zeigt.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8099';
const out = process.argv[3] ?? '/tmp/shots7';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  // Der Import ueber die Zwischenablage laesst sich nur mit dieser Erlaubnis
  // nachstellen; im Browser fragt sonst ein Dialog, den es auf dem Geraet
  // nicht gibt.
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(name) {
  await wait(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('->', name);
}

page.on('pageerror', (error) => console.log('!! pageerror:', error.message));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('!! console:', message.text());
});

await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await wait(1500);
await shot('00-bibliothek');

// Import-Sheet: die drei Wege, jetzt mit Wirkung.
await page.getByLabel('Dokument importieren').click();
await shot('01-import-sheet');

// "Von URL laden" oeffnet das zweite Sheet ueber dem ersten.
await page.getByLabel(/^Von URL laden/).click();
await shot('02-import-url');
await page.keyboard.press('Escape');
await wait(400);
await page.keyboard.press('Escape');
await wait(400);

// Einstellungen.
await page.getByLabel('Einstellungen', { exact: true }).click();
await shot('03-einstellungen');

// Papierkorb — erst leer.
await page.getByRole('button', { name: 'Papierkorb', exact: true }).click();
await shot('04-papierkorb-leer');
await page.getByLabel('Zurück').first().click();
await wait(500);

// Darstellung.
await page.getByLabel('Darstellung').click();
await shot('05-darstellung');

// Regler ans obere Ende ziehen — die Vorschau muss mitwachsen.
const slider = page.getByLabel('Textgröße im Viewer');
const box = await slider.boundingBox();
await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.up();
await shot('06-darstellung-150');

// Dokumente abdunkeln einschalten.
await page.getByLabel('Dokumente abdunkeln').click();
await shot('07-darstellung-abgedunkelt');
await page.getByLabel('Zurück').first().click();
await wait(500);

// Offline behaltene Dokumente.
await page.getByLabel(/^Offline behaltene Dokumente/).click();
await shot('08-offline');
await page.getByLabel('Zurück').first().click();
await wait(500);

// Jetzt etwas in den Papierkorb legen: Bibliothek, Sektion "Neu"
// einsortieren-Weg in die Mehrfachauswahl, dann loeschen.
await page.getByLabel('Bibliothek', { exact: true }).click();
await wait(600);
await page.getByLabel('Einsortieren').click();
await wait(400);
await page.keyboard.press('Escape');
await wait(400);
await page.getByLabel('Löschen').click();
await wait(600);
await shot('09-toast-papierkorb');

// Und der gefuellte Papierkorb.
await page.getByLabel('Einstellungen', { exact: true }).click();
await wait(500);
await page.getByRole('button', { name: 'Papierkorb', exact: true }).click();
await shot('10-papierkorb');

// Auswaehlen im Papierkorb-Kopf.
await page.getByLabel('Auswählen').click();
await wait(300);
await page.getByLabel(/^Depot-Auswertung August/).first().click();
await shot('11-papierkorb-auswahl');

/*
 * Funktionsnachweis des Imports: HTML in die Zwischenablage legen, ueber den
 * zweiten Weg importieren und pruefen, ob Titel und Dokumenttyp erkannt
 * wurden — die Tabelle muss eine Tabellen-Kachel ergeben.
 */
// Erstes Zurueck beendet die Auswahl, zweites verlaesst den Papierkorb.
await page.getByLabel('Zurück').first().click();
await wait(400);
await page.getByLabel('Zurück').first().click();
await wait(500);
await page.getByLabel('Bibliothek', { exact: true }).click();
await wait(600);

await page.evaluate(() =>
  navigator.clipboard.writeText(`<!doctype html><html><head>
      <title>Nebenkosten Prüfung 2026</title></head><body>
      <h1>Nebenkosten</h1>
      <table><tr><th>Posten</th><th>Betrag</th></tr>
      <tr><td>Heizung</td><td>412,90 €</td></tr>
      <tr><td>Wasser</td><td>188,40 €</td></tr></table>
      <p>Die Heizkosten liegen 14 Prozent über dem Vorjahr.</p>
      </body></html>`)
);

await page.getByLabel('Dokument importieren').click();
await wait(400);
await page.getByLabel(/^Aus Zwischenablage/).click();
await wait(900);
await shot('12-import-eingetroffen');

// Und geoeffnet: der Viewer muss den Inhalt aus dem Dateicache zeigen.
await page.getByLabel(/^Nebenkosten Prüfung 2026/).first().click();
await wait(1200);
await shot('13-import-im-viewer');

await browser.close();
