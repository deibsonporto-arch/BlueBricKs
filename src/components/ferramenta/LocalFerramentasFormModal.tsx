import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { LocalFerramentas } from '../../types/domain';
import { useLocaisFerramentas } from '../../hooks/useLocaisFerramentas';
import { generateId } from '../../utils/id';

interface LocalFerramentasFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  item?: LocalFerramentas;
  onClose: () => void;
  onSaved: () => void;
}

export function LocalFerramentasFormModal({ open, mode, item, onClose, onSaved }: LocalFerramentasFormModalProps) {
  const { createLocal, updateLocal } = useLocaisFerramentas();
  const [nome, setNome] = useState(item?.nome ?? '');

  useEffect(() => {
    if (open) setNome(item?.nome ?? '');
  }, [open, item]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    if (mode === 'create') {
      createLocal({ id: generateId(), nome: nome.trim(), createdAt: now, updatedAt: now }).then(onSaved);
    } else if (item) {
      updateLocal(item.id, { nome: nome.trim() }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo local' : 'Editar local'}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="local-ferramentas-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="local-ferramentas-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome do local</label>
          <input required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: CD - Rua 16" />
        </div>
      </form>
    </Modal>
  );
}
