/**
 * Screen 5 und 6 — Viewer (Blaetter `2b`, `2c`) samt Info- und Tag-Sheet.
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
 *   Tag-Sheet         darueber, ersetzt das Info-Sheet nicht
 *   Toast             ueber allem — er sichert das zuletzt Getane ab
 *
 * Die Sheets sind Ebenen dieses Screens und keine Modals: nur so laesst sich
 * die Reihenfolge Info → Tag → Toast zuverlaessig festlegen (siehe
 * `SheetLayer` in `ui/BottomSheet`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { readDocument } from '../../data/cache';
import type { LibraryTag } from '../../data/library';
import { sampleDocumentHtml } from '../../data/sampleDocumentHtml';
import { useAppearanceStore } from '../../state/appearance';
import { documentById, documentTags, useDocumentStore } from '../../state/documents';
import { colorOf, useFolderStore } from '../../state/folders';
import { useViewerStore } from '../../state/viewer';
import { bg, scrollThreshold, size, space } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { FolderOpen, Info, PencilSimple, Tag, Trash } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { Toast } from '../../ui/Toast';
import { MoveSheet } from '../folders/MoveSheet';
import { DocumentView } from './DocumentView';
import { InfoSheet } from './InfoSheet';
import { INFO_SHEET_RATIO, TAG_SHEET_RATIO } from './metrics';
import { TagSheet } from './TagSheet';
import { ViewerActionBar, ViewerHeader } from './ViewerChrome';

/** Was zuletzt geschah — der Toast bietet dafuer 5 Sekunden "Rueckgaengig". */
interface UndoableAction {
  message: string;
  undo: () => void;
}

export interface ViewerScreenProps {
  documentId: string;
  onBack: () => void;
}

export function ViewerScreen({ documentId, onBack }: ViewerScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const allDocuments = useDocumentStore((state) => state.documents);
  const document = documentById(allDocuments, documentId);

  const tags = useDocumentStore((state) => state.tags);
  const setTitle = useDocumentStore((state) => state.setTitle);
  const setNote = useDocumentStore((state) => state.setNote);
  const setKeepOffline = useDocumentStore((state) => state.setKeepOffline);
  const setFolder = useDocumentStore((state) => state.setFolder);
  const assignTag = useDocumentStore((state) => state.assignTag);
  const removeTag = useDocumentStore((state) => state.removeTag);
  const createTag = useDocumentStore((state) => state.createTag);
  const countOpen = useDocumentStore((state) => state.countOpen);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const trashDocuments = useDocumentStore((state) => state.trash);
  const folders = useFolderStore((state) => state.folders);

  const textScale = useAppearanceStore((state) => state.viewerTextScale);
  const dimDocuments = useAppearanceStore((state) => state.dimDocuments);
  const keepScreenOn = useAppearanceStore((state) => state.keepScreenOn);

  const rememberScroll = useViewerStore((state) => state.rememberScroll);
  const initialOffset = useViewerStore((state) => state.scrollPositions[documentId] ?? 0);

  const [chromeVisible, setChromeVisible] = useState(true);
  /** Der Inhalt aus dem Dateicache; `null`, solange er noch gelesen wird. */
  const [cachedHtml, setCachedHtml] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<null | 'info' | 'tags' | 'move'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);

  /**
   * Letzter gemeldeter Versatz. Er steht in einem Ref und nicht im Zustand:
   * jeder Scrollschritt wuerde sonst den ganzen Screen neu zeichnen, waehrend
   * gelesen wird.
   */
  const lastOffset = useRef(initialOffset);

  /**
   * "Geoeffnet 12×" im Info-Sheet zaehlt Besuche, nicht Renderdurchlaeufe —
   * der Waechter haelt den Zaehler auch unter React StrictMode richtig, das
   * Effekte in der Entwicklung zweimal ausfuehrt.
   */
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    countOpen(documentId);
  }, [countOpen, documentId]);

  const title = document?.title ?? '';
  const assigned = useMemo(() => document?.tagIds ?? [], [document]);
  const assignedTags = useMemo(() => documentTags(tags, assigned), [tags, assigned]);

  /** Anzahl der Dokumente je Tag — die Zahl rechts in der Tag-Zeile. */
  const tagUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allDocuments) {
      for (const id of entry.tagIds) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [allDocuments]);

  /**
   * Importierte Dokumente liegen als Datei im Cache und werden von dort
   * gelesen; die Erstbefuellung hat keine Datei und bekommt ihren erzeugten
   * Beispielinhalt. Die Buehne bleibt so lange leer — sie ist `bg/base`, es
   * blitzt also nichts auf.
   */
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

  const handleShare = useCallback(() => {
    // Bis der Dateicache steht (Schritt 6), teilt das System-Sheet den Titel.
    // Sobald das Dokument als Datei liegt, kommt hier sein Pfad hinein.
    Share.share({ title, message: title }).catch(() => {});
  }, [title]);

  const toggleTag = useCallback(
    (tag: LibraryTag) => {
      if (assigned.includes(tag.id)) {
        removeTag(documentId, tag.id);
        setUndoable({
          message: `Tag „${tag.name}“ entfernt`,
          undo: () => assignTag(documentId, tag.id),
        });
        return;
      }
      assignTag(documentId, tag.id);
      setUndoable({
        message: `Tag „${tag.name}“ gesetzt`,
        undo: () => removeTag(documentId, tag.id),
      });
    },
    [assigned, assignTag, documentId, removeTag]
  );

  const handleCreateTag = useCallback(
    (name: string) => {
      const tag = createTag(name);
      assignTag(documentId, tag.id);
      setTagQuery('');
      setUndoable({
        message: `Tag „${tag.name}“ gesetzt`,
        undo: () => removeTag(documentId, tag.id),
      });
    },
    [assignTag, createTag, documentId, removeTag]
  );

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
      <DocumentView
        html={html}
        initialOffset={initialOffset}
        textScale={textScale}
        dim={dimDocuments}
        onScroll={handleScroll}
      />

      <ViewerHeader
        title={title}
        visible={chromeVisible}
        top={insets.top}
        onBack={onBack}
        onOverflow={() => setMenuOpen(true)}
      />

      <ViewerActionBar
        visible={chromeVisible}
        bottom={insets.bottom + size.viewerActionBarInset}
        favorite={favorite}
        // Kein Toast: der Zustand ist am Stern selbst zu sehen.
        onToggleFavorite={() => toggleFavorite(documentId)}
        onTags={() => setActiveSheet('tags')}
        onShare={handleShare}
        onInfo={() => setActiveSheet('info')}
      />

      <InfoSheet
        visible={activeSheet === 'info' || activeSheet === 'tags'}
        document={document}
        title={title}
        tags={assignedTags}
        note={document.note}
        keepOffline={document.keepOffline}
        openCount={document.openCount}
        folderName={document.folderName}
        folderColor={colorOf(folders, document.folderName)}
        height={Math.round(windowHeight * INFO_SHEET_RATIO)}
        onClose={() => setActiveSheet(null)}
        onChangeTitle={(next) => setTitle(documentId, next)}
        onChangeNote={(next) => setNote(documentId, next)}
        onChangeKeepOffline={(next) => setKeepOffline(documentId, next)}
        onOpenFolder={() => setActiveSheet('move')}
        onAddTag={() => setActiveSheet('tags')}
        onRemoveTag={(tagId) => removeTag(documentId, tagId)}
        onTrash={handleTrash}
      />

      <TagSheet
        visible={activeSheet === 'tags'}
        query={tagQuery}
        onChangeQuery={setTagQuery}
        tags={tags}
        assigned={assigned}
        usage={tagUsage}
        height={Math.round(windowHeight * TAG_SHEET_RATIO)}
        onToggle={toggleTag}
        onCreate={handleCreateTag}
        onRemove={(tagId) => removeTag(documentId, tagId)}
        onClose={() => setActiveSheet('info')}
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

      <ContextMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />

      <Toast
        visible={undoable !== null}
        message={undoable?.message ?? ''}
        icon={Tag}
        actionLabel="Rückgängig"
        onAction={() => {
          undoable?.undo();
          setUndoable(null);
        }}
        onHide={() => setUndoable(null)}
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
