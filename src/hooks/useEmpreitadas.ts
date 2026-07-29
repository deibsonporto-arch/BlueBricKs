import { useCallback, useEffect, useState } from 'react';
import type { Empreitada, MedicaoEmpreitada } from '../types/domain';
import { empreitadaRepository } from '../data/repositories/empreitadaRepository';
import { generateId } from '../utils/id';

export function useEmpreitadas(obraId: string) {
  const [empreitadas, setEmpreitadas] = useState<Empreitada[]>([]);

  const refresh = useCallback(
    () => setEmpreitadas(empreitadaRepository.list().filter((e) => e.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createEmpreitada = useCallback(
    async (empreitada: Empreitada) => {
      empreitadaRepository.create(empreitada);
      refresh();
    },
    [refresh],
  );

  const updateEmpreitada = useCallback(
    async (id: string, patch: Partial<Empreitada>) => {
      empreitadaRepository.update(id, { ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteEmpreitada = useCallback(
    async (id: string) => {
      empreitadaRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  const proximaSequencia = (empreitada: Empreitada) =>
    empreitada.medicoes.length > 0 ? Math.max(...empreitada.medicoes.map((m) => m.sequencia)) + 1 : 1;

  const registrarMedicao = useCallback(
    async (empreitadaId: string, dados: Omit<MedicaoEmpreitada, 'id' | 'sequencia'>) => {
      const empreitada = empreitadaRepository.get(empreitadaId);
      if (!empreitada) throw new Error('Empreitada não encontrada');
      const medicao: MedicaoEmpreitada = { ...dados, id: generateId(), sequencia: proximaSequencia(empreitada) };
      empreitadaRepository.update(empreitadaId, {
        medicoes: [...empreitada.medicoes, medicao],
        updatedAt: new Date().toISOString(),
      });
      refresh();
      return medicao;
    },
    [refresh],
  );

  // Registra várias etapas medidas de uma vez (mesma visita) como uma única medição —
  // todas dividem o mesmo número de sequência, em vez de virar 2ª, 3ª, 4ª etc.
  const registrarMedicoes = useCallback(
    async (empreitadaId: string, listaDados: Omit<MedicaoEmpreitada, 'id' | 'sequencia'>[]) => {
      const empreitada = empreitadaRepository.get(empreitadaId);
      if (!empreitada) throw new Error('Empreitada não encontrada');
      const sequencia = proximaSequencia(empreitada);
      const novasMedicoes: MedicaoEmpreitada[] = listaDados.map((dados) => ({ ...dados, id: generateId(), sequencia }));
      empreitadaRepository.update(empreitadaId, {
        medicoes: [...empreitada.medicoes, ...novasMedicoes],
        updatedAt: new Date().toISOString(),
      });
      refresh();
      return novasMedicoes;
    },
    [refresh],
  );

  const atualizarMedicao = useCallback(
    async (empreitadaId: string, medicaoId: string, patch: Partial<MedicaoEmpreitada>) => {
      const empreitada = empreitadaRepository.get(empreitadaId);
      if (!empreitada) throw new Error('Empreitada não encontrada');
      empreitadaRepository.update(empreitadaId, {
        medicoes: empreitada.medicoes.map((m) => (m.id === medicaoId ? { ...m, ...patch } : m)),
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [refresh],
  );

  const removerMedicao = useCallback(
    async (empreitadaId: string, medicaoId: string) => {
      const empreitada = empreitadaRepository.get(empreitadaId);
      if (!empreitada) throw new Error('Empreitada não encontrada');
      const restantes = empreitada.medicoes.filter((m) => m.id !== medicaoId);
      // renumera a sequência para não deixar buracos (ex: 1ª, 3ª virando 1ª, 2ª), preservando
      // o agrupamento — medições que dividem o mesmo número (registradas juntas) continuam juntas
      const sequenciasOrdenadas = [...new Set(restantes.map((m) => m.sequencia))].sort((a, b) => a - b);
      const mapaNovaSequencia = new Map(sequenciasOrdenadas.map((seq, i) => [seq, i + 1]));
      const renumeradas = restantes.map((m) => ({ ...m, sequencia: mapaNovaSequencia.get(m.sequencia)! }));
      empreitadaRepository.update(empreitadaId, {
        medicoes: renumeradas,
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [refresh],
  );

  return { empreitadas, createEmpreitada, updateEmpreitada, deleteEmpreitada, registrarMedicao, registrarMedicoes, atualizarMedicao, removerMedicao, refresh };
}
