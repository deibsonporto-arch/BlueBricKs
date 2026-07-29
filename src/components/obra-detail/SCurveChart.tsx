import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SCurvePoint } from '../../utils/curvaS';
import { currentMonthLabel } from '../../utils/curvaS';
import { formatBRL } from '../../utils/currency';
import './SCurveChart.css';

interface SCurveChartProps {
  title: string;
  data: SCurvePoint[];
  previstoLabel: string;
  realLabel: string;
  unit?: 'percent' | 'currency';
}

export function SCurveChart({ title, data, previstoLabel, realLabel, unit = 'percent' }: SCurveChartProps) {
  const hojeLabel = currentMonthLabel();
  const isCurrency = unit === 'currency';

  return (
    <div className="curva-s-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
          {isCurrency ? (
            <YAxis tick={{ fontSize: 12 }} />
          ) : (
            <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
          )}
          <Tooltip formatter={(value: number) => (isCurrency ? formatBRL(value) : `${value}%`)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="previstoAcumulado"
            name={previstoLabel}
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="realAcumulado"
            name={realLabel}
            stroke="var(--color-success)"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          {data.some((d) => d.mes === hojeLabel) && (
            <ReferenceLine x={hojeLabel} stroke="var(--color-neutral)" label={{ value: 'Hoje', fontSize: 11, fill: 'var(--color-text-muted)' }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
