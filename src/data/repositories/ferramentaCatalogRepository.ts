import type { FerramentaCatalogItem } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const ferramentaCatalogRepository = createSyncedRepository<FerramentaCatalogItem>('ferramentas_catalogo');
