import type { ItemRequisicao } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const requisicaoRepository = createSyncedRepository<ItemRequisicao>('requisicoes');
