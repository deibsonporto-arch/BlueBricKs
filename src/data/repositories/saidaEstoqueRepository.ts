import type { SaidaEstoque } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const saidaEstoqueRepository = createSyncedRepository<SaidaEstoque>('saidas_estoque');
