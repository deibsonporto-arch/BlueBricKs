import type { Atividade, LancamentoFinanceiro, Obra } from '../../types/domain';
import { SCurveChart } from './SCurveChart';
import { buildCronogramaData, buildCurvaSFinanceiraFromLancamentos } from '../../utils/curvaS';
import './CurvaSSection.css';

interface CurvaSSectionProps {
  obra: Obra;
  atividades: Atividade[];
  lancamentos: LancamentoFinanceiro[];
}

export function CurvaSSection({ obra, atividades, lancamentos }: CurvaSSectionProps) {
  const custoData = buildCurvaSFinanceiraFromLancamentos(obra, atividades, lancamentos);
  const cronogramaData = buildCronogramaData(obra, atividades);

  return (
    <div className="curva-s-section">
      <SCurveChart
        title="Cronograma — Prazo previsto x real"
        data={cronogramaData}
        previstoLabel="Prazo previsto"
        realLabel="Prazo real"
      />
      <SCurveChart
        title="Curva S — Custo previsto x real"
        data={custoData}
        previstoLabel="Custo previsto (orçamento)"
        realLabel="Custo real (pago)"
        unit="currency"
      />
    </div>
  );
}
