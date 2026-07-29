import type { Empreitada } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const empreitadaRepository = createSyncedRepository<Empreitada>('empreitadas');
