/**
 * Woher der Viewer sein HTML bekommt.
 *
 * Drei Quellen, die derselbe Wert nach aussen sind:
 *
 *   Dateicache        der Normalfall — importiert oder schon einmal geholt
 *   Supabase Storage  was der Abgleich brachte, ist zunaechst nur eine Zeile;
 *                     die Datei kommt beim ersten Oeffnen nach
 *                     (DATABASE_STRUCTURE.md, Sync-Strategie)
 *   erzeugt           ausschliesslich die Erstbefuellung, die keine Datei hat
 *
 * Herausgeloest aus `ViewerScreen`, der Laden, Suchen, Menue, Sheets und
 * Toasts in einer Komponente hielt. Der Screen fragt jetzt nach dem Ergebnis
 * und nicht mehr nach dem Weg dorthin.
 *
 * `alive` in beiden Effekten: wer schnell blaettert, verlaesst den Viewer, bevor
 * die Datei da ist — ein `setState` danach traefe eine Komponente, die es
 * nicht mehr gibt.
 */
import { useEffect, useMemo, useState } from 'react';

import { readDocument } from '../../data/cache';
import { downloadDocument, needsDownload } from '../../data/remote/download';
import type { StoredDocument } from '../../data/library';
import { sampleDocumentHtml } from '../../data/sampleDocumentHtml';

export interface DocumentHtml {
  /** Vollstaendige Seite; leer, solange nichts (mehr) da ist. */
  html: string;
  /**
   * Ist der Versuch, die Datei nachzuladen, gescheitert?
   *
   * Mit Netz ist ein nicht gecachtes Dokument zunaechst nur eine Wartezeit.
   * Bleibt der Abruf aber erfolglos, ist die Wartezeit vorbei und das Dokument
   * genauso wenig zu oeffnen wie ohne Netz — dann soll auch dasselbe dastehen
   * statt einer leeren Buehne, die nichts erklaert.
   */
  loadFailed: boolean;
}

export interface DocumentHtmlOptions {
  document: StoredDocument | undefined;
  isOnline: boolean;
  /** Aus dem Dokument-Zustand: die Zeile weiss danach, dass die Datei hier liegt. */
  markCached: (documentId: string, cacheKey: string, sizeBytes: number) => void;
  /** Innenabstaende fuer den erzeugten Beispielinhalt. */
  padTop: number;
  padBottom: number;
}

export function useDocumentHtml({
  document,
  isOnline,
  markCached,
  padTop,
  padBottom,
}: DocumentHtmlOptions): DocumentHtml {
  const [loadFailed, setLoadFailed] = useState(false);
  /** Der Inhalt aus dem Dateicache; `null`, solange er noch gelesen wird. */
  const [cachedHtml, setCachedHtml] = useState<string | null>(null);

  /**
   * Was der Abgleich gebracht hat, ist zunaechst nur eine Zeile: die Datei
   * liegt noch oben. Sie kommt hier nach — beim Oeffnen, nicht beim Abgleich.
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

  const html = useMemo(() => {
    if (!document) return '';
    if (document.cacheKey !== null) return cachedHtml ?? '';
    // Der erzeugte Beispielinhalt gilt ausschliesslich fuer die Erstbefuellung.
    // Ihn auch fuer ein echtes Dokument zu zeigen, dessen Datei gerade erst
    // geholt wird, waere die schlimmste Form von Platzhalter: einer, der wie
    // der Inhalt aussieht. Bis die Datei da ist, bleibt die Buehne leer —
    // sie ist `bg/base`, es blitzt also nichts auf.
    if (document.source !== 'sample') return '';
    return sampleDocumentHtml(document, padTop, padBottom);
  }, [document, cachedHtml, padTop, padBottom]);

  return { html, loadFailed };
}
