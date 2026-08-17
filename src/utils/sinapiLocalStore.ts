/**
 * Armazenamento local (IndexedDB) da base de referência SINAPI, importada por arquivo no
 * próprio computador — ver sinapiLocalImport.ts. Cada pessoa importa no seu navegador; os
 * dados não são compartilhados na nuvem (são grandes demais e somente-leitura, não precisam).
 */

const DB_NAME = 'brics-sinapi';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'chave' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local da base SINAPI.'));
  }).catch((err: unknown) => {
    dbPromise = undefined;
    throw err;
  });

  dbPromise = promise;
  return promise;
}

export async function salvarBlobSinapi(chave: string, valor: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ chave, valor });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível salvar dados da base SINAPI.'));
  });
}

export async function lerBlobSinapi<T>(chave: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(chave);
    req.onsuccess = () => resolve(req.result?.valor as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('Não foi possível ler dados da base SINAPI.'));
  });
}

export async function limparBlobsSinapi(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível limpar a base SINAPI local.'));
  });
}
