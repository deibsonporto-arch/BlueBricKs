import { useCallback, useEffect, useState } from 'react';
import type { Fornecedor } from '../types/domain';
import { fornecedorRepository } from '../data/repositories/fornecedorRepository';

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const refresh = useCallback(() => setFornecedores(fornecedorRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createFornecedor = useCallback(
    async (fornecedor: Fornecedor) => {
      fornecedorRepository.create(fornecedor);
      refresh();
    },
    [refresh],
  );

  const updateFornecedor = useCallback(
    async (id: string, patch: Partial<Fornecedor>) => {
      fornecedorRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteFornecedor = useCallback(
    async (id: string) => {
      fornecedorRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { fornecedores, createFornecedor, updateFornecedor, deleteFornecedor, refresh };
}
