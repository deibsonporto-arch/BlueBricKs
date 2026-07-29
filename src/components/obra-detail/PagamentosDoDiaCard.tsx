import type { Fornecedor, LancamentoFinanceiro } from '../../types/domain';
import { diffDays, formatDate, isPast, isWeekend, todayISO } from '../../utils/dateUtils';
import { formatBRL } from '../../utils/currency';
import './PagamentosDoDiaCard.css';

const STATUS_LABEL: Record<LancamentoFinanceiro['status'], string> = {
  pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado',
};

interface PagamentosDoDiaCardProps {
  lancamentos: LancamentoFinanceiro[];
  fornecedores: Fornecedor[];
}

function rowClass(l: LancamentoFinanceiro): string {
  if (isPast(l.dataVencimento)) return 'is-vencida';
  if (isWeekend(l.dataVencimento)) return 'is-fim-de-semana';
  return 'is-proximo';
}

export function PagamentosDoDiaCard({ lancamentos, fornecedores }: PagamentosDoDiaCardProps) {
  const hoje = todayISO();
  const itens = lancamentos
    .filter((l) => l.status !== 'pago' && diffDays(hoje, l.dataVencimento) <= 3)
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  const total = itens.reduce((s, l) => s + l.valorPago, 0);

  return (
    <div className="pagamentos-do-dia-card">
      <div className="pagamentos-do-dia-card__header">
        <h3>Pagamentos do dia</h3>
        {itens.length > 0 && <span className="pagamentos-do-dia-card__total">{formatBRL(total)}</span>}
      </div>
      {itens.length === 0 ? (
        <p className="pagamentos-do-dia-card__empty">Nenhum pagamento vencido ou vencendo nos próximos dias.</p>
      ) : (
        <ul className="pagamentos-do-dia-card__list">
          {itens.map((l) => {
            const fornecedor = fornecedores.find((f) => f.id === l.fornecedorId);
            return (
              <li key={l.id} className={rowClass(l)}>
                <div className="pagamentos-do-dia-card__desc">
                  <strong>{fornecedor?.nome ?? 'sem fornecedor'}</strong>
                  <span>{l.descricao}</span>
                </div>
                <div className="pagamentos-do-dia-card__valor">{formatBRL(l.valorPago)}</div>
                <div className="pagamentos-do-dia-card__vencimento">{formatDate(l.dataVencimento)}</div>
                <div className="pagamentos-do-dia-card__status">{STATUS_LABEL[l.status]}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
