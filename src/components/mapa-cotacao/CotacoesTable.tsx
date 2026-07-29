import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconCopy, IconEdit, IconFileTypeDoc, IconFileTypePdf, IconLink, IconPaperclip, IconTrash } from '@tabler/icons-react';
import type { Atividade, Cotacao } from '../../types/domain';
import { melhorFornecedor } from '../../hooks/useCotacoes';
import { formatBRL } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { downloadAnexo } from '../../utils/attachmentStore';
import './CotacoesTable.css';

const STATUS_LABEL: Record<Cotacao['status'], string> = {
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
};

const STATUS_OPTIONS: Cotacao['status'][] = ['em_cotacao', 'aguardando_aprovacao', 'aprovado'];

interface CotacoesTableProps {
  cotacoes: Cotacao[];
  atividades: Atividade[];
  onAlterarStatus: (cotacao: Cotacao, novoStatus: Cotacao['status']) => void;
  onFiltrarPorAtividade: (atividadeId: string) => void;
  onEdit: (cotacao: Cotacao) => void;
  onDuplicar: (cotacao: Cotacao) => void;
  onDelete: (id: string) => void;
  onImprimir: (cotacao: Cotacao) => void;
  onBaixarWord: (cotacao: Cotacao) => void;
}

export function CotacoesTable({ cotacoes, atividades, onAlterarStatus, onFiltrarPorAtividade, onEdit, onDuplicar, onDelete, onImprimir, onBaixarWord }: CotacoesTableProps) {
  const maxFornecedores = Math.max(0, ...cotacoes.map((c) => c.fornecedores.length));
  const colunas = Array.from({ length: maxFornecedores }, (_, i) => i);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [editandoStatusId, setEditandoStatusId] = useState<string | undefined>(undefined);

  function toggleExpandida(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="scroll-x">
      <table className="cotacoes-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Responsável</th>
            <th>Atividade vinculada</th>
            <th>Previsto</th>
            {colunas.map((i) => (
              <th key={i}>Fornecedor {i + 1}</th>
            ))}
            <th>Melhor opção</th>
            <th>Tipo</th>
            <th>NF</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cotacoes.map((c) => {
            const melhor = melhorFornecedor(c);
            const atividade = atividades.find((a) => a.id === c.atividadeId);
            const totalPrevisto = c.naoPrevisto ? 0 : c.quantidade * c.valorUnitarioPrevisto;
            const acimaDoPrevisto = melhor !== undefined && totalPrevisto > 0 && melhor.valor > totalPrevisto;

            return (
              <tr key={c.id} className={c.status === 'aprovado' ? 'cotacoes-table__row--aprovado' : ''}>
                <td className="cotacoes-table__item">
                  {(() => {
                    const temDetalhes = Boolean(
                      c.descricaoServico || c.condicoesPagamentoGerais || c.servicosNaoInclusos || c.melhorOpcaoObservacao || c.observacoesGerais,
                    );
                    const temHistorico = Boolean(c.historico && c.historico.length > 0);
                    const expandida = expandidas.has(c.id);
                    return (
                      <>
                        <div className="cotacoes-table__item-row">
                          <span>{c.itemServico}</span>
                          {(temDetalhes || temHistorico) && (
                            <button type="button" className="cotacoes-table__toggle-detalhes" onClick={() => toggleExpandida(c.id)}>
                              {expandida ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
                              {expandida ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </button>
                          )}
                        </div>
                        {expandida && (
                          <>
                            {temDetalhes && (
                              <div className="cotacoes-table__desc-group">
                                {c.descricaoServico && <div className="cotacoes-table__desc">{c.descricaoServico}</div>}
                                {c.condicoesPagamentoGerais && (
                                  <div className="cotacoes-table__desc"><strong>Condições de pagamento:</strong> {c.condicoesPagamentoGerais}</div>
                                )}
                                {c.servicosNaoInclusos && (
                                  <div className="cotacoes-table__desc"><strong>Serviços não inclusos:</strong> {c.servicosNaoInclusos}</div>
                                )}
                                {c.melhorOpcaoObservacao && (
                                  <div className="cotacoes-table__desc"><strong>Melhor opção:</strong> {c.melhorOpcaoObservacao}</div>
                                )}
                                {c.observacoesGerais && (
                                  <div className="cotacoes-table__desc"><strong>Observações:</strong> {c.observacoesGerais}</div>
                                )}
                              </div>
                            )}
                            {c.historico && c.historico.length > 0 && (
                              <ul className="cotacoes-table__historico-list">
                                {[...c.historico].reverse().map((h, i) => (
                                  <li key={i}>
                                    <span className="cotacoes-table__historico-data">{formatDate(h.data.slice(0, 10))} — {h.usuario}</span>
                                    <span>{h.resumo}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="cotacoes-table__responsavel">
                  <div>{c.responsavel || '—'}</div>
                  <div className="cotacoes-table__muted">{formatDate(c.data)}</div>
                </td>
                <td>
                  {atividade ? (
                    <button type="button" className="atividade-link-pill" onClick={() => onFiltrarPorAtividade(atividade.id)}>
                      <IconLink size={12} /> {atividade.nome}
                    </button>
                  ) : (
                    <span className="cotacoes-table__muted">—</span>
                  )}
                </td>
                <td>
                  {totalPrevisto > 0 ? (
                    <>
                      <div>{formatBRL(totalPrevisto)}</div>
                      <div className="cotacoes-table__muted">{c.quantidade} {c.unidade} × {formatBRL(c.valorUnitarioPrevisto)}</div>
                    </>
                  ) : (
                    <span className="cotacoes-table__muted">—</span>
                  )}
                </td>
                {colunas.map((i) => {
                  const f = c.fornecedores[i];
                  if (!f) return <td key={i}>—</td>;
                  const isMelhor = f.id === melhor?.id;
                  return (
                    <td key={i} className={isMelhor ? 'cotacoes-table__cell-menor' : ''}>
                      <div className="cotacoes-table__fornecedor-nome">
                        {f.nome}
                        {f.orcamentoAnexo && (
                          <button
                            type="button"
                            className="cotacoes-table__anexo-btn"
                            onClick={() => downloadAnexo(f.orcamentoAnexo!)}
                            title={`Abrir orçamento: ${f.orcamentoAnexo.nome}`}
                            aria-label="Abrir orçamento anexado"
                          >
                            <IconPaperclip size={13} />
                          </button>
                        )}
                      </div>
                      <div className="cotacoes-table__valor">{formatBRL(f.valor)}</div>
                      {(f.marca || f.numeroOrcamento) && (
                        <div className="cotacoes-table__muted">
                          {f.marca}{f.marca && f.numeroOrcamento ? ' · ' : ''}{f.numeroOrcamento && `Orç. ${f.numeroOrcamento}`}
                        </div>
                      )}
                      {f.contato && <div className="cotacoes-table__muted">{f.contato}</div>}
                    </td>
                  );
                })}
                <td className="cotacoes-table__melhor">
                  {melhor ? melhor.nome : '—'}
                  {acimaDoPrevisto && <div className="cotacoes-table__acima-previsto">acima do previsto</div>}
                </td>
                <td>
                  {melhor && (
                    <span className={`tipo-badge tipo-badge--${melhor.tipo === 'PJ' ? 'pj' : 'informal'}`}>
                      {melhor.tipo === 'PJ' ? 'PJ' : 'Informal'}
                    </span>
                  )}
                </td>
                <td>
                  {melhor && (
                    <span className={`nf-badge nf-badge--${melhor.emiteNF ? 'sim' : 'nao'}`}>
                      {melhor.emiteNF ? 'Sim' : 'Não'}
                    </span>
                  )}
                </td>
                <td>
                  {editandoStatusId === c.id ? (
                    <select
                      className="cotacoes-table__status-select"
                      defaultValue={c.status}
                      autoFocus
                      onChange={(e) => { onAlterarStatus(c, e.target.value as Cotacao['status']); setEditandoStatusId(undefined); }}
                      onBlur={() => setEditandoStatusId(undefined)}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className={`cotacao-status-pill cotacao-status-pill--${c.status} cotacoes-table__status-pill`}
                      onClick={() => setEditandoStatusId(c.id)}
                      title="Clique para alterar o status"
                    >
                      {STATUS_LABEL[c.status]}
                    </button>
                  )}
                </td>
                <td className="cotacoes-table__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => onEdit(c)} aria-label="Editar cotação">
                    <IconEdit size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onDuplicar(c)} aria-label="Duplicar cotação">
                    <IconCopy size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onImprimir(c)} aria-label="Baixar cotação em PDF">
                    <IconFileTypePdf size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onBaixarWord(c)} aria-label="Baixar cotação em Word">
                    <IconFileTypeDoc size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onDelete(c.id)} aria-label="Excluir cotação">
                    <IconTrash size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {cotacoes.length === 0 && (
            <tr>
              <td colSpan={9 + maxFornecedores} className="cotacoes-table__empty">Nenhuma cotação cadastrada ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
