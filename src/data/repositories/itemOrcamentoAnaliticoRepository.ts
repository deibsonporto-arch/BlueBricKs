import type { ItemOrcamentoAnalitico } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const itemOrcamentoAnaliticoRepository = createSyncedRepository<ItemOrcamentoAnalitico>('orcamento_analitico_itens');
