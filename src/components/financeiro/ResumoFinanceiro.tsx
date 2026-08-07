import type { LancamentoFinanceiro } from '../../types/domain';
import { formatBRL } from '../../utils/currency';
import { saldoRestante } from '../../utils/lancamentoSaldo';
import './ResumoFinanceiro.css';

interface ResumoFinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
  orcamentoTotal: number;
}

export function ResumoFinanceiro({ lancamentos, orcamentoTotal }: ResumoFinanceiroProps) {
  const totalPago = lancamentos.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
  const saldoAPagar = lancamentos.filter((l) => l.status !== 'pago').reduce((s, l) => s + saldoRestante(l), 0);

  return (
    <div className="resumo-financeiro">
      <div className="resumo-financeiro__card">
        <span className="resumo-financeiro__label">Total previsto</span>
        <span className="resumo-financeiro__value">{formatBRL(orcamentoTotal)}</span>
      </div>
      <div className="resumo-financeiro__card">
        <span className="resumo-financeiro__label">Total pago</span>
        <span className="resumo-financeiro__value is-success">{formatBRL(totalPago)}</span>
      </div>
      <div className="resumo-financeiro__card">
        <span className="resumo-financeiro__label">Saldo a pagar</span>
        <span className={`resumo-financeiro__value ${saldoAPagar > 0 ? 'is-warning' : ''}`}>{formatBRL(saldoAPagar)}</span>
      </div>
    </div>
  );
}
