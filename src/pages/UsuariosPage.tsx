import { useEffect, useState } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { useAuth } from '../hooks/useAuth';
import './UsuariosPage.css';

export function UsuariosPage() {
  const { usuarioAtual, atualizarNomeExibicao } = useAuth();
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    setNomeExibicao(usuarioAtual?.nomeExibicao ?? '');
  }, [usuarioAtual?.nomeExibicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeExibicao.trim()) return;
    setSalvando(true);
    await atualizarNomeExibicao(nomeExibicao);
    setSalvando(false);
    setAviso('Nome atualizado.');
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="usuarios-header">
          <h1>Minha conta</h1>
          <p className="usuarios-subtitle">
            Os dados do BlueBRICKs são salvos na nuvem e compartilhados com toda a equipe — as ações de criar, editar, excluir e
            aprovar ficam registradas em nome de quem está usando o app.
          </p>
        </div>

        <div className="usuarios-section">
          <h2>Dados da conta</h2>
          <form className="usuarios-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Seu nome</label>
              <input value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} placeholder="Seu nome" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
          {aviso && <p className="usuarios-subtitle">{aviso}</p>}
        </div>

      </div>
    </div>
  );
}
