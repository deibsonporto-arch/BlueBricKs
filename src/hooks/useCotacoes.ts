import { useCallback, useEffect, useState } from 'react';
import type { Cotacao } from '../types/domain';
import { cotacaoRepository } from '../data/repositories/cotacaoRepository';

export function useCotacoes(obraId: string) {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);

  const refresh = useCallback(
    () => setCotacoes(cotacaoRepository.list().filter((c) => c.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createCotacao = useCallback(
    async (cotacao: Cotacao) => {
      cotacaoRepository.create(cotacao);
      refresh();
    },
    [refresh],
  );

  const updateCotacao = useCallback(
    async (id: string, patch: Partial<Cotacao>) => {
      cotacaoRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteCotacao = useCallback(
    async (id: string) => {
      cotacaoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { cotacoes, createCotacao, updateCotacao, deleteCotacao, refresh };
}

export function melhorFornecedor(cotacao: Cotacao) {
  if (cotacao.fornecedores.length === 0) return undefined;
  if (cotacao.melhorFornecedorId) {
    const escolhido = cotacao.fornecedores.find((f) => f.id === cotacao.melhorFornecedorId);
    if (escolhido) return escolhido;
  }
  return cotacao.fornecedores.reduce((best, f) => (f.valor < best.valor ? f : best));
}
