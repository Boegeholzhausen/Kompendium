/**
 * Bildkontrolle der Screens aus Schritt 6 (Ordner, Tags, Suche, Import,
 * Mehrfachauswahl) gegen den Prototyp.
 *
 * Nicht Teil der App. Aufruf nach `expo export --platform web`, waehrend
 * `python3 -m http.server` auf dist zeigt.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8099';
const out = process.argv[3] ?? '/tmp/shots6';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(name) {
  await wait(800);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('->', name);
}

page.on('pageerror', (error) => console.log('!! pageerror:', error.message));

await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await wait(1500);
await shot('00-bibliothek');

// Import-Sheet ueber den FAB.
await page.getByLabel('Dokument importieren').click();
await shot('01-import-sheet');
await page.keyboard.press('Escape');
await wait(500);

// Ordner-Uebersicht.
await page.getByLabel('Ordner', { exact: true }).click();
await shot('02-ordner');

// Sheet "Ordner anlegen".
await page.getByLabel('Ordner anlegen').first().click();
await shot('03-ordner-anlegen');
await page.keyboard.press('Escape');
await wait(500);

// Ordner-Detail.
await page.getByLabel(/^Ordner Finanzen/).click();
await shot('04-ordner-detail');
await page.getByLabel('Zurück').first().click();
await wait(500);

// Tag-Verwaltung.
await page.getByLabel('Tags', { exact: true }).click();
await shot('05-tags');

// Umbenennen-Sheet ueber den Chevron.
await page.getByLabel(/^Tag Recht,/).click();
await wait(400);
// Nicht `getByLabel`: die Wischaktion hinter der Zeile traegt dieselbe
// Beschriftung. Der Menueeintrag ist ueber seine Rolle eindeutig.
await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
await shot('06-umbenennen');
await page.keyboard.press('Escape');
await wait(500);

// Suche — leer, dann Ergebnisse, dann nichts gefunden.
await page.getByLabel('Bibliothek', { exact: true }).click();
await wait(500);
await page.getByLabel(/^Suchen\./).click();
await shot('07-suche-leer');

await page.getByLabel('Suchbegriff').fill('annuität');
await page.getByLabel('Suchbegriff').press('Enter');
await shot('08-suche-treffer');

await page.getByLabel('Zeitraum').click();
await wait(400);
await page.getByLabel('Letzte 7 Tage').click();
await shot('09-suche-leer-ergebnis');

// Mehrfachauswahl in der Bibliothek.
//
// Ausgeloest wird sie ueber "Einsortieren" in der Sektion "Neu": ein langer
// Druck laesst sich im Web-Export nicht zuverlaessig nachstellen, und dieser
// Weg prueft zugleich das Verschieben-Sheet.
await page.getByLabel('Zurück zur Bibliothek').click();
await wait(700);
await page.getByLabel('Einsortieren').click();
await shot('10-verschieben');
await page.keyboard.press('Escape');
await wait(500);
await shot('11-mehrfachauswahl');

await browser.close();
