# Migrar BlueBRICKs do backend Go para Lovable Cloud

## Objetivo
Tirar a dependência do backend em Go (`backend/`) e do proxy local `localhost:8081` para que o app funcione no preview e na publicação do Lovable usando Lovable Cloud (banco, auth e funções server-side).

## Abordagem (migração mínima viável)
Em vez de reescrever toda a camada de dados de uma vez, vamos manter o padrão atual do front-end: **localStorage como cache local das coleções**, e substituir o sync com o Postgres por chamadas ao Supabase. Isso preserva os componentes, hooks e repositórios existentes.

- **Auth:** troca o login customizado (SHA-256 + token) por Lovable Cloud Auth (email/senha + Google).
- **Dados:** uma tabela genérica `collections` (`user_id`, `key`, `data` jsonb, `updated_at`) para persistir cada coleção inteira (igual ao backend fazia com `DELETE + INSERT`).
- **Anexos:** tabela `anexos` (`user_id`, `id`, `data_url`, `updated_at`) ou Storage, mantendo o mesmo contrato de data URL.
- **SINAPI:** ficará sem funcionar nesta fase — a base exige importação de um ZIP externo. O app continua funcionando, mas as consultas SINAPI mostram estado vazio/placeholder.
- **Cleanup:** remove o proxy do `vite.config.ts` e apaga a pasta `backend/`.

## Passos técnicos

1. **Migrations**
   - Criar `public.profiles` (`id uuid PK`, `nome_usuario text`, `nome_exibicao text`, `created_at`, `updated_at`) com GRANTs e RLS (usuário vê/só edita o próprio).
   - Criar `public.collections` (`id uuid PK`, `user_id uuid`, `key text`, `data jsonb`, `updated_at`) com GRANTs e RLS.
   - Criar `public.anexos` (`id uuid PK`, `user_id uuid`, `data_url text`, `updated_at`) com GRANTs e RLS.

2. **Autenticação**
   - Atualizar `src/hooks/useAuth.tsx` para usar `supabase.auth.signInWithPassword`/`signUp`/`signOut`.
   - Mapear `auth.users` → `profiles` para `Usuario`.
   - Manter a página de login, mas usar email/senha.
   - Criar seed de um primeiro usuário admin via migration (ou signup automático controlado).
   - Atualizar `src/utils/session.ts`, `authToken.ts`, `currentUser.ts` para usar o novo fluxo.

3. **Sync de dados**
   - Reescrever `src/data/apiSync.ts` para substituir `/api/bootstrap` e `/api/{collection}` por `supabase.from('collections')`.
   - `fetchBootstrap`: busca todas as coleções do usuário logado e escreve no localStorage.
   - `pushCollection`: upsert da coleção inteira em `public.collections`.
   - Manter `localStorageRepository.ts` inalterado — ele continua como cache.

4. **Anexos**
   - Reescrever `fetchAnexo`, `pushAnexo`, `deleteAnexoRemote` para usar `public.anexos`.

5. **SINAPI**
   - Deixar as funções de SINAPI retornando arrays vazios ou erro informativo até a fase 2.

6. **Cleanup**
   - Remover o proxy de `/api` do `vite.config.ts`.
   - Remover a pasta `backend/`.
   - Ajustar `package.json` se necessário (remover deps de backend se houver, mas as atuais são front-end).

7. **Build & test**
   - `bun run build` sem erros.
   - Login funciona no preview com Lovable Cloud Auth.

## Trade-offs desta fase
- Dados persistidos como JSONB por coleção, não tabelas normalizadas. Isso é suficiente para restaurar o funcionamento imediato; a normalização pode vir depois.
- SINAPI não estará disponível até que a base de composições seja importada via um edge function ou processo manual.

## Fases futuras
- **Fase 2:** edge function para consultar SINAPI e importação da base de referência.
- **Fase 3 (opcional):** migrar cada coleção (obras, atividades, etc.) para tabelas normalizadas com relacionamentos reais, para aproveitar RLS, filtros e relatórios no banco.
