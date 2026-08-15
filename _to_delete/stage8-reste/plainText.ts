/**
 * HTML auf seinen Text herunterbrechen.
 *
 * Zwei Leser: die Typerkennung beim Import (Textmenge) und der Suchindex
 * (Volltext). Deshalb steht die Funktion in einem eigenen Modul und nicht in
 * einem der beiden — sonst muessten sie sich gegenseitig importieren.
 *
 * Kein Parser: React Native hat kein DOM, und fuer diese beiden Zwecke genuegt
 * es, Auszeichnungen zu entfernen. Ein fehlerhaftes Dokument fuehrt so
 * hoechstens zu einem schlechteren Textausschnitt, nie zu einem Absturz.
 */
export function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
