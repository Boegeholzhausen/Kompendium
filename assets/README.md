# assets/

Die Bilddateien, auf die [app.json](../app.json) zeigt.

| Datei | Größe | Wofür |
| --- | --- | --- |
| `icon.png` | 1024x1024 | Das klassische App-Icon, deckend. Trägt `expo.icon`. |
| `adaptive-icon.png` | 1024x1024 | Nur der **Vordergrund** des adaptiven Icons, transparent, Motiv im inneren Kreis (66 %). Trägt `expo.android.adaptiveIcon.foregroundImage`. |
| `play-store-512.png` | 512x512 | **Nicht Teil des Builds.** Das Bild für den Store-Eintrag, wird in der Play Console hochgeladen. |
| `README.txt` | — | Herkunft des Entwurfs (Variante 02) und seine Farbwerte, so wie geliefert. |

Der Hintergrund des adaptiven Icons ist kein Bild, sondern die Farbe
`android.adaptiveIcon.backgroundColor` in app.json: `#0E1012`, also `color.bg`
aus [../src/theme](../src/theme/) — bewusst nicht der `#15181B` aus
`README.txt`, damit Icon- und App-Hintergrund übereinstimmen.

Nach einer Änderung an den beiden PNGs einmal
`npx expo prebuild -p android --clean` laufen lassen und kontrollieren, dass
`android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` sowie die
`ic_launcher_foreground`-Dateien je Dichte neu entstanden sind.
