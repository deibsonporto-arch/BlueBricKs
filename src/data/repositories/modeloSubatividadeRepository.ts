import type { ModeloSubatividade } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const modeloSubatividadeRepository = createSyncedRepository<ModeloSubatividade>('modelos_subatividade');
