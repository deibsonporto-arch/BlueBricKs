import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { NovoModeloModal } from '../components/modelos/NovoModeloModal';
import { useTemplates } from '../hooks/useTemplates';
import { obraRepository } from '../data/repositories/obraRepository';
import { atividadeRepository } from '../data/repositories/atividadeRepository';
import { generateId } from '../utils/id';
import { todayISO } from '../utils/dateUtils';
import { formatBRL } from '../utils/currency';
import type { ObraTemplate, TipoObra } from '../types/domain';
import './ModelosPage.css';

const TIPO_LABEL: Record<TipoObra, string> = {
  casa: 'Casa',
  galpao: 'Galpão',
  condominio: 'Condomínio',
  comercial: 'Comercial',
};

export function ModelosPage() {
  const navigate = useNavigate();
  const { templates, deleteTemplate, applyTemplateToNewObra } = useTemplates();
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ObraTemplate | undefined>(undefined);

  function criarObraDeModelo(nome: string, tipo: TipoObra, atividades: ReturnType<typeof applyTemplateToNewObra> = []) {
    const now = new Date().toISOString();
    const id = generateId();
    const dataInicio = todayISO();

    obraRepository.create({
      id,
      codigo: `MODELO-${Date.now()}`,
      nome,
      tipo,
      endereco: { logradouro: '-', cidade: '-', estado: '--' },
      responsavelTecnico: '-',
      dataInicio,
      previsaoEntrega: dataInicio,
      orcamentoTotal: 0,
      status: 'nao_iniciada',
      gastoReal: 0,
      colaboradoresAtivos: 0,
      progressoFisico: 0,
      isModelo: true,
      createdAt: now,
      updatedAt: now,
    });

    atividades.forEach((a) => atividadeRepository.create(a));
    navigate(`/obras/${id}/visao-geral`);
  }

  function handleCriarNovo(nome: string, tipo: TipoObra) {
    setNovoModalOpen(false);
    criarObraDeModelo(nome, tipo);
  }

  function handleEditar(template: ObraTemplate) {
    const obraId = generateId();
    const now = new Date().toISOString();
    const dataInicio = todayISO();

    obraRepository.create({
      id: obraId,
      codigo: `MODELO-${Date.now()}`,
      nome: template.nome,
      tipo: template.tipo,
      endereco: { logradouro: '-', cidade: '-', estado: '--' },
      responsavelTecnico: '-',
      dataInicio,
      previsaoEntrega: dataInicio,
      orcamentoTotal: template.orcamentoBase,
      status: 'nao_iniciada',
      gastoReal: 0,
      colaboradoresAtivos: 0,
      progressoFisico: 0,
      isModelo: true,
      templateOrigemId: template.id,
      createdAt: now,
      updatedAt: now,
    });

    applyTemplateToNewObra(template, obraId, dataInicio).forEach((a) => atividadeRepository.create(a));
    navigate(`/obras/${obraId}/visao-geral`);
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="modelos-header">
          <div>
            <h1 className="modelos-title">Modelos de cronograma</h1>
            <p className="modelos-subtitle">Salve o cronograma de uma obra como modelo para já começar a próxima com tudo pré-preenchido.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setNovoModalOpen(true)}>
            <IconPlus size={16} /> Novo modelo
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="modelos-empty">Nenhum modelo salvo ainda.</p>
        ) : (
          <div className="modelos-grid">
            {templates.map((t) => {
              const totalAtividades = t.atividades.length;
              const totalSubatividades = t.atividades.reduce((sum, a) => sum + a.subatividades.length, 0);
              return (
                <div className="modelo-card" key={t.id}>
                  <div className="modelo-card__header">
                    <h3>{t.nome}</h3>
                    <span className="modelo-card__tipo">{TIPO_LABEL[t.tipo]}</span>
                  </div>
                  <div className="modelo-card__stats">
                    <span>{totalAtividades} etapas</span>
                    <span>{totalSubatividades} subetapas</span>
                    <span>{formatBRL(t.orcamentoBase)}</span>
                  </div>
                  <div className="modelo-card__actions">
                    <button type="button" className="btn btn-secondary" onClick={() => handleEditar(t)}>
                      <IconEdit size={14} /> Editar
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setDeletingTemplate(t)} aria-label="Excluir modelo">
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NovoModeloModal open={novoModalOpen} onClose={() => setNovoModalOpen(false)} onCreate={handleCriarNovo} />

      <ConfirmDialog
        open={!!deletingTemplate}
        title="Excluir modelo"
        message={`Tem certeza que deseja excluir o modelo "${deletingTemplate?.nome}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingTemplate(undefined)}
        onConfirm={async () => {
          if (deletingTemplate) await deleteTemplate(deletingTemplate.id);
          setDeletingTemplate(undefined);
        }}
      />
    </div>
  );
}
