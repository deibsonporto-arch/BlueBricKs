import { useEffect, useState } from 'react';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { EquipeFormModal } from './EquipeFormModal';
import type { Equipe } from '../../types/domain';
import { useEquipes } from '../../hooks/useEquipes';
import '../financeiro/FornecedoresListModal.css';

interface EquipesListModalProps {
  open: boolean;
  onClose: () => void;
}

export function EquipesListModal({ open, onClose }: EquipesListModalProps) {
  const { equipes, deleteEquipe, refresh } = useEquipes();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Equipe | undefined>(undefined);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  function openCreate() {
    setFormModalMode('create');
    setEditing(undefined);
    setFormModalOpen(true);
  }

  function openEdit(e: Equipe) {
    setFormModalMode('edit');
    setEditing(e);
    setFormModalOpen(true);
  }

  function handleDelete(e: Equipe) {
    if (confirm(`Excluir a equipe "${e.nome}"?`)) deleteEquipe(e.id);
  }

  return (
    <>
      <Modal
        open={open}
        title="Equipes cadastradas"
        onClose={onClose}
        width={640}
        footer={<button type="button" className="btn btn-primary" onClick={openCreate}><IconPlus size={16} /> Nova equipe</button>}
      >
        <div className="fornecedores-list">
          {equipes.length === 0 ? (
            <p className="fornecedores-list__empty">Nenhuma equipe cadastrada ainda.</p>
          ) : (
            equipes.map((e) => (
              <div className="fornecedores-list__row" key={e.id}>
                <div>
                  <strong>{e.nome}</strong>
                  <div className="fornecedores-list__row-sub">
                    {e.membros.length > 0 ? e.membros.map((m) => m.nome || m.funcao).join(', ') : 'Nenhum membro'}
                  </div>
                </div>
                <div className="fornecedores-list__row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(e)} aria-label="Editar equipe">
                    <IconEdit size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(e)} aria-label="Excluir equipe">
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <EquipeFormModal
        open={formModalOpen}
        mode={formModalMode}
        equipe={editing}
        onClose={() => setFormModalOpen(false)}
        onSaved={() => { setFormModalOpen(false); refresh(); }}
      />
    </>
  );
}
