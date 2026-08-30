import type { ItemInsumoAtividade, TipoInsumoAtividade } from '../types/domain';
import type { SinapiMaterialExplodido } from '../data/apiSync';
import { generateId } from './id';

/** Classifica a coluna "classificação" da planilha ISD do SINAPI num dos 3 baldes de custo da
 * Atividade (mesma convenção usada no split material×mão de obra do resto do app). */
export function classificarTipoInsumo(classificacao: string | null | undefined): TipoInsumoAtividade {
  const c = (classificacao ?? '').toUpperCase();
  if (c.includes('MÃO') || c.includes('MAO')) return 'mao_de_obra';
  if (c.includes('EQUIPAMENTO')) return 'aluguel';
  return 'material';
}

/** Converte o resultado de explodir uma composição SINAPI em insumos-folha (buscarItensComposicaoSinapiLocal)
 * na lista de ItemInsumoAtividade que fica salva na Atividade. */
export function insumosDeComposicaoExplodida(itens: SinapiMaterialExplodido[]): ItemInsumoAtividade[] {
  return itens.map((i) => ({
    id: generateId(),
    sinapiCodigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    quantidade: i.coeficiente,
    custoUnitario: i.precoUnitario ?? 0,
    tipo: classificarTipoInsumo(i.classificacao),
  }));
}

export function totaisPorTipo(insumos: ItemInsumoAtividade[]): Record<TipoInsumoAtividade, number> {
  return insumos.reduce(
    (acc, i) => {
      acc[i.tipo] += i.quantidade * i.custoUnitario;
      return acc;
    },
    { material: 0, mao_de_obra: 0, aluguel: 0, parametro_calculado: 0 } as Record<TipoInsumoAtividade, number>,
  );
}
