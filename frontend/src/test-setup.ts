/**
 * Le socle des tests, charge avant chaque fichier.
 *
 * POURQUOI CE FICHIER EXISTE. `jsdom` expose `sessionStorage` mais pas
 * `localStorage` dans l'environnement de ce projet, si bien que tout test
 * touchant le stockage persistant levait « Cannot read properties of undefined
 * (reading 'clear') » avant meme d'atteindre ce qu'il verifiait. Cinq tests de
 * detection de langue tombaient pour cette raison, sans rapport avec la langue.
 *
 * L'application, elle, etait deja juste: `langStore` entoure ses acces d'un
 * `try/catch` et fonctionne sur un navigateur qui refuse le stockage. C'est le
 * banc d'essai qui ne ressemblait pas au navigateur.
 *
 * L'implementation suit l'interface `Storage` du DOM: des cles et des valeurs
 * converties en chaines, un `length`, et `key(i)` qui parcourt dans l'ordre
 * d'insertion. Une doublure approximative ferait passer des tests que le
 * navigateur refuserait ensuite.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(String(key)) ? this.data.get(String(key))! : null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.data.set(String(key), String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
