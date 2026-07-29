import { IconCash, IconWallet, IconCalendarDue, IconTrendingUp } from '@tabler/icons-react';
import type { Atividade, LancamentoFinanceiro, Obra } from '../../types/domain';
import { useObraDetailMetrics } from '../../hooks/useObraMetrics';
import { formatBRL, formatPct } from '../../utils/currency';
import './VisaoGeralMetrics.css';

interface VisaoGeralMetricsProps {
  obra: Obra;
  atividades: Atividade[];
  lancamentos: LancamentoFinanceiro[];
}

export function VisaoGeralMetrics({ obra, atividades, lancamentos }: VisaoGeralMetricsProps) {
  const metrics = useObraDetailMetrics(obra, atividades, lancamentos);
  if (!metrics) return null;

  const prazoAtrasado = metrics.prazoRestante < 0;

  return (
    <div className="visao-geral-metrics">
      <div className="vg-metric-card">
        <div className="vg-metric-card__icon vg-metric-card__icon--primary"><IconCash size={20} /></div>
        <div>
          <div className="vg-metric-card__value">{formatBRL(metrics.orcamentoTotal)}</div>
          <div className="vg-metric-card__label">Orçamento total</div>
        </div>
      </div>

      <div className="vg-metric-card">
        <div className="vg-metric-card__icon vg-metric-card__icon--warning"><IconWallet size={20} /></div>
        <div>
          <div className="vg-metric-card__value">{formatBRL(metrics.gastoReal)}</div>
          <div className="vg-metric-card__label">Gasto real · {formatPct(metrics.gastoRealPct)} do orçamento</div>
        </div>
      </div>

      <div className="vg-metric-card">
        <div className={`vg-metric-card__icon ${prazoAtrasado ? 'vg-metric-card__icon--danger' : 'vg-metric-card__icon--neutral'}`}>
          <IconCalendarDue size={20} />
        </div>
        <div>
          <div className={`vg-metric-card__value${prazoAtrasado ? ' is-danger' : ''}`}>
            {prazoAtrasado ? `${Math.abs(metrics.prazoRestante)} dias em atraso` : `${metrics.prazoRestante} dias restantes`}
          </div>
          <div className="vg-metric-card__label">Prazo</div>
        </div>
      </div>

      <div className="vg-metric-card">
        <div className="vg-metric-card__icon vg-metric-card__icon--success"><IconTrendingUp size={20} /></div>
        <div>
          <div className="vg-metric-card__value">{formatPct(metrics.avancoFisicoReal)} <span className="vg-metric-card__vs">/ {formatPct(metrics.avancoFisicoPrevisto)} previsto</span></div>
          <div className="vg-metric-card__label">Avanço físico real vs previsto</div>
        </div>
      </div>
    </div>
  );
}
