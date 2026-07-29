import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { MaterialCatalogItem, UnidadeMedida } from '../../types/domain';
import { useMateriaisCatalogo } from '../../hooks/useMateriaisCatalogo';
import { generateId } from '../../utils/id';

interface MaterialCatalogFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  material?: MaterialCatalogItem;
  categoriasExistentes: string[];
  onClose: () => void;
  onSaved: () => void;
}

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

function toFormState(m?: MaterialCatalogItem) {
  return {
    nome: m?.nome ?? '',
    categoria: m?.categoria ?? '',
    unidade: m?.unidade ?? ('un' as UnidadeMedida),
    custoUnitario: m ? String(m.custoUnitario ?? '') : '',
  };
}

export function MaterialCatalogFormModal({ open, mode, material, categoriasExistentes, onClose, onSaved }: MaterialCatalogFormModalProps) {
  const { createMaterial, updateMaterial } = useMateriaisCatalogo();
  const [form, setForm] = useState(() => toFormState(material));

  useEffect(() => {
    if (open) setForm(toFormState(material));
  }, [open, material]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const base = {
      nome: form.nome,
      categoria: form.categoria || 'Sem categoria',
      unidade: form.unidade,
      custoUnitario: form.custoUnitario ? Number(form.custoUnitario) : undefined,
    };

    if (mode === 'create') {
      createMaterial({ id: generateId(), createdAt: now, updatedAt: now, ...base }).then(onSaved);
    } else if (material) {
      updateMaterial(material.id, { ...base, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo material' : 'Editar material'}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="material-catalog-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="material-catalog-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome</label>
          <input required autoFocus value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Categoria</label>
          <input
            value={form.categoria}
            onChange={(e) => update('categoria', e.target.value)}
            list="categorias-existentes"
            placeholder="Ex: Cimento e Argamassa"
          />
          <datalist id="categorias-existentes">
            {categoriasExistentes.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="form-field">
          <label>Unidade</label>
          <select value={form.unidade} onChange={(e) => update('unidade', e.target.value as UnidadeMedida)}>
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-field form-field--full">
          <label>Custo unitário (R$)</label>
          <input type="number" min={0} step="0.01" value={form.custoUnitario} onChange={(e) => update('custoUnitario', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
