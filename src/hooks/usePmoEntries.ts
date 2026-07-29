import { useCallback, useEffect, useState } from 'react';
import type { PmoEntry } from '../types/domain';
import { pmoRepository } from '../data/repositories/pmoRepository';
import { generateId } from '../utils/id';

export function usePmoEntries(obraId: string, mes: string) {
  const [entries, setEntries] = useState<PmoEntry[]>([]);

  const refresh = useCallback(
    () => setEntries(pmoRepository.list().filter((e) => e.obraId === obraId && e.mes === mes)),
    [obraId, mes],
  );
  useEffect(() => refresh(), [refresh]);

  const getEntry = useCallback(
    (subatividadeId: string) => entries.find((e) => e.subatividadeId === subatividadeId),
    [entries],
  );

  const upsertEntry = useCallback(
    (
      atividadeId: string,
      subatividadeId: string,
      patch: Partial<Omit<PmoEntry, 'id' | 'obraId' | 'atividadeId' | 'subatividadeId' | 'mes'>>,
      numSemanas: number,
    ) => {
      const existing = pmoRepository.list().find((e) => e.obraId === obraId && e.mes === mes && e.subatividadeId === subatividadeId);
      const now = new Date().toISOString();
      if (existing) {
        pmoRepository.update(existing.id, { ...patch, updatedAt: now });
      } else {
        pmoRepository.create({
          id: generateId(),
          obraId,
          atividadeId,
          subatividadeId,
          mes,
          percentualReal: 0,
          checklistSemanal: new Array(numSemanas).fill(false),
          observacoes: '',
          updatedAt: now,
          ...patch,
        });
      }
      refresh();
    },
    [obraId, mes, refresh],
  );

  return { entries, getEntry, upsertEntry, refresh };
}
