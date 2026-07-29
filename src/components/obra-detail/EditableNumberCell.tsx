import { useState } from 'react';
import './EditableCells.css';

interface EditableNumberCellProps {
  value: number;
  onSave: (newValue: number) => void;
  suffix?: string;
}

export function EditableNumberCell({ value, onSave, suffix }: EditableNumberCellProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        className="editable-cell__input"
        defaultValue={value}
        autoFocus
        onBlur={(e) => {
          onSave(Number(e.target.value) || 0);
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
      {value}{suffix ? ` ${suffix}` : ''}
    </span>
  );
}
