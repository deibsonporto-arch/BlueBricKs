import type { HistoricoPrecoItem } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const historicoPrecoRepository = createSyncedRepository<HistoricoPrecoItem>('historico_precos');
