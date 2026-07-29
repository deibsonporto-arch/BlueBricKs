import type { DiarioEntry } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const diarioRepository = createSyncedRepository<DiarioEntry>('diario_entries');
