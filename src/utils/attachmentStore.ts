import { downloadDataUrl } from './downloadDataUrl';
import { fetchAnexo, pushAnexo, deleteAnexoRemote } from '../data/apiSync';

/**
 * Guarda o conteúdo pesado dos anexos (fotos, PDFs, comprovantes) no IndexedDB em vez de embutido
 * no JSON do localStorage — o localStorage tem cota de ~5-10MB por site, o IndexedDB aceita muito mais.
 * Anexos antigos (já salvos com dataUrl embutido) continuam funcionando sem migração: loadAnexoDataUrl
 * devolve o dataUrl direto quando ele já vem preenchido, e só busca no IndexedDB quando vem vazio (ponteiro).
 */

const DB_NAME = 'brics-attachments';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 5000;

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timeout = setTimeout(() => {
      reject(new Error('Não foi possível abrir o armazenamento de anexos (IndexedDB) — outra aba pode estar travando a conexão.'));
    }, OPEN_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      reject(new Error('Não foi possível abrir o armazenamento de anexos — feche outras abas do BRICS e tente novamente.'));
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timeout);
      reject(request.error ?? new Error('Não foi possível abrir o armazenamento de anexos.'));
    };
  }).catch((err: unknown) => {
    dbPromise = undefined;
    throw err;
  });

  dbPromise = promise;
  return promise;
}

/** Grava só no IndexedDB local, sem tocar o servidor — usado pelo restore de backup e pelo cache de leitura remota. */
function putBlobLocal(id: string, dataUrl: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id, dataUrl });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Não foi possível salvar o anexo.'));
      }),
  );
}

/** Grava local e sincroniza com o servidor em segundo plano — usado ao criar um anexo novo no app. */
export function putBlob(id: string, dataUrl: string): Promise<void> {
  pushAnexo(id, dataUrl);
  return putBlobLocal(id, dataUrl);
}

function getBlobLocal(id: string): Promise<string | undefined> {
  return openDb().then(
    (db) =>
      new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result?.dataUrl);
        req.onerror = () => reject(req.error ?? new Error('Não foi possível ler o anexo.'));
      }),
  );
}

/**
 * Lê do IndexedDB local; se não achar (ex: outro navegador/máquina que nunca criou esse anexo
 * localmente), busca no servidor e guarda em cache local pra não repetir a viagem de rede.
 */
export async function getBlob(id: string): Promise<string | undefined> {
  const local = await getBlobLocal(id);
  if (local !== undefined) return local;

  const remote = await fetchAnexo(id).catch((err: unknown) => {
    console.error(`Falha ao buscar anexo "${id}" no servidor:`, err);
    return undefined;
  });
  if (remote === undefined) return undefined;

  await putBlobLocal(id, remote);
  return remote;
}

/** Remove local e no servidor em segundo plano — usado ao excluir um anexo no app. */
export function deleteBlob(id: string): Promise<void> {
  deleteAnexoRemote(id);
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Não foi possível remover o anexo.'));
      }),
  );
}

/** Usado só pelo backup — lê tudo em N transações sequenciais (não uma transação compartilhada entre awaits). */
export function getAllBlobsRaw(): Promise<Record<string, string>> {
  return openDb().then(
    (db) =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const out: Record<string, string> = {};
          for (const row of req.result as { id: string; dataUrl: string }[]) out[row.id] = row.dataUrl;
          resolve(out);
        };
        req.onerror = () => reject(req.error ?? new Error('Não foi possível ler os anexos.'));
      }),
  );
}

export function clearAllBlobs(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Não foi possível limpar os anexos.'));
      }),
  );
}

/**
 * Usado só pelo backup manual (arquivo local) — grava sequencialmente, um por vez (evita
 * transação viva entre awaits), só no IndexedDB. Não sincroniza com o servidor: restaurar
 * um arquivo de backup é uma operação local, igual ao restore de `dados` em backup.ts.
 */
export async function restoreAllBlobs(entries: Record<string, string>): Promise<void> {
  for (const [id, dataUrl] of Object.entries(entries)) {
    await putBlobLocal(id, dataUrl);
  }
}

/** Move o dataUrl de um anexo recém-criado para o IndexedDB; devolve o mesmo item com dataUrl vazio (ponteiro). */
export function storeAnexo<T extends { id: string; dataUrl: string }>(item: T): Promise<T> {
  return putBlob(item.id, item.dataUrl).then(() => ({ ...item, dataUrl: '' }));
}

/** Resolve o dataUrl real de um anexo: se já vier preenchido (anexo antigo, embutido), devolve direto; senão busca no IndexedDB. */
export function loadAnexoDataUrl(item: { id: string; dataUrl: string }): Promise<string> {
  if (item.dataUrl) return Promise.resolve(item.dataUrl);
  return getBlob(item.id).then((b) => b ?? '');
}

export function downloadAnexo(item: { id: string; dataUrl: string; nome: string }): Promise<void> {
  return loadAnexoDataUrl(item)
    .then((url) => {
      if (!url) {
        alert(`Não foi possível baixar "${item.nome}" — o arquivo não está salvo neste navegador nem na nuvem. Provavelmente ele foi anexado noutro dispositivo e falhou ao sincronizar; será preciso anexar de novo.`);
        return;
      }
      downloadDataUrl(url, item.nome);
    })
    .catch((err: unknown) => {
      console.error(`Falha ao baixar anexo "${item.nome}":`, err);
      alert(`Não foi possível baixar "${item.nome}": ${err instanceof Error ? err.message : 'erro desconhecido'}.`);
    });
}
