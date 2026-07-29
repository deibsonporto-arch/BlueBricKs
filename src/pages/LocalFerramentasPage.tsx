import { Link, Navigate, useParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { FerramentasManager } from '../components/ferramenta/FerramentasManager';
import { useLocaisFerramentas } from '../hooks/useLocaisFerramentas';

export function LocalFerramentasPage() {
  const { localId } = useParams<{ localId: string }>();
  const { locais } = useLocaisFerramentas();
  const local = locais.find((l) => l.id === localId);

  if (!localId) return <Navigate to="/ferramentas" replace />;

  return (
    <div>
      <AppHeader />
      <div className="obra-detail-breadcrumb" style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          to="/ferramentas"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13, width: 'fit-content' }}
        >
          <IconArrowLeft size={16} /> Voltar para Ferramentas
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{local ? local.nome : 'Carregando...'}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>Local de armazenamento (não é uma obra)</p>
        </div>
      </div>
      <div className="container" style={{ marginTop: 16 }}>
        <FerramentasManager contextId={localId} contextNome={local?.nome ?? ''} />
      </div>
    </div>
  );
}
