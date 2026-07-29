import { readCollection, writeCollection } from '../storage';
import { pushCollection } from '../apiSync';
import type { Repository } from './types';

export function createLocalStorageRepository<T extends { id: string }>(key: string): Repository<T> {
  return {
    list: () => readCollection<T>(key),
    get: (id) => readCollection<T>(key).find((i) => i.id === id),
    create: (item) => {
      const all = readCollection<T>(key);
      all.push(item);
      writeCollection(key, all);
      return item;
    },
    update: (id, patch) => {
      const all = readCollection<T>(key);
      const idx = all.findIndex((i) => i.id === id);
      if (idx === -1) return undefined;
      all[idx] = { ...all[idx], ...patch };
      writeCollection(key, all);
      return all[idx];
    },
    remove: (id) => {
      writeCollection(
        key,
        readCollection<T>(key).filter((i) => i.id !== id),
      );
    },
  };
}

/**
 * Igual a createLocalStorageRepository (cache local, leitura/escrita síncrona,
 * nenhum componente muda) mas também envia a coleção inteira pro backend a cada
 * escrita, em segundo plano — o Postgres passa a ser a fonte durável dos dados,
 * compartilhada entre navegadores/máquinas a cada login/reload.
 */
export function createSyncedRepository<T extends { id: string }>(key: string): Repository<T> {
  const base = createLocalStorageRepository<T>(key);

  function sync() {
    pushCollection(key, readCollection<T>(key));
  }

  return {
    list: base.list,
    get: base.get,
    create: (item) => {
      const result = base.create(item);
      sync();
      return result;
    },
    update: (id, patch) => {
      const result = base.update(id, patch);
      sync();
      return result;
    },
    remove: (id) => {
      base.remove(id);
      sync();
    },
  };
}
