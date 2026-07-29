import { useEffect, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { MaterialPicker } from './MaterialPicker';
import type { ListaDeMateriais, MaterialCatalogItem } from '../../types/domain';
import { useListasDeMateriais } from '../../hooks/useListasDeMateriais';
import { generateId } from '../../utils/id';
import '../obra-detail/DynamicListField.css';
import './ListaDeMateriaisFormModal.css';

interface ListaDeMateriaisFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  lista?: ListaDeMateriais;
  catalogo: MaterialCatalogItem[];
  onClose: () => void;
  onSaved: () => void;
}

function toFormState(l?: ListaDeMateriais, catalogo?: MaterialCatalogItem[]) {
  return {
    nome: l?.nome ?? '',
    itens: l?.itens ?? (catalogo?.[0] ? [{ materialId: catalogo[0].id, quantidade: 1 }] : []),
  };
}

export function ListaDeMateriaisFormModal({ open, mode, lista, catalogo, onClose, onSaved }: ListaDeMateriaisFormModalProps) {
  const { createLista, updateLista } = useListasDeMateriais();
  const [form, setForm] = useState(() => toFormState(lista, catalogo));

  useEffect(() => {
    if (open) setForm(toFormState(lista, catalogo));
  }, [open, lista]);

  function updateItem(index: number, patch: Partial<{ materialId: string; quantidade: number }>) {
    setForm((f) => ({ ...f, itens: f.itens.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  }

  function addItem() {
    if (catalogo.length === 0) return;
    setForm((f) => ({ ...f, itens: [...f.itens, { materialId: catalogo[0].id, quantidade: 1 }] }));
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const base = { nome: form.nome, itens: form.itens };

    if (mode === 'create') {
      createLista({ id: generateId(), createdAt: now, updatedAt: now, ...base }).then(onSaved);
    } else if (lista) {
      updateLista(lista.id, { ...base, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova lista de materiais' : 'Editar lista de materiais'}
      onClose={onClose}
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="lista-materiais-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="lista-materiais-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome da lista</label>
          <input required autoFocus value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Lista de material para Fundação" />
        </div>

        <div className="dynamic-list-field">
          <div className="dynamic-list-field__header">
            <label>Itens da lista</label>
            <button type="button" className="btn btn-ghost" onClick={addItem} disabled={catalogo.length === 0}>
              <IconPlus size={14} /> Adicionar
            </button>
          </div>
          {catalogo.length === 0 && <p className="dynamic-list-field__empty">Cadastre materiais no catálogo antes de montar uma lista.</p>}
          {form.itens.length === 0 && catalogo.length > 0 && <p className="dynamic-list-field__empty">Nenhum item adicionado.</p>}
          {form.itens.map((item, index) => {
            const material = catalogo.find((m) => m.id === item.materialId);
            return (
              <div className="dynamic-list-field__row" key={index}>
                <MaterialPicker catalogo={catalogo} value={item.materialId} onChange={(materialId) => updateItem(index, { materialId })} />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantidade}
                  onChange={(e) => updateItem(index, { quantidade: Number(e.target.value) })}
                  style={{ width: 90 }}
                />
                <span className="lista-materiais-form__unidade">{material?.unidade}</span>
                <button type="button" className="btn btn-ghost dynamic-list-field__remove" onClick={() => removeItem(index)} aria-label="Remover">
                  <IconTrash size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
