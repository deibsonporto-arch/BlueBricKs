import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const { entrar } = useAuth();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!nome.trim()) {
      setErro('Informe seu nome para continuar.');
      return;
    }

    setEntrando(true);
    const msg = await entrar(nome);
    setEntrando(false);
    if (msg) setErro(msg);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <img src="/favicon.svg" alt="" className="login-card__brand-icon" />
          <div className="login-card__logo">BlueBRICKs</div>
          <p className="login-card__tagline">Inteligência Construtiva</p>
        </div>
        <p className="login-card__subtitle">Digite seu nome para entrar</p>

        <div className="form-field">
          <label>Nome</label>
          <input
            autoFocus
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Deibson Porto"
          />
        </div>

        {erro && <p className="login-card__erro">{erro}</p>}

        <button type="submit" className="btn btn-primary login-card__submit" disabled={entrando}>
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
