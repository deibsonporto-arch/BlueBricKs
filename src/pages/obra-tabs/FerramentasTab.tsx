import { useParams } from 'react-router-dom';
import { useObras } from '../../hooks/useObras';
import { FerramentasManager } from '../../components/ferramenta/FerramentasManager';

export function FerramentasTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);

  return <FerramentasManager contextId={obraId} contextNome={obra?.nome ?? ''} />;
}
