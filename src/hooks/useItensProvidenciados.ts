import { useCallback, useEffect, useState } from 'react';
import type { ItemProvidenciado } from '../types/domain';
import { itemProvidenciadoRepository } from '../data/repositories/itemProvidenciadoRepository';
import { generateId } from '../utils/id';

export function useItensProvidenciados(obraId: string) {
  const [itens, setItens] = useState<ItemProvidenciado[]>([]);

  const refresh = useCallback(
    () => setItens(itemProvidenciadoRepository.list().filter((i) => i.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const isProvidenciado = useCallback(
    (itemKey: string) => itens.some((i) => i.itemKey === itemKey && i.providenciado),
    [itens],
  );

  const toggle = useCallback(
    (itemKey: string) => {
      const existing = itemProvidenciadoRepository.list().find((i) => i.obraId === obraId && i.itemKey === itemKey);
      if (existing) {
        itemProvidenciadoRepository.update(existing.id, { providenciado: !existing.providenciado });
      } else {
        itemProvidenciadoRepository.create({ id: generateId(), obraId, itemKey, providenciado: true });
      }
      refresh();
    },
    [obraId, refresh],
  );

  return { isProvidenciado, toggle };
}
