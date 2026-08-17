import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types/domain';
import { setCurrentUserName } from '../utils/currentUser';
import { fetchBootstrap } from '../data/apiSync';
import { writeCollection } from '../data/storage';
import { ensureSeeded, ensureFerramentasCatalogSeed } from '../data/seed';
import { migrateSubatividadeDependeDe } from '../data/migrations';

interface AuthContextValue {
  usuarios: Usuario[];
  usuarioAtual: Usuario | undefined;
  carregando: boolean;
  entrar: (nomeExibicao: string) => Promise<string | null>;
  logout: () => void;
  atualizarNomeExibicao: (nomeExibicao: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NOME_KEY = 'brics:nome_usuario';

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
}

function montarUsuario(nome: string): Usuario {
  return {
    id: nome.trim().toLowerCase(),
    nomeUsuario: nome.trim(),
    nomeExibicao: nome.trim(),
    senhaHash: '',
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem(NOME_KEY);
    if (!salvo) {
      setCarregando(false);
      return;
    }
    void (async () => {
      try {
        await hydrateFromServer();
        setUsuarioAtual(montarUsuario(salvo));
        setCurrentUserName(salvo);
      } catch (err) {
        console.error('Falha ao carregar dados da nuvem:', err);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (nomeExibicao: string): Promise<string | null> => {
    const nome = nomeExibicao.trim();
    if (!nome) return 'Informe seu nome.';
    setCarregando(true);
    try {
      await hydrateFromServer();
    } catch (err) {
      setCarregando(false);
      return err instanceof Error ? err.message : 'Falha ao carregar dados da nuvem.';
    }
    localStorage.setItem(NOME_KEY, nome);
    setUsuarioAtual(montarUsuario(nome));
    setCurrentUserName(nome);
    setCarregando(false);
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(NOME_KEY);
    setUsuarioAtual(undefined);
    setCurrentUserName('');
  }, []);

  const atualizarNomeExibicao = useCallback(async (nomeExibicao: string) => {
    const nome = nomeExibicao.trim();
    if (!nome) return;
    localStorage.setItem(NOME_KEY, nome);
    setUsuarioAtual(montarUsuario(nome));
    setCurrentUserName(nome);
  }, []);

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
