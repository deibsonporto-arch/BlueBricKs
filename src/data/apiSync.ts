import { supabase } from '../integrations/supabase/client';

/**
 * Camada de sincronização com o Lovable Cloud (Postgres gerenciado).
 *
 * O front-end continua lendo/escrevendo o localStorage de forma síncrona (ver
 * localStorageRepository). Este módulo espelha cada coleção inteira na tabela
 * `collections`, em uma base única compartilhada por todos.
 */

/** Busca todas as coleções do usuário logado, pra hidratar o cache local no boot/login. */
export async function fetchBootstrap(): Promise<Record<string, unknown[]>> {
  const { data, error } = await supabase.from('collections').select('key, data');

  if (error) throw new Error(`Falha ao carregar dados: ${error.message}`);

  const out: Record<string, unknown[]> = {};
  for (const row of data ?? []) {
    out[row.key as string] = (row.data as unknown[]) ?? [];
  }
  return out;
}

async function upsertCollection<T>(key: string, items: T[]): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .upsert({ key, data: items as unknown as never }, { onConflict: 'key' });

  if (error) console.error(`Falha ao sincronizar "${key}":`, error.message);
}

// Fila por coleção: create/update/remove em sequência rápida (ex: seed inicial criando
// dezenas de itens em loop) disparam vários pushCollection() para a mesma chave. Aqui só
// um upsert por coleção fica em voo por vez; escritas que chegam nesse meio-tempo são
// "coalescidas": ao terminar, reenvia uma única vez com o snapshot mais atual.
const emVoo = new Set<string>();
const pendente = new Map<string, unknown[]>();

function agendarSync(key: string) {
  if (emVoo.has(key)) return;
  const items = pendente.get(key);
  if (!items) return;
  pendente.delete(key);
  emVoo.add(key);
  upsertCollection(key, items)
    .catch((err) => console.error(`Falha ao sincronizar "${key}":`, err))
    .finally(() => {
      emVoo.delete(key);
      agendarSync(key);
    });
}

/** Envia o conteúdo inteiro de uma coleção pra nuvem (substitui tudo). Best-effort. */
export function pushCollection<T>(key: string, items: T[]): void {
  pendente.set(key, items);
  agendarSync(key);
}

// ---------- Anexos ----------

/** Busca um anexo direto da nuvem (usado quando não está no IndexedDB local). */
export async function fetchAnexo(id: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('anexos')
    .select('data_url')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar anexo: ${error.message}`);
  return data?.data_url ?? undefined;
}

/** Envia um anexo pra nuvem em segundo plano — best-effort. */
export function pushAnexo(id: string, dataUrl: string): void {
  void (async () => {
    const { error } = await supabase
      .from('anexos')
      .upsert({ id, data_url: dataUrl }, { onConflict: 'id' });
    if (error) console.error(`Falha ao sincronizar anexo "${id}":`, error.message);
  })();
}

/** Remove um anexo da nuvem em segundo plano — best-effort. */
export function deleteAnexoRemote(id: string): void {
  void (async () => {
    const { error } = await supabase.from('anexos').delete().eq('id', id);
    if (error) console.error(`Falha ao remover anexo "${id}":`, error.message);
  })();
}

// ---------- Base de referência SINAPI ----------
//
// A base SINAPI (insumos, composições e a árvore composição→itens) é grande e somente-leitura,
// importada mensalmente a partir do pacote oficial da CAIXA. Ela ainda não foi carregada na
// nuvem — as consultas abaixo devolvem vazio até a importação ser feita. O restante do app
// (cronograma, financeiro, cotações, diário) funciona normalmente.

export interface SinapiComposicaoResumo {
  codigo: number;
  grupo: string | null;
  descricao: string;
  unidade: string;
  custo: number | null;
}

export interface SinapiInsumoResumo {
  codigo: number;
  classificacao: string | null;
  descricao: string;
  unidade: string;
  preco: number | null;
}

export interface SinapiMaterialExplodido {
  codigo: number;
  descricao: string;
  unidade: string;
  classificacao: string | null;
  coeficiente: number;
  precoUnitario: number | null;
  custoTotal: number | null;
}

export interface SinapiFiltro {
  uf: string;
  desoneracao?: 'SD' | 'CD';
  mes?: string;
}

export const SINAPI_INDISPONIVEL =
  'A base de referência SINAPI ainda não foi importada para a nuvem.';

export async function fetchSinapiMeses(): Promise<string[]> {
  return [];
}

export async function fetchSinapiGrupos(_mes?: string): Promise<string[]> {
  return [];
}

export async function buscarComposicoesSinapi(
  _q: string,
  _filtro: SinapiFiltro,
  _limit = 30,
  _grupo?: string,
): Promise<SinapiComposicaoResumo[]> {
  return [];
}

export async function buscarInsumosSinapi(
  _q: string,
  _filtro: SinapiFiltro,
  _limit = 30,
): Promise<SinapiInsumoResumo[]> {
  return [];
}

export async function buscarItensComposicaoSinapi(
  _codigo: number,
  _filtro: SinapiFiltro,
  _quantidade = 1,
): Promise<SinapiMaterialExplodido[]> {
  return [];
}

export async function buscarMateriaisConsolidadosSinapi(
  _linhas: { composicaoCodigo: number; quantidade: number }[],
  _filtro: SinapiFiltro,
): Promise<SinapiMaterialExplodido[]> {
  return [];
}
