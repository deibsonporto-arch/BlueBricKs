import type { Equipe } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const equipeRepository = createSyncedRepository<Equipe>('equipes');
