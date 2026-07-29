import { useState } from 'react';
import { IconLink } from '@tabler/icons-react';
import './EditableCells.css';

export interface PredecessorOption {
  id: string;
  label: string;
  concluida?: boolean;
}

interface EditablePredecessorCellProps {
  /** Ids de predecessora (até `maxPredecessoras`) — com 2, a data só é liberada depois que AMBAS terminarem (a que acabar por último manda na data). */
  values: string[];
  options: PredecessorOption[];
  onSave: (newValues: string[]) => void;
  /** Quantas predecessoras podem ser vinculadas ao mesmo tempo. Default 2. */
  maxPredecessoras?: number;
}

export function EditablePredecessorCell({ values, options, onSave, maxPredecessoras = 2 }: EditablePredecessorCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);
  const selecionadas = values.map((id) => options.find((o) => o.id === id)).filter((o): o is PredecessorOption => !!o);

  if (editing) {
    const primeira = draft[0] ?? '';
    const segunda = draft[1] ?? '';
    const opcoesSegunda = options.filter((o) => o.id !== primeira);

    function commit(next: string[]) {
      setDraft(next);
      onSave(next.filter(Boolean));
    }

    return (
      <div className="editable-cell__predecessor-group" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditing(false); }}>
        <select
          className="editable-cell__input"
          value={primeira}
          autoFocus
          onChange={(e) => {
            const novaPrimeira = e.target.value;
            const novaSegunda = segunda === novaPrimeira ? '' : segunda;
            commit(novaPrimeira ? [novaPrimeira, novaSegunda].filter(Boolean) : []);
          }}
        >
          <option value="">Nenhuma</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {primeira && maxPredecessoras > 1 && (
          <select
            className="editable-cell__input"
            value={segunda}
            onChange={(e) => commit([primeira, e.target.value].filter(Boolean))}
          >
            <option value="">+ 2ª predecessora (opcional)</option>
            {opcoesSegunda.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <span className="editable-cell" onClick={() => { setDraft(values); setEditing(true); }} title="Clique para editar">
      {selecionadas.length > 0 ? (
        selecionadas.map((s) => (
          <span key={s.id} className={`dep-tag${s.concluida ? ' dep-tag--concluida' : ''}`}>
            <IconLink size={12} /> {s.label}
          </span>
        ))
      ) : (
        <span className="atividades-table__muted">—</span>
      )}
    </span>
  );
}
