# Kompendium — Supabase & .env einrichten

Zwei Schritte, ca. 15–20 Minuten. Danach kann die App echte Daten lesen und schreiben.

Geprüft gegen deine echten Dateien (`supabase/schema.sql`, `.env.example`, `.gitignore`, `src/data/supabase.ts`) — die Angaben unten (Variablennamen, Bucket-Name, Tabellen) stimmen exakt mit deinem Projektstand überein.

Hinweis: Die Menüpunkte im Supabase-Dashboard heißen manchmal leicht anders oder liegen eine Ebene tiefer. Die Reihenfolge und die Begriffe stimmen, die genaue Position kann abweichen.

---

## Schritt 1 — Supabase-Projekt anlegen

### 1.1 Account und Organisation

1. Gehe auf **https://supabase.com** und klicke **Start your project** / **Sign in**.
2. Anmelden geht mit GitHub oder E-Mail. Beides ist gleichwertig.
3. Beim ersten Login legt Supabase eine **Organization** an. Name ist egal (z. B. dein Name), Plan **Free** reicht für dieses Projekt vollständig aus.

### 1.2 Projekt erstellen

1. **New project** klicken.
2. Felder ausfüllen:
   - **Name**: `kompendium`
   - **Database Password**: Ein starkes Passwort erzeugen lassen und **sofort in deinen Passwortmanager speichern**. Du brauchst es für die App nicht, aber für direkten Datenbankzugriff später — und Supabase zeigt es nie wieder an.
   - **Region**: `Central EU (Frankfurt)` — kürzeste Wege, und die Daten bleiben in der EU.
3. **Create new project**. Die Bereitstellung dauert ein bis drei Minuten. Warte, bis der Status oben grün ist.

### 1.3 schema.sql ausführen

1. Links in der Seitenleiste **SQL Editor** öffnen.
2. **New query** klicken.
3. Auf deinem Rechner `C:\Projekte\Kompendium\supabase\schema.sql` in einem Editor öffnen, **kompletten Inhalt** kopieren und in das SQL-Fenster einfügen.
4. **Run** klicken (oder `Strg + Enter`).
5. Erwartetes Ergebnis: `Success. No rows returned`. Fehlermeldungen bitte nicht ignorieren — siehe „Wenn etwas schiefgeht" unten.

Was das Skript anlegt (und was du danach prüfen kannst):

| Bestandteil | Wozu | Wo prüfen |
|---|---|---|
| Tabellen `folders`, `documents`, `user_settings` | Datenmodell der App (Ablage im Storage, Ordnung in diesen Tabellen — trennt sich bewusst) | **Table Editor** |
| Volltextsuche deutsch auf `documents.search_vector` (generierte Spalte, gewichtet: Titel > Beschreibung > Vorschautext) + GIN-Index | Suche findet auch gebeugte Wortformen | **Database → Indexes** |
| `touch_updated_at`-Trigger auf allen Tabellen | Zeitstempel wird bei jedem Update automatisch gesetzt, das Pull-Wasserzeichen der App verlässt sich darauf | **Database → Triggers** |
| RLS-Policies (`<tabelle>_owner`) auf `owner_id = auth.uid()` | Jeder Nutzer sieht ausschließlich eigene Zeilen | **Authentication → Policies** |
| Privater Bucket `documents` + vier Pfad-Policies (`documents_read/write/update/delete`) | HTML-Dateien liegen flach unter `documents/<user-id>/<dokument-id>.html`, fremde Ordner sind gesperrt | **Storage** |

### 1.4 Kontrolle, dass RLS wirklich aktiv ist

Das ist der eine Punkt, den man nicht überspringen sollte — ohne RLS wären alle Daten für jeden Anon-Key lesbar.

1. **Table Editor** öffnen, eine Tabelle anklicken.
2. Oben darf **kein** roter Hinweis „RLS is disabled" stehen. Steht dort einer, hat das Skript nicht vollständig durchlaufen.
3. Unter **Authentication → Policies** muss jede Tabelle mindestens eine Policy haben.

### 1.5 Bucket prüfen

1. **Storage** öffnen.
2. Es muss ein Bucket **`documents`** existieren, markiert als **Private** (nicht public). Falls er fehlt, hat der Storage-Teil des Skripts nicht funktioniert.

### 1.6 Anonymous sign-ins aktivieren (nur für den Anfang)

Bei einem **frischen** Projekt legt die erste Identität die App selbst an — beim ersten Start, still und ohne Registrierung. Genau diese Identität bekommt in Schritt 1.7 E-Mail und Passwort und wird damit zum Konto. Danach braucht die App das anonyme Anmelden nicht mehr, und der Schalter darf wieder aus.

Hast du dieses Projekt schon einmal benutzt, existiert die Identität bereits — dann kannst du direkt zu 1.7 springen.

1. **Authentication** → **Sign In / Providers** (in manchen Versionen: **Providers** bzw. **Settings**).
2. Den Eintrag **Anonymous sign-ins** suchen und **einschalten**.
3. **Save**.

Zum Verständnis: Ein anonymer Nutzer bekommt eine echte, dauerhafte User-ID. Genau die landet als `owner_id` in deinen Zeilen, und genau darauf greift RLS zu. Kein Passwort, aber trotzdem sauber isolierte Daten. Genau dieser Account bekommt im nächsten Schritt E-Mail und Passwort — er wird dabei **nicht ersetzt**, und deshalb geht nichts verloren. Danach braucht die App das anonyme Anmelden nicht mehr.

### 1.7 Ein Konto anlegen

Solange die App nur anonym anmeldet, hat **jede Installation eine eigene** `auth.uid()`. RLS filtert auf `owner_id = auth.uid()` — ein zweites Gerät sieht deshalb einen leeren Bestand, egal wie gut der Abgleich funktioniert. Mit einem richtigen Konto melden sich alle Geräte unter derselben Kennung an.

1. **Authentication → Sign In / Providers**: **Email** einschalten und speichern. (An den Mail-Vorlagen ist nichts zu tun — es wird keine Mail verschickt.)
2. In PowerShell im Projektordner:

   ```powershell
   npm run konto -- "meine@adresse.de" "ein-langes-passwort" --dry
   npm run konto -- "meine@adresse.de" "ein-langes-passwort"
   ```

   Das Skript setzt E-Mail und Passwort an der **vorhandenen** Identität (`auth.admin.updateUserById`). Die Kennung bleibt dieselbe — das ist der springende Punkt: jede Zeile in Supabase gehört ihr, und `scripts/upload.mjs` hat unter genau dieser Kennung hochgeladen. Eine Neuanmeldung mit einer neuen Adresse erzeugte stattdessen eine **zweite** Identität und ließe den ganzen bisherigen Bestand verwaist zurück.

   Es läuft mit dem Service-Role-Key aus `.env.local` — der trägt bewusst kein `EXPO_PUBLIC_` im Namen und landet deshalb nie im App-Bundle. Das Passwort wird von Supabase gehasht abgelegt; im Projekt bleibt davon nichts zurück.
3. **Kontrolle:** Dashboard → **Authentication → Users**. Es muss **dieselbe** User-ID sein wie vorher, jetzt mit der Adresse und `is_anonymous = false`. Kam eine zweite Kennung hinzu, ist etwas schiefgelaufen — dann nicht weitermachen, sondern nachsehen.

### 1.8 In der App anmelden

**Einstellungen → Konto → Anmelden**, E-Mail und Passwort eintippen. Das war's — die Anmeldung bleibt bestehen, auch über Neustarts hinweg, und auf einem zweiten Gerät genügt derselbe Vorgang.

Die App liegt dabei nicht hinter einem Anmeldeschirm: die lokale Datenbank ist die Wahrheitsquelle, jeder Screen funktioniert offline vollständig. Nicht angemeldet heißt schlicht, dass der Abgleich ruht — die Statuszeile sagt „Nicht angemeldet", die Bibliothek läuft weiter.

Im App-Bundle steht damit nur URL und Anon Key. Beide sind ohne Anmeldung wertlos, weil RLS auf `auth.uid()` filtert; auf dem Gerät bleibt nur ein Sitzungs-Token in AsyncStorage.

**Passwort vergessen?** `npm run konto` noch einmal mit einem neuen laufen lassen — die Kennung bleibt, es bewegt sich kein Dokument.

---

## Schritt 2 — .env anlegen

### 2.1 Datei kopieren

In PowerShell:

```powershell
cd C:\Projekte\Kompendium
Copy-Item .env.example .env
```

Oder im Explorer: `.env.example` kopieren, Kopie in `.env` umbenennen (der Dateiname beginnt mit einem Punkt und hat **keine** Endung — Windows meckert eventuell, das ist in Ordnung).

### 2.2 Werte aus Supabase holen

1. Im Dashboard: **Project Settings** (Zahnrad) → **API** (teils **API Keys** / **Data API**).
2. Du brauchst zwei Werte:
   - **Project URL** — sieht aus wie `https://abcdefghijklm.supabase.co`
   - **anon / public key** — ein sehr langer Schlüssel

### 2.3 Eintragen

`.env` öffnen und ausfüllen — die beiden Variablennamen stehen so in deiner `.env.example`, einfach die Platzhalter ersetzen:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Wichtig dabei:

- Die Variablennamen genau so lassen, wie in `.env.example` vorgegeben. Bei Expo müssen sie mit `EXPO_PUBLIC_` beginnen, sonst kommen sie im App-Bundle nicht an — dein `src/data/supabase.ts` liest exakt `process.env.EXPO_PUBLIC_SUPABASE_URL` und `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Keine Anführungszeichen**, **keine Leerzeichen** um das `=`.
- Kein Zeilenumbruch mitten im Key — er ist lang, muss aber in einer Zeile stehen.

### 2.4 Neu starten

Env-Variablen werden beim Start des Dev-Servers eingelesen. Nach dem Anlegen der `.env` also:

```powershell
npx expo start -c
```

Das `-c` leert den Metro-Cache. Ohne das siehst du unter Umständen noch die alten (leeren) Werte.

### 2.5 Sicherheitscheck

- `.env` gehört **nicht** in Git — steht bei dir bereits in `.gitignore`, das passt schon.
- Der Anon Key ist zum Ausliefern gedacht und landet ohnehin im App-Bundle — er ist kein Geheimnis. Deine Daten schützt allein RLS. Deshalb Schritt 1.4 ernst nehmen.
- Falls dir in den Einstellungen ein **`service_role`**-Key begegnet: **niemals** in die App. Der umgeht RLS komplett.
- Ohne `.env` startet die App trotzdem — `isSupabaseConfigured` in `supabase.ts` prüft das und die App läuft dann rein lokal mit expo-sqlite weiter, kein Absturz.

---

## Wenn etwas schiefgeht

| Symptom | Wahrscheinliche Ursache | Lösung |
|---|---|---|
| SQL-Fehler `relation … already exists` | Skript lief schon einmal (teilweise) | Wenn das Projekt neu ist: einfachster Weg ist ein frisches Supabase-Projekt |
| SQL-Fehler bei `storage.…` | Storage-Policies brauchen teils erhöhte Rechte | Rest des Skripts läuft; Bucket notfalls per Hand unter **Storage → New bucket**, Name `documents`, Private, anlegen |
| App startet, zeigt aber keine Daten | `.env` nicht geladen | `npx expo start -c`, Variablennamen gegen `.env.example` prüfen |
| Fehler „Anonymous sign-ins are disabled" | Schritt 1.6 fehlt | Provider einschalten und speichern. Sobald Schritt 1.7 gelaufen ist, braucht die App ihn nicht mehr — er darf dann wieder aus |
| „E-Mail oder Passwort stimmt nicht." | Tippfehler, oder das Passwort wurde seither geändert | `npm run konto` mit einem neuen Passwort laufen lassen und dieses eintippen |
| „E-Mail-Anmeldung ist im Supabase-Projekt nicht aktiviert." | Schritt 1.7, Punkt 1 fehlt | Email-Provider einschalten und speichern |
| Statuszeile sagt „Nicht angemeldet" | so gewollt, solange niemand angemeldet ist | **Einstellungen → Konto → Anmelden** |
| Zweites Gerät bleibt leer | dort ist niemand angemeldet | **Einstellungen → Konto → Anmelden** mit derselben Adresse, dann „Jetzt synchronisieren" |
| Alles leer, keine Fehlermeldung | RLS aktiv, aber `owner_id` wird beim Schreiben nicht gesetzt | Beim ersten Schreibversuch melden — das ist dann ein Code-Thema, kein Setup-Thema |
| Nichts geht, App startet trotzdem | So gewollt: ohne `.env` läuft die App im lokalen Modus (expo-sqlite) weiter | Kein Fehler, nur kein Sync |

---

## Fertig, wenn …

- [ ] Supabase-Projekt existiert, Region Frankfurt
- [ ] `schema.sql` gelaufen, Tabellen im Table Editor sichtbar
- [ ] Jede Tabelle hat RLS aktiv und mindestens eine Policy
- [ ] Bucket `documents` existiert und ist privat
- [ ] Anonymous sign-ins aktiviert und gespeichert (nur bis Schritt 1.7)
- [ ] Email-Provider aktiviert
- [ ] `npm run konto` gelaufen, User-ID unverändert (`is_anonymous = false`)
- [ ] In der App unter **Einstellungen → Konto** angemeldet, Adresse steht dort
- [ ] `.env` liegt in `C:\Projekte\Kompendium` mit URL und Anon Key
- [ ] `.env` steht in `.gitignore`
- [ ] `npx expo start -c` läuft ohne Supabase-Fehler in der Konsole

Wenn du an einem Punkt hängst: Fehlermeldung hierher kopieren, dann sehen wir uns die konkrete Stelle an.
