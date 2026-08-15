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
            items={items}
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
