import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { ObraTabsNav } from '../components/obra-detail/ObraTabsNav';
import { useObras } from '../hooks/useObras';

export function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === id);

  if (!id) return <Navigate to="/obras" replace />;

  return (
    <div>
      <AppHeader />
      <div className="obra-detail-breadcrumb" style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          to={obra?.isModelo ? '/modelos' : '/obras'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13, width: 'fit-content' }}
        >
          <IconArrowLeft size={16} /> {obra?.isModelo ? 'Voltar para modelos' : 'Voltar para obras'}
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{obra ? obra.nome : 'Carregando...'}</h1>
          {obra && <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>{obra.codigo}</p>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <ObraTabsNav obraId={id} />
      </div>
      <div className="container">
        <Outlet context={{ obra }} />
      </div>
    </div>
  );
}
