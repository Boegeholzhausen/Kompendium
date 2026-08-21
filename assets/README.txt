Kompendium – App-Icon (Variante 02: Aufgeschlagenes Blatt mit Lesezeichen)

Dateien
  ic_launcher-1024.png              klassisches Icon, 1024 x 1024, deckend, kein Alpha-Rand
  ic_launcher_foreground-1024.png   Adaptive-Vordergrund, 1024 x 1024, transparent,
                                    Motiv innerhalb des inneren Kreises (66 % Durchmesser)
  play-store-512.png                Play-Store-Listing, 512 x 512

Farben
  Hintergrund (adaptive background / Grundfläche)  #15181B
  Akzent Mint                                      #34D399
  Papier                                           #F6F5F1 (linke Seite #E4E2DB)
  Textlinien                                       #1A1A1A bei 17 % Deckkraft

Einbindung (Android)
  res/mipmap-xxxhdpi/ic_launcher_foreground.png   <- Vordergrund-PNG
  res/values/ic_launcher_background.xml           <- <color name="ic_launcher_background">#15181B</color>
  res/mipmap-anydpi-v26/ic_launcher.xml:
    <adaptive-icon>
      <background android:drawable="@color/ic_launcher_background" />
      <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    </adaptive-icon>
  Fallback fuer API < 26: ic_launcher-1024.png auf 48/72/96/144/192 px skalieren.
