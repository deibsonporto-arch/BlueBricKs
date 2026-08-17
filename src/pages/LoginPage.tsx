import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const { login, cadastrar } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setAviso('');

    if (!email.trim() || !senha.trim()) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    if (modo === 'cadastrar' && !nomeExibicao.trim()) {
      setErro('Informe seu nome de exibição.');
      return;
    }
    if (modo === 'cadastrar' && senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setEntrando(true);
    const msg =
      modo === 'entrar'
        ? await login(email, senha)
        : await cadastrar(email, senha, nomeExibicao);
    setEntrando(false);

    if (msg) {
      setErro(msg);
      return;
    }
    if (modo === 'cadastrar') {
      setAviso('Conta criada. Se a confirmação por e-mail estiver ativa, confirme antes de entrar.');
      setModo('entrar');
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <img src="/favicon.svg" alt="" className="login-card__brand-icon" />
          <div className="login-card__logo">BlueBRICKs</div>
          <p className="login-card__tagline">Inteligência Construtiva</p>
        </div>
        <p className="login-card__subtitle">
          {modo === 'entrar' ? 'Entre com seu e-mail para continuar' : 'Crie sua conta para começar'}
        </p>

        {modo === 'cadastrar' && (
          <div className="form-field">
            <label>Nome de exibição</label>
            <input
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Ex: Deibson Porto"
            />
          </div>
        )}

        <div className="form-field">
          <label>E-mail</label>
          <input
            autoFocus
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
          />
        </div>
        <div className="form-field">
          <label>Senha</label>
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
          />
        </div>

        {erro && <p className="login-card__erro">{erro}</p>}
        {aviso && <p className="login-card__subtitle">{aviso}</p>}

        <button type="submit" className="btn btn-primary login-card__submit" disabled={entrando}>
          {entrando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setModo(modo === 'entrar' ? 'cadastrar' : 'entrar');
            setErro('');
            setAviso('');
          }}
        >
          {modo === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tenho conta — entrar'}
        </button>
      </form>
    </div>
  );
}
