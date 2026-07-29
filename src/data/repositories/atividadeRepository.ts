import type { Atividade } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';
import { readCollection, writeCollection } from '../storage';
import { pushCollection } from '../apiSync';

const base = createSyncedRepository<Atividade>('atividades');

export const atividadeRepository = {
  ...base,
  reorderByObra(obraId: string, idsNaNovaOrdem: string[]) {
    const all = readCollection<Atividade>('atividades');
    const ordemMap = new Map(idsNaNovaOrdem.map((id, i) => [id, i]));
    const daObraOrdenadas = all
      .filter((a) => a.obraId === obraId)
      .sort((a, b) => (ordemMap.get(a.id) ?? 0) - (ordemMap.get(b.id) ?? 0));
    let cursor = 0;
    const reordenado = all.map((a) => (a.obraId === obraId ? daObraOrdenadas[cursor++] : a));
    writeCollection('atividades', reordenado);
    pushCollection('atividades', reordenado);
  },
};
