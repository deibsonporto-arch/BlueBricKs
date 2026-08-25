import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconFileInvoice, IconPlus } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { AtividadeStatusBadge } from '../common/StatusBadge';
import { ComposicaoInsumosField } from './ComposicaoInsumosField';
import type { Atividade, Cotacao, Obra, Subatividade, UnidadeMedida } from '../../types/domain';
import { EditableDateCell } from './EditableDateCell';
import { EditableNumberCell } from './EditableNumberCell';
import { EditablePredecessorCell } from './EditablePredecessorCell';
import { useCotacoes } from '../../hooks/useCotacoes';
import {
  buildReagendamentoPatch,
  deriveParentStatus,
  getDescendantIds,
  getSubatividadeDisplayStatus,
  getTaskNumber,
  isAtrasado,
  temNetos,
} from '../../utils/subatividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis, todayISO } from '../../utils/dateUtils';
import { getCurrentUserName } from '../../utils/currentUser';
import { generateId } from '../../utils/id';
import { ROUTES } from '../../routes/routes';
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
  obra: Obra;
  onClose: () => void;
  onUpdateAtividade: (id: string, patch: Partial<Atividade>) => void;
  onToggleSubatividade: (atividadeId: string, subatividadeId: string) => void;
  onUpdateSubatividade: (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => void;
  onToggleSubSubatividade: (atividadeId: string, subatividadeId: string, subSubatividadeId: string) => void;
  onUpdateSubSubatividade: (atividadeId: string, subatividadeId: string, subSubatividadeId: string, patch: Partial<Subatividade>) => void;
  onNavigateTo: (path: ItemPath) => void;
  /** Abre o formulário de criação já apontando pro pai certo (atividade, ou subatividade quando `path.subatividadeId` vem preenchido). */
  onAddChild: (path: ItemPath) => void;
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

/** Itens que têm este como predecessora — "pra frente" na cadeia, o inverso da Predecessora. */
function opcoesSucessoras(atividades: Atividade[], itemId: string): { path: ItemPath; label: string }[] {
  const out: { path: ItemPath; label: string }[] = [];
  for (const a of atividades) {
    if (a.dependeDe.includes(itemId)) out.push({ path: { atividadeId: a.id }, label: `${getTaskNumber(atividades, a.id)} — ${a.nome}` });
    for (const s of a.subatividades) {
      if (s.dependeDe.includes(itemId)) out.push({ path: { atividadeId: a.id, subatividadeId: s.id }, label: `${getTaskNumber(atividades, s.id)} — ${s.nome}` });
      for (const n of s.subatividades ?? []) {
        if (n.dependeDe.includes(itemId)) out.push({ path: { atividadeId: a.id, subatividadeId: s.id, netoId: n.id }, label: `${getTaskNumber(atividades, n.id)} — ${n.nome}` });
      }
    }
  }
  return out;
}

export function NoDetalhePanel({
  open,
  path,
  atividades,
  obra,
  onClose,
  onUpdateAtividade,
  onToggleSubatividade,
  onUpdateSubatividade,
  onToggleSubSubatividade,
  onUpdateSubSubatividade,
  onNavigateTo,
  onAddChild,
}: NoDetalhePanelProps) {
  const [netosExpandidos, setNetosExpandidos] = useState<Set<string>>(new Set());
  const [enviandoCotacao, setEnviandoCotacao] = useState(false);
  const navigate = useNavigate();
  const { createCotacao } = useCotacoes(obra.id);

  if (!path) return null;
  const atividade = atividades.find((a) => a.id === path.atividadeId);
  if (!atividade) return null;
  const subatividade = path.subatividadeId ? atividade.subatividades.find((s) => s.id === path.subatividadeId) : undefined;
  const neto = subatividade && path.netoId ? (subatividade.subatividades ?? []).find((n) => n.id === path.netoId) : undefined;

  const item = neto ?? subatividade ?? atividade;
  const numero = getTaskNumber(atividades, item.id);
  const excludeIds = new Set([item.id, ...getDescendantIds(item.id, atividades)]);
  const opcoes = opcoesPredecessora(atividades, excludeIds);
  const sucessoras = opcoesSucessoras(atividades, item.id);

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
  const podeTerFilhos = !neto; // netos são o 3º nível — não têm mais um nível abaixo
  // insumos (materiais/mão de obra/aluguel) só fazem sentido pra quem não tem filhos — quando tem
  // filhos, o custo já vem agregado deles, igual acontece nas datas/status.
  const podeTerInsumos = isSubatividadeOuNeto && !temFilhos;
  const insumosAtuais = (item as Subatividade).insumos ?? [];

  async function enviarInsumosParaCotacao() {
    const materiaisInsumos = insumosAtuais.filter((i) => i.tipo === 'material');
    if (materiaisInsumos.length === 0) return;
    setEnviandoCotacao(true);
    try {
      const now = new Date().toISOString();
      for (const i of materiaisInsumos) {
        const cotacao: Cotacao = {
          id: generateId(),
          obraId: obra.id,
          atividadeId: atividade.id,
          responsavel: getCurrentUserName(),
          data: todayISO(),
          itemServico: i.descricao,
          descricaoServico: i.sinapiCodigo ? `SINAPI ${i.sinapiCodigo}` : undefined,
          quantidade: i.quantidade,
          unidade: i.unidade as UnidadeMedida,
          valorUnitarioPrevisto: i.custoUnitario,
          fornecedores: [],
          status: 'em_cotacao',
          createdAt: now,
          updatedAt: now,
        };
        await createCotacao(cotacao);
      }
      onClose();
      navigate(ROUTES.obraMapaCotacao(obra.id));
    } finally {
      setEnviandoCotacao(false);
    }
  }

  // no título, mostra de qual fase/etapa (atividade-mãe) o item é — ex: "2.1 INST. HIDRAULICA / ESGOTO — WC-TÉRREO" — pra não ficar só o número solto, difícil de saber a que fase pertence.
  const tituloModal = isSubatividadeOuNeto ? `${numero} ${atividade.nome} — ${item.nome}` : `${numero} — ${item.nome}`;

  return (
    <Modal open={open} title={tituloModal} onClose={onClose} width="min(1200px, 96vw)">
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
          {sucessoras.length > 0 && (
            <div className="no-detalhe-panel__campo">
              <span className="no-detalhe-panel__label">Sucessoras (depende deste)</span>
              <select
                className="no-detalhe-panel__sucessoras-select"
                value=""
                onChange={(e) => {
                  const alvo = sucessoras.find((s) => `${s.path.atividadeId}:${s.path.subatividadeId ?? ''}:${s.path.netoId ?? ''}` === e.target.value);
                  if (alvo) onNavigateTo(alvo.path);
                }}
              >
                <option value="">Ir para uma sucessora...</option>
                {sucessoras.map((s) => (
                  <option key={`${s.path.atividadeId}:${s.path.subatividadeId ?? ''}:${s.path.netoId ?? ''}`} value={`${s.path.atividadeId}:${s.path.subatividadeId ?? ''}:${s.path.netoId ?? ''}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="no-detalhe-panel__campo">
            <span className="no-detalhe-panel__label">Status</span>
            <AtividadeStatusBadge status={isSubatividadeOuNeto ? displayStatus : (isAtrasado({ dataFim: atividade.dataFim, concluida }) ? 'atrasada' : displayStatus)} />
          </div>
        </div>

        {podeTerInsumos && (
          <div className="no-detalhe-panel__insumos">
            <ComposicaoInsumosField
              uf={obra.endereco.estado || 'GO'}
              etapaNome={atividade.nome}
              insumos={insumosAtuais}
              onChangeInsumos={(novo) => salvar({ insumos: novo })}
            />
            {insumosAtuais.some((i) => i.tipo === 'material') && (
              <button type="button" className="btn btn-secondary" disabled={enviandoCotacao} onClick={enviarInsumosParaCotacao}>
                <IconFileInvoice size={14} /> {enviandoCotacao ? 'Enviando...' : 'Enviar materiais para Mapa de Cotação'}
              </button>
            )}
          </div>
        )}

        {podeTerFilhos && (
          <div className="no-detalhe-panel__filhos">
            <div className="no-detalhe-panel__filhos-header">
              <h4>Itens dentro de "{item.nome}"</h4>
              <button
                type="button"
                className="btn btn-secondary no-detalhe-panel__add-btn"
                onClick={() => onAddChild(subatividade ? { atividadeId: atividade.id, subatividadeId: subatividade.id } : { atividadeId: atividade.id })}
              >
                <IconPlus size={13} /> Adicionar
              </button>
            </div>
            {!temFilhos && <p className="no-detalhe-panel__filhos-empty">Nenhum item ainda.</p>}
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
