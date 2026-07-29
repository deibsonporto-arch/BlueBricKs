import { createSyncedRepository } from './localStorageRepository';
import type { Usuario } from '../../types/domain';

export const usuarioRepository = createSyncedRepository<Usuario>('usuarios');
