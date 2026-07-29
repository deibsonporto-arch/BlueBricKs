import type { MaterialCatalogItem } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const materialCatalogRepository = createSyncedRepository<MaterialCatalogItem>('materiais_catalogo');
