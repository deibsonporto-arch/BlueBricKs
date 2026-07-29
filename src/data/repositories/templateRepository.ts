import type { ObraTemplate } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const templateRepository = createSyncedRepository<ObraTemplate>('templates');
