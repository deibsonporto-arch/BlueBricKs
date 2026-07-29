import { useCallback, useEffect, useState } from 'react';
import type { LancamentoFinanceiro } from '../types/domain';
import { lancamentoRepository } from '../data/repositories/lancamentoRepository';

export function useLancamentos(obraId: string) {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);

  const refresh = useCallback(
    () => setLancamentos(lancamentoRepository.list().filter((l) => l.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createLancamento = useCallback(
    async (lancamento: LancamentoFinanceiro) => {
      lancamentoRepository.create(lancamento);
      refresh();
    },
    [refresh],
  );

  const updateLancamento = useCallback(
    async (id: string, patch: Partial<LancamentoFinanceiro>) => {
      lancamentoRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteLancamento = useCallback(
    async (id: string) => {
      lancamentoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { lancamentos, createLancamento, updateLancamento, deleteLancamento, refresh };
}
