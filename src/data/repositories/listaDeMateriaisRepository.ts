import type { ListaDeMateriais } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const listaDeMateriaisRepository = createSyncedRepository<ListaDeMateriais>('listas_materiais');
