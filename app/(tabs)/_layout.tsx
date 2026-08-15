/**
 * Tab-Rahmen — vier Ziele: Bibliothek, Ordner, Tags, Einstellungen.
 *
 * Die Tab-Bar ist die Komponente 14 aus Schritt 3, nicht die eingebaute:
 * Flaechen, Schriftschnitte und der `fill`-Wechsel des aktiven Icons stecken
 * dort. Der Navigator liefert nur Zustand und Ziel.
 *
 * Suchscreen, Viewer, Ordner-Detail, Papierkorb und Darstellung liegen als
 * Push-Screens ueber diesem Rahmen und zeigen keine Tab-Bar — sie gehoeren
 * deshalb in den Stack eine Ebene hoeher, nicht hierher.
 *
 * Seit Schritt 6 wechselt die Leiste im Auswahlmodus auf die
 * Auswahl-Aktionsleiste (Komponente 17, Blatt `3h`). Sie muss hier stehen und
 * nicht in der Bibliothek: sie **ersetzt** die Tab-Bar, und die liegt
 * ausserhalb der Screen-Flaeche. Was sie ausloest, fuehrt die Bibliothek aus —
 * ueber `request` im Bibliothek-Zustand.
 */
import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { useDocumentStore } from '../../src/state/documents';
import { useLibraryStore } from '../../src/state/library';
import { bg } from '../../src/theme/colors';
import { Books, FolderOpen, Folders, Gear, Star, Tag, Trash } from '../../src/ui/icons';
import { SelectionBar, TabBar, type TabItem } from '../../src/ui/TabBar';

const items: TabItem[] = [
  { key: 'index', label: 'Bibliothek', icon: Books },
  { key: 'ordner', label: 'Ordner', icon: Folders },
  { key: 'tags', label: 'Tags', icon: Tag },
  { key: 'einstellungen', label: 'Einstellungen', icon: Gear },
];

export default function TabsLayout() {
  const selectionMode = useLibraryStore((state) => state.selectionMode);
  const setRequest = useLibraryStore((state) => state.setRequest);

  /**
   * Leere Bibliothek (Blatt `4a`): Ordner und Tags stehen in `text/tertiary`
   * und sind nicht anwaehlbar — ohne Dokumente fuehren sie nur in weitere
   * leere Screens. Einstellungen bleibt erreichbar, dort gibt es auch ohne
   * Bestand etwas zu tun.
   *
   * Erst nach dem Lesen der Datenbank: bis dahin ist die Bibliothek nicht
   * leer, sondern unbekannt (Blatt `4b` zeigt alle vier Ziele normal).
   */
  const hydrated = useDocumentStore((state) => state.hydrated);
  const documents = useDocumentStore((state) => state.documents);
  const empty = hydrated && documents.every((document) => document.trashedAt !== null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: bg.base },
      }}
      tabBar={({ state, navigation }) =>
        selectionMode ? (
          <SelectionBar
            actions={[
              {
                key: 'move',
                label: 'Verschieben',
                icon: FolderOpen,
                onPress: () => setRequest('move'),
              },
              { key: 'tag', label: 'Taggen', icon: Tag, onPress: () => setRequest('tag') },
              {
                key: 'favorite',
                label: 'Favorit',
                icon: Star,
                onPress: () => setRequest('favorite'),
              },
              {
                key: 'trash',
                label: 'Löschen',
                icon: Trash,
                destructive: true,
                onPress: () => setRequest('trash'),
              },
            ]}
          />
        ) : (
          <TabBar
            items={items.map((item) =>
              empty && (item.key === 'ordner' || item.key === 'tags')
                ? { ...item, disabled: true }
                : item
            )}
            value={state.routes[state.index]?.name ?? 'index'}
            onChange={(key) => navigation.navigate(key)}
          />
        )
      }
    >
      {items.map((item) => (
        <Tabs.Screen key={item.key} name={item.key} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
