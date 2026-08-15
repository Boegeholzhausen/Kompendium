/**
 * Schreiben in die Datenbank, ohne die Oberflaeche darauf warten zu lassen.
 *
 * Jede Aenderung landet zuerst im Zustand — dort ist sie sofort sichtbar — und
 * gleich danach in der Datenbank. Der Schreibvorgang wird bewusst nicht
 * abgewartet: eine Zeile, die erst nach dem Festschreiben umspringt, faehlt
 * sich traege an, und der Zustand ist bereits die Wahrheit fuer diesen Lauf.
 *
 * Faellt das Schreiben aus, laeuft die App weiter und meldet es im Protokoll.
 * Die Alternative — eine Fehlermeldung auf dem Screen — haette hier keinen
 * Adressaten: der Nutzer kann nichts daran aendern, und seine Aenderung ist
 * nicht verloren, sondern nur nicht dauerhaft.
 */
export function persist(work: () => Promise<void>): void {
  work().catch((error: unknown) => {
    console.warn('[kompendium] Schreiben in die Datenbank fehlgeschlagen:', error);
  });
}
