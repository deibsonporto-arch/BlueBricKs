import { useState } from 'react';
import { formatDateWithWeekday } from '../../utils/dateUtils';
import './EditableCells.css';

interface EditableDateCellProps {
  value: string;
  onSave: (newValue: string) => void;
  disabled?: boolean;
  disabledTitle?: string;
}

export function EditableDateCell({ value, onSave, disabled, disabledTitle }: EditableDateCellProps) {
  const [editing, setEditing] = useState(false);

  if (disabled) {
    return (
      <span className="editable-cell editable-cell--disabled" title={disabledTitle}>
        {formatDateWithWeekday(value)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        type="date"
        className="editable-cell__input"
        defaultValue={value}
        autoFocus
        onBlur={(e) => {
          if (e.target.value) onSave(e.target.value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span className="editable-cell" onClick={() => setEditing(true)} title="Clique para editar">
      {formatDateWithWeekday(value)}
    </span>
  );
}
