import { IconCash, IconEdit, IconLink, IconTrash } from '@tabler/icons-react';
import type { Atividade, Fornecedor, LancadoTipo, LancamentoFinanceiro, StatusLancamento } from '../../types/domain';
import { AnexosCell } from './AnexosCell';
import { EditableStatusCell } from './EditableStatusCell';
import { EditableLancadoCell } from './EditableLancadoCell';
import { formatBRL } from '../../utils/currency';
import { formatDate, isPast, todayISO } from '../../utils/dateUtils';
import { lancadoTipoEfetivo } from '../../utils/lancado';
import './LancamentosTable.css';

const CATEGORIA_LABEL: Record<LancamentoFinanceiro['categoria'], string> = {
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

function rowClass(l: LancamentoFinanceiro): string {
  if (l.status === 'pago') return 'lancamentos-table__row--pago';
  if (l.status === 'atrasado' || isPast(l.dataVencimento)) return 'lancamentos-table__row--atrasado';
  if (l.dataVencimento === todayISO()) return 'lancamentos-table__row--hoje';
  return '';
}

interface LancamentosTableProps {
  lancamentos: LancamentoFinanceiro[];
  fornecedores: Fornecedor[];
  atividades: Atividade[];
  onEdit: (lancamento: LancamentoFinanceiro) => void;
  onFiltrarPorAtividade: (atividadeId: string) => void;
  onUpdateStatus: (lancamento: LancamentoFinanceiro, novoStatus: StatusLancamento) => void;
  onRegistrarPagamento: (lancamento: LancamentoFinanceiro) => void;
  onDelete: (lancamento: LancamentoFinanceiro) => void;
  onUpdateLancado: (lancamento: LancamentoFinanceiro, tipo: LancadoTipo, numero: string) => void;
}

export function LancamentosTable({ lancamentos, fornecedores, atividades, onEdit, onFiltrarPorAtividade, onUpdateStatus, onRegistrarPagamento, onDelete, onUpdateLancado }: LancamentosTableProps) {
  const totalPago = lancamentos.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
  const saldoAPagar = lancamentos.filter((l) => l.status !== 'pago').reduce((s, l) => s + l.valorPago, 0);
  const totalLiquido = totalPago + saldoAPagar;

  return (
    <div>
      <div className="scroll-x">
        <table className="lancamentos-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Vencimento</th>
            <th>Fornecedor</th>
            <th>Descrição</th>
            <th>Atividade</th>
            <th>Categoria</th>
            <th>Valor a pagar</th>
            <th>Pagamento</th>
            <th>NF</th>
            <th title="Nota lançada para pagamento">Lanç.</th>
            <th>Anexos</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.map((l) => {
            const fornecedor = fornecedores.find((f) => f.id === l.fornecedorId);
            const atividade = atividades.find((a) => a.id === l.atividadeId);
            return (
              <tr key={l.id} className={`${rowClass(l)}${lancadoTipoEfetivo(l) === 'nao_lancado' ? ' lancamentos-table__row--nao-lancado' : ''}`}>
                <td>{formatDate(l.data)}</td>
                <td>{formatDate(l.dataVencimento)}</td>
                <td>{fornecedor?.nome ?? <span className="lancamentos-table__muted">—</span>}</td>
                <td className="lancamentos-table__descricao" title={l.descricao}>{l.descricao}</td>
                <td>
                  {atividade ? (
                    <button type="button" className="atividade-link-pill" onClick={() => onFiltrarPorAtividade(atividade.id)}>
                      <IconLink size={12} /> {atividade.nome}
                    </button>
                  ) : (
                    <span className="lancamentos-table__muted">—</span>
                  )}
                </td>
                <td>{CATEGORIA_LABEL[l.categoria]}</td>
                <td>
                  {formatBRL(l.valorPago)}
                  {(l.pagamentos?.length ?? 0) > 0 && (
                    <>
                      <span className="lancamentos-table__parcela-badge">
                        {l.parcelaTotal ? `${l.pagamentos!.length}/${l.parcelaTotal}` : `${l.pagamentos!.length} pagamentos`}
                      </span>
                      {l.status !== 'pago' && (
                        <span className="lancamentos-table__ja-pago">
                          Já pago: {formatBRL(l.pagamentos!.reduce((s, p) => s + p.valor, 0))}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="lancamentos-table__forma">{l.formaPagamento}</td>
                <td>{l.nf ? 'Sim' : 'Não'}</td>
                <td>
                  <EditableLancadoCell
                    tipo={lancadoTipoEfetivo(l)}
                    numero={l.lancadoNumero}
                    onSave={(tipo, numero) => onUpdateLancado(l, tipo, numero)}
                  />
                </td>
                <td>
                  <AnexosCell anexos={l.anexos} />
                </td>
                <td className="lancamentos-table__status-cell">
                  <EditableStatusCell value={l.status} onSave={(novoStatus) => onUpdateStatus(l, novoStatus)} />
                  {l.status !== 'pago' && (
                    <button
                      type="button"
                      className="btn btn-ghost lancamentos-table__icon-btn lancamentos-table__pagar-btn"
                      onClick={() => onRegistrarPagamento(l)}
                      title="Registrar pagamento"
                      aria-label="Registrar pagamento"
                    >
                      <IconCash size={14} />
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost lancamentos-table__icon-btn" onClick={() => onEdit(l)} aria-label="Editar lançamento">
                    <IconEdit size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost lancamentos-table__icon-btn" onClick={() => onDelete(l)} aria-label="Excluir lançamento">
                    <IconTrash size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
          {lancamentos.length === 0 && (
            <tr>
              <td colSpan={12} className="lancamentos-table__empty">Nenhum lançamento encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      <div className="lancamentos-table__footer">
        <span>{lancamentos.length} registros</span>
        <span><strong>Total líquido:</strong> {formatBRL(totalLiquido)}</span>
        <span><strong>Total pago:</strong> {formatBRL(totalPago)}</span>
        <span><strong>Saldo a pagar:</strong> {formatBRL(saldoAPagar)}</span>
      </div>
    </div>
  );
}
