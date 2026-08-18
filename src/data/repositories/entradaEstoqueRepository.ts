import type { EntradaEstoque } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const entradaEstoqueRepository = createSyncedRepository<EntradaEstoque>('entradas_estoque');
