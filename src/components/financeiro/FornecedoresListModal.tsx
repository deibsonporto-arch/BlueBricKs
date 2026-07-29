import { useEffect, useMemo, useState } from 'react';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { FornecedorFormModal } from './FornecedorFormModal';
import type { Fornecedor } from '../../types/domain';
import { useFornecedores } from '../../hooks/useFornecedores';
import './FornecedoresListModal.css';

interface FornecedoresListModalProps {
  open: boolean;
  onClose: () => void;
}

export function FornecedoresListModal({ open, onClose }: FornecedoresListModalProps) {
  const { fornecedores, deleteFornecedor, refresh } = useFornecedores();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Fornecedor | undefined>(undefined);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const fornecedoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return fornecedores;
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        f.codigo.toLowerCase().includes(q) ||
        f.documento.toLowerCase().includes(q) ||
        (f.cidade ?? '').toLowerCase().includes(q),
    );
  }, [fornecedores, busca]);

  function openCreate() {
    setFormModalMode('create');
    setEditing(undefined);
    setFormModalOpen(true);
  }

  function openEdit(f: Fornecedor) {
    setFormModalMode('edit');
    setEditing(f);
    setFormModalOpen(true);
  }

  function handleDelete(f: Fornecedor) {
    if (confirm(`Excluir o fornecedor ${f.nome}?`)) deleteFornecedor(f.id);
  }

  return (
    <>
      <Modal
        open={open}
        title="Fornecedores cadastrados"
        onClose={onClose}
        width={720}
        footer={<button type="button" className="btn btn-primary" onClick={openCreate}><IconPlus size={16} /> Novo fornecedor</button>}
      >
        <input
          className="fornecedores-list__busca"
          placeholder="Buscar por nome, código, CPF/CNPJ ou cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="fornecedores-list">
          {fornecedores.length === 0 ? (
            <p className="fornecedores-list__empty">Nenhum fornecedor cadastrado ainda.</p>
          ) : fornecedoresFiltrados.length === 0 ? (
            <p className="fornecedores-list__empty">Nenhum fornecedor encontrado para "{busca}".</p>
          ) : (
            fornecedoresFiltrados.map((f) => (
              <div className="fornecedores-list__row" key={f.id}>
                <div>
                  <strong>{f.codigo}</strong> — {f.nome}
                  <div className="fornecedores-list__row-sub">{f.tipo} · {f.documento || '—'} · {f.cidade || 'cidade não informada'}</div>
                </div>
                <div className="fornecedores-list__row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(f)} aria-label="Editar fornecedor">
                    <IconEdit size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(f)} aria-label="Excluir fornecedor">
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <FornecedorFormModal
        open={formModalOpen}
        mode={formModalMode}
        fornecedor={editing}
        onClose={() => setFormModalOpen(false)}
        onSaved={() => { setFormModalOpen(false); refresh(); }}
      />
    </>
  );
}
