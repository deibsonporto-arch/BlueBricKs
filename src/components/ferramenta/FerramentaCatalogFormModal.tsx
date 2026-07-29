import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { FerramentaCatalogItem } from '../../types/domain';
import { useFerramentasCatalogo } from '../../hooks/useFerramentasCatalogo';
import { generateId } from '../../utils/id';

interface FerramentaCatalogFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  item?: FerramentaCatalogItem;
  onClose: () => void;
  onSaved: () => void;
}

export function FerramentaCatalogFormModal({ open, mode, item, onClose, onSaved }: FerramentaCatalogFormModalProps) {
  const { createItem, updateItem } = useFerramentasCatalogo();
  const [nome, setNome] = useState(item?.nome ?? '');

  useEffect(() => {
    if (open) setNome(item?.nome ?? '');
  }, [open, item]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    if (mode === 'create') {
      createItem({ id: generateId(), nome: nome.trim(), createdAt: now, updatedAt: now }).then(onSaved);
    } else if (item) {
      updateItem(item.id, { nome: nome.trim() }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo nome de ferramenta' : 'Editar nome de ferramenta'}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="ferramenta-catalogo-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="ferramenta-catalogo-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome</label>
          <input required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Carrinho de mão" />
        </div>
      </form>
    </Modal>
  );
}
