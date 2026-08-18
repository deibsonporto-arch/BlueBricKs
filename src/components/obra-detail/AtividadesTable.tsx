import { Fragment, useState } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconGripVertical,
  IconLock,
  IconLockOpen,
  IconPlayerPlay,
  IconPlayerPlayFilled,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import type { Atividade, Subatividade } from '../../types/domain';
import { AtividadeStatusBadge } from '../common/StatusBadge';
import { isBlocked } from '../../hooks/useAtividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis, formatDate } from '../../utils/dateUtils';
import { formatBRL, formatNumberBR } from '../../utils/currency';
import { totaisPorTipo } from '../../utils/insumosAtividade';
import { buildReagendamentoPatch, deriveParentStatus, getDescendantIds, getOrderedSubatividades, getSubatividadeDisplayStatus, getTaskNumber, isAtrasado } from '../../utils/subatividades';
import { EditableDateCell } from './EditableDateCell';
import { EditableNumberCell } from './EditableNumberCell';
import { EditablePredecessorCell } from './EditablePredecessorCell';
import './AtividadesTable.css';

function isAtividadeConcluida(x: Atividade): boolean {
  return x.subatividades.length > 0 ? (deriveParentStatus(x.subatividades)?.concluida ?? x.concluida) : x.concluida;
}

interface AtividadesTableProps {
  atividades: Atividade[];
  onToggleConclusao: (id: string) => void;
  onUpdateAtividade: (id: string, patch: Partial<Atividade>) => void;
  onToggleSubatividade: (atividadeId: string, subatividadeId: string) => void;
  onUpdateSubatividade: (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => void;
  onDeleteSubatividade: (atividadeId: string, subatividadeId: string) => void;
  onReorderAtividades: (idsNaNovaOrdem: string[]) => void;
  onReorderSubatividades: (atividadeId: string, idsNaNovaOrdem: string[]) => void;
  onEdit: (atividade: Atividade) => void;
  onDelete: (atividade: Atividade) => void;
  onNew: () => void;
  onUsarEtapasPadrao?: () => void;
  onEnviarParaRequisicoes?: (atividade: Atividade, subatividade: Subatividade) => void;
  subatividadesComRequisicaoEnviada?: Set<string>;
  onNewSubatividade: (atividadeId: string) => void;
  onEditSubatividade: (atividadeId: string, subatividade: Subatividade) => void;
}

export function AtividadesTable({
  atividades,
  onToggleConclusao,
  onUpdateAtividade,
  onToggleSubatividade,
  onUpdateSubatividade,
  onDeleteSubatividade,
  onReorderAtividades,
  onReorderSubatividades,
  onEdit,
  onDelete,
  onNew,
  onUsarEtapasPadrao,
  onEnviarParaRequisicoes,
  subatividadesComRequisicaoEnviada,
  onNewSubatividade,
  onEditSubatividade,
}: AtividadesTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInsumos, setExpandedInsumos] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const displayList = pendingOrder
    ? [
        ...pendingOrder.map((id) => atividades.find((a) => a.id === id)).filter((a): a is Atividade => !!a),
        ...atividades.filter((a) => !pendingOrder.includes(a.id)),
      ]
    : atividades;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandedInsumos(id: string) {
    setExpandedInsumos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removerInsumoDaSubatividade(atividadeId: string, s: Subatividade, insumoId: string) {
    const novosInsumos = (s.insumos ?? []).filter((i) => i.id !== insumoId);
    const totais = totaisPorTipo(novosInsumos);
    onUpdateSubatividade(atividadeId, s.id, {
      insumos: novosInsumos,
      custoMaterial: totais.material,
      custoMaoDeObra: totais.mao_de_obra,
      custoAluguel: totais.aluguel,
    });
  }

  function handleDrop(atividadeId: string, orderedList: Subatividade[], targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const ids = orderedList.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, draggedId);
    onReorderSubatividades(atividadeId, newIds);
    setDraggedId(null);
  }

  function handleDropAtividade(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const ids = displayList.map((a) => a.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, draggedId);
    setPendingOrder(newIds);
    setDraggedId(null);
  }

  function confirmarNovaOrdem() {
    if (!pendingOrder) return;
    onReorderAtividades(pendingOrder);
    setPendingOrder(null);
  }

  function cancelarNovaOrdem() {
    setPendingOrder(null);
  }

  return (
    <div className="atividades-table-card">
      <div className="atividades-table-card__header">
        <h3>Atividades</h3>
        <div className="atividades-table-card__header-actions">
          {onUsarEtapasPadrao && (
            <button type="button" className="btn btn-secondary" onClick={onUsarEtapasPadrao}>
              Usar etapas pré-cadastradas
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onNew}>
            <IconPlus size={16} /> Nova atividade
          </button>
        </div>
      </div>

      {pendingOrder && (
        <div className="atividades-table__reorder-bar">
          <span>Nova ordem das atividades — confirme para salvar.</span>
          <div className="atividades-table__reorder-actions">
            <button type="button" className="btn btn-ghost" onClick={cancelarNovaOrdem}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmarNovaOrdem}>
              Confirmar nova ordem
            </button>
          </div>
        </div>
      )}

      <div className="scroll-x">
        <table className="atividades-table">
          <thead>
            <tr>
              <th></th>
              <th></th>
              <th></th>
              <th>Atividade</th>
              <th>Predecessoras</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Duração (sem)</th>
              <th>Mão de obra</th>
              <th>Material</th>
              <th>Aluguel</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((a) => {
              const blocked = isBlocked(a, atividades);
              const isExpanded = expanded.has(a.id);
              const subConcluidas = a.subatividades.filter((s) => s.concluida).length;
              const temSubatividades = a.subatividades.length > 0;
              const autoData = a.dependeDe.length > 0 && a.dataAutomatica !== false;

              const excludedIds = new Set([a.id, ...getDescendantIds(a.id, atividades)]);
              const opcoesPredecessora = displayList
                .filter((x) => !excludedIds.has(x.id))
                .map((x) => ({ id: x.id, label: `${getTaskNumber(displayList, x.id)} — ${x.nome}`, concluida: isAtividadeConcluida(x) }));

              const subatividadesOrdenadas = getOrderedSubatividades(a.subatividades);

              const derivadoDeSubatividades = temSubatividades ? deriveParentStatus(a.subatividades) : undefined;
              const atividadeStatus = derivadoDeSubatividades?.status ?? a.status;
              const atividadeConcluida = derivadoDeSubatividades?.concluida ?? a.concluida;
              // faixas com subatividades já mostram o atraso individualmente em cada subativ-row —
              // aqui só marca a linha-mãe quando ela mesma é a folha (sem subatividades)
              const atividadeAtrasada = !temSubatividades && isAtrasado({ dataFim: a.dataFim, concluida: atividadeConcluida });

              return (
                <Fragment key={a.id}>
                  <tr
                    className={`${atividadeConcluida ? 'is-concluida' : ''}${draggedId === a.id ? ' is-dragging' : ''}${atividadeAtrasada ? ' is-atrasada' : ''}`}
                    draggable
                    onDragStart={() => setDraggedId(a.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropAtividade(a.id)}
                  >
                    <td className="atividades-table__drag" title="Arraste para reordenar">
                      <IconGripVertical size={14} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="atividades-table__expand-btn"
                        onClick={() => toggleExpanded(a.id)}
                        aria-label={isExpanded ? 'Recolher subatividades' : 'Expandir subatividades'}
                      >
                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={atividadeConcluida}
                        disabled={temSubatividades || (!a.concluida && blocked)}
                        title={
                          temSubatividades
                            ? 'Calculado automaticamente a partir das subatividades'
                            : !a.concluida && blocked
                              ? 'Aguardando conclusão da predecessora'
                              : undefined
                        }
                        onChange={() => onToggleConclusao(a.id)}
                      />
                    </td>
                    <td className="atividades-table__nome">
                      <span className="atividades-table__numero">{getTaskNumber(displayList, a.id)}</span> {a.nome}
                      {temSubatividades && (
                        <span className="atividades-table__sub-count"> ({subConcluidas}/{a.subatividades.length})</span>
                      )}
                    </td>
                    <td>
                      <EditablePredecessorCell
                        values={a.dependeDe}
                        options={opcoesPredecessora}
                        onSave={(novosIds) => onUpdateAtividade(a.id, { dependeDe: novosIds, updatedAt: new Date().toISOString() })}
                      />
                    </td>
                    <td>
                      <div className="atividades-table__data-cell">
                        <EditableDateCell
                          value={a.dataInicio}
                          disabled={temSubatividades || autoData}
                          disabledTitle={temSubatividades ? 'Calculado a partir das subatividades' : 'Data automática — clique no cadeado para editar manualmente'}
                          onSave={(novaData) => onUpdateAtividade(a.id, { ...buildReagendamentoPatch(a, novaData), updatedAt: new Date().toISOString() })}
                        />
                        {a.dataInicioOriginal && (
                          <span className="atividades-table__data-original" title="Data de início planejada antes do atraso">
                            previsto: {formatDate(a.dataInicioOriginal)}
                          </span>
                        )}
                        {a.dependeDe.length > 0 && !temSubatividades && (
                          <button
                            type="button"
                            className={`subativ-row__auto-btn${a.dataAutomatica === false ? ' is-manual' : ''}`}
                            onClick={() => onUpdateAtividade(a.id, { dataAutomatica: a.dataAutomatica === false, updatedAt: new Date().toISOString() })}
                            title={
                              a.dataAutomatica === false
                                ? 'Data manual — clique para voltar a calcular automaticamente pela predecessora'
                                : 'Data automática pela predecessora — clique para travar e editar manualmente'
                            }
                          >
                            {a.dataAutomatica === false ? <IconLockOpen size={12} /> : <IconLock size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <EditableDateCell
                        value={a.dataFim}
                        disabled={temSubatividades}
                        disabledTitle="Calculado a partir das subatividades"
                        onSave={(novaData) => onUpdateAtividade(a.id, { dataFim: novaData, updatedAt: new Date().toISOString() })}
                      />
                    </td>
                    <td>
                      {temSubatividades ? (
                        <span className="editable-cell editable-cell--disabled" title="Calculado a partir das subatividades">
                          {Math.max(1, Math.round(durationDays(a.dataInicio, a.dataFim) / 7))} sem
                        </span>
                      ) : a.duracaoDias != null ? (
                        <EditableNumberCell
                          value={a.duracaoDias}
                          suffix="dias"
                          onSave={(v) => onUpdateAtividade(a.id, { duracaoDias: Math.max(1, v), duracaoSemanas: undefined, updatedAt: new Date().toISOString() })}
                        />
                      ) : (
                        <EditableNumberCell
                          value={a.duracaoSemanas ?? Math.max(1, Math.round(durationDays(a.dataInicio, a.dataFim) / 7))}
                          suffix="sem"
                          onSave={(v) => onUpdateAtividade(a.id, { duracaoSemanas: Math.max(1, v), duracaoDias: undefined, updatedAt: new Date().toISOString() })}
                        />
                      )}
                    </td>
                    <td>{formatBRL(a.custoMaoDeObra)}</td>
                    <td>{formatBRL(a.custoMaterial)}</td>
                    <td>{formatBRL(a.custoAluguel)}</td>
                    <td><AtividadeStatusBadge status={atividadeStatus} /></td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => onEdit(a)} aria-label="Editar atividade">
                        <IconEdit size={16} />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDelete(a)} aria-label="Excluir atividade">
                        <IconTrash size={16} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="atividades-table__sub-row">
                      <td></td>
                      <td></td>
                      <td colSpan={11}>
                        <div className="subativ-list">
                          {subatividadesOrdenadas.map(({ subatividade: s, depth }) => {
                            const subExcluded = new Set([s.id, ...getDescendantIds(s.id, atividades)]);
                            const subOpcoes = [
                              ...displayList
                                .filter((x) => !subExcluded.has(x.id))
                                .map((x) => ({ id: x.id, label: `${getTaskNumber(displayList, x.id)} — ${x.nome}`, concluida: isAtividadeConcluida(x) })),
                              ...displayList.flatMap((x) =>
                                x.subatividades
                                  .filter((y) => !subExcluded.has(y.id))
                                  .map((y) => ({ id: y.id, label: `${getTaskNumber(displayList, y.id)} — ${y.nome}`, concluida: y.concluida })),
                              ),
                            ];

                            const displayStatus = getSubatividadeDisplayStatus(s);
                            const subTemPredecessora = s.dependeDe.length > 0 || a.dependeDe.length > 0;
                            const temInsumos = (s.insumos?.length ?? 0) > 0;
                            const insumosExpandidos = expandedInsumos.has(s.id);

                            return (
                              <Fragment key={s.id}>
                              <div
                                className={`subativ-row${draggedId === s.id ? ' is-dragging' : ''}${displayStatus === 'atrasada' ? ' is-atrasada' : ''}`}
                                draggable
                                onDragStart={() => setDraggedId(s.id)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(a.id, subatividadesOrdenadas.map((n) => n.subatividade), s.id)}
                              >
                                <span className="subativ-row__drag" title="Arraste para reordenar">
                                  <IconGripVertical size={14} />
                                </span>
                                <span className="subativ-row__indent" style={{ width: depth * 20 }} />
                                <input
                                  type="checkbox"
                                  checked={s.concluida}
                                  onChange={() => onToggleSubatividade(a.id, s.id)}
                                />
                                <button
                                  type="button"
                                  className={`subativ-row__iniciar-btn${s.iniciada ? ' is-iniciada' : ''}`}
                                  onClick={() => onUpdateSubatividade(a.id, s.id, { iniciada: !s.iniciada })}
                                  title={s.iniciada ? 'Marcada como iniciada' : 'Marcar como iniciada'}
                                >
                                  {s.iniciada ? <IconPlayerPlayFilled size={12} /> : <IconPlayerPlay size={12} />}
                                </button>
                                <span className="subativ-row__numero">{getTaskNumber(displayList, s.id)}</span>
                                {temInsumos && (
                                  <button
                                    type="button"
                                    className="subativ-row__insumos-toggle"
                                    onClick={() => toggleExpandedInsumos(s.id)}
                                    aria-label={insumosExpandidos ? 'Recolher insumos' : 'Expandir insumos'}
                                  >
                                    {insumosExpandidos ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                                  </button>
                                )}
                                <span className={`subativ-row__nome${s.concluida ? ' is-concluida' : ''}`}>{s.nome}</span>
                                {temInsumos && (
                                  <span className="subativ-row__insumos-badges">
                                    <span className="subativ-row__badge">Mão de obra {formatBRL(s.custoMaoDeObra)}</span>
                                    <span className="subativ-row__badge">Materiais {formatBRL(s.custoMaterial)}</span>
                                  </span>
                                )}
                                {subTemPredecessora && (
                                  <button
                                    type="button"
                                    className={`subativ-row__auto-btn${s.dataAutomatica === false ? ' is-manual' : ''}`}
                                    onClick={() => onUpdateSubatividade(a.id, s.id, { dataAutomatica: s.dataAutomatica === false })}
                                    title={
                                      s.dataAutomatica === false
                                        ? 'Data manual — clique para voltar a calcular automaticamente pela predecessora'
                                        : 'Data automática pela predecessora — clique para travar e editar manualmente'
                                    }
                                  >
                                    {s.dataAutomatica === false ? <IconLockOpen size={12} /> : <IconLock size={12} />}
                                  </button>
                                )}
                                <span className="subativ-row__campo">
                                  <EditableDateCell
                                    value={s.dataInicio}
                                    disabled={subTemPredecessora && s.dataAutomatica !== false}
                                    disabledTitle="Data automática — clique no cadeado para editar manualmente"
                                    onSave={(v) => onUpdateSubatividade(a.id, s.id, buildReagendamentoPatch(s, v))}
                                  />
                                </span>
                                <span className="subativ-row__campo-sep">—</span>
                                <span className="subativ-row__campo">
                                  <EditableDateCell value={s.dataFim} onSave={(v) => onUpdateSubatividade(a.id, s.id, { dataFim: v })} />
                                </span>
                                {s.dataInicioOriginal && (
                                  <span className="atividades-table__data-original" title="Data de início planejada antes do atraso">
                                    previsto: {formatDate(s.dataInicioOriginal)}
                                  </span>
                                )}
                                <span className="subativ-row__campo">
                                  <EditableNumberCell
                                    value={s.contagemDias === 'uteis' ? businessDaysBetween(s.dataInicio, s.dataFim) : durationDays(s.dataInicio, s.dataFim)}
                                    suffix="dias"
                                    onSave={(v) =>
                                      onUpdateSubatividade(a.id, s.id, {
                                        dataFim: s.contagemDias === 'uteis' ? endDateFromDurationUteis(s.dataInicio, v) : endDateFromDuration(s.dataInicio, v),
                                      })
                                    }
                                  />
                                </span>
                                <button
                                  type="button"
                                  className="subativ-row__modo-btn"
                                  onClick={() => onUpdateSubatividade(a.id, s.id, { contagemDias: s.contagemDias === 'uteis' ? 'corridos' : 'uteis' })}
                                  title="Alternar entre dias corridos (conta sáb/dom) e dias úteis (pula sáb/dom)"
                                >
                                  {s.contagemDias === 'uteis' ? 'úteis' : 'corridos'}
                                </button>
                                <span className="subativ-row__campo">
                                  <EditablePredecessorCell
                                    values={s.dependeDe}
                                    options={subOpcoes}
                                    onSave={(v) => onUpdateSubatividade(a.id, s.id, { dependeDe: v })}
                                  />
                                </span>
                                {s.dependeDe.length > 0 && (
                                  <span className="subativ-row__campo" title="Dias de espera/cura após o fim da predecessora">
                                    <EditableNumberCell
                                      value={s.diasEsperaAposPredecessora ?? 0}
                                      suffix="d espera"
                                      onSave={(v) => onUpdateSubatividade(a.id, s.id, { diasEsperaAposPredecessora: Math.max(0, v) })}
                                    />
                                  </span>
                                )}
                                <AtividadeStatusBadge status={displayStatus} />
                                <button
                                  type="button"
                                  className="btn btn-ghost subativ-row__edit"
                                  onClick={() => onEditSubatividade(a.id, s)}
                                  aria-label="Editar subatividade"
                                >
                                  <IconEdit size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost subativ-row__remove"
                                  onClick={() => onDeleteSubatividade(a.id, s.id)}
                                  aria-label="Remover subatividade"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                              {temInsumos && insumosExpandidos && (
                                <div className="subativ-insumos" style={{ marginLeft: depth * 20 + 26 }}>
                                  {onEnviarParaRequisicoes && (
                                    <div className="subativ-insumos__enviar-row">
                                      <button
                                        type="button"
                                        className="btn btn-secondary subativ-insumos__enviar-btn"
                                        onClick={() => onEnviarParaRequisicoes(a, s)}
                                      >
                                        {subatividadesComRequisicaoEnviada?.has(s.id) ? 'Reenviar para Requisições' : 'Enviar tudo para Requisições'}
                                      </button>
                                      {subatividadesComRequisicaoEnviada?.has(s.id) && (
                                        <span className="subativ-insumos__enviado-badge">✓ Enviado para Requisições</span>
                                      )}
                                    </div>
                                  )}
                                  <table className="subativ-insumos__table">
                                    <thead>
                                      <tr>
                                        <th>Tipo</th>
                                        <th>Cód.</th>
                                        <th>Descrição</th>
                                        <th>Un.</th>
                                        <th>Qtd.</th>
                                        <th>Preço unit.</th>
                                        <th>Total</th>
                                        <th></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(s.insumos ?? []).map((i) => (
                                        <tr key={i.id}>
                                          <td>{i.tipo === 'mao_de_obra' ? 'Mão de obra' : i.tipo === 'aluguel' ? 'Aluguel' : 'Material'}</td>
                                          <td>{i.sinapiCodigo ?? '—'}</td>
                                          <td>{i.descricao}</td>
                                          <td>{i.unidade}</td>
                                          <td>{formatNumberBR(i.quantidade)}</td>
                                          <td>{formatBRL(i.custoUnitario)}</td>
                                          <td>{formatBRL(i.quantidade * i.custoUnitario)}</td>
                                          <td>
                                            <button
                                              type="button"
                                              className="btn btn-ghost"
                                              onClick={() => removerInsumoDaSubatividade(a.id, s, i.id)}
                                              aria-label="Remover insumo"
                                            >
                                              <IconTrash size={12} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              </Fragment>
                            );
                          })}
                        </div>
                        {!temSubatividades && (
                          <p className="subativ-list__empty">Nenhuma subatividade ainda — as datas, custos e materiais desta atividade vêm das subatividades.</p>
                        )}
                        <button type="button" className="btn btn-secondary subativ-list__add" onClick={() => onNewSubatividade(a.id)}>
                          <IconPlus size={14} /> Subatividade
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {atividades.length === 0 && (
              <tr>
                <td colSpan={13} className="atividades-table__empty">Nenhuma atividade cadastrada ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
