import type { MedidasAmbiente } from '../types/domain';

export function medidasAmbienteVazias(): MedidasAmbiente {
  return { portas: [], janelas: [], pontosEletricos: [] };
}

export interface ResumoAmbiente {
  areaPiso: number;
  perimetro: number;
  areaParedeBruta: number;
  areaAberturas: number;
  areaLiquidaParede: number; // usada pra alvenaria e reboco (1 face)
  totalPontosEletricos: number;
}

/** Calcula m² de piso, m² líquido de parede (descontando portas/janelas) e total de pontos
 * elétricos a partir das medidas do ambiente. Puramente informativo — quem decide usar o valor
 * nos insumos é o usuário, clicando em "Aplicar" em cada linha do resumo. */
export function calcularResumoAmbiente(m: MedidasAmbiente): ResumoAmbiente {
  const largura = m.largura ?? 0;
  const comprimento = m.comprimento ?? 0;
  const peDireito = m.peDireito ?? 0;

  const areaPiso = largura * comprimento;
  const perimetro = 2 * (largura + comprimento);
  const areaParedeBruta = perimetro * peDireito;
  const areaPortas = m.portas.reduce((s, p) => s + p.largura * p.altura * p.quantidade, 0);
  const areaJanelas = m.janelas.reduce((s, j) => s + j.largura * j.altura * j.quantidade, 0);
  const areaAberturas = areaPortas + areaJanelas;
  const areaLiquidaParede = Math.max(0, areaParedeBruta - areaAberturas);
  const totalPontosEletricos = m.pontosEletricos.reduce((s, p) => s + p.quantidade, 0);

  return { areaPiso, perimetro, areaParedeBruta, areaAberturas, areaLiquidaParede, totalPontosEletricos };
}
