/**
 * Screen 5 und 6 — Viewer (Blaetter `2b`, `2c`) samt Info-Sheet.
 *
 * Zweck: lesen. Die App muss verschwinden. Deshalb fuellt das Dokument den
 * Bildschirm randlos, und die Bedienung schwebt darueber statt im Layout zu
 * stehen. Beim Runterscrollen verschwindet sie vollstaendig, bei der ersten
 * Aufwaertsbewegung kommt sie zurueck — Schwelle 8 px, damit Mikrobewegungen
 * nichts ausloesen.
 *
 * Aufbau der Ebenen, von unten nach oben:
 *   Buehne `bg/base`  verhindert weisses Aufblitzen beim Laden
 *   DocumentView      WebView mit dem HTML des Dokuments
 *   Kopfzeile         80 hoch, Blur, blendet aus
 *   Aktionsbalken     schwebende Pille, blendet aus
 *   Info-Sheet        75 %, Scrim
 *   Suchen-Sheet      "Im Dokument suchen", bleibt beim Blaettern offen
 *   Toast             ueber allem — er sichert das zuletzt Getane ab
 *
 * Die Sheets sind Ebenen dieses Screens und keine Modals: nur so laesst sich
 * die Reihenfolge Info → Suchen → Toast zuverlaessig festlegen (siehe
 * `SheetLayer` in `ui/BottomSheet`).
 *
 * **Suchen im Dokument (D2/D3).** Der Auftrag geht als `FindCommand` an die
 * WebView, das Ergebnis kommt als Zaehlung zurueck (Begruendung des Weges im
 * Kopf von `DocumentView`). Kommt der Viewer aus einem Suchtreffer, traegt die
 * Adresse den Begriff (`/dokument/<id>?suche=…`): dann gewinnt der Sprung zur
 * Fundstelle gegen die gemerkte Leseposition, und das Sheet steht eingeklappt
 * da, damit sichtbar ist, warum das Dokument nicht oben beginnt. Gespeichert
 * bleibt die alte Position trotzdem — beim naechsten Oeffnen ohne Begriff
 * greift sie wieder.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Sharing from 'expo-sharing';

import { documentUri, readDocument } from '../../data/cache';
import { downloadDocument, needsDownload } from '../../data/remote/download';
import { sampleDocumentHtml } from '../../data/sampleDocumentHtml';
import { useAppearanceStore } from '../../state/appearance';
import { documentById, useDocumentStore } from '../../state/documents';
import { colorOf, useFolderStore } from '../../state/folders';
import { useNetworkStore } from '../../state/network';
import { flushScroll, useViewerStore } from '../../state/viewer';
import { bg, scrollThreshold, size, space } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import {
  Archive,
  Check,
  DownloadSimple,
  FolderOpen,
  Info,
  MagnifyingGlass,
  PencilSimple,
  ShareNetwork,
  Trash,
  Warning,
  WifiSlash,
  type Icon,
} from '../../ui/icons';
import { Text } from '../../ui/Text';
import { Toast } from '../../ui/Toast';
import { MoveSheet } from '../folders/MoveSheet';
import { DocumentView, type FindCommand } from './DocumentView';
import { FindSheet } from './FindSheet';
import { InfoSheet } from './InfoSheet';
import { OfflineNotice } from './OfflineNotice';
import { INFO_SHEET_RATIO } from './metrics';
import { ViewerActionBar, ViewerHeader } from './ViewerChrome';

/** Was zuletzt geschah — der Toast bietet dafuer 5 Sekunden "Rueckgaengig". */
interface UndoableAction {
  message: string;
  /** Ohne Angabe der Haken — die neutrale Bestaetigung. */
  icon?: Icon;
  undo: () => void;
}

/**
 * Eine Rueckmeldung, die sich nicht zuruecknehmen laesst — kein Netz, kein
 * Teilen, ein Link, der nicht aufgeht. Sie steht im selben Toast, aber ohne
 * "Rueckgaengig": eine Schaltflaeche ohne Wirkung waere schlimmer als keine.
 */
interface PlainNote {
  message: string;
  icon: Icon;
}

export interface ViewerScreenProps {
  documentId: string;
  /** Begriff aus der Suche (`?suche=`): danach wird nach dem Laden gesprungen. */
  searchTerm?: string;
  onBack: () => void;
}

export function ViewerScreen({ documentId, searchTerm, onBack }: ViewerScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const allDocuments = useDocumentStore((state) => state.documents);
  const document = documentById(allDocuments, documentId);

  const setTitle = useDocumentStore((state) => state.setTitle);
  const setNote = useDocumentStore((state) => state.setNote);
  const setKeepOffline = useDocumentStore((state) => state.setKeepOffline);
  const setFolder = useDocumentStore((state) => state.setFolder);
  const setRead = useDocumentStore((state) => state.setRead);
  const setArchived = useDocumentStore((state) => state.setArchived);
  const toggleArchived = useDocumentStore((state) => state.toggleArchived);
  const countOpen = useDocumentStore((state) => state.countOpen);
  const markCached = useDocumentStore((state) => state.markCached);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const trashDocuments = useDocumentStore((state) => state.trash);
  const folders = useFolderStore((state) => state.folders);
  const isOnline = useNetworkStore((state) => state.isOnline);

  /**
   * Ist der Versuch, die Datei nachzuladen, gescheitert?
   *
   * Mit Netz ist ein nicht gecachtes Dokument zunaechst nur eine Wartezeit.
   * Bleibt der Abruf aber erfolglos, ist die Wartezeit vorbei und das Dokument
   * genauso wenig zu oeffnen wie ohne Netz — dann soll auch dasselbe dastehen
   * statt einer leeren Buehne, die nichts erklaert.
   */
  const [loadFailed, setLoadFailed] = useState(false);

  /**
   * Screen 22 (Blatt `4d`): weder im Gerätespeicher noch nachladbar. Mit Netz
   * ist ein nicht gecachtes Dokument kein Fehler, sondern eine Wartezeit —
   * deshalb haengt die Ansicht an BEIDEN Bedingungen.
   */
  const unreachable =
    document !== undefined && !document.cached && (!isOnline || loadFailed);

  const textScale = useAppearanceStore((state) => state.viewerTextScale);
  const dimDocuments = useAppearanceStore((state) => state.dimDocuments);
  const keepScreenOn = useAppearanceStore((state) => state.keepScreenOn);

  const rememberScroll = useViewerStore((state) => state.rememberScroll);
  const initialOffset = useViewerStore((state) => state.scrollPositions[documentId] ?? 0);

  const [chromeVisible, setChromeVisible] = useState(true);
  /** Der Inhalt aus dem Dateicache; `null`, solange er noch gelesen wird. */
  const [cachedHtml, setCachedHtml] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<null | 'info' | 'move' | 'find'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  /** Meldungen ohne "Rueckgaengig" — "Erneut versuchen", Teilen, Links. */
  const [plainNote, setPlainNote] = useState<PlainNote | null>(null);

  /** Suchen im Dokument: Eingabe, letzter Auftrag und die Antwort der WebView. */
  const [findTerm, setFindTerm] = useState('');
  const [findCommand, setFindCommand] = useState<FindCommand | null>(null);
  const [findResult, setFindResult] = useState({ total: 0, index: 0 });
  const [findCollapsed, setFindCollapsed] = useState(false);

  /** Der Begriff aus der Adresse — leer, wenn der Viewer nicht aus der Suche kommt. */
  const jumpTerm = (searchTerm ?? '').trim();

  /**
   * Kommt ein Suchbegriff mit, gewinnt er gegen die gemerkte Leseposition —
   * sonst spraenge das Dokument erst an die alte Stelle und gleich darauf zur
   * Fundstelle. Der gespeicherte Wert bleibt dabei unangetastet und gilt beim
   * naechsten Oeffnen ohne Begriff wieder.
   */
  const restoreOffset = jumpTerm === '' ? initialOffset : 0;

  /**
   * Letzter gemeldeter Versatz. Er steht in einem Ref und nicht im Zustand:
   * jeder Scrollschritt wuerde sonst den ganzen Screen neu zeichnen, waehrend
   * gelesen wird.
   */
  const lastOffset = useRef(restoreOffset);

  /**
   * Der Auftragszaehler steht in einem Ref: zweimal "weiter" mit demselben
   * Begriff waeren sonst derselbe Auftrag, und die WebView bekaeme den zweiten
   * Tipp nicht zu sehen.
   */
  const findId = useRef(0);

  const sendFind = useCallback((kind: FindCommand['kind'], term: string) => {
    findId.current += 1;
    setFindCommand({ id: findId.current, kind, term });
    if (kind === 'clear') setFindResult({ total: 0, index: 0 });
  }, []);

  /**
   * Der Sprung aus einem Suchtreffer laeuft genau einmal, nach `onLoadEnd`:
   * vorher gibt es im Dokument nichts zu finden.
   */
  const jumped = useRef(false);
  const handleLoaded = useCallback(() => {
    if (jumped.current || jumpTerm === '') return;
    jumped.current = true;
    setFindTerm(jumpTerm);
    setFindCollapsed(true);
    setActiveSheet('find');
    sendFind('search', jumpTerm);
  }, [jumpTerm, sendFind]);

  /** Schliessen hebt die Hervorhebung im Dokument wieder auf. */
  const closeFind = useCallback(() => {
    setActiveSheet(null);
    sendFind('clear', '');
  }, [sendFind]);

  /**
   * "Geoeffnet 12×" im Info-Sheet zaehlt Besuche, nicht Renderdurchlaeufe —
   * der Waechter haelt den Zaehler auch unter React StrictMode richtig, das
   * Effekte in der Entwicklung zweimal ausfuehrt.
   */
  /**
   * Beim Verlassen des Viewers wird die gemerkte Leseposition sofort
   * festgeschrieben. Waehrend des Lesens laeuft sie gedrosselt in die
   * Datenbank (siehe `state/viewer.ts`) — ohne diesen Abschluss ginge der
   * letzte Scrollschritt verloren, wenn man innerhalb der Drosselzeit
   * zurueckgeht.
   */
  useEffect(() => flushScroll, []);

  /**
   * "Zuletzt geoeffnet" im Info-Sheet meint den Besuch **davor**. Der Effekt
   * unten zaehlt beim Oeffnen hoch und setzt `lastOpenedAt` auf jetzt — ohne
   * diesen Merkposten stuende im Sheet immer "gerade eben", was nichts
   * aussagt. Der Wert wird beim ersten Rendern festgehalten, also bevor der
   * Effekt laeuft.
   */
  const openedBefore = useRef<number | null | undefined>(undefined);
  if (openedBefore.current === undefined && document !== undefined) {
    openedBefore.current = document.lastOpenedAt;
  }

  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    // Ein Dokument, von dem nur die Fehlermeldung zu sehen war, wurde nicht
    // geoeffnet — sonst zeigte die Metazeile auf Blatt `4d` beim naechsten
    // Versuch "zuletzt geoeffnet gerade eben", obwohl niemand etwas gelesen
    // hat.
    if (unreachable) return;
    counted.current = true;
    countOpen(documentId);
  }, [countOpen, documentId, unreachable]);

  const title = document?.title ?? '';

  /**
   * Importierte Dokumente liegen als Datei im Cache und werden von dort
   * gelesen; die Erstbefuellung hat keine Datei und bekommt ihren erzeugten
   * Beispielinhalt. Die Buehne bleibt so lange leer — sie ist `bg/base`, es
   * blitzt also nichts auf.
   */
  /**
   * Was der Abgleich gebracht hat, ist zunaechst nur eine Zeile: die Datei
   * liegt noch oben. Sie kommt hier nach — beim Oeffnen, nicht beim Abgleich
   * (DATABASE_STRUCTURE.md, Sync-Strategie).
   *
   * Scheitert der Abruf, passiert nichts weiter: das Dokument bleibt
   * `cached: false` und zeigt damit den Zustand "nicht geladen" aus Blatt
   * `4c` — dieselbe Darstellung wie fuer jedes andere Dokument ohne Inhalt,
   * statt einer eigenen Fehlermeldung fuer denselben Sachverhalt.
   */
  useEffect(() => {
    if (document === undefined || !isOnline) return;
    if (!needsDownload(document)) return;

    let alive = true;
    setLoadFailed(false);
    downloadDocument(document)
      .then((result) => {
        if (!alive) return;
        setCachedHtml(result.html);
        markCached(document.id, result.cacheKey, result.sizeBytes);
      })
      .catch((error: unknown) => {
        console.warn('[kompendium] Dokument liess sich nicht laden:', error);
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [document, isOnline, markCached]);

  const cacheKey = document?.cacheKey ?? null;
  useEffect(() => {
    if (cacheKey === null) {
      setCachedHtml(null);
      return;
    }
    let alive = true;
    readDocument(cacheKey)
      .then((html) => {
        if (alive) setCachedHtml(html ?? '');
      })
      .catch(() => {
        if (alive) setCachedHtml('');
      });
    return () => {
      alive = false;
    };
  }, [cacheKey]);

  /** "Bildschirm anlassen — Beim Lesen nicht sperren" (Blatt `6b`). */
  useEffect(() => {
    if (!keepScreenOn) return;
    void activateKeepAwakeAsync('kompendium-viewer');
    return () => {
      void deactivateKeepAwake('kompendium-viewer');
    };
  }, [keepScreenOn]);

  const html = useMemo(() => {
    if (!document) return '';
    if (document.cacheKey !== null) return cachedHtml ?? '';
    // Der erzeugte Beispielinhalt gilt ausschliesslich fuer die Erstbefuellung.
    // Ihn auch fuer ein echtes Dokument zu zeigen, dessen Datei gerade erst
    // geholt wird, waere die schlimmste Form von Platzhalter: einer, der wie
    // der Inhalt aussieht. Bis die Datei da ist, bleibt die Buehne leer —
    // sie ist `bg/base`, es blitzt also nichts auf.
    if (document.source !== 'sample') return '';
    return sampleDocumentHtml(
      document,
      insets.top + size.viewerHeaderHeight,
      insets.bottom + size.viewerActionBarHeight + space['16']
    );
  }, [document, cachedHtml, insets.top, insets.bottom]);

  /**
   * Aus- und Einblenden der Bedienung. Erst ab 8 px Unterschied, damit ein
   * ruhender Finger nichts umschaltet; ganz oben ist sie immer sichtbar.
   */
  const handleScroll = useCallback(
    (offset: number) => {
      const delta = offset - lastOffset.current;
      if (Math.abs(delta) < scrollThreshold) return;

      lastOffset.current = offset;
      rememberScroll(documentId, offset);
      setChromeVisible(offset <= 0 || delta < 0);
    },
    [documentId, rememberScroll]
  );

  /**
   * Geteilt wird die Datei, nicht der Titel: ein Dokument weiterzugeben heisst,
   * dass der Empfaenger es oeffnen kann.
   *
   * Die Erstbefuellung hat keine Datei (ihr HTML entsteht erst beim Oeffnen aus
   * `sampleDocumentHtml`) — dort bleibt es beim System-Sheet mit dem Titel, und
   * der Toast sagt warum. Ein Knopf, der stumm nichts Brauchbares tut, waere
   * die schlechtere Antwort.
   */
  const handleShare = useCallback(() => {
    void (async () => {
      const uri = cacheKey === null ? null : documentUri(cacheKey);
      try {
        if (uri !== null && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, { mimeType: 'text/html', dialogTitle: title });
          return;
        }
        await Share.share({ title, message: title });
        setPlainNote({ message: 'Dieses Beispiel hat keine Datei zum Teilen', icon: ShareNetwork });
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : 'unbekannter Grund';
        setPlainNote({ message: `Teilen fehlgeschlagen: ${reason}`, icon: Warning });
      }
    })();
  }, [cacheKey, title]);

  /** A2: ein externer Link, den das System nicht oeffnen konnte. */
  const handleExternalLinkFailed = useCallback(() => {
    setPlainNote({ message: 'Link ließ sich nicht öffnen', icon: Warning });
  }, []);

  /**
   * Archivieren aus dem Viewer heraus. Anders als der Favorit bekommt es einen
   * Toast: die Zeile verschwindet danach aus der Liste, und das ist eine
   * Wirkung ausserhalb dieses Screens.
   */
  const handleArchive = useCallback(() => {
    const wasArchived = document?.archivedAt !== null;
    toggleArchived(documentId);
    setUndoable({
      message: wasArchived ? 'Aus dem Archiv geholt' : 'Archiviert',
      icon: Archive,
      undo: () => setArchived([documentId], wasArchived),
    });
  }, [document?.archivedAt, documentId, setArchived, toggleArchived]);

  /**
   * "Erneut versuchen". Einen echten Abruf gibt es noch nicht (der Sync
   * kommt spaeter); was es gibt, ist der Netzzustand — und solange der auf
   * offline steht, ist die Antwort schon bekannt. Sie hier auszusprechen ist
   * ehrlicher, als eine Ladeanzeige zu zeigen, hinter der nichts passiert.
   */
  const handleRetry = useCallback(() => {
    if (useNetworkStore.getState().isOnline) return;
    setUndoable(null);
    setPlainNote({ message: 'Keine Verbindung', icon: WifiSlash });
  }, []);

  const handleKeepOffline = useCallback(() => {
    // Der Hinweis des letzten Versuchs steht sonst noch 5 Sekunden im Bild
    // und ueberdeckt die Rueckmeldung, die zur gerade gedrueckten Taste
    // gehoert.
    setPlainNote(null);
    setKeepOffline(documentId, true);
    setUndoable({
      message: 'Für offline vorgemerkt',
      icon: DownloadSimple,
      undo: () => setKeepOffline(documentId, false),
    });
  }, [documentId, setKeepOffline]);

  const previousFolder = document?.folderName ?? null;

  /**
   * Loeschen legt in den Papierkorb und geht zurueck — im Viewer eines
   * geloeschten Dokuments zu bleiben, waere sinnlos.
   *
   * Anders als in der Bibliothek gibt es hier keinen Toast mit "Rueckgaengig":
   * der Screen ist im selben Moment weg, und ein Toast auf dem darunter
   * liegenden Screen gehoerte dort nicht hin. Der Rueckweg ist der Papierkorb
   * (Schritt 7) — dort steht das Dokument 30 Tage lang.
   */
  const handleTrash = useCallback(() => {
    trashDocuments([documentId]);
    onBack();
  }, [documentId, onBack, trashDocuments]);

  const menuItems: ContextMenuItem[] = [
    {
      key: 'find',
      label: 'Im Dokument suchen',
      icon: MagnifyingGlass,
      onPress: () => {
        setMenuOpen(false);
        setFindCollapsed(false);
        setActiveSheet('find');
      },
    },
    {
      key: 'rename',
      label: 'Umbenennen',
      icon: PencilSimple,
      onPress: () => {
        setMenuOpen(false);
        setActiveSheet('info');
      },
    },
    {
      key: 'move',
      label: 'Verschieben',
      icon: FolderOpen,
      onPress: () => {
        setMenuOpen(false);
        setActiveSheet('move');
      },
    },
    {
      key: 'info',
      label: 'Informationen',
      icon: Info,
      onPress: () => {
        setMenuOpen(false);
        setActiveSheet('info');
      },
    },
    {
      key: 'trash',
      label: 'In den Papierkorb',
      icon: Trash,
      destructive: true,
      onPress: () => {
        setMenuOpen(false);
        handleTrash();
      },
    },
  ];

  if (!document) {
    // Kann nur auftreten, wenn ein Ausweis aus einem alten Verlauf kommt.
    return (
      <View style={styles.missing}>
        <Text variant="body" tone="secondary">
          Dieses Dokument gibt es nicht mehr.
        </Text>
      </View>
    );
  }

  const favorite = document.favorite;

  return (
    <View style={styles.screen}>
      {unreachable ? (
        <OfflineNotice
          document={document}
          // Die Kopfzeile schwebt; ohne diesen Freiraum stuende die
          // Zeichnung teilweise darunter.
          top={insets.top + size.viewerHeaderHeight}
          bottom={insets.bottom + size.screenPadding}
          onRetry={handleRetry}
          onKeepOffline={handleKeepOffline}
        />
      ) : (
        <DocumentView
          html={html}
          initialOffset={restoreOffset}
          textScale={textScale}
          dim={dimDocuments}
          onScroll={handleScroll}
          onLoaded={handleLoaded}
          onExternalLinkFailed={handleExternalLinkFailed}
          find={findCommand}
          onFindResult={setFindResult}
        />
      )}

      <ViewerHeader
        title={title}
        // Ohne Dokument gibt es nichts zu scrollen, also auch nichts
        // auszublenden: die Kopfzeile ist hier der einzige Rueckweg.
        visible={unreachable || chromeVisible}
        top={insets.top}
        onBack={onBack}
        onOverflow={() => setMenuOpen(true)}
      />

      {unreachable ? null : (
      <ViewerActionBar
        visible={chromeVisible}
        bottom={insets.bottom + size.viewerActionBarInset}
        favorite={favorite}
        // Kein Toast: der Zustand ist am Stern selbst zu sehen.
        onToggleFavorite={() => toggleFavorite(documentId)}
        onArchive={handleArchive}
        archived={document.archivedAt !== null}
        onShare={handleShare}
        onInfo={() => setActiveSheet('info')}
      />
      )}

      <InfoSheet
        visible={activeSheet === 'info'}
        document={document}
        title={title}
        note={document.note}
        read={document.readAt !== null}
        archived={document.archivedAt !== null}
        keepOffline={document.keepOffline}
        openCount={document.openCount}
        lastOpenedAt={openedBefore.current ?? null}
        folderName={document.folderName}
        folderColor={colorOf(folders, document.folderName)}
        height={Math.round(windowHeight * INFO_SHEET_RATIO)}
        onClose={() => setActiveSheet(null)}
        onChangeTitle={(next) => setTitle(documentId, next)}
        onChangeNote={(next) => setNote(documentId, next)}
        onChangeKeepOffline={(next) => setKeepOffline(documentId, next)}
        onOpenFolder={() => setActiveSheet('move')}
        onChangeRead={(next) => setRead([documentId], next)}
        onChangeArchived={(next) => setArchived([documentId], next)}
        onTrash={handleTrash}
      />

      <MoveSheet
        visible={activeSheet === 'move'}
        documentIds={[documentId]}
        onClose={() => setActiveSheet('info')}
        onMoved={(folderName) =>
          setUndoable({
            message:
              folderName === null
                ? 'Aus dem Ordner genommen'
                : `Nach „${folderName}“ verschoben`,
            undo: () => setFolder([documentId], previousFolder),
          })
        }
      />

      <FindSheet
        visible={activeSheet === 'find'}
        collapsed={findCollapsed}
        term={findTerm}
        onChangeTerm={setFindTerm}
        onSubmit={() => sendFind('search', findTerm.trim())}
        // Erst nach einem abgeschickten Auftrag ist "nicht gefunden" eine
        // Aussage — vorher stuende sie da, bevor jemand getippt hat.
        searched={findCommand !== null && findCommand.kind !== 'clear'}
        total={findResult.total}
        index={findResult.index}
        onNext={() => sendFind('next', findTerm.trim())}
        onPrevious={() => sendFind('previous', findTerm.trim())}
        onExpand={() => setFindCollapsed(false)}
        onClose={closeFind}
      />

      <ContextMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />

      <Toast
        visible={undoable !== null || plainNote !== null}
        message={plainNote?.message ?? undoable?.message ?? ''}
        icon={plainNote?.icon ?? undoable?.icon ?? Check}
        // Ein fehlgeschlagener Versuch hat nichts, was sich zuruecknehmen
        // liesse — eine Schaltflaeche ohne Wirkung waere schlimmer als keine.
        actionLabel={plainNote === null ? 'Rückgängig' : undefined}
        onAction={() => {
          undoable?.undo();
          setUndoable(null);
        }}
        onHide={() => {
          setUndoable(null);
          setPlainNote(null);
        }}
        style={{ bottom: insets.bottom + size.viewerActionBarInset }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg.base,
    padding: size.screenPadding,
  },
});
