import type { ItemOrcamentoAnalitico, SinapiDesoneracao } from '../types/domain';
import type { SinapiComposicaoResumo } from '../data/apiSync';
import { generateId } from './id';

/** Monta uma linha de orçamento analítico a partir de uma composição SINAPI e uma quantidade —
 * usado tanto no lançamento manual quanto na importação em lote de quantitativos. */
export function criarItemOrcamentoAnalitico(
  obraId: string,
  composicao: SinapiComposicaoResumo,
  quantidade: number,
  filtro: { uf: string; mes: string; desoneracao: SinapiDesoneracao },
): ItemOrcamentoAnalitico {
  const now = new Date().toISOString();
  const custoUnitario = composicao.custo ?? 0;
  return {
    id: generateId(),
    obraId,
    composicaoCodigo: composicao.codigo,
    composicaoDescricao: composicao.descricao,
    grupo: composicao.grupo ?? undefined,
    unidade: composicao.unidade,
    quantidade,
    uf: filtro.uf,
    mesReferencia: filtro.mes,
    desoneracao: filtro.desoneracao,
    custoUnitarioSinapi: custoUnitario,
    custoTotal: quantidade * custoUnitario,
    createdAt: now,
    updatedAt: now,
  };
}
