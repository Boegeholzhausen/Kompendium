/**
 * Bildkontrolle des Web-Exports gegen den Prototyp.
 *
 * Nicht Teil der App: das Skript oeffnet den statischen Build bei 393 x 852
 * und legt Screenshots der Viewer-Zustaende ab. Aufruf nach `expo export
 * --platform web`, waehrend `python3 -m http.server` auf dist zeigt.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8099';
const out = process.argv[3] ?? '/tmp/shots';

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
  await wait(900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('->', name);
}

// Die Seite muss unter / geladen werden, nicht /index.html — sonst zeigt
// expo-router "Unmatched Route".
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await wait(1500);
await shot('01-bibliothek');

// Erste Dokumentzeile oeffnen.
await page.getByText('Depot-Auswertung August', { exact: false }).first().click();
await shot('02-viewer');

// Info-Sheet ueber den Aktionsbalken.
await page.getByLabel('Info', { exact: true }).click();
await shot('03-info-sheet');

// Der Workflow-Status im Info-Sheet — der gestenfreie Weg im Viewer. Im
// Web-Bild gibt es keine Wischgeste, deshalb ist das hier die einzige
// Fassung, die sich abbilden laesst.
await page.getByLabel('Als gelesen markiert').click();
await shot('04-gelesen-gesetzt');

await page.getByLabel('Archiviert', { exact: true }).click();
await shot('05-archiviert-gesetzt');

await browser.close();
