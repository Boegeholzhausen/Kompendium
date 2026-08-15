# CLAUDE.md

Anleitung für Claude Code in diesem Repository.

## Projekt

**Kompendium** — persönliche Bibliothek für selbstgebaute HTML-Dokumente.
Expo/React Native, Android-first, mobile only, Dark Mode only. Details:
[TECH_STACK.md](TECH_STACK.md), [DESIGN.md](DESIGN.md), [README.md](README.md).

## Verbindliche Quellen — in dieser Reihenfolge

1. `C:\Projekte\HTML-Dokumenten-Ordner\README.md` — das Handoff-Dokument.
   Bei jedem Widerspruch gilt **dieses** Dokument, auch gegenüber allem
   anderen hier im Repo.
2. `C:\Projekte\HTML-Dokumenten-Ordner\Loesungskonzept-HTML-Dokumenten-App.md`
   — ursprüngliches Architektur-/Sync-Konzept, teils durch spätere Schritte
   überholt (siehe README.md „Abweichungen").
3. Dieses Repo: [README.md](README.md) dokumentiert den aktuellen Stand und
   alle bewussten Abweichungen vom Handoff-Dokument — dort nachsehen, bevor
   eine Abweichung als Fehler behandelt wird.

## Harte Regeln

- **Keine freihändigen Hex-Codes oder Schriftgrößen** außerhalb von
  `src/theme/`. Neue Farb-/Größenwerte gehören dort hinein, nicht inline in
  eine Komponente. Prüfen mit `npm run lint:tokens`.
- **`src/data/db/repository.ts`** ist die einzige Stelle im Projekt mit SQL.
  Screens und Zustand-Stores kennen die Datenbank nicht — sie lesen/schreiben
  über die Stores in `src/state/`.
- Bei Schemaänderungen (`src/data/db/schema.ts`): `SCHEMA_VERSION` hochzählen
  und eine Migration in `migrations` ergänzen (`CREATE TABLE IF NOT EXISTS`
  ändert keine vorhandene Tabelle — neue Spalten brauchen `ALTER TABLE` in
  einer Migration, sonst bricht das für bestehende Installationen).
- **`src/data/sampleLibrary.ts`** ist nur die Erstbefüllung, kein
  Laufzeitbestand — nicht anfassen, um bestehende Daten zu „reparieren".
- Ordner sind ein **Name**, kein Fremdschlüssel (`documents.folder_name`).
  Umbenennen läuft ausschließlich über `repository.renameFolder`
  (Transaktion über `documents` und `folders`).
- Web-Varianten existieren nur für den Screenshot-Vergleich, nie als
  Zielplattform: `repository.web.ts`, `cache.web.ts`, `DocumentView.web.tsx`,
  `networkSource.web.ts`. Änderungen an der nativen Logik brauchen dort keine
  Entsprechung, außer die Datei wird explizit mitgepflegt.
- Textgröße im Viewer läuft über `textZoom` der WebView (Android-only) — kein
  eingespritztes CSS. Im Web-Bild wirkt das deshalb nur in der
  Papier-Vorschau des Reglers.

## Typische Prüfbefehle

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # Token-Linter
npx expo start        # Entwicklung, mit Expo Go SDK 57 auf dem Zielgeraet scannen
```

Für den visuellen Soll-Ist-Vergleich (kein Emulator/Gerät nötig):

```bash
npx expo export --platform web
cd dist && python3 -m http.server 8099   # Seite unter / laden, nicht /index.html
node scripts/shots.mjs http://127.0.0.1:8099 /tmp/shots
```

Weitere `scripts/shotsN.mjs` je Umsetzungsschritt, siehe README.md.

## Arbeitsweise in diesem Repo

- Vor einer neuen Komponente in `src/theme/layout.ts` (`size`) nachsehen, ob
  das benötigte Maß schon als Konstante existiert — die meisten UI-Maße sind
  dort bereits benannt.
- Vor einer neuen Abweichung vom Handoff-Dokument: README.md „Abweichungen"
  lesen, ob es dafür schon eine dokumentierte Begründung gibt, und neue
  bewusste Abweichungen dort ergänzen statt stillschweigend einzuführen.
- Deutsch ist die Sprache im Code-Kommentar, in Commit-relevanten Dokumenten
  und in der UI — bei neuen Texten/Kommentaren dabei bleiben.
- Keine neuen nativen Module, die einen Dev Build erzwingen würden — die App
  läuft in Expo Go. Ausnahmen nur nach Rücksprache (siehe Handoff-Dokument,
  „Was in Expo Go nicht geht").
