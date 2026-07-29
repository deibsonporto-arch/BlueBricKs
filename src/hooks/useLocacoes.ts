import { useCallback, useEffect, useState } from 'react';
import type { Locacao } from '../types/domain';
import { locacaoRepository } from '../data/repositories/locacaoRepository';

export function useLocacoes(obraId: string) {
  const [locacoes, setLocacoes] = useState<Locacao[]>([]);

  const refresh = useCallback(
    () => setLocacoes(locacaoRepository.list().filter((l) => l.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createLocacao = useCallback(
    async (locacao: Locacao) => {
      locacaoRepository.create(locacao);
      refresh();
    },
    [refresh],
  );

  const updateLocacao = useCallback(
    async (id: string, patch: Partial<Locacao>) => {
      locacaoRepository.update(id, { ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteLocacao = useCallback(
    async (id: string) => {
      locacaoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  const getByLancamentoId = useCallback(
    (lancamentoId: string) => locacaoRepository.list().find((l) => l.lancamentoId === lancamentoId),
    [],
  );

  return { locacoes, createLocacao, updateLocacao, deleteLocacao, getByLancamentoId, refresh };
}
