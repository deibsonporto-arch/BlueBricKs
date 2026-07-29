import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types/domain';
import { usuarioRepository } from '../data/repositories/usuarioRepository';
import { hashSenha } from '../utils/auth';
import { clearSessao, getSessaoUsuarioId, setSessaoUsuarioId } from '../utils/session';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/authToken';
import { setCurrentUserName } from '../utils/currentUser';
import { generateId } from '../utils/id';
import { apiLogin, apiLogout, fetchBootstrap } from '../data/apiSync';
import { writeCollection } from '../data/storage';
import { ensureSeeded, ensureFerramentasCatalogSeed } from '../data/seed';
import { migrateSubatividadeDependeDe } from '../data/migrations';

interface AuthContextValue {
  usuarios: Usuario[];
  usuarioAtual: Usuario | undefined;
  carregando: boolean;
  login: (nomeUsuario: string, senha: string) => Promise<boolean>;
  logout: () => void;
  criarUsuario: (nomeUsuario: string, nomeExibicao: string, senha: string) => Promise<Usuario>;
  excluirUsuario: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Busca todas as coleções do backend (Postgres) e sobrescreve o cache local
 * (localStorage) com elas — roda logo após autenticar, antes de liberar a tela,
 * pra garantir que o navegador reflita a fonte de dados compartilhada. Depois
 * disso, o resto do app continua lendo/escrevendo localStorage de forma síncrona,
 * como sempre fez.
 */
async function hydrateFromServer(): Promise<void> {
  const bootstrap = await fetchBootstrap();
  for (const [key, items] of Object.entries(bootstrap)) {
    writeCollection(key, items);
  }
  ensureSeeded();
  ensureFerramentasCatalogSeed();
  migrateSubatividadeDependeDe();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const refresh = useCallback(() => setUsuarios(usuarioRepository.list()), []);

  useEffect(() => {
    const sessaoId = getSessaoUsuarioId();
    const token = getAuthToken();
    if (!sessaoId || !token) {
      setCarregando(false);
      return;
    }
    hydrateFromServer()
      .then(() => {
        refresh();
        setUsuarioAtualId(sessaoId);
      })
      .catch((err) => {
        console.error('Falha ao carregar dados do servidor:', err);
        clearSessao();
        clearAuthToken();
      })
      .finally(() => setCarregando(false));
  }, [refresh]);

  const usuarioAtual = usuarios.find((u) => u.id === usuarioAtualId);

  useEffect(() => {
    setCurrentUserName(usuarioAtual?.nomeExibicao ?? '');
  }, [usuarioAtual]);

  const login = useCallback(async (nomeUsuario: string, senha: string): Promise<boolean> => {
    const senhaHash = await hashSenha(senha);
    const resposta = await apiLogin<Usuario>(nomeUsuario, senhaHash);
    if (!resposta) return false;

    setAuthToken(resposta.token);
    await hydrateFromServer();
    refresh();
    setSessaoUsuarioId(resposta.usuario.id);
    setUsuarioAtualId(resposta.usuario.id);
    return true;
  }, [refresh]);

  const logout = useCallback(() => {
    void apiLogout();
    clearSessao();
    clearAuthToken();
    setUsuarioAtualId(null);
  }, []);

  const criarUsuario = useCallback(
    async (nomeUsuario: string, nomeExibicao: string, senha: string) => {
      const senhaHash = await hashSenha(senha);
      const usuario: Usuario = {
        id: generateId(),
        nomeUsuario: nomeUsuario.trim(),
        nomeExibicao: nomeExibicao.trim(),
        senhaHash,
        createdAt: new Date().toISOString(),
      };
      usuarioRepository.create(usuario);
      refresh();
      return usuario;
    },
    [refresh],
  );

  const excluirUsuario = useCallback(
    (id: string) => {
      usuarioRepository.remove(id);
      refresh();
      if (usuarioAtualId === id) logout();
    },
    [refresh, usuarioAtualId, logout],
  );

  return (
    <AuthContext.Provider value={{ usuarios, usuarioAtual, carregando, login, logout, criarUsuario, excluirUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
