import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const { entrar } = useAuth();
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!nomeUsuario.trim() || !senha) {
      setErro('Informe usuário e senha.');
      return;
    }

    setEntrando(true);
    const msg = await entrar(nomeUsuario, senha);
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
        <p className="login-card__subtitle">Entre com seu usuário e senha</p>

        <div className="form-field">
          <label>Usuário</label>
          <input
            autoFocus
            autoComplete="username"
            value={nomeUsuario}
            onChange={(e) => setNomeUsuario(e.target.value)}
            placeholder="Digite seu usuário"
          />
        </div>

        <div className="form-field">
          <label>Senha</label>
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
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
