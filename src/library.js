/**
 * Bibliothèque de versions : les modèles enregistrés par l'utilisateur.
 *
 * Le stockage s'appuie directement sur IndexedDB, sans bibliothèque. C'est déjà
 * le magasin qu'enveloppent les paquets habituels, et c'est le seul qui accepte
 * les images telles quelles : une version conserve le visuel importé sous forme
 * de `Blob`, ce que `localStorage` — limité à quelques mégaoctets de texte — ne
 * permettrait pas.
 *
 * Chaque enregistrement contient de quoi reconstituer exactement l'écran quitté :
 *
 *   { id, name, createdAt, updatedAt,
 *     state,                       tous les réglages
 *     source: null | { kind: 'preset', presetId }
 *                  | { kind: 'image' | 'svg', name, blob, bbox },
 *     thumb }                      vignette PNG pour la liste
 */

const DB_NAME = 'reflecto';
const STORE = 'versions';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Ce navigateur ne propose pas de stockage local.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Stockage local inaccessible.'));
    // En navigation privée, l'ouverture peut rester bloquée sans jamais échouer.
    request.onblocked = () => reject(new Error('Stockage local bloqué.'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

/** Exécute une transaction et renvoie le résultat de la requête produite. */
function run(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    let result;
    if (request) request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Enregistrement interrompu.'));
  }));
}

/** Le stockage est-il utilisable ? Un refus ne doit pas casser l'édition. */
export async function isAvailable() {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

/** Versions les plus récentes d'abord. */
export async function listVersions() {
  const all = await run('readonly', (store) => store.getAll());
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getVersion(id) {
  return run('readonly', (store) => store.get(id));
}

export async function putVersion(record) {
  await run('readwrite', (store) => store.put(record));
  return record;
}

export async function deleteVersion(id) {
  await run('readwrite', (store) => store.delete(id));
}

export async function renameVersion(id, name) {
  const record = await getVersion(id);
  if (!record) return null;
  record.name = name;
  record.updatedAt = Date.now();
  return putVersion(record);
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() || `v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Signature du contenu d'une version, pour repérer qu'un modèle chargé a été
 * modifié depuis. Les blobs ne sont pas comparés : seule l'identité de la
 * source compte, son contenu ne change pas sous elle.
 */
export function signature(state, source) {
  return JSON.stringify([
    state,
    source ? (source.presetId || source.name || source.kind) : null,
  ]);
}
