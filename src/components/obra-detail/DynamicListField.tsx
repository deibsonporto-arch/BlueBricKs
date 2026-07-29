import type { ReactNode } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import './DynamicListField.css';

interface DynamicListFieldProps<T extends { id: string }> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderRowFields: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}

export function DynamicListField<T extends { id: string }>({
  label,
  items,
  onChange,
  newItem,
  renderRowFields,
}: DynamicListFieldProps<T>) {
  function updateItem(id: string, patch: Partial<T>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <div className="dynamic-list-field">
      <div className="dynamic-list-field__header">
        <label>{label}</label>
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...items, newItem()])}>
          <IconPlus size={14} /> Adicionar
        </button>
      </div>
      {items.length === 0 && <p className="dynamic-list-field__empty">Nenhum item adicionado.</p>}
      {items.map((item) => (
        <div className="dynamic-list-field__row" key={item.id}>
          {renderRowFields(item, (patch) => updateItem(item.id, patch))}
          <button type="button" className="btn btn-ghost dynamic-list-field__remove" onClick={() => removeItem(item.id)} aria-label="Remover">
            <IconTrash size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
