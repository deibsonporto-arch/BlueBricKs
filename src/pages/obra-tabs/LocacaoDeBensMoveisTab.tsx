import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useLocacoes } from '../../hooks/useLocacoes';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useLancamentos } from '../../hooks/useLancamentos';
import { LocacaoFormModal } from '../../components/locacao/LocacaoFormModal';
import { RenovarLocacaoModal } from '../../components/locacao/RenovarLocacaoModal';
import { EmptyState } from '../../components/common/EmptyState';
import type { HistoricoEntry, Locacao, StatusLancamento } from '../../types/domain';
import { formatBRL } from '../../utils/currency';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { getCurrentUserName } from '../../utils/currentUser';
import './LocacaoDeBensMoveisTab.css';

type StatusLocacao = 'agendada' | 'ativa' | 'encerrada';

const STATUS_LABEL: Record<StatusLocacao, string> = {
  agendada: 'Agendada',
  ativa: 'Ativa',
  encerrada: 'Encerrada',
};

const STATUS_LANCAMENTO_LABEL: Record<StatusLancamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
};

function statusDe(l: Locacao): StatusLocacao {
  const hoje = todayISO();
  if (l.dataFim < hoje) return 'encerrada';
  if (l.dataInicio > hoje) return 'agendada';
  return 'ativa';
}

const ORDEM_STATUS: Record<StatusLocacao, number> = { ativa: 0, agendada: 1, encerrada: 2 };

export function LocacaoDeBensMoveisTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { locacoes, updateLocacao, deleteLocacao, refresh: refreshLocacoes } = useLocacoes(obraId);
  const { fornecedores } = useFornecedores();
  const { lancamentos, refresh: refreshLancamentos } = useLancamentos(obraId);
  const [editando, setEditando] = useState<Locacao | undefined>(undefined);
  const [renovando, setRenovando] = useState<Locacao | undefined>(undefined);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  function toggleExpandida(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ordenadas = useMemo(
    () =>
      [...locacoes].sort((a, b) => {
        const s = ORDEM_STATUS[statusDe(a)] - ORDEM_STATUS[statusDe(b)];
        return s !== 0 ? s : b.dataInicio.localeCompare(a.dataInicio);
      }),
    [locacoes],
  );

  function handleDelete(l: Locacao) {
    if (confirm('Remover esta locação do controle? O lançamento financeiro vinculado (se houver) não será excluído.')) {
      deleteLocacao(l.id);
    }
  }

  function handleToggleEntregue(l: Locacao, entregue: boolean) {
    const now = new Date().toISOString();
    const historico: HistoricoEntry[] = [
      ...l.historico,
      { data: now, usuario: getCurrentUserName(), resumo: entregue ? 'Marcado como entregue' : 'Desmarcado como entregue' },
    ];
    updateLocacao(l.id, {
      entregue,
      dataEntrega: entregue ? (l.dataEntrega ?? todayISO()) : undefined,
      updatedBy: getCurrentUserName(),
      historico,
    });
  }

  function handleDataEntregaChange(l: Locacao, dataEntrega: string) {
    updateLocacao(l.id, { dataEntrega });
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="locacao-header">
        <h2>Locação de Bens Móveis</h2>
      </div>

      {ordenadas.length === 0 ? (
        <EmptyState
          title="Nenhuma locação registrada"
          description={'Crie um lançamento no Financeiro com a categoria "Aluguel" para registrar o período e os itens locados — eles aparecem aqui automaticamente.'}
        />
      ) : (
        ordenadas.map((l) => {
          const fornecedor = fornecedores.find((f) => f.id === l.fornecedorId);
          const status = statusDe(l);
          const lancamento = l.lancamentoId ? lancamentos.find((lc) => lc.id === l.lancamentoId) : undefined;
          const expandida = expandidas.has(l.id);
          return (
            <div className={`locacao-card ${expandida ? 'is-expanded' : ''}`} key={l.id}>
              <div
                className="locacao-card__header"
                onClick={() => toggleExpandida(l.id)}
                role="button"
                tabIndex={0}
                aria-expanded={expandida}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandida(l.id); } }}
              >
                <div className="locacao-card__header-main">
                  {expandida ? <IconChevronDown size={16} className="locacao-card__chevron" /> : <IconChevronRight size={16} className="locacao-card__chevron" />}
                  <strong>{fornecedor?.nome ?? 'Locador não informado'}</strong>
                  <span className={`locacao-card__status locacao-card__status--${status}`}>{STATUS_LABEL[status]}</span>
                  <span className="locacao-card__periodo">{formatDate(l.dataInicio)} a {formatDate(l.dataFim)}</span>
                  <span className={`locacao-card__entrega-badge ${l.entregue ? 'locacao-card__entrega-badge--sim' : 'locacao-card__entrega-badge--nao'}`}>
                    {l.entregue ? `Entregue${l.dataEntrega ? ` — ${formatDate(l.dataEntrega)}` : ''}` : 'Não entregue'}
                  </span>
                  {lancamento && (
                    <span className="locacao-card__financeiro locacao-card__financeiro--compact">
                      Venc.: {formatDate(lancamento.dataVencimento)}
                      <span className={`locacao-card__status-lancamento locacao-card__status-lancamento--${lancamento.status}`}>
                        {STATUS_LANCAMENTO_LABEL[lancamento.status]}
                      </span>
                    </span>
                  )}
                </div>
                <div className="locacao-card__header-actions" onClick={(e) => e.stopPropagation()}>
                  <span className="locacao-card__valor">{formatBRL(l.valorTotal)}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => setRenovando(l)} aria-label="Renovar locação">
                    <IconRefresh size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(l)} aria-label="Editar locação">
                    <IconEdit size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(l)} aria-label="Remover locação">
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>

              {expandida && (
                <div className="locacao-card__body">
                  <div className="locacao-card__meta">
                    {l.numeroContrato && <span><strong>Contrato:</strong> {l.numeroContrato}</span>}
                    {l.numeroFatura && <span><strong>Fatura(s):</strong> {l.numeroFatura}</span>}
                    {l.enderecoObra && <span><strong>Endereço obra:</strong> {l.enderecoObra}</span>}
                  </div>

                  <div className="locacao-card__entrega-financeiro">
                    <label className="locacao-card__entrega-toggle">
                      <input
                        type="checkbox"
                        checked={!!l.entregue}
                        onChange={(e) => handleToggleEntregue(l, e.target.checked)}
                      />
                      Entregue
                    </label>
                    {l.entregue && (
                      <input
                        type="date"
                        value={l.dataEntrega ?? todayISO()}
                        onChange={(e) => handleDataEntregaChange(l, e.target.value)}
                      />
                    )}
                    {lancamento ? (
                      <span className="locacao-card__financeiro">
                        <strong>Vencimento:</strong> {formatDate(lancamento.dataVencimento)}
                        <span className={`locacao-card__status-lancamento locacao-card__status-lancamento--${lancamento.status}`}>
                          {STATUS_LANCAMENTO_LABEL[lancamento.status]}
                        </span>
                      </span>
                    ) : (
                      <span className="locacao-card__financeiro locacao-card__financeiro--vazio">Sem lançamento financeiro vinculado</span>
                    )}
                  </div>

                  {l.itens.length > 0 && (
                    <table className="locacao-card__table">
                      <thead>
                        <tr>
                          <th>Descrição</th>
                          <th>Patrimônio</th>
                          <th>Qtd</th>
                          <th>Unitário</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {l.itens.map((item) => (
                          <tr key={item.id}>
                            <td>{item.descricao}</td>
                            <td>{item.patrimonio || '—'}</td>
                            <td>{item.quantidade}</td>
                            <td>{formatBRL(item.valorUnitario)}</td>
                            <td>{formatBRL(item.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="locacao-card__totais">
                    <span>Valor locação: {formatBRL(l.valorLocacao)}</span>
                    <span>Frete: {formatBRL(l.valorFrete)}</span>
                    <span><strong>Total: {formatBRL(l.valorTotal)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {editando && (
        <LocacaoFormModal
          open
          locacao={editando}
          fornecedores={fornecedores}
          onClose={() => setEditando(undefined)}
          onSaved={() => { setEditando(undefined); refreshLocacoes(); }}
        />
      )}

      {renovando && (
        <RenovarLocacaoModal
          open
          locacao={renovando}
          lancamento={renovando.lancamentoId ? lancamentos.find((lc) => lc.id === renovando.lancamentoId) : undefined}
          onClose={() => setRenovando(undefined)}
          onSaved={() => { setRenovando(undefined); refreshLocacoes(); refreshLancamentos(); }}
        />
      )}
    </div>
  );
}
