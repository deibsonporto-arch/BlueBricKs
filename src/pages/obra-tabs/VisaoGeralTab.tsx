import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBookmark } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useTemplates } from '../../hooks/useTemplates';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useLembretes } from '../../hooks/useLembretes';
import { VisaoGeralMetrics } from '../../components/obra-detail/VisaoGeralMetrics';
import { PagamentosDoDiaCard } from '../../components/obra-detail/PagamentosDoDiaCard';
import { LembretesCard } from '../../components/obra-detail/LembretesCard';
import { CurvaSSection } from '../../components/obra-detail/CurvaSSection';
import { GanttChart } from '../../components/obra-detail/GanttChart';
import { AtividadesTable } from '../../components/obra-detail/AtividadesTable';
import { AtividadeFormModal } from '../../components/obra-detail/AtividadeFormModal';
import { SubatividadeFormModal } from '../../components/obra-detail/SubatividadeFormModal';
import type { Atividade, Subatividade } from '../../types/domain';
import { businessDaysBetween } from '../../utils/dateUtils';

export function VisaoGeralTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const {
    atividades,
    toggleConclusao,
    updateAtividade,
    deleteAtividade,
    createSubatividade,
    updateSubatividade,
    deleteSubatividade,
    reorderAtividades,
    reorderSubatividades,
    refresh,
  } = useAtividades(obraId);
  const { saveTemplateFromObra, updateTemplateFromObra } = useTemplates();
  const { lancamentos } = useLancamentos(obraId);
  const { fornecedores } = useFornecedores();
  const { lembretes, createLembrete, toggleConcluido, deleteLembrete } = useLembretes(obraId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAtividade, setEditingAtividade] = useState<Atividade | undefined>(undefined);
  const [templateSaved, setTemplateSaved] = useState(false);

  const [subatividadeModalOpen, setSubatividadeModalOpen] = useState(false);
  const [subatividadeModalMode, setSubatividadeModalMode] = useState<'create' | 'edit'>('create');
  const [subatividadeParentId, setSubatividadeParentId] = useState<string>('');
  const [editingSubatividade, setEditingSubatividade] = useState<Subatividade | undefined>(undefined);

  if (!obra) return null;

  function openCreate() {
    setModalMode('create');
    setEditingAtividade(undefined);
    setModalOpen(true);
  }

  function openEdit(atividade: Atividade) {
    setModalMode('edit');
    setEditingAtividade(atividade);
    setModalOpen(true);
  }

  function handleDeleteAtividade(atividade: Atividade) {
    if (confirm(`Excluir a atividade "${atividade.nome}"? Isso também remove todas as suas subatividades. Essa ação não pode ser desfeita.`)) {
      deleteAtividade(atividade.id);
    }
  }

  function openNewSubatividade(atividadeId: string) {
    setSubatividadeModalMode('create');
    setEditingSubatividade(undefined);
    setSubatividadeParentId(atividadeId);
    setSubatividadeModalOpen(true);
  }

  function openEditSubatividade(atividadeId: string, subatividade: Subatividade) {
    setSubatividadeModalMode('edit');
    setEditingSubatividade(subatividade);
    setSubatividadeParentId(atividadeId);
    setSubatividadeModalOpen(true);
  }

  function handleToggleSubatividade(atividadeId: string, subatividadeId: string) {
    const atividade = atividades.find((a) => a.id === atividadeId);
    const sub = atividade?.subatividades.find((s) => s.id === subatividadeId);
    if (!sub) return;
    const willBeConcluida = !sub.concluida;
    updateSubatividade(atividadeId, subatividadeId, {
      concluida: willBeConcluida,
      status: willBeConcluida ? 'concluida' : 'pendente',
    });
  }

  async function handleSaveAsTemplate() {
    if (obra.isModelo && obra.templateOrigemId) {
      await updateTemplateFromObra(
        obra.templateOrigemId,
        obra.nome,
        obra.tipo,
        obra.orcamentoTotal,
        obra.dataInicio,
        atividades,
      );
    } else if (obra.isModelo) {
      await saveTemplateFromObra(obra.nome, obra.tipo, obra.orcamentoTotal, obra.dataInicio, atividades);
    } else {
      await saveTemplateFromObra(`Template — ${obra.nome}`, obra.tipo, obra.orcamentoTotal, obra.dataInicio, atividades);
    }
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 3000);
  }

  // duração real da obra = do início da atividade mais antiga ao fim da mais tardia (não a soma das durações
  // individuais, que infla o total quando atividades rodam em paralelo)
  const dataInicioObra = atividades.length > 0 ? atividades.reduce((min, a) => (a.dataInicio < min ? a.dataInicio : min), atividades[0].dataInicio) : obra.dataInicio;
  const dataFimObra = atividades.length > 0 ? atividades.reduce((max, a) => (a.dataFim > max ? a.dataFim : max), atividades[0].dataFim) : obra.dataInicio;
  const totalDias = atividades.length > 0 ? businessDaysBetween(dataInicioObra, dataFimObra) : 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div style={{ fontSize: 14 }}>
          <strong>{obra.nome}</strong> <span style={{ color: 'var(--color-text-muted)' }}>— Total: {totalDias} dias</span>
          {obra.isModelo && (
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: 'var(--color-primary-dark)', background: 'var(--color-primary-light)', borderRadius: 999, padding: '3px 10px' }}>
              Editando modelo
            </span>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleSaveAsTemplate} disabled={atividades.length === 0}>
          <IconBookmark size={16} /> {templateSaved ? 'Modelo salvo!' : obra.isModelo ? 'Salvar modelo' : 'Salvar cronograma como template'}
        </button>
      </div>

      <LembretesCard lembretes={lembretes} onCreate={createLembrete} onToggle={toggleConcluido} onDelete={deleteLembrete} />
      <VisaoGeralMetrics obra={obra} atividades={atividades} lancamentos={lancamentos} />
      <PagamentosDoDiaCard lancamentos={lancamentos} fornecedores={fornecedores} />
      <CurvaSSection obra={obra} atividades={atividades} lancamentos={lancamentos} />
      <GanttChart obra={obra} atividades={atividades} onBarClick={openEdit} />
      <AtividadesTable
        atividades={atividades}
        onToggleConclusao={toggleConclusao}
        onUpdateAtividade={updateAtividade}
        onToggleSubatividade={handleToggleSubatividade}
        onUpdateSubatividade={updateSubatividade}
        onDeleteSubatividade={deleteSubatividade}
        onReorderAtividades={reorderAtividades}
        onReorderSubatividades={reorderSubatividades}
        onEdit={openEdit}
        onDelete={handleDeleteAtividade}
        onNew={openCreate}
        onNewSubatividade={openNewSubatividade}
        onEditSubatividade={openEditSubatividade}
      />

      <AtividadeFormModal
        open={modalOpen}
        mode={modalMode}
        obraId={obraId}
        obraDataInicio={obra.dataInicio}
        atividade={editingAtividade}
        todasAtividades={atividades}
        lancamentos={lancamentos}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          refresh();
        }}
      />

      <SubatividadeFormModal
        open={subatividadeModalOpen}
        mode={subatividadeModalMode}
        obraId={obraId}
        atividadeId={subatividadeParentId}
        subatividade={editingSubatividade}
        todasAtividades={atividades}
        onClose={() => setSubatividadeModalOpen(false)}
        onSaved={() => {
          setSubatividadeModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
