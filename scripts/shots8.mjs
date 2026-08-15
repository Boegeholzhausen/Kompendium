/**
 * Bildkontrolle der Zustaende aus Schritt 8 gegen die Blaetter `4a` bis `4d`.
 *
 * Nicht Teil der App. Aufruf nach `expo export --platform web`, waehrend
 * `python3 -m http.server` auf dist zeigt.
 *
 * Zwei der vier Zustaende gibt es im Browser nur mit Nachhilfe:
 *   leer      `?bestand=leer` — der Web-Stub des Repositorys startet ohne
 *             Bestand (Blatt `4a`)
 *   laden     `?laden=4000` — er verzoegert das erste Lesen (Blatt `4b`)
 *
 * Offline dagegen ist echt: `context.setOffline(true)` schaltet
 * `navigator.onLine` um, und genau daran haengt NetInfo im Browser. Der
 * Offline-Streifen, die deaktivierten Zeilen, der Sync-Fehler und die
 * Viewer-Ansicht ohne Cache werden also wirklich ausgeloest und nicht
 * nachgestellt.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8099';
const out = process.argv[3] ?? '/tmp/shots8';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(name, settle = 700) {
  await wait(settle);
  await page.screenshot({ path: `${out}/${name}.png` });
  // Der Netzzustand steht im Protokoll: ohne ihn ist auf einem Bild nicht zu
  // sehen, ob ein fehlender Streifen ein Fehler ist oder schlicht Netz.
  console.log('->', name, '· online:', await page.evaluate(() => navigator.onLine));
}

page.on('pageerror', (error) => console.log('!! pageerror:', error.message));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('!! console:', message.text());
});

// 4b · Ladezustand — waehrend der Verzoegerung fotografieren, danach noch
// einmal: das Layout darf zwischen beiden Bildern nicht springen.
await page.goto(`${base}/?laden=4000`, { waitUntil: 'domcontentloaded' });
await shot('01-laden', 1800);
await shot('02-geladen', 4000);

// 4a · Leere Bibliothek.
await page.goto(`${base}/?bestand=leer`, { waitUntil: 'networkidle' });
await shot('03-leer', 1500);

// Ordner und Tags sind dort nicht anwaehlbar — das muss auch stimmen und
// nicht nur so aussehen.
await page.getByLabel('Ordner', { exact: true }).click({ force: true });
await shot('04-leer-ordner-gesperrt', 800);

// 4c · Offline.
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await wait(1500);
await context.setOffline(true);
await shot('05-offline-streifen', 1200);

// Nicht geladene Dokumente bleiben sichtbar und deaktiviert. Sie liegen
// weiter unten in der Liste (jedes 23.), deshalb erst dorthin scrollen.
await page.mouse.move(196, 500);
await page.mouse.wheel(0, 1500);
await shot('06-offline-nicht-geladen', 900);

// 4c · Sync-Fehler: Der Abgleich in den Einstellungen scheitert ohne Netz,
// und der Streifen wechselt auf `warning`.
await page.getByLabel('Einstellungen', { exact: true }).click();
await wait(700);
await page.getByRole('button', { name: 'Jetzt synchronisieren', exact: true }).click();
await shot('07-sync-fehler-einstellungen', 900);
await page.getByLabel('Bibliothek', { exact: true }).click();
// Offline geht vor: solange kein Netz da ist, waere "Wiederholen" eine
// Schaltflaeche, die sicher wieder fehlschlaegt.
await shot('08-offline-geht-vor-fehler', 900);

// Mit Netz tritt der Fehler hervor — derselbe Streifen in `warning`, rechts
// die Wiederholung. Ohne Neuladen, sonst waere der Zustand weg.
await context.setOffline(false);
await shot('09-sync-fehler-streifen', 1500);

// Und "Wiederholen" raeumt ihn weg: syncing, dann synchron, dann kein
// Streifen mehr.
await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
await shot('10-sync-laeuft', 400);
await shot('11-sync-fertig', 1800);

// 4d · Viewer ohne Cache. `doc-023` ist das erste ungecachte Dokument
// (`cached: i % 23 !== 0`) und heisst "Trainingsplan 2021".
//
// Der Weg fuehrt ueber die Suche: der statische Web-Build kennt nur `/`, und
// aus der Liste heraus laesst sich eine nicht geladene Zeile absichtlich
// nicht oeffnen. Das ist zugleich der einzige Weg, auf dem ein Nutzer hier
// landet — mit Netz oeffnen, dann faellt die Verbindung aus.
const viewerContext = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});
const viewer = await viewerContext.newPage();
viewer.on('pageerror', (error) => console.log('!! pageerror:', error.message));

await viewer.goto(`${base}/`, { waitUntil: 'networkidle' });
await wait(1500);
await viewer.getByLabel(/^Suchen\./).first().click();
await wait(600);
await viewer.getByLabel('Suchbegriff').fill('Trainingsplan 2021');
await viewer.getByLabel('Suchbegriff').press('Enter');
await wait(1200);
await viewer.getByRole('button', { name: /^Trainingsplan 2021/ }).first().click();
await wait(1500);
await viewerContext.setOffline(true);
await wait(1200);
await viewer.screenshot({ path: `${out}/12-viewer-offline.png` });
console.log('-> 12-viewer-offline');

// "Erneut versuchen" ohne Netz sagt es, statt eine Ladeanzeige zu zeigen.
await viewer.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
await wait(800);
await viewer.screenshot({ path: `${out}/13-viewer-erneut.png` });
console.log('-> 13-viewer-erneut');

// "Für offline vormerken" wirkt und laesst sich zuruecknehmen.
await viewer.getByRole('button', { name: 'Für offline vormerken', exact: true }).click();
await wait(900);
await viewer.screenshot({ path: `${out}/14-viewer-vorgemerkt.png` });
console.log('-> 14-viewer-vorgemerkt');

await viewerContext.close();

// Zurueck online: der Streifen verschwindet, die Zeilen leben wieder.
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await shot('15-wieder-online', 1500);

await browser.close();
