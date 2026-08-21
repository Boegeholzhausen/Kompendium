# Analyse-Auftrag: Kompendium (Expo/RN, Android-first)

Du analysierst dieses Repository **nur lesend**. Kein Code ändern, keine Dateien
schreiben außer dem einen Ergebnisbericht am Schluss. Ziel ist ein
priorisierter Befundbericht, kein Refactoring.

## Vorbereitung

Lies zuerst: `CLAUDE.md`, `TECH_STACK.md`, `DATABASE_STRUCTURE.md`,
`README.md` (Abschnitt „Abweichungen"). Die dort dokumentierten Regeln und
bewussten Abweichungen sind **Vorgabe, kein Befund** — melde sie nicht als
Fehler, sondern prüfe, ob der Code sie tatsächlich einhält.

Verbindliche Contracts, gegen die geprüft wird:

- SQL ausschließlich in `src/data/db/repository.ts`; Screens und Stores kennen
  die DB nicht, sie gehen über `src/state/`.
- Keine Hex-Codes/Schriftgrößen außerhalb von `src/theme/`.
- Ordner sind ein Name (`documents.folder_name`), kein Fremdschlüssel;
  Umbenennen nur über `repository.renameFolder` (Transaktion).
- Schemaänderung ⇒ `SCHEMA_VERSION` hoch + Migration mit `ALTER TABLE`
  (`CREATE TABLE IF NOT EXISTS` ändert bestehende Tabellen nicht).
- `src/data/sampleLibrary.ts` ist nur Erstbefüllung.
- Web-Varianten (`*.web.ts(x)`) existieren nur für den Screenshot-Vergleich.
- Keine neuen nativen Module (App läuft in Expo Go).

Nutze `npm run typecheck` und `npm run lint:tokens` als Faktenbasis, nicht als
Ersatz für das Lesen der Dateien.

## Prüfblöcke

### A — Fehlerquellen und Robustheit

Suche konkrete Defekte, keine Stilfragen. Besonders anzuschauen:

1. **Persistenz / Migrationen** (`src/data/db/schema.ts`, `repository.ts`):
   Migrationspfad für Alt-Installationen, fehlende `ALTER TABLE`, nicht
   idempotente Migrationen, Transaktionsgrenzen, Fehler beim Öffnen der DB.
2. **Sync** (`src/data/remote/push.ts`, `pull.ts`, `src/state/hydrate.ts`):
   stille Sackgassen in der Outbox, Einträge die nie den Status verlassen,
   Konfliktauflösung (Last-Write-Wins?), Umgang mit Teilfehlern, Verhalten bei
   Offline/Reconnect, Retry ohne Backoff, doppeltes Ausführen bei parallelen
   Läufen, Löschungen die nicht propagieren.
3. **Zustand** (`src/state/*.ts`): Race Conditions zwischen Hydrate und
   Nutzeraktion, veralteter State nach Fehlern, optimistische Updates ohne
   Rollback.
4. **Import/Dateisystem** (`src/data/importDocument.ts`, `cache.ts`):
   Pfadbehandlung, Dateinamen-Kollisionen, verwaiste Dateien nach Löschen
   (Leak im Cache), fehlende Größen-/Typprüfung, Abbruch mitten im Import.
5. **Viewer** (`src/screens/viewer/*`): WebView-Lebenszyklus, Speicher bei
   großen HTML-Dokumenten, Zurück-Navigation, `textZoom`-Zustand.
6. **Fehlerbehandlung generell**: verschluckte `catch`-Blöcke ohne Nutzer-
   Feedback, `await` ohne Fehlerpfad, Promise-Ketten ohne `.catch`.

### B — Sicherheit

Prüfe mit Blick auf ein Gerät, auf dem beliebige HTML-Dokumente landen können:

1. **WebView** (`DocumentView.tsx`): Ausgeführtes fremdes JavaScript im
   Dokument — was kann es erreichen? `originWhitelist`, `allowFileAccess`,
   `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`,
   `javaScriptEnabled`, `onMessage`-Bridge, `injectedJavaScript`, Umgang mit
   externen Links/`onShouldStartLoadWithRequest`. Kann ein Dokument andere
   lokale Dateien oder Tokens lesen?
2. **Secrets**: `.env` / `.env.local` gegen `.gitignore` und `app.json`
   prüfen; welche Werte landen über `EXPO_PUBLIC_*` im Bundle und sind damit
   öffentlich? Liegt irgendwo ein Service-Role-Key im App-Code oder in
   `scripts/`? Git-History auf versehentlich eingecheckte Keys prüfen.
3. **Supabase** (`supabase/schema.sql`, `src/data/remote/*`): Ist RLS auf
   jeder Tabelle aktiv, und decken die Policies wirklich nur die eigenen Zeilen
   ab? Storage-Bucket öffentlich oder signiert? Was kann ein beliebiger
   Anon-Key-Inhaber lesen/schreiben?
4. **SQL**: String-Interpolation statt Parameter-Bindings in `repository.ts` —
   jede Stelle einzeln benennen.
5. **Auth/Session** (`LoginSheet.tsx`, Konto-Flows): Wo liegt das Token, was
   passiert beim Logout, bleiben Daten des Vorbenutzers lokal liegen?
6. **Scripts** (`scripts/upload.mjs`, `account.mjs`): Rechte, die dort
   verwendet werden, und ob sie versehentlich in die App gelangen können.

### C — Modularisierung

Ausgangslage: `repository.ts` ~46 KB, `FolderDetailScreen.tsx` ~24 KB,
`ViewerScreen.tsx` ~24 KB, `push.ts` ~20 KB, `LibraryScreen.tsx` ~19 KB.

Für jede Datei über ~400 Zeilen: benenne die enthaltenen Verantwortlichkeiten
und schlage einen konkreten Schnitt vor — welche neue Datei, welche Exporte,
welche Aufrufer ändern sich. Prüfe dabei:

- Lässt sich `repository.ts` entlang der Entitäten (documents, folders, trash,
  outbox, settings) trennen, ohne die Regel „SQL nur hier" zu verletzen —
  z. B. `src/data/db/repos/*.ts` mit gemeinsamem Barrel?
- Wiederholte Logik in Screens (Auswahlmodus, Swipe-Aktionen, Sheet-Handling,
  Filterzustand), die in Hooks oder gemeinsame Komponenten gehört.
- Grenzverletzungen: Screens die Datenzugriff enthalten, Stores die UI-Wissen
  tragen, `src/ui/` mit Domänenwissen.
- Zirkuläre Importe und stille Kopplungen.

Bewerte jeden Vorschlag mit **Nutzen vs. Risiko** und markiere, was ohne
Verhaltensänderung rein mechanisch geht.

### D — Was NICHT zu melden ist

Kosmetik, Namensgeschmack, Testabdeckung als Selbstzweck, Vorschläge die neue
native Module oder einen Dev Build erzwingen, Änderungen an den `*.web.*`-
Dateien, „modernere Bibliothek X statt Y" ohne konkreten Defekt.

## Ergebnisformat

Schreibe genau eine Datei: `ANALYSE-BEFUND.md` im Projektwurzelverzeichnis.
Aufbau:

1. **Kurzfassung** — max. 10 Zeilen: die drei wichtigsten Befunde.
2. **Befundtabelle** — je Zeile: ID, Kategorie (Fehler/Sicherheit/Struktur),
   Schwere (kritisch/hoch/mittel/niedrig), Datei:Zeile, Ein-Satz-Beschreibung.
3. **Details je Befund** — Beobachtung (mit Code-Zitat), warum das ein Problem
   ist, konkreter Auslöser/Reproduktion, vorgeschlagene Behebung, Aufwand
   (S/M/L), Risiko der Behebung.
4. **Modularisierungsplan** — vorgeschlagene Dateistruktur als Baum plus
   Reihenfolge der Schritte, mechanische Schritte zuerst.
5. **Nicht abschließend geklärt** — was du ohne Gerät/Laufzeit nicht prüfen
   konntest, und wie man es prüfen würde.

Jeder Befund braucht eine Datei- und Zeilenangabe. Wo du unsicher bist,
schreib „vermutlich" dazu — keine erfundenen Zeilennummern, keine Befunde aus
Analogieschluss. Lieber 15 belegte Befunde als 40 geratene.

## Testschritte nach der Analyse

Es wird nichts geändert, daher nur Gegenprüfung des Berichts:

```bash
npm run typecheck
npm run lint:tokens
```

Und stichprobenartig: drei zufällige Befunde aus der Tabelle nehmen, die
genannte Datei/Zeile öffnen und prüfen, ob das Zitat wörtlich stimmt.
