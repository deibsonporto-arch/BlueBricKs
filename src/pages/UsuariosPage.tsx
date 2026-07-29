import { useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/dateUtils';
import './UsuariosPage.css';

export function UsuariosPage() {
  const { usuarios, usuarioAtual, criarUsuario, excluirUsuario } = useAuth();
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!nomeUsuario.trim() || !nomeExibicao.trim() || !senha.trim()) {
      setErro('Preencha usuário, nome de exibição e senha.');
      return;
    }
    if (usuarios.some((u) => u.nomeUsuario.trim().toLowerCase() === nomeUsuario.trim().toLowerCase())) {
      setErro('Já existe um usuário com esse login.');
      return;
    }
    setSalvando(true);
    await criarUsuario(nomeUsuario, nomeExibicao, senha);
    setSalvando(false);
    setNomeUsuario('');
    setNomeExibicao('');
    setSenha('');
  }

  function handleExcluir(id: string, nomeExibicao: string) {
    if (usuarios.length <= 1) {
      alert('Não é possível excluir o único usuário cadastrado.');
      return;
    }
    if (confirm(`Excluir o usuário "${nomeExibicao}"? Essa ação não pode ser desfeita.`)) excluirUsuario(id);
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="usuarios-header">
          <h1>Usuários</h1>
          <p className="usuarios-subtitle">
            Cada pessoa que usa o BlueBRICKs deve ter seu próprio usuário — as ações de criar, editar, excluir e aprovar ficam
            registradas em nome de quem estiver logado.
          </p>
        </div>

        <div className="usuarios-section">
          <h2>Novo usuário</h2>
          <form className="usuarios-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Login</label>
              <input value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} placeholder="Ex: JoaoSilva" />
            </div>
            <div className="form-field">
              <label>Nome de exibição</label>
              <input value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="form-field">
              <label>Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              <IconPlus size={16} /> Adicionar
            </button>
          </form>
          {erro && <p className="usuarios-erro">{erro}</p>}
        </div>

        <div className="usuarios-section">
          <h2>Usuários cadastrados</h2>
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Login</th>
                <th>Nome de exibição</th>
                <th>Criado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nomeUsuario}{u.id === usuarioAtual?.id && <span className="usuarios-voce"> (você)</span>}</td>
                  <td>{u.nomeExibicao}</td>
                  <td>{formatDate(u.createdAt.slice(0, 10))}</td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => handleExcluir(u.id, u.nomeExibicao)} aria-label="Excluir usuário">
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
