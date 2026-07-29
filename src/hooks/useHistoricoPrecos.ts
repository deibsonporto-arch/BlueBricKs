import { useCallback, useEffect, useState } from 'react';
import type { HistoricoPrecoItem, TipoHistoricoPreco } from '../types/domain';
import { historicoPrecoRepository } from '../data/repositories/historicoPrecoRepository';

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function useHistoricoPrecos() {
  const [historicoPrecos, setHistoricoPrecos] = useState<HistoricoPrecoItem[]>([]);

  const refresh = useCallback(() => setHistoricoPrecos(historicoPrecoRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createHistoricoPreco = useCallback(
    async (item: HistoricoPrecoItem) => {
      historicoPrecoRepository.create(item);
      refresh();
    },
    [refresh],
  );

  /** Último registro conhecido pro item — usado pra estimar preço/fornecedor numa obra nova. */
  const getUltimoPreco = useCallback(
    (params: { materialCatalogId?: string; nome?: string; tipo: TipoHistoricoPreco }) => {
      const candidatos = historicoPrecos.filter((h) => {
        if (h.tipo !== params.tipo) return false;
        if (params.materialCatalogId) return h.materialCatalogId === params.materialCatalogId;
        if (params.nome) return normalizar(h.nome) === normalizar(params.nome);
        return false;
      });
      if (candidatos.length === 0) return undefined;
      return candidatos.reduce((mais, atual) => (atual.data > mais.data ? atual : mais));
    },
    [historicoPrecos],
  );

  /** Sugestões de serviço já contratado antes, uma por nome (a mais recente), pra autocomplete. */
  const buscarServicos = useCallback(
    (query: string) => {
      const q = normalizar(query);
      const porNome = new Map<string, HistoricoPrecoItem>();
      for (const h of historicoPrecos) {
        if (h.tipo !== 'servico') continue;
        if (q && !normalizar(h.nome).includes(q)) continue;
        const chave = normalizar(h.nome);
        const existente = porNome.get(chave);
        if (!existente || h.data > existente.data) porNome.set(chave, h);
      }
      return Array.from(porNome.values())
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .slice(0, 20);
    },
    [historicoPrecos],
  );

  return { historicoPrecos, createHistoricoPreco, getUltimoPreco, buscarServicos, refresh };
}
