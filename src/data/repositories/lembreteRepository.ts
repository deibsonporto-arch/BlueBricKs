import type { Lembrete } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const lembreteRepository = createSyncedRepository<Lembrete>('lembretes');
