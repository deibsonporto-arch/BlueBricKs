import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoriaLancamento, LancamentoFinanceiro } from '../../types/domain';
import './GastosPorCategoriaChart.css';

const CATEGORIA_LABEL: Record<CategoriaLancamento, string> = {
  sem_categoria: 'Sem categoria',
  mao_de_obra: 'Mão de obra',
  material: 'Material',
  aluguel: 'Aluguel',
  alimentacao: 'Alimentação/Marmitas',
  servico: 'Serviço',
  taxa: 'Taxa',
  empreitada: 'Empreitada',
  projetos: 'Projetos',
  sondagem: 'Sondagem',
};

interface GastosPorCategoriaChartProps {
  lancamentos: LancamentoFinanceiro[];
}

export function GastosPorCategoriaChart({ lancamentos }: GastosPorCategoriaChartProps) {
  const data = (Object.keys(CATEGORIA_LABEL) as CategoriaLancamento[]).map((categoria) => {
    const doCategoria = lancamentos.filter((l) => l.categoria === categoria);
    return {
      categoria: CATEGORIA_LABEL[categoria],
      previsto: doCategoria.reduce((s, l) => s + l.valorPrevisto, 0),
      pago: doCategoria.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0),
    };
  });

  const ranking = [...data].filter((d) => d.pago > 0).sort((a, b) => b.pago - a.pago);

  return (
    <div className="gastos-categoria-section">
      <div className="gastos-categoria-card">
        <h3>Gastos por categoria</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="categoria" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Legend />
            <Bar dataKey="previsto" name="Previsto" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pago" name="Pago" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {ranking.length > 0 && (
        <div className="gastos-categoria-card gastos-categoria-card--ranking">
          <h3>Ranking — gastos por categoria</h3>
          <ol className="gastos-categoria-ranking">
            {ranking.map((d) => (
              <li key={d.categoria}>
                <span className="gastos-categoria-ranking__nome">{d.categoria}</span>
                <span className="gastos-categoria-ranking__valor">
                  {d.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
