# assets/

Hier liegen die Bilddateien, die in [app.json](../app.json) eingetragen werden.
Der Ordner ist absichtlich noch leer: **die Einträge in app.json werden erst
gesetzt, wenn die Dateien wirklich hier liegen** — ein Pfad auf eine fehlende
Datei lässt `expo prebuild` und damit jeden EAS-Build abbrechen.

## Was nachgeliefert wird

| Datei | Größe | Was es ist |
| --- | --- | --- |
| `icon.png` | 1024x1024 | Das App-Icon als Ganzes. Quadratisch, ohne eigene runde Maske — Android schneidet selbst zu. |
| `adaptive-icon.png` | 1024x1024 | Nur der **Vordergrund** des adaptiven Icons, mit durchsichtigem Hintergrund. Android bewegt diese Ebene beim Wackeln über dem Hintergrund, deshalb gehört das Motiv in die mittleren ~66 % der Fläche; alles weiter außen kann je nach Launcher-Maske abgeschnitten werden. |

## Was dann in app.json ergänzt wird

Unter `expo`:

```json
"icon": "./assets/icon.png"
```

Unter `expo.android`:

```json
"adaptiveIcon": {
  "foregroundImage": "./assets/adaptive-icon.png",
  "backgroundColor": "#0E1012"
}
```

`backgroundColor` ist die Hintergrundebene des adaptiven Icons. `#0E1012` ist
derselbe Wert, der in app.json schon als `backgroundColor` steht — das ist
`color.bg` aus [src/theme](../src/theme/), damit Icon-Hintergrund und
App-Hintergrund dieselbe Farbe sind. Es ist der einzige Ort außerhalb von
`src/theme/`, an dem ein Hex-Code stehen darf: app.json ist keine Komponente
und kann die Token-Datei nicht importieren.

Danach einmal `npx expo prebuild -p android --clean` laufen lassen und
kontrollieren, dass unter `android/app/src/main/res/mipmap-*/` neue Dateien
liegen — dann zieht das Icon auch in den Build.
