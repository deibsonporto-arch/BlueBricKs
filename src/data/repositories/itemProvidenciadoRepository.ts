import type { ItemProvidenciado } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const itemProvidenciadoRepository = createSyncedRepository<ItemProvidenciado>('itens_providenciados');
