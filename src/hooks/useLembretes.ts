import { useCallback, useEffect, useState } from 'react';
import type { Lembrete } from '../types/domain';
import { lembreteRepository } from '../data/repositories/lembreteRepository';
import { generateId } from '../utils/id';

export function useLembretes(obraId: string) {
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);

  const refresh = useCallback(
    () => setLembretes(lembreteRepository.list().filter((l) => l.obraId === obraId).sort((a, b) => a.data.localeCompare(b.data))),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createLembrete = useCallback(
    async (texto: string, data: string) => {
      const now = new Date().toISOString();
      lembreteRepository.create({ id: generateId(), obraId, texto, data, concluido: false, createdAt: now, updatedAt: now });
      refresh();
    },
    [obraId, refresh],
  );

  const toggleConcluido = useCallback(
    async (id: string) => {
      const lembrete = lembreteRepository.get(id);
      if (!lembrete) return;
      lembreteRepository.update(id, { concluido: !lembrete.concluido, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteLembrete = useCallback(
    async (id: string) => {
      lembreteRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { lembretes, createLembrete, toggleConcluido, deleteLembrete, refresh };
}
