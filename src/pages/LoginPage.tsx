import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    const ok = await login(nomeUsuario, senha);
    setEntrando(false);
    if (!ok) setErro('Usuário ou senha inválidos.');
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <img src="/favicon.svg" alt="" className="login-card__brand-icon" />
          <div className="login-card__logo">BlueBRICKs</div>
          <p className="login-card__tagline">Inteligência Construtiva</p>
        </div>
        <p className="login-card__subtitle">Entre com seu usuário para continuar</p>

        <div className="form-field">
          <label>Usuário</label>
          <input
            autoFocus
            value={nomeUsuario}
            onChange={(e) => setNomeUsuario(e.target.value)}
            placeholder="Ex: DeibsonPorto"
          />
        </div>
        <div className="form-field">
          <label>Senha</label>
          <input
            type="password"
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
