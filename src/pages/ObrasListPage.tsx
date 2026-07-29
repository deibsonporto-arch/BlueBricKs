import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { ObrasMetricsPanel } from '../components/obras/ObrasMetricsPanel';
import { ObrasFilterBar } from '../components/obras/ObrasFilterBar';
import { ObraCard } from '../components/obras/ObraCard';
import { NewObraCard } from '../components/obras/NewObraCard';
import { ObraFormModal } from '../components/obras/ObraFormModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useObras } from '../hooks/useObras';
import { atividadeRepository } from '../data/repositories/atividadeRepository';
import { lancamentoRepository } from '../data/repositories/lancamentoRepository';
import type { Obra, StatusObra } from '../types/domain';
import { computeStatus } from '../utils/obraStatus';

export function ObrasListPage() {
  const navigate = useNavigate();
  const { obras, deleteObra, refresh } = useObras();
  const [atividades] = useState(() => atividadeRepository.list());
  const [lancamentos] = useState(() => lancamentoRepository.list());

  const [statusFilter, setStatusFilter] = useState<StatusObra | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingObra, setEditingObra] = useState<Obra | undefined>(undefined);
  const [deletingObra, setDeletingObra] = useState<Obra | undefined>(undefined);

  const obrasReais = useMemo(() => obras.filter((o) => !o.isModelo), [obras]);

  const filteredObras = useMemo(() => {
    const term = search.trim().toLowerCase();
    return obrasReais.filter((o) => {
      const status = computeStatus(o, atividades.filter((a) => a.obraId === o.id));
      if (statusFilter !== 'todos' && status !== statusFilter) return false;
      if (!term) return true;
      const local = `${o.endereco.logradouro} ${o.endereco.bairro ?? ''} ${o.endereco.cidade}`.toLowerCase();
      return o.nome.toLowerCase().includes(term) || local.includes(term);
    });
  }, [obrasReais, statusFilter, search, atividades]);

  function openCreate() {
    setFormMode('create');
    setEditingObra(undefined);
    setFormOpen(true);
  }

  function openEdit(obra: Obra) {
    setFormMode('edit');
    setEditingObra(obra);
    setFormOpen(true);
  }

  function handleSaved() {
    setFormOpen(false);
    refresh();
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <ObrasMetricsPanel obras={obrasReais} atividades={atividades} />
        <ObrasFilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          search={search}
          onSearchChange={setSearch}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {filteredObras.map((obra) => (
            <ObraCard
              key={obra.id}
              obra={obra}
              atividades={atividades.filter((a) => a.obraId === obra.id)}
              lancamentos={lancamentos.filter((l) => l.obraId === obra.id)}
              onView={() => navigate(`/obras/${obra.id}`)}
              onEdit={() => openEdit(obra)}
              onDelete={() => setDeletingObra(obra)}
            />
          ))}
          <NewObraCard onClick={openCreate} />
        </div>
      </div>

      <ObraFormModal
        open={formOpen}
        mode={formMode}
        initialValue={editingObra}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!deletingObra}
        title="Excluir obra"
        message={`Tem certeza que deseja excluir "${deletingObra?.nome}"? Essa ação também remove todas as atividades associadas e não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingObra(undefined)}
        onConfirm={async () => {
          if (deletingObra) await deleteObra(deletingObra.id);
          setDeletingObra(undefined);
        }}
      />
    </div>
  );
}
