import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { DependencyGraph } from '../../components/obra-detail/DependencyGraph';
import { NoDetalhePanel, type ItemPath } from '../../components/obra-detail/NoDetalhePanel';
import { SubatividadeFormModal } from '../../components/obra-detail/SubatividadeFormModal';
import { AtividadeFormModal } from '../../components/obra-detail/AtividadeFormModal';

export function MapaDependenciasTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades, updateAtividade, updateSubatividade, updateSubSubatividade } = useAtividades(obraId);

  const [painelPath, setPainelPath] = useState<ItemPath | null>(null);
  const [novoItemPath, setNovoItemPath] = useState<ItemPath | null>(null);
  const [novaFaseModalOpen, setNovaFaseModalOpen] = useState(false);

  function handleToggleSubatividade(atividadeId: string, subatividadeId: string) {
    const atividade = atividades.find((a) => a.id === atividadeId);
    const sub = atividade?.subatividades.find((s) => s.id === subatividadeId);
    if (!sub) return;
    const willBeConcluida = !sub.concluida;
    updateSubatividade(atividadeId, subatividadeId, { concluida: willBeConcluida, status: willBeConcluida ? 'concluida' : 'pendente' });
  }

  function handleToggleSubSubatividade(atividadeId: string, subatividadeId: string, subSubatividadeId: string) {
    const atividade = atividades.find((a) => a.id === atividadeId);
    const sub = atividade?.subatividades.find((s) => s.id === subatividadeId);
    const neto = sub?.subatividades?.find((n) => n.id === subSubatividadeId);
    if (!neto) return;
    const willBeConcluida = !neto.concluida;
    updateSubSubatividade(atividadeId, subatividadeId, subSubatividadeId, { concluida: willBeConcluida, status: willBeConcluida ? 'concluida' : 'pendente' });
  }

  if (!obra) return null;

  return (
    <div style={{ paddingBottom: 40, marginTop: 16 }}>
      <DependencyGraph
        obraId={obraId}
        atividades={atividades}
        onUpdateAtividade={updateAtividade}
        onUpdateSubatividade={updateSubatividade}
        onUpdateSubSubatividade={updateSubSubatividade}
        onOpenPanel={setPainelPath}
        onNovaFase={() => setNovaFaseModalOpen(true)}
      />

      <NoDetalhePanel
        open={!!painelPath}
        path={painelPath}
        atividades={atividades}
        obra={obra}
        onClose={() => setPainelPath(null)}
        onUpdateAtividade={updateAtividade}
        onToggleSubatividade={handleToggleSubatividade}
        onUpdateSubatividade={updateSubatividade}
        onToggleSubSubatividade={handleToggleSubSubatividade}
        onUpdateSubSubatividade={updateSubSubatividade}
        onNavigateTo={setPainelPath}
        onAddChild={setNovoItemPath}
      />

      <SubatividadeFormModal
        open={!!novoItemPath}
        mode="create"
        obraId={obraId}
        obra={obra}
        atividadeId={novoItemPath?.atividadeId ?? ''}
        subatividadePaiId={novoItemPath?.subatividadeId}
        todasAtividades={atividades}
        onClose={() => setNovoItemPath(null)}
        onSaved={() => setNovoItemPath(null)}
      />

      <AtividadeFormModal
        open={novaFaseModalOpen}
        mode="create"
        obraId={obraId}
        obraDataInicio={obra.dataInicio}
        obra={obra}
        todasAtividades={atividades}
        lancamentos={[]}
        onClose={() => setNovaFaseModalOpen(false)}
        onSaved={() => setNovaFaseModalOpen(false)}
      />
    </div>
  );
}
