import { IconEye, IconEdit, IconTrash, IconMapPin, IconUser, IconUsers, IconCalendar } from '@tabler/icons-react';
import type { Atividade, LancamentoFinanceiro, Obra } from '../../types/domain';
import { ObraStatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import { computeStatus } from '../../utils/obraStatus';
import { formatBRL, formatPct } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import './ObraCard.css';

const TIPO_LABEL: Record<Obra['tipo'], string> = {
  casa: 'Casa',
  galpao: 'Galpão',
  condominio: 'Condomínio',
  comercial: 'Comercial',
};

interface ObraCardProps {
  obra: Obra;
  atividades: Atividade[];
  lancamentos: LancamentoFinanceiro[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ObraCard({ obra, atividades, lancamentos, onView, onEdit, onDelete }: ObraCardProps) {
  const status = computeStatus(obra, atividades);
  const enderecoResumo = `${obra.endereco.logradouro}${obra.endereco.bairro ? `, ${obra.endereco.bairro}` : ''} — ${obra.endereco.cidade}/${obra.endereco.estado}`;

  const gastoReal = lancamentos.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
  const progressoFisico = atividades.length > 0 ? (atividades.filter((a) => a.concluida).length / atividades.length) * 100 : obra.progressoFisico;

  return (
    <div className={`obra-card${status === 'atrasada' ? ' obra-card--atrasada' : ''}`}>
      <div className="obra-card__header">
        <div>
          <div className="obra-card__codigo">{obra.codigo}</div>
          <h3 className="obra-card__nome" onClick={onView}>{obra.nome}</h3>
        </div>
        <ObraStatusBadge status={status} />
      </div>

      <div className="obra-card__tipo">{TIPO_LABEL[obra.tipo]}</div>

      <div className="obra-card__info">
        <div className="obra-card__info-row">
          <IconMapPin size={15} stroke={1.75} />
          <span>{enderecoResumo}</span>
        </div>
        <div className="obra-card__info-row">
          <IconUser size={15} stroke={1.75} />
          <span>{obra.responsavelTecnico}</span>
        </div>
        <div className="obra-card__info-row">
          <IconCalendar size={15} stroke={1.75} />
          <span>{formatDate(obra.dataInicio)} — {formatDate(obra.previsaoEntrega)}</span>
        </div>
        <div className="obra-card__info-row">
          <IconUsers size={15} stroke={1.75} />
          <span>{obra.colaboradoresAtivos} colaboradores ativos</span>
        </div>
      </div>

      <div className="obra-card__financeiro">
        <div>
          <span className="obra-card__financeiro-label">Orçamento</span>
          <span className="obra-card__financeiro-value">{formatBRL(obra.orcamentoTotal)}</span>
        </div>
        <div>
          <span className="obra-card__financeiro-label">Gasto</span>
          <span className="obra-card__financeiro-value">{formatBRL(gastoReal)}</span>
        </div>
      </div>

      <ProgressBar
        value={progressoFisico}
        color={status === 'atrasada' ? 'danger' : status === 'concluida' ? 'success' : 'primary'}
        label={`Progresso físico · ${formatPct(progressoFisico)}`}
      />

      <div className="obra-card__actions">
        <button type="button" className="btn btn-secondary" onClick={onView}>
          <IconEye size={16} /> Visualizar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onEdit} aria-label="Editar obra">
          <IconEdit size={16} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDelete} aria-label="Excluir obra">
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}
