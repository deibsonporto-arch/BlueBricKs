import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types/domain';
import { setCurrentUserName } from '../utils/currentUser';
import { hashSenha } from '../utils/auth';
import { fetchBootstrap, pushCollection } from '../data/apiSync';
import { readCollection, writeCollection } from '../data/storage';
import { ensureSeeded, ensureFerramentasCatalogSeed } from '../data/seed';
import { migrateSubatividadeDependeDe } from '../data/migrations';

interface AuthContextValue {
  usuarios: Usuario[];
  usuarioAtual: Usuario | undefined;
  carregando: boolean;
  entrar: (nomeUsuario: string, senha: string) => Promise<string | null>;
  logout: () => void;
  atualizarNomeExibicao: (nomeExibicao: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USUARIO_ID_KEY = 'brics:usuario_id';

/**
 * Busca todas as coleções da nuvem (base única compartilhada) e sobrescreve o
 * cache local (localStorage). Depois disso o resto do app continua lendo/escrevendo
 * localStorage de forma síncrona, como sempre fez.
 */
async function hydrateFromServer(): Promise<void> {
  const bootstrap = await fetchBootstrap();
  for (const [key, items] of Object.entries(bootstrap)) {
    writeCollection(key, items);
  }
  ensureSeeded();
  ensureFerramentasCatalogSeed();
  migrateSubatividadeDependeDe();

  // Sobe pra nuvem anexos que ficaram só neste navegador (best-effort, em segundo plano).
  void sincronizarAnexosPendentes().catch((err: unknown) =>
    console.error('Falha ao sincronizar anexos pendentes:', err),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const usuarioId = localStorage.getItem(USUARIO_ID_KEY);
    if (!usuarioId) {
      setCarregando(false);
      return;
    }
    void (async () => {
      try {
        await hydrateFromServer();
        const usuario = readCollection<Usuario>('usuarios').find((u) => u.id === usuarioId);
        if (usuario) {
          setUsuarioAtual(usuario);
          setCurrentUserName(usuario.nomeExibicao);
        } else {
          localStorage.removeItem(USUARIO_ID_KEY);
        }
      } catch (err) {
        console.error('Falha ao carregar dados da nuvem:', err);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (nomeUsuario: string, senha: string): Promise<string | null> => {
    const nome = nomeUsuario.trim();
    if (!nome || !senha) return 'Informe usuário e senha.';

    setCarregando(true);
    try {
      await hydrateFromServer();
    } catch (err) {
      setCarregando(false);
      return err instanceof Error ? err.message : 'Falha ao carregar dados da nuvem.';
    }

    const senhaHash = await hashSenha(senha);
    const usuario = readCollection<Usuario>('usuarios').find(
      (u) => u.nomeUsuario.toLowerCase() === nome.toLowerCase() && u.senhaHash === senhaHash,
    );
    if (!usuario) {
      setCarregando(false);
      return 'Usuário ou senha inválidos.';
    }

    localStorage.setItem(USUARIO_ID_KEY, usuario.id);
    setUsuarioAtual(usuario);
    setCurrentUserName(usuario.nomeExibicao);
    setCarregando(false);
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USUARIO_ID_KEY);
    setUsuarioAtual(undefined);
    setCurrentUserName('');
  }, []);

  const atualizarNomeExibicao = useCallback(
    async (nomeExibicao: string) => {
      const nome = nomeExibicao.trim();
      if (!nome || !usuarioAtual) return;

      const todos = readCollection<Usuario>('usuarios');
      const atualizados = todos.map((u) => (u.id === usuarioAtual.id ? { ...u, nomeExibicao: nome } : u));
      writeCollection('usuarios', atualizados);
      pushCollection('usuarios', atualizados);

      setUsuarioAtual({ ...usuarioAtual, nomeExibicao: nome });
      setCurrentUserName(nome);
    },
    [usuarioAtual],
  );

  return (
    <AuthContext.Provider
      value={{
        usuarios: usuarioAtual ? [usuarioAtual] : [],
        usuarioAtual,
        carregando,
        entrar,
        logout,
        atualizarNomeExibicao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
