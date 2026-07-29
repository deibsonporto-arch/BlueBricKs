import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { DynamicListField } from '../obra-detail/DynamicListField';
import type { Equipe, EquipeMembro } from '../../types/domain';
import { useEquipes } from '../../hooks/useEquipes';
import { generateId } from '../../utils/id';
import './EquipeFormModal.css';

interface EquipeFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  equipe?: Equipe;
  onClose: () => void;
  onSaved: () => void;
}

export function EquipeFormModal({ open, mode, equipe, onClose, onSaved }: EquipeFormModalProps) {
  const { createEquipe, updateEquipe } = useEquipes();
  const [nome, setNome] = useState(equipe?.nome ?? '');
  const [membros, setMembros] = useState<EquipeMembro[]>(equipe?.membros ?? []);

  useEffect(() => {
    if (open) {
      setNome(equipe?.nome ?? '');
      setMembros(equipe?.membros ?? []);
    }
  }, [open, equipe]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    if (mode === 'create') {
      const nova: Equipe = { id: generateId(), nome, membros, createdAt: now, updatedAt: now };
      createEquipe(nova).then(onSaved);
    } else if (equipe) {
      updateEquipe(equipe.id, { nome, membros, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova equipe' : 'Editar equipe'}
      onClose={onClose}
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="equipe-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="equipe-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome da equipe</label>
          <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Equipe do Wendel" />
        </div>

        <DynamicListField<EquipeMembro>
          label="Membros"
          items={membros}
          onChange={setMembros}
          newItem={() => ({ id: generateId(), nome: '', funcao: '', valorDiaria: 0 })}
          renderRowFields={(item, upd) => (
            <div className="equipe-membro-row">
              <input placeholder="Nome" value={item.nome} onChange={(e) => upd({ nome: e.target.value })} />
              <input placeholder="Função" value={item.funcao} onChange={(e) => upd({ funcao: e.target.value })} />
              <input type="number" min={0} step="0.01" placeholder="Valor diária (R$)" value={item.valorDiaria} onChange={(e) => upd({ valorDiaria: Number(e.target.value) })} />
            </div>
          )}
        />
      </form>
    </Modal>
  );
}
