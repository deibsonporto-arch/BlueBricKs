-- Collections: passa a ser base única compartilhada
DROP POLICY IF EXISTS collections_select_own ON public.collections;
DROP POLICY IF EXISTS collections_insert_own ON public.collections;
DROP POLICY IF EXISTS collections_update_own ON public.collections;
DROP POLICY IF EXISTS collections_delete_own ON public.collections;

DELETE FROM public.collections a
USING public.collections b
WHERE a.key = b.key AND a.updated_at < b.updated_at;

ALTER TABLE public.collections DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE public.collections ADD CONSTRAINT collections_key_unique UNIQUE (key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO anon, authenticated;
GRANT ALL ON public.collections TO service_role;

CREATE POLICY collections_shared_all ON public.collections
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Anexos: idem
DROP POLICY IF EXISTS anexos_select_own ON public.anexos;
DROP POLICY IF EXISTS anexos_insert_own ON public.anexos;
DROP POLICY IF EXISTS anexos_update_own ON public.anexos;
DROP POLICY IF EXISTS anexos_delete_own ON public.anexos;

DELETE FROM public.anexos a
USING public.anexos b
WHERE a.id = b.id AND a.updated_at < b.updated_at;

ALTER TABLE public.anexos DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE public.anexos ADD CONSTRAINT anexos_id_unique UNIQUE (id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anexos TO anon, authenticated;
GRANT ALL ON public.anexos TO service_role;

CREATE POLICY anexos_shared_all ON public.anexos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);