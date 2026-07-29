import type { LocalFerramentas } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const localFerramentasRepository = createSyncedRepository<LocalFerramentas>('locais_ferramentas');
