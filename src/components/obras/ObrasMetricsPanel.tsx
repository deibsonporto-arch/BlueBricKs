import type { Atividade, Obra } from '../../types/domain';
import { useObrasListMetrics } from '../../hooks/useObraMetrics';
import { IconBuildingSkyscraper, IconClockHour4, IconAlertTriangle, IconPlayerPause } from '@tabler/icons-react';
import './ObrasMetricsPanel.css';

interface ObrasMetricsPanelProps {
  obras: Obra[];
  atividades: Atividade[];
}

export function ObrasMetricsPanel({ obras, atividades }: ObrasMetricsPanelProps) {
  const metrics = useObrasListMetrics(obras, atividades);

  const cards = [
    { label: 'Total de obras', value: metrics.total, icon: IconBuildingSkyscraper, color: 'neutral' },
    { label: 'Em andamento', value: metrics.emAndamento, icon: IconClockHour4, color: 'primary' },
    { label: 'Atrasadas', value: metrics.atrasadas, icon: IconAlertTriangle, color: 'danger' },
    { label: 'Paralisadas', value: metrics.paralisadas, icon: IconPlayerPause, color: 'warning' },
  ];

  return (
    <div className="obras-metrics-panel">
      {cards.map((c) => (
        <div key={c.label} className={`obras-metric-card obras-metric-card--${c.color}`}>
          <div className="obras-metric-card__icon">
            <c.icon size={22} stroke={1.75} />
          </div>
          <div>
            <div className="obras-metric-card__value">{c.value}</div>
            <div className="obras-metric-card__label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
