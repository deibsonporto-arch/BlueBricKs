import type { Obra } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const obraRepository = createSyncedRepository<Obra>('obras');
