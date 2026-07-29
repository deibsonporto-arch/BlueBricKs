import type { Cotacao } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const cotacaoRepository = createSyncedRepository<Cotacao>('cotacoes');
