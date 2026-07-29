import type { LancamentoFinanceiro } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const lancamentoRepository = createSyncedRepository<LancamentoFinanceiro>('lancamentos');
