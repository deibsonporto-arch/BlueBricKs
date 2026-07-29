import { useCallback, useEffect, useState } from 'react';
import type { Ferramenta } from '../types/domain';
import { ferramentaRepository } from '../data/repositories/ferramentaRepository';
import { generateId } from '../utils/id';

interface EnviarParaObraDados {
  obraDestinoId: string;
  data: string;
  quantidade: number;
  observacao?: string;
}

export function useFerramentas(obraId: string) {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);

  const refresh = useCallback(
    () => setFerramentas(ferramentaRepository.list().filter((f) => f.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createFerramenta = useCallback(
    async (ferramenta: Ferramenta) => {
      ferramentaRepository.create(ferramenta);
      refresh();
    },
    [refresh],
  );

  const updateFerramenta = useCallback(
    async (id: string, patch: Partial<Ferramenta>) => {
      ferramentaRepository.update(id, { ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteFerramenta = useCallback(
    async (id: string) => {
      ferramentaRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  const enviarParaObra = useCallback(
    async (ferramentaId: string, dados: EnviarParaObraDados) => {
      const ferramenta = ferramentaRepository.get(ferramentaId);
      if (!ferramenta) throw new Error('Ferramenta não encontrada');
      const now = new Date().toISOString();
      const movimentacao = {
        id: generateId(),
        data: dados.data,
        obraOrigemId: ferramenta.obraId,
        obraDestinoId: dados.obraDestinoId,
        quantidade: dados.quantidade,
        observacao: dados.observacao,
      };

      // Se já existe uma ferramenta com o mesmo nome/unidade no destino, soma nela em vez de
      // criar um registro duplicado (evita "Carrinho de mão" aparecer 2x na lista da obra).
      const existenteNoDestino = ferramentaRepository
        .list()
        .find(
          (f) =>
            f.id !== ferramentaId &&
            f.obraId === dados.obraDestinoId &&
            f.nome.trim().toLowerCase() === ferramenta.nome.trim().toLowerCase() &&
            f.unidade === ferramenta.unidade,
        );

      if (dados.quantidade >= ferramenta.quantidade) {
        if (existenteNoDestino) {
          ferramentaRepository.update(existenteNoDestino.id, {
            quantidade: existenteNoDestino.quantidade + dados.quantidade,
            movimentacoes: [...existenteNoDestino.movimentacoes, movimentacao],
            updatedAt: now,
          });
          ferramentaRepository.remove(ferramentaId);
        } else {
          ferramentaRepository.update(ferramentaId, {
            obraId: dados.obraDestinoId,
            movimentacoes: [...ferramenta.movimentacoes, movimentacao],
            updatedAt: now,
          });
        }
      } else {
        ferramentaRepository.update(ferramentaId, {
          quantidade: ferramenta.quantidade - dados.quantidade,
          movimentacoes: [...ferramenta.movimentacoes, movimentacao],
          updatedAt: now,
        });
        if (existenteNoDestino) {
          ferramentaRepository.update(existenteNoDestino.id, {
            quantidade: existenteNoDestino.quantidade + dados.quantidade,
            movimentacoes: [...existenteNoDestino.movimentacoes, movimentacao],
            updatedAt: now,
          });
        } else {
          ferramentaRepository.create({
            id: generateId(),
            obraId: dados.obraDestinoId,
            nome: ferramenta.nome,
            quantidade: dados.quantidade,
            unidade: ferramenta.unidade,
            observacoes: ferramenta.observacoes,
            movimentacoes: [movimentacao],
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      refresh();
    },
    [refresh],
  );

  return { ferramentas, createFerramenta, updateFerramenta, deleteFerramenta, enviarParaObra, refresh };
}

export function useTodasFerramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);

  const refresh = useCallback(() => setFerramentas(ferramentaRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  return { ferramentas, refresh };
}
