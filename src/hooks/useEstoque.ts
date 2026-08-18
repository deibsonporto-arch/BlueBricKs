import { useCallback, useEffect, useState } from 'react';
import type { EntradaEstoque, SaidaEstoque } from '../types/domain';
import { entradaEstoqueRepository } from '../data/repositories/entradaEstoqueRepository';
import { saidaEstoqueRepository } from '../data/repositories/saidaEstoqueRepository';

export function useEstoque(obraId: string) {
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([]);
  const [saidas, setSaidas] = useState<SaidaEstoque[]>([]);

  const refresh = useCallback(() => {
    setEntradas(entradaEstoqueRepository.list().filter((e) => e.obraId === obraId));
    setSaidas(saidaEstoqueRepository.list().filter((s) => s.obraId === obraId));
  }, [obraId]);
  useEffect(() => refresh(), [refresh]);

  const createEntrada = useCallback(
    async (entrada: EntradaEstoque) => {
      entradaEstoqueRepository.create(entrada);
      refresh();
    },
    [refresh],
  );

  const updateEntrada = useCallback(
    async (id: string, patch: Partial<EntradaEstoque>) => {
      entradaEstoqueRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteEntrada = useCallback(
    async (id: string) => {
      entradaEstoqueRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  const createSaida = useCallback(
    async (saida: SaidaEstoque) => {
      saidaEstoqueRepository.create(saida);
      refresh();
    },
    [refresh],
  );

  const deleteSaida = useCallback(
    async (id: string) => {
      saidaEstoqueRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { entradas, saidas, createEntrada, updateEntrada, deleteEntrada, createSaida, deleteSaida, refresh };
}
