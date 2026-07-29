import type { Fornecedor } from '../../types/domain';
import { createSyncedRepository } from './localStorageRepository';

export const fornecedorRepository = createSyncedRepository<Fornecedor>('fornecedores');
