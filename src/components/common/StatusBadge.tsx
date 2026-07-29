import type { StatusAtividade, StatusObra } from '../../types/domain';
import { OBRA_STATUS_LABEL, SUBATIVIDADE_DISPLAY_LABEL } from '../../utils/obraStatus';
import './StatusBadge.css';

interface ObraStatusBadgeProps {
  status: StatusObra;
}

export function ObraStatusBadge({ status }: ObraStatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {OBRA_STATUS_LABEL[status]}
    </span>
  );
}

interface AtividadeStatusBadgeProps {
  status: StatusAtividade | 'atrasada';
}

export function AtividadeStatusBadge({ status }: AtividadeStatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {SUBATIVIDADE_DISPLAY_LABEL[status]}
    </span>
  );
}
