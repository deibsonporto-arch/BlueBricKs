import type { Atividade, LancamentoFinanceiro, Obra } from '../types/domain';
import { businessDaysBetween, parseISODate, todayISO } from './dateUtils';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface SCurvePoint {
  mes: string;
  previstoAcumulado: number;
  realAcumulado?: number;
}

function duracaoAtividade(a: Atividade): number {
  return Math.max(1, businessDaysBetween(a.dataInicio, a.dataFim));
}

function buildMonthlySCurve(
  obra: Obra,
  atividades: Atividade[],
  pesoAtividade: (a: Atividade) => number,
  previstoPct: (monthEnd: Date, monthIndex: number, totalMonths: number) => number,
): SCurvePoint[] {
  const start = parseISODate(obra.dataInicio);
  const end = parseISODate(obra.previsaoEntrega);
  const today = parseISODate(todayISO());

  const points: SCurvePoint[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const totalMonths = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1,
  );

  const pesoTotal = atividades.reduce((sum, a) => sum + pesoAtividade(a), 0) || 1;

  let monthIndex = 0;
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const realAcumulado = atividades
      .filter((a) => parseISODate(a.dataFim) <= monthEnd && a.status !== 'pendente')
      .reduce((sum, a) => sum + pesoAtividade(a), 0);

    const isFuture = cursor > today;

    points.push({
      mes: `${MONTH_NAMES[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
      previstoAcumulado: Math.round(previstoPct(monthEnd, monthIndex, totalMonths)),
      realAcumulado: isFuture ? undefined : Math.round((realAcumulado / pesoTotal) * 100),
    });

    cursor.setMonth(cursor.getMonth() + 1);
    monthIndex += 1;
  }

  return points;
}

/** Curva S de cronograma (prazo): previsto = % da duração planejada das atividades com término até o mês; real = % da duração das atividades já concluídas/em andamento com término até o mês. */
export function buildCronogramaData(obra: Obra, atividades: Atividade[]): SCurvePoint[] {
  const pesoTotalDuracao = atividades.reduce((sum, a) => sum + duracaoAtividade(a), 0) || 1;

  return buildMonthlySCurve(
    obra,
    atividades,
    duracaoAtividade,
    (monthEnd) => {
      const previstoDuracao = atividades
        .filter((a) => parseISODate(a.dataFim) <= monthEnd)
        .reduce((sum, a) => sum + duracaoAtividade(a), 0);
      return (previstoDuracao / pesoTotalDuracao) * 100;
    },
  );
}

/**
 * Curva S financeira real, em R$ (não %): previsto = orçamento total da obra distribuído mês a mês
 * conforme o custo previsto de cada etapa (custoMaoDeObra+custoMaterial+custoAluguel) e sua data de término;
 * real = acumulação de valorPago dos lançamentos já pagos até o mês. Se a obra não tiver orçamento por etapa
 * cadastrado (aba Orçamento), cai para a soma de valorPrevisto dos lançamentos como aproximação.
 */
export function buildCurvaSFinanceiraFromLancamentos(obra: Obra, atividades: Atividade[], lancamentos: LancamentoFinanceiro[]): SCurvePoint[] {
  const start = parseISODate(obra.dataInicio);
  // se o cronograma das atividades correr além da previsão de entrega da obra (prazo desatualizado em
  // relação às durações reais), estende a janela do gráfico até lá — senão o previsto nunca soma 100% do
  // orçamento, ficando preso no que só as atividades que terminam antes da previsão somam
  const ultimaDataFim = atividades.reduce((max, a) => (a.dataFim > max ? a.dataFim : max), obra.previsaoEntrega);
  const end = parseISODate(ultimaDataFim > obra.previsaoEntrega ? ultimaDataFim : obra.previsaoEntrega);
  const today = parseISODate(todayISO());
  const orcamentoTotal = obra.orcamentoTotal || 0;
  const custoEtapa = (a: Atividade) => a.custoMaoDeObra + a.custoMaterial + a.custoAluguel;
  const pesoTotal = atividades.reduce((s, a) => s + custoEtapa(a), 0);
  const usaOrcamentoPorEtapa = pesoTotal > 0 && orcamentoTotal > 0;

  const points: SCurvePoint[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const previstoAcumulado = usaOrcamentoPorEtapa
      ? (atividades.filter((a) => parseISODate(a.dataFim) <= monthEnd).reduce((s, a) => s + custoEtapa(a), 0) / pesoTotal) * orcamentoTotal
      : lancamentos.filter((l) => parseISODate(l.data) <= monthEnd).reduce((s, l) => s + l.valorPrevisto, 0);

    const realAcumulado = lancamentos
      .filter((l) => l.status === 'pago' && parseISODate(l.data) <= monthEnd)
      .reduce((s, l) => s + l.valorPago, 0);
    const isFuture = cursor > today;

    points.push({
      mes: `${MONTH_NAMES[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
      previstoAcumulado: Math.round(previstoAcumulado),
      realAcumulado: isFuture ? undefined : Math.round(realAcumulado),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

export function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`;
}
