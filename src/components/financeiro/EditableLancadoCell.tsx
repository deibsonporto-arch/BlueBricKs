import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import type { LancadoTipo } from '../../types/domain';
import { LANCADO_LABEL, LANCADO_OPTIONS } from '../../utils/lancado';
import './EditableLancadoCell.css';

interface EditableLancadoCellProps {
  tipo: LancadoTipo;
  numero?: string;
  onSave: (tipo: LancadoTipo, numero: string) => void;
}

export function EditableLancadoCell({ tipo, numero, onSave }: EditableLancadoCellProps) {
  const [editing, setEditing] = useState(false);
  const [tipoDraft, setTipoDraft] = useState<LancadoTipo>(tipo);
  const [numeroDraft, setNumeroDraft] = useState(numero ?? '');

  function abrir() {
    setTipoDraft(tipo);
    setNumeroDraft(numero ?? '');
    setEditing(true);
  }

  function salvar() {
    onSave(tipoDraft, numeroDraft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="editable-lancado-cell__form">
        <select
          className="editable-lancado-cell__select"
          value={tipoDraft}
          autoFocus
          onChange={(e) => setTipoDraft(e.target.value as LancadoTipo)}
        >
          {LANCADO_OPTIONS.map((t) => <option key={t} value={t}>{LANCADO_LABEL[t]}</option>)}
        </select>
        <input
          className="editable-lancado-cell__numero"
          placeholder="Nº"
          value={numeroDraft}
          onChange={(e) => setNumeroDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
        />
        <button type="button" className="editable-lancado-cell__ok" onClick={salvar} aria-label="Salvar">
          <IconCheck size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`editable-lancado-cell__pill editable-lancado-cell__pill--${tipo}`}
      onClick={abrir}
      title="Clique para editar"
    >
      {LANCADO_LABEL[tipo]}{numero ? ` · ${numero}` : ''}
    </button>
  );
}
