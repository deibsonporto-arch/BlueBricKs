import type { PmoEntry } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const pmoRepository = createSyncedRepository<PmoEntry>('pmo_entries');
