import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBookmark } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useTemplates } from '../../hooks/useTemplates';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useLembretes } from '../../hooks/useLembretes';
import { useRequisicoes } from '../../hooks/useRequisicoes';
import { useEstoque } from '../../hooks/useEstoque';
import { VisaoGeralMetrics } from '../../components/obra-detail/VisaoGeralMetrics';
import { PagamentosDoDiaCard } from '../../components/obra-detail/PagamentosDoDiaCard';
import { LembretesCard } from '../../components/obra-detail/LembretesCard';
import { CurvaSSection } from '../../components/obra-detail/CurvaSSection';
import { GanttChart } from '../../components/obra-detail/GanttChart';
import { AtividadesTable } from '../../components/obra-detail/AtividadesTable';
import { AtividadeFormModal } from '../../components/obra-detail/AtividadeFormModal';
import { SubatividadeFormModal } from '../../components/obra-detail/SubatividadeFormModal';
import { UsarEtapasPadraoModal } from '../../components/obra-detail/UsarEtapasPadraoModal';
import type { Atividade, Subatividade } from '../../types/domain';
import { businessDaysBetween } from '../../utils/dateUtils';
import { generateId } from '../../utils/id';
import { ordenarPorSequenciaPadrao } from '../../utils/etapasPadrao';

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
    updateSubatividade,
    duplicateSubatividade,
    deleteSubatividade,
    reorderAtividades,
    reorderSubatividades,
    updateSubSubatividade,
    deleteSubSubatividade,
    refresh,
  } = useAtividades(obraId);
  const { saveTemplateFromObra, updateTemplateFromObra } = useTemplates();
  const { lancamentos } = useLancamentos(obraId);
  const { fornecedores } = useFornecedores();
  const { lembretes, createLembrete, toggleConcluido, deleteLembrete } = useLembretes(obraId);
  const { requisicoes, createRequisicoes, deleteRequisicao } = useRequisicoes(obraId);
  const { entradas } = useEstoque(obraId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAtividade, setEditingAtividade] = useState<Atividade | undefined>(undefined);
  const [templateSaved, setTemplateSaved] = useState(false);

  const [subatividadeModalOpen, setSubatividadeModalOpen] = useState(false);
  const [subatividadeModalMode, setSubatividadeModalMode] = useState<'create' | 'edit'>('create');
  const [subatividadeParentId, setSubatividadeParentId] = useState<string>('');
  const [subSubatividadePaiId, setSubSubatividadePaiId] = useState<string>('');
  const [editingSubatividade, setEditingSubatividade] = useState<Subatividade | undefined>(undefined);
  const [etapasPadraoModalOpen, setEtapasPadraoModalOpen] = useState(false);

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

  async function handleEnviarParaRequisicoes(atividade: Atividade, subatividade: Subatividade) {
    // parâmetro calculado (m² de alvenaria/reboco/etc das Medidas do ambiente) nunca vai pra
    // Requisições — é só a base do cálculo, não algo que se compra
    const insumos = (subatividade.insumos ?? []).filter((i) => i.tipo !== 'parametro_calculado');
    if (insumos.length === 0) return;

    // reenviar substitui o que já tinha sido mandado dessa subatividade — evita duplicar se os
    // insumos mudaram desde o último envio
    const jaEnviados = requisicoes.filter((r) => r.subatividadeId === subatividade.id);
    for (const r of jaEnviados) await deleteRequisicao(r.id);

    const now = new Date().toISOString();
    const novos = insumos.map((i) => ({
      id: generateId(),
      obraId,
      atividadeId: atividade.id,
      atividadeNome: atividade.nome,
      subatividadeId: subatividade.id,
      subatividadeNome: subatividade.nome,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      custoUnitario: i.custoUnitario,
      tipo: i.tipo,
      status: 'pendente' as const,
      createdAt: now,
      updatedAt: now,
    }));
    await createRequisicoes(novos);
  }

  async function handleRemoverDaRequisicoes(subatividadeId: string) {
    const jaEnviados = requisicoes.filter((r) => r.subatividadeId === subatividadeId);
    for (const r of jaEnviados) await deleteRequisicao(r.id);
  }

  function handleReordenarPadrao() {
    const ordenadas = ordenarPorSequenciaPadrao(atividades);
    reorderAtividades(ordenadas.map((a) => a.id));
  }

  function openNewSubatividade(atividadeId: string) {
    setSubatividadeModalMode('create');
    setEditingSubatividade(undefined);
    setSubatividadeParentId(atividadeId);
    setSubSubatividadePaiId('');
    setSubatividadeModalOpen(true);
  }

  function openEditSubatividade(atividadeId: string, subatividade: Subatividade) {
    setSubatividadeModalMode('edit');
    setEditingSubatividade(subatividade);
    setSubatividadeParentId(atividadeId);
    setSubSubatividadePaiId('');
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

  function openNewSubSubatividade(atividadeId: string, subatividadeId: string) {
    setSubatividadeModalMode('create');
    setEditingSubatividade(undefined);
    setSubatividadeParentId(atividadeId);
    setSubSubatividadePaiId(subatividadeId);
    setSubatividadeModalOpen(true);
  }

  function openEditSubSubatividade(atividadeId: string, subatividadeId: string, subSubatividade: Subatividade) {
    setSubatividadeModalMode('edit');
    setEditingSubatividade(subSubatividade);
    setSubatividadeParentId(atividadeId);
    setSubSubatividadePaiId(subatividadeId);
    setSubatividadeModalOpen(true);
  }

  function handleToggleSubSubatividade(atividadeId: string, subatividadeId: string, subSubatividadeId: string) {
    const atividade = atividades.find((a) => a.id === atividadeId);
    const sub = atividade?.subatividades.find((s) => s.id === subatividadeId);
    const neto = sub?.subatividades?.find((n) => n.id === subSubatividadeId);
    if (!neto) return;
    const willBeConcluida = !neto.concluida;
    updateSubSubatividade(atividadeId, subatividadeId, subSubatividadeId, {
      concluida: willBeConcluida,
      status: willBeConcluida ? 'concluida' : 'pendente',
    });
  }

  async function handleSaveAsTemplate() {
    if (!obra) return;
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
  const subatividadesComRequisicaoEnviada = new Set(requisicoes.map((r) => r.subatividadeId));
  const entradasPorSubatividade = new Map<string, typeof entradas>();
  for (const e of entradas) {
    if (!e.subatividadeId) continue;
    const lista = entradasPorSubatividade.get(e.subatividadeId) ?? [];
    lista.push(e);
    entradasPorSubatividade.set(e.subatividadeId, lista);
  }

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
        onDuplicateSubatividade={duplicateSubatividade}
        onDeleteSubatividade={deleteSubatividade}
        onReorderAtividades={reorderAtividades}
        onReorderSubatividades={reorderSubatividades}
        onEdit={openEdit}
        onDelete={handleDeleteAtividade}
        onNew={openCreate}
        onUsarEtapasPadrao={() => setEtapasPadraoModalOpen(true)}
        onReordenarPadrao={handleReordenarPadrao}
        onEnviarParaRequisicoes={handleEnviarParaRequisicoes}
        onRemoverDaRequisicoes={handleRemoverDaRequisicoes}
        subatividadesComRequisicaoEnviada={subatividadesComRequisicaoEnviada}
        entradasPorSubatividade={entradasPorSubatividade}
        onNewSubatividade={openNewSubatividade}
        onEditSubatividade={openEditSubatividade}
        onToggleSubSubatividade={handleToggleSubSubatividade}
        onUpdateSubSubatividade={updateSubSubatividade}
        onDeleteSubSubatividade={deleteSubSubatividade}
        onNewSubSubatividade={openNewSubSubatividade}
        onEditSubSubatividade={openEditSubSubatividade}
      />

      <AtividadeFormModal
        open={modalOpen}
        mode={modalMode}
        obraId={obraId}
        obraDataInicio={obra.dataInicio}
        obra={obra}
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
        obra={obra}
        atividadeId={subatividadeParentId}
        subatividadePaiId={subSubatividadePaiId || undefined}
        subatividade={editingSubatividade}
        todasAtividades={atividades}
        onClose={() => setSubatividadeModalOpen(false)}
        onSaved={() => {
          setSubatividadeModalOpen(false);
          refresh();
        }}
      />

      <UsarEtapasPadraoModal
        open={etapasPadraoModalOpen}
        obraId={obraId}
        obraDataInicio={obra.dataInicio}
        atividades={atividades}
        onClose={() => setEtapasPadraoModalOpen(false)}
        onApplied={() => {
          setEtapasPadraoModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
