import type { Locacao } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const locacaoRepository = createSyncedRepository<Locacao>('locacoes');
