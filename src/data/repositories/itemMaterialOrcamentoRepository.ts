import type { ItemMaterialOrcamento } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const itemMaterialOrcamentoRepository = createSyncedRepository<ItemMaterialOrcamento>('orcamento_materiais_itens');
