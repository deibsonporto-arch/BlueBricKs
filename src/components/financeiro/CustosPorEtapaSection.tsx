import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Atividade, LancamentoFinanceiro, Obra } from '../../types/domain';
import { SCurveChart } from '../obra-detail/SCurveChart';
import { buildCurvaSFinanceiraFromLancamentos } from '../../utils/curvaS';
import { formatBRL } from '../../utils/currency';
import './CustosPorEtapaSection.css';

interface CustosPorEtapaSectionProps {
  obra: Obra;
  lancamentos: LancamentoFinanceiro[];
  atividades: Atividade[];
}

export function CustosPorEtapaSection({ obra, lancamentos, atividades }: CustosPorEtapaSectionProps) {
  const porEtapa = atividades
    .map((a) => {
      const doAtividade = lancamentos.filter((l) => l.atividadeId === a.id);
      return {
        nome: a.nome,
        // previsto vem do orçamento da etapa (custoMaoDeObra+custoMaterial+custoAluguel), não da soma de
        // valorPrevisto dos lançamentos — a maioria dos lançamentos não tem valorPrevisto preenchido
        previsto: a.custoMaoDeObra + a.custoMaterial + a.custoAluguel,
        pago: doAtividade.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0),
      };
    })
    .filter((e) => e.previsto > 0 || e.pago > 0)
    .sort((a, b) => b.pago - a.pago);

  const curvaFinanceira = buildCurvaSFinanceiraFromLancamentos(obra, atividades, lancamentos);

  if (porEtapa.length === 0) return null;

  return (
    <div className="custos-por-etapa">
      <div className="custos-por-etapa__chart-card">
        <h3>Custo real por etapa</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porEtapa} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => formatBRL(value)} />
            <Bar dataKey="previsto" name="Previsto" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pago" name="Pago" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="custos-por-etapa__ranking-card">
        <h3>Ranking — etapas mais caras</h3>
        <ol className="custos-por-etapa__ranking">
          {porEtapa.map((e) => (
            <li key={e.nome}>
              <span className="custos-por-etapa__ranking-nome">{e.nome}</span>
              <span className="custos-por-etapa__ranking-valor">{formatBRL(e.pago)}</span>
            </li>
          ))}
        </ol>
      </div>

      <SCurveChart
        title="Curva S Financeira — orçamento x pago"
        data={curvaFinanceira}
        previstoLabel="Previsto (orçamento)"
        realLabel="Pago"
        unit="currency"
      />
    </div>
  );
}
