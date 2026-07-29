import { useCallback, useEffect, useState } from 'react';
import type { DiarioEntry } from '../types/domain';
import { diarioRepository } from '../data/repositories/diarioRepository';

function loadEntries(obraId: string): DiarioEntry[] {
  return diarioRepository
    .list()
    .filter((e) => e.obraId === obraId)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}

export function useDiarioEntries(obraId: string) {
  const [entries, setEntries] = useState<DiarioEntry[]>(() => loadEntries(obraId));

  const refresh = useCallback(() => setEntries(loadEntries(obraId)), [obraId]);
  useEffect(() => refresh(), [refresh]);

  const getByData = useCallback((data: string) => entries.find((e) => e.data === data), [entries]);

  const saveEntry = useCallback(
    async (entry: DiarioEntry) => {
      const existing = diarioRepository.list().find((e) => e.obraId === obraId && e.data === entry.data);
      if (existing) {
        diarioRepository.update(existing.id, { ...entry, id: existing.id, updatedAt: new Date().toISOString() });
      } else {
        diarioRepository.create(entry);
      }
      refresh();
    },
    [obraId, refresh],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      diarioRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { entries, getByData, saveEntry, deleteEntry, refresh };
}
