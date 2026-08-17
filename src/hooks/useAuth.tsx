import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types/domain';
import { supabase } from '../integrations/supabase/client';
import { setCurrentUserName } from '../utils/currentUser';
import { fetchBootstrap } from '../data/apiSync';
import { writeCollection } from '../data/storage';
import { ensureSeeded, ensureFerramentasCatalogSeed } from '../data/seed';
import { migrateSubatividadeDependeDe } from '../data/migrations';

interface AuthContextValue {
  usuarios: Usuario[];
  usuarioAtual: Usuario | undefined;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (email: string, senha: string, nomeExibicao: string) => Promise<string | null>;
  logout: () => Promise<void>;
  atualizarNomeExibicao: (nomeExibicao: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Busca todas as coleções da nuvem e sobrescreve o cache local (localStorage) —
 * roda logo após autenticar, antes de liberar a tela. Depois disso o resto do app
 * continua lendo/escrevendo localStorage de forma síncrona, como sempre fez.
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

function limparCacheLocal(): void {
  const chaves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('brics:')) chaves.push(k);
  }
  chaves.forEach((k) => localStorage.removeItem(k));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const hidratadoPara = useRef<string | null>(null);

  const carregarPerfil = useCallback(async (userId: string, email: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome_usuario, nome_exibicao, created_at')
      .eq('id', userId)
      .maybeSingle();

    const usuario: Usuario = {
      id: userId,
      nomeUsuario: data?.nome_usuario || email,
      nomeExibicao: data?.nome_exibicao || email.split('@')[0],
      senhaHash: '',
      createdAt: data?.created_at ?? new Date().toISOString(),
    };
    setUsuarioAtual(usuario);
    setCurrentUserName(usuario.nomeExibicao);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        hidratadoPara.current = null;
        setUsuarioAtual(undefined);
        setCurrentUserName('');
        setCarregando(false);
        return;
      }
      if (hidratadoPara.current === user.id) return;
      hidratadoPara.current = user.id;

      // Chamadas ao Supabase não podem rodar dentro do callback do onAuthStateChange.
      setTimeout(() => {
        void (async () => {
          try {
            await hydrateFromServer();
            await carregarPerfil(user.id, user.email ?? '');
          } catch (err) {
            console.error('Falha ao carregar dados da nuvem:', err);
          } finally {
            setCarregando(false);
          }
        })();
      }, 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setCarregando(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [carregarPerfil]);

  const login = useCallback(async (email: string, senha: string): Promise<string | null> => {
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setCarregando(false);
      return error.message.includes('Invalid login credentials')
        ? 'E-mail ou senha inválidos.'
        : error.message;
    }
    return null;
  }, []);

  const cadastrar = useCallback(
    async (email: string, senha: string, nomeExibicao: string): Promise<string | null> => {
      setCarregando(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: window.location.origin,
          data: { nome_usuario: email.trim(), nome_exibicao: nomeExibicao.trim() },
        },
      });
      if (error) {
        setCarregando(false);
        return error.message.includes('already registered')
          ? 'Já existe uma conta com esse e-mail.'
          : error.message;
      }
      return null;
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    limparCacheLocal();
    hidratadoPara.current = null;
    setUsuarioAtual(undefined);
    setCurrentUserName('');
  }, []);

  const atualizarNomeExibicao = useCallback(
    async (nomeExibicao: string) => {
      if (!usuarioAtual) return;
      const { error } = await supabase
        .from('profiles')
        .update({ nome_exibicao: nomeExibicao.trim() })
        .eq('id', usuarioAtual.id);
      if (error) {
        console.error('Falha ao atualizar nome de exibição:', error.message);
        return;
      }
      setUsuarioAtual({ ...usuarioAtual, nomeExibicao: nomeExibicao.trim() });
      setCurrentUserName(nomeExibicao.trim());
    },
    [usuarioAtual],
  );

  return (
    <AuthContext.Provider
      value={{
        usuarios: usuarioAtual ? [usuarioAtual] : [],
        usuarioAtual,
        carregando,
        login,
        cadastrar,
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
