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

/** Área de um item de parede (metro linear x altura, descontando aberturas) — usado por alvenaria,
 * reboco, porcelanato de parede e pintura. Sem um metro linear próprio em `cfg`, usa a soma da
 * largura + comprimento do ambiente como aproximação (dá pra sobrescrever com o metro linear real
 * das paredes consideradas, quando for diferente disso). */
function areaParedeItem(m: MedidasAmbiente, cfg: ConfigItemAmbiente | undefined, areaAberturasAmbiente: number): number {
  const metroLinear = cfg?.metroLinear ?? (m.largura ?? 0) + (m.comprimento ?? 0);
  const altura = cfg?.altura ?? m.peDireito ?? 0;
  const aberturas = cfg?.aberturas ?? areaAberturasAmbiente;
  return Math.max(0, metroLinear * altura - aberturas);
}

/** Área de um item "plano" (piso ou teto) — largura x comprimento, descontando aberturas só se o
 * item tiver um ajuste próprio de desconto (piso/teto normalmente não descontam porta/janela). */
function areaPlanaItem(m: MedidasAmbiente, cfg: ConfigItemAmbiente | undefined): number {
  const largura = cfg?.largura ?? m.largura ?? 0;
  const comprimento = cfg?.comprimento ?? m.comprimento ?? 0;
  const aberturas = cfg?.aberturas ?? 0;
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
