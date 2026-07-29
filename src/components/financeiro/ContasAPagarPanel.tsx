import type { LancamentoFinanceiro } from '../../types/domain';
import { bucketSummary, VENCIMENTO_BUCKET_LABEL, type VencimentoBucket } from '../../utils/contasAPagar';
import { formatBRL } from '../../utils/currency';
import './ContasAPagarPanel.css';

const BUCKETS: VencimentoBucket[] = ['hoje', 'proximos7', 'vencidas', 'pagas', 'pendentes'];

interface ContasAPagarPanelProps {
  lancamentos: LancamentoFinanceiro[];
  activeBucket: VencimentoBucket | null;
  onSelectBucket: (bucket: VencimentoBucket) => void;
}

export function ContasAPagarPanel({ lancamentos, activeBucket, onSelectBucket }: ContasAPagarPanelProps) {
  return (
    <div className="contas-a-pagar-panel">
      {BUCKETS.map((bucket) => {
        const { count, total } = bucketSummary(lancamentos, bucket);
        return (
          <button
            type="button"
            key={bucket}
            className={`contas-a-pagar-panel__card contas-a-pagar-panel__card--${bucket}${activeBucket === bucket ? ' is-active' : ''}`}
            onClick={() => onSelectBucket(bucket)}
          >
            <span className="contas-a-pagar-panel__label">{VENCIMENTO_BUCKET_LABEL[bucket]}</span>
            <span className="contas-a-pagar-panel__count">{count}</span>
            <span className="contas-a-pagar-panel__total">{formatBRL(total)}</span>
          </button>
        );
      })}
    </div>
  );
}
