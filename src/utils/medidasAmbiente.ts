import type { MedidasAmbiente } from '../types/domain';

export function medidasAmbienteVazias(): MedidasAmbiente {
  return { portas: [], janelas: [], pontosEletricos: [] };
}

export interface ResumoAmbiente {
  areaPiso: number;
  perimetro: number;
  areaAberturas: number;
  areaAlvenaria: number;
  areaReboco: number;
  areaPorcelanatoParede: number;
  areaPintura: number;
  areaForro: number; // = área de piso (teto tem a mesma área do chão)
  totalPontosEletricos: number;
}

/** Área líquida de parede (perímetro x altura, descontando portas/janelas) pra uma altura
 * considerada específica — cada item do resumo (alvenaria, reboco, porcelanato de parede, pintura)
 * pode usar sua própria altura (ex: revestimento só até 1,5m), em vez do pé-direito inteiro. */
function areaParedeParaAltura(perimetro: number, altura: number, areaAberturas: number): number {
  return Math.max(0, perimetro * altura - areaAberturas);
}

/** Calcula m² de piso, m² líquido de parede por item (cada um com sua própria altura considerada,
 * quando definida) e total de pontos elétricos a partir das medidas do ambiente. Puramente
 * informativo — quem decide usar o valor nos insumos é o usuário, clicando em "Aplicar". */
export function calcularResumoAmbiente(m: MedidasAmbiente): ResumoAmbiente {
  const largura = m.largura ?? 0;
  const comprimento = m.comprimento ?? 0;
  const peDireito = m.peDireito ?? 0;

  const areaPiso = largura * comprimento;
  const perimetro = 2 * (largura + comprimento);
  const areaPortas = m.portas.reduce((s, p) => s + p.largura * p.altura * p.quantidade, 0);
  const areaJanelas = m.janelas.reduce((s, j) => s + j.largura * j.altura * j.quantidade, 0);
  const areaAberturas = areaPortas + areaJanelas;
  const totalPontosEletricos = m.pontosEletricos.reduce((s, p) => s + p.quantidade, 0);

  return {
    areaPiso,
    perimetro,
    areaAberturas,
    areaAlvenaria: areaParedeParaAltura(perimetro, m.alturaAlvenaria ?? peDireito, areaAberturas),
    areaReboco: areaParedeParaAltura(perimetro, m.alturaReboco ?? peDireito, areaAberturas),
    areaPorcelanatoParede: areaParedeParaAltura(perimetro, m.alturaPorcelanatoParede ?? peDireito, areaAberturas),
    areaPintura: areaParedeParaAltura(perimetro, m.alturaPintura ?? peDireito, areaAberturas),
    areaForro: areaPiso,
    totalPontosEletricos,
  };
}
