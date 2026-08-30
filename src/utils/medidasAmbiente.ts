import type { ConfigItemAmbiente, MedidasAmbiente } from '../types/domain';

export function medidasAmbienteVazias(): MedidasAmbiente {
  return { portas: [], janelas: [], pontosEletricos: [] };
}

export interface ResumoAmbiente {
  areaAberturas: number; // total de portas+janelas do ambiente (usado como padrão de desconto)
  areaAlvenaria: number;
  areaReboco: number;
  areaPorcelanatoPiso: number;
  areaPorcelanatoParede: number;
  areaPintura: number;
  areaForro: number;
  totalPontosEletricos: number;
}

/** Área de um item de parede (soma de metro linear x altura de cada parede detalhada, descontando
 * aberturas) — usado por alvenaria, reboco, porcelanato de parede e pintura. Sem nenhuma parede
 * detalhada em `cfg.segmentos`, usa 1 parede única com a soma da largura + comprimento do ambiente
 * como metro linear e o pé-direito como altura (aproximação de um ambiente retangular simples). */
function areaParedeItem(m: MedidasAmbiente, cfg: ConfigItemAmbiente | undefined, areaAberturasAmbiente: number): number {
  if (cfg?.areaDireta) return Math.max(0, cfg.areaDireta);
  const aberturas = cfg?.aberturas ?? areaAberturasAmbiente;
  const segmentos = cfg?.segmentos;
  if (segmentos && segmentos.length > 0) {
    const areaBruta = segmentos.reduce((s, seg) => s + seg.metroLinear * seg.altura, 0);
    return Math.max(0, areaBruta - aberturas);
  }
  const metroLinearPadrao = (m.largura ?? 0) + (m.comprimento ?? 0);
  const alturaPadrao = m.peDireito ?? 0;
  return Math.max(0, metroLinearPadrao * alturaPadrao - aberturas);
}

/** Área de um item "plano" (piso ou teto) — soma de largura x comprimento de cada pedaço detalhado
 * em `cfg.segmentosPlanos`, descontando aberturas só se o item tiver um ajuste próprio de desconto
 * (piso/teto normalmente não descontam porta/janela). Sem nenhum pedaço detalhado, usa 1 área única
 * com a largura x comprimento do ambiente (ou do próprio item, se sobrescrito). */
function areaPlanaItem(m: MedidasAmbiente, cfg: ConfigItemAmbiente | undefined): number {
  if (cfg?.areaDireta) return Math.max(0, cfg.areaDireta);
  const aberturas = cfg?.aberturas ?? 0;
  const segmentos = cfg?.segmentosPlanos;
  if (segmentos && segmentos.length > 0) {
    const areaBruta = segmentos.reduce((s, seg) => s + seg.largura * seg.comprimento, 0);
    return Math.max(0, areaBruta - aberturas);
  }
  const largura = cfg?.largura ?? m.largura ?? 0;
  const comprimento = cfg?.comprimento ?? m.comprimento ?? 0;
  return Math.max(0, largura * comprimento - aberturas);
}

/** Calcula a área de cada item do resumo (alvenaria, reboco, porcelanato piso/parede, pintura,
 * forro) e o total de pontos elétricos. Cada item pode ter sua própria largura/comprimento/altura/
 * desconto de abertura (ver `ConfigItemAmbiente`) — sem isso, usa as medidas gerais do ambiente.
 * Puramente informativo: quem decide usar o valor nos insumos é o usuário, clicando em "Aplicar". */
export function calcularResumoAmbiente(m: MedidasAmbiente): ResumoAmbiente {
  const areaPortas = m.portas.reduce((s, p) => s + p.largura * p.altura * p.quantidade, 0);
  const areaJanelas = m.janelas.reduce((s, j) => s + j.largura * j.altura * j.quantidade, 0);
  const areaAberturas = areaPortas + areaJanelas;
  const totalPontosEletricos = m.pontosEletricos.reduce((s, p) => s + p.quantidade, 0);

  return {
    areaAberturas,
    areaAlvenaria: areaParedeItem(m, m.configAlvenaria, areaAberturas),
    areaReboco: areaParedeItem(m, m.configReboco, areaAberturas),
    areaPorcelanatoPiso: areaPlanaItem(m, m.configPorcelanatoPiso),
    areaPorcelanatoParede: areaParedeItem(m, m.configPorcelanatoParede, areaAberturas),
    areaPintura: areaParedeItem(m, m.configPintura, areaAberturas),
    areaForro: areaPlanaItem(m, m.configForro),
    totalPontosEletricos,
  };
}
