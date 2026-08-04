/**
 * Stockage local : la bibliothèque de versions et le visuel de travail.
 *
 * Tout s'appuie directement sur IndexedDB, sans bibliothèque. C'est déjà le
 * magasin qu'enveloppent les paquets habituels, et c'est le seul qui accepte
 * les images telles quelles : une version — ou le visuel en cours — conserve
 * l'import sous forme de `Blob`, ce que `localStorage` — limité à quelques
 * mégaoctets de texte — ne permettrait pas.
 *
 * Deux magasins :
 *
 *   `versions`  { id, name, createdAt, updatedAt,
 *                 state,                       tous les réglages
 *                 source: null | { kind: 'preset', presetId }
 *                              | { kind: 'image' | 'svg', name, blob, bbox },
 *                 thumb }                      vignette PNG pour la liste
 *
 *   `workspace` { id: 'current', source, updatedAt }
 *               le visuel affiché à l'instant, pour le retrouver après un
 *               rechargement — les réglages, eux, tiennent dans `localStorage`
 *               et survivent déjà d'une visite à l'autre.
 */

const DB_NAME = 'reflecto';
const VERSIONS_STORE = 'versions';
const WORKSPACE_STORE = 'workspace';
const WORKSPACE_ID = 'current';
const DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        db.createObjectStore(VERSIONS_STORE, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
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

/** Exécute une transaction sur le magasin donné et renvoie le résultat de la requête produite. */
function run(storeName, mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
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

/* ------------------------------------------------------------------ versions */

/** Versions les plus récentes d'abord. */
export async function listVersions() {
  const all = await run(VERSIONS_STORE, 'readonly', (store) => store.getAll());
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getVersion(id) {
  return run(VERSIONS_STORE, 'readonly', (store) => store.get(id));
}

export async function putVersion(record) {
  await run(VERSIONS_STORE, 'readwrite', (store) => store.put(record));
  return record;
}

export async function deleteVersion(id) {
  await run(VERSIONS_STORE, 'readwrite', (store) => store.delete(id));
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

/* ----------------------------------------------------------------- espace de travail */

/** Visuel affiché lors de la dernière visite, ou `undefined` si rien n'a jamais été enregistré. */
export async function getWorkspaceSource() {
  return run(WORKSPACE_STORE, 'readonly', (store) => store.get(WORKSPACE_ID));
}

/** `source` suit le même format que dans une version : `null` si aucun visuel n'est affiché. */
export async function setWorkspaceSource(source) {
  await run(WORKSPACE_STORE, 'readwrite', (store) => store.put({
    id: WORKSPACE_ID, source, updatedAt: Date.now(),
  }));
}
