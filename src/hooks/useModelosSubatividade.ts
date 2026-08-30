import { useCallback, useEffect, useState } from 'react';
import type { ModeloSubatividade } from '../types/domain';
import { modeloSubatividadeRepository } from '../data/repositories/modeloSubatividadeRepository';

/** Modelos de subatividade são globais (reutilizáveis em qualquer obra), como os OrcamentoModelo —
 * por isso não filtra por obraId. */
export function useModelosSubatividade() {
  const [modelos, setModelos] = useState<ModeloSubatividade[]>([]);

  const refresh = useCallback(() => setModelos(modeloSubatividadeRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const salvarModelo = useCallback(
    async (modelo: ModeloSubatividade) => {
      modeloSubatividadeRepository.create(modelo);
      refresh();
    },
    [refresh],
  );

  const atualizarModelo = useCallback(
    async (id: string, patch: Partial<ModeloSubatividade>) => {
      modeloSubatividadeRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const removerModelo = useCallback(
    async (id: string) => {
      modeloSubatividadeRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { modelos, salvarModelo, atualizarModelo, removerModelo, refresh };
}
