import { useState } from 'react';
import type { StatusLancamento } from '../../types/domain';
import './EditableStatusCell.css';

const STATUS_LABEL: Record<StatusLancamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
};

const STATUS_OPTIONS: StatusLancamento[] = ['pendente', 'pago', 'atrasado'];

interface EditableStatusCellProps {
  value: StatusLancamento;
  onSave: (novoStatus: StatusLancamento) => void;
}

export function EditableStatusCell({ value, onSave }: EditableStatusCellProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        className="editable-status-cell__select"
        defaultValue={value}
        autoFocus
        onChange={(e) => { onSave(e.target.value as StatusLancamento); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
    );
  }

  return (
    <button
      type="button"
      className={`lancamento-status-pill lancamento-status-pill--${value} editable-status-cell__pill`}
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {STATUS_LABEL[value]}
    </button>
  );
}
