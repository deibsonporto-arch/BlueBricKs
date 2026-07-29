import type { Ferramenta } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const ferramentaRepository = createSyncedRepository<Ferramenta>('ferramentas');
