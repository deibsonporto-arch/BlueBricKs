import { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { AtividadeStatusBadge } from '../common/StatusBadge';
import type { Atividade, Subatividade } from '../../types/domain';
import { EditableDateCell } from './EditableDateCell';
import { EditableNumberCell } from './EditableNumberCell';
import { EditablePredecessorCell } from './EditablePredecessorCell';
import {
  buildReagendamentoPatch,
  deriveParentStatus,
  getDescendantIds,
  getSubatividadeDisplayStatus,
  getTaskNumber,
  isAtrasado,
  temNetos,
} from '../../utils/subatividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis } from '../../utils/dateUtils';
import './NoDetalhePanel.css';

export interface ItemPath {
  atividadeId: string;
  subatividadeId?: string;
  netoId?: string;
}

interface NoDetalhePanelProps {
  open: boolean;
  path: ItemPath | null;
  atividades: Atividade[];
  onClose: () => void;
  onUpdateAtividade: (id: string, patch: Partial<Atividade>) => void;
  onToggleSubatividade: (atividadeId: string, subatividadeId: string) => void;
  onUpdateSubatividade: (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => void;
  onToggleSubSubatividade: (atividadeId: string, subatividadeId: string, subSubatividadeId: string) => void;
  onUpdateSubSubatividade: (atividadeId: string, subatividadeId: string, subSubatividadeId: string, patch: Partial<Subatividade>) => void;
  onNavigateTo: (path: ItemPath) => void;
}

/** Duração em dias de um item com data própria (Atividade sem subatividades) ou com filhos (soma). */
function duracaoDias(item: { dataInicio: string; dataFim: string; contagemDias?: 'corridos' | 'uteis'; subatividades?: Subatividade[] }): number {
  if (item.subatividades && item.subatividades.length > 0) {
    return item.subatividades.reduce((soma, filho) => soma + duracaoDias(filho), 0);
  }
  return item.contagemDias === 'uteis' ? businessDaysBetween(item.dataInicio, item.dataFim) : durationDays(item.dataInicio, item.dataFim);
}

function isAtividadeConcluida(x: Atividade): boolean {
  return x.subatividades.length > 0 ? (deriveParentStatus(x.subatividades)?.concluida ?? x.concluida) : x.concluida;
}

function opcoesPredecessora(atividades: Atividade[], excludeIds: Set<string>) {
  return atividades.flatMap((a) => [
    { id: a.id, label: `${getTaskNumber(atividades, a.id)} — ${a.nome}`, concluida: isAtividadeConcluida(a) },
    ...a.subatividades.flatMap((s) => [
      { id: s.id, label: `${getTaskNumber(atividades, s.id)} — ${s.nome}`, concluida: s.concluida },
      ...(s.subatividades ?? []).map((n) => ({ id: n.id, label: `${getTaskNumber(atividades, n.id)} — ${n.nome}`, concluida: n.concluida })),
    ]),
  ]).filter((o) => !excludeIds.has(o.id));
}

export function NoDetalhePanel({
  open,
  path,
  atividades,
  onClose,
  onUpdateAtividade,
  onToggleSubatividade,
  onUpdateSubatividade,
  onToggleSubSubatividade,
  onUpdateSubSubatividade,
  onNavigateTo,
}: NoDetalhePanelProps) {
  const [netosExpandidos, setNetosExpandidos] = useState<Set<string>>(new Set());

  if (!path) return null;
  const atividade = atividades.find((a) => a.id === path.atividadeId);
  if (!atividade) return null;
  const subatividade = path.subatividadeId ? atividade.subatividades.find((s) => s.id === path.subatividadeId) : undefined;
  const neto = subatividade && path.netoId ? (subatividade.subatividades ?? []).find((n) => n.id === path.netoId) : undefined;

  const item = neto ?? subatividade ?? atividade;
  const numero = getTaskNumber(atividades, item.id);
  const excludeIds = new Set([item.id, ...getDescendantIds(item.id, atividades)]);
  const opcoes = opcoesPredecessora(atividades, excludeIds);

  const displayStatus = neto
    ? getSubatividadeDisplayStatus(neto)
    : subatividade
      ? (temNetos(subatividade) ? deriveParentStatus(subatividade.subatividades ?? [])?.status ?? subatividade.status : getSubatividadeDisplayStatus(subatividade))
      : (deriveParentStatus(atividade.subatividades)?.status ?? atividade.status);

  const temFilhos = neto ? false : subatividade ? temNetos(subatividade) : atividade.subatividades.length > 0;
  const concluida = neto ? neto.concluida : subatividade ? subatividade.concluida : isAtividadeConcluida(atividade);

  function toggleConcluida() {
    if (neto && subatividade) return onToggleSubSubatividade(atividade!.id, subatividade.id, neto.id);
    if (subatividade) return onToggleSubatividade(atividade!.id, subatividade.id);
  }

  function salvar(patch: Partial<Subatividade> | Partial<Atividade>) {
    if (neto && subatividade) return onUpdateSubSubatividade(atividade!.id, subatividade.id, neto.id, patch as Partial<Subatividade>);
    if (subatividade) return onUpdateSubatividade(atividade!.id, subatividade.id, patch as Partial<Subatividade>);
    return onUpdateAtividade(atividade!.id, patch as Partial<Atividade>);
  }

  const isSubatividadeOuNeto = !!subatividade;

  return (
    <Modal open={open} title={`${numero} — ${item.nome}`} onClose={onClose} width={480}>
      <div className="no-detalhe-panel">
        <div className="no-detalhe-panel__campos">
          {isSubatividadeOuNeto && (
            <label className="no-detalhe-panel__campo-checkbox">
              <input type="checkbox" checked={concluida} disabled={temFilhos} onChange={toggleConcluida} />
              Concluída
            </label>
          )}

          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Início</span>
            <EditableDateCell
              value={item.dataInicio}
              disabled={temFilhos}
              disabledTitle="Calculado a partir dos itens de dentro"
              onSave={(v) => salvar(buildReagendamentoPatch(item, v))}
            />
          </div>
          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Fim</span>
            <EditableDateCell value={item.dataFim} disabled={temFilhos} disabledTitle="Calculado a partir dos itens de dentro" onSave={(v) => salvar({ dataFim: v })} />
          </div>
          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Duração</span>
            {temFilhos || !isSubatividadeOuNeto ? (
              <span className="editable-cell editable-cell--disabled">{duracaoDias(item)} dias</span>
            ) : (
              <EditableNumberCell
                value={duracaoDias(item as Subatividade)}
                suffix="dias"
                onSave={(v) => {
                  const s = item as Subatividade;
                  salvar({ dataFim: s.contagemDias === 'uteis' ? endDateFromDurationUteis(s.dataInicio, v) : endDateFromDuration(s.dataInicio, v) });
                }}
              />
            )}
          </div>
          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Predecessora</span>
            <EditablePredecessorCell values={item.dependeDe} options={opcoes} onSave={(v) => salvar({ dependeDe: v })} />
          </div>
          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Status</span>
            <AtividadeStatusBadge status={isSubatividadeOuNeto ? displayStatus : (isAtrasado({ dataFim: atividade.dataFim, concluida }) ? 'atrasada' : displayStatus)} />
          </div>
        </div>

        {temFilhos && (
          <div className="no-detalhe-panel__filhos">
            <h4>Itens dentro de "{item.nome}"</h4>
            {!subatividade &&
              atividade.subatividades.map((s) => (
                <div key={s.id} className="no-detalhe-panel__filho-row">
                  <div className="no-detalhe-panel__filho-linha" onClick={() => onNavigateTo({ atividadeId: atividade.id, subatividadeId: s.id })}>
                    {temNetos(s) && (
                      <button
                        type="button"
                        className="no-detalhe-panel__filho-chevron"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNetosExpandidos((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          });
                        }}
                      >
                        {netosExpandidos.has(s.id) ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                      </button>
                    )}
                    <span className="no-detalhe-panel__filho-numero">{getTaskNumber(atividades, s.id)}</span>
                    <span className="no-detalhe-panel__filho-nome">{s.nome}</span>
                    <AtividadeStatusBadge status={getSubatividadeDisplayStatus(s)} />
                  </div>
                  {netosExpandidos.has(s.id) &&
                    (s.subatividades ?? []).map((n) => (
                      <div
                        key={n.id}
                        className="no-detalhe-panel__filho-linha no-detalhe-panel__filho-linha--neto"
                        onClick={() => onNavigateTo({ atividadeId: atividade.id, subatividadeId: s.id, netoId: n.id })}
                      >
                        <span className="no-detalhe-panel__filho-numero">{getTaskNumber(atividades, n.id)}</span>
                        <span className="no-detalhe-panel__filho-nome">{n.nome}</span>
                        <AtividadeStatusBadge status={getSubatividadeDisplayStatus(n)} />
                      </div>
                    ))}
                </div>
              ))}
            {subatividade &&
              (subatividade.subatividades ?? []).map((n) => (
                <div
                  key={n.id}
                  className="no-detalhe-panel__filho-linha"
                  onClick={() => onNavigateTo({ atividadeId: atividade.id, subatividadeId: subatividade.id, netoId: n.id })}
                >
                  <span className="no-detalhe-panel__filho-numero">{getTaskNumber(atividades, n.id)}</span>
                  <span className="no-detalhe-panel__filho-nome">{n.nome}</span>
                  <AtividadeStatusBadge status={getSubatividadeDisplayStatus(n)} />
                </div>
              ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
