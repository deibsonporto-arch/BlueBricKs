import { getAuthToken } from '../utils/authToken';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface LoginResponse<TUsuario> {
  token: string;
  usuario: TUsuario;
}

export async function apiLogin<TUsuario>(nomeUsuario: string, senhaHash: string): Promise<LoginResponse<TUsuario> | null> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeUsuario, senhaHash }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Falha no login: ${res.status}`);
  return (await res.json()) as LoginResponse<TUsuario>;
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => undefined);
}

/** Busca todas as coleções de uma vez, pra hidratar o cache local (localStorage) no boot/login. */
export async function fetchBootstrap(): Promise<Record<string, unknown[]>> {
  const res = await fetch('/api/bootstrap', { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao carregar dados do servidor: ${res.status}`);
  return (await res.json()) as Record<string, unknown[]>;
}

async function putCollection<T>(key: string, items: T[]): Promise<void> {
  const res = await fetch(`/api/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(items),
  });
  if (!res.ok) console.error(`Falha ao sincronizar "${key}" com o servidor: ${res.status}`);
}

// Fila por coleção: create/update/remove em sequência rápida (ex: seed inicial criando
// dezenas de itens em loop) disparam vários pushCollection() para a mesma chave. Sem
// serializar, essas requisições correm em paralelo contra a mesma tabela — o Postgres
// pode rejeitar por conflito de transação, e a ordem de chegada no servidor não é
// garantida (a última a chegar "vence", não necessariamente a mais completa/recente).
// Aqui só um PUT por coleção fica em voo por vez; escritas que chegam nesse meio-tempo
// são "coalescidas": ao terminar, reenvia uma única vez com o snapshot mais atual.
const emVoo = new Set<string>();
const pendente = new Map<string, unknown[]>();

function agendarSync(key: string) {
  if (emVoo.has(key)) return;
  const items = pendente.get(key);
  if (!items) return;
  pendente.delete(key);
  emVoo.add(key);
  putCollection(key, items)
    .catch((err) => console.error(`Falha ao sincronizar "${key}" com o servidor:`, err))
    .finally(() => {
      emVoo.delete(key);
      agendarSync(key);
    });
}

/**
 * Envia o conteúdo inteiro de uma coleção pro backend (substitui tudo), espelhando
 * o padrão local de sempre ler/escrever o array inteiro. Best-effort: não bloqueia
 * a UI nem lança erro pro chamador — só registra falha no console. Serializado por
 * coleção (ver agendarSync) pra evitar corrida/conflito quando várias escritas
 * acontecem em sequência rápida.
 */
export function pushCollection<T>(key: string, items: T[]): void {
  pendente.set(key, items);
  agendarSync(key);
}

/** Busca um anexo direto do servidor (usado quando não está no IndexedDB local, ex: outro navegador/máquina). */
export async function fetchAnexo(id: string): Promise<string | undefined> {
  const res = await fetch(`/api/anexos/${id}`, { headers: authHeaders() });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Falha ao buscar anexo: ${res.status}`);
  const body = (await res.json()) as { dataUrl: string };
  return body.dataUrl;
}

/** Envia um anexo pro servidor em segundo plano — best-effort, não bloqueia nem lança erro pro chamador. */
export function pushAnexo(id: string, dataUrl: string): void {
  fetch(`/api/anexos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ dataUrl }),
  })
    .then((res) => {
      if (!res.ok) console.error(`Falha ao sincronizar anexo "${id}" com o servidor: ${res.status}`);
    })
    .catch((err) => console.error(`Falha ao sincronizar anexo "${id}" com o servidor:`, err));
}

/** Remove um anexo do servidor em segundo plano — best-effort, mesmo padrão de pushAnexo. */
export function deleteAnexoRemote(id: string): void {
  fetch(`/api/anexos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then((res) => {
      if (!res.ok) console.error(`Falha ao remover anexo "${id}" no servidor: ${res.status}`);
    })
    .catch((err) => console.error(`Falha ao remover anexo "${id}" no servidor:`, err));
}

// ---------- Base de referência SINAPI (somente leitura, consultada sob demanda) ----------

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

export async function fetchSinapiMeses(): Promise<string[]> {
  const res = await fetch('/api/sinapi/meses', { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao buscar meses SINAPI: ${res.status}`);
  return (await res.json()) as string[];
}

/** Lista os Grupos/Cadernos Técnicos existentes nas composições do mês (ex: "Alvenaria Estrutural - Blocos Cerâmicos"), pra filtrar a busca por categoria. */
export async function fetchSinapiGrupos(mes?: string): Promise<string[]> {
  const qs = new URLSearchParams();
  if (mes) qs.set('mes', mes);
  const res = await fetch(`/api/sinapi/grupos?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao buscar grupos SINAPI: ${res.status}`);
  return (await res.json()) as string[];
}

export async function buscarComposicoesSinapi(q: string, filtro: SinapiFiltro, limit = 30, grupo?: string): Promise<SinapiComposicaoResumo[]> {
  const qs = new URLSearchParams({ uf: filtro.uf, limit: String(limit) });
  if (q) qs.set('q', q);
  if (grupo) qs.set('grupo', grupo);
  if (filtro.desoneracao) qs.set('desoneracao', filtro.desoneracao);
  if (filtro.mes) qs.set('mes', filtro.mes);
  const res = await fetch(`/api/sinapi/composicoes?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao buscar composições SINAPI: ${res.status}`);
  return (await res.json()) as SinapiComposicaoResumo[];
}

export async function buscarInsumosSinapi(q: string, filtro: SinapiFiltro, limit = 30): Promise<SinapiInsumoResumo[]> {
  const qs = new URLSearchParams({ uf: filtro.uf, limit: String(limit) });
  if (q) qs.set('q', q);
  if (filtro.desoneracao) qs.set('desoneracao', filtro.desoneracao);
  if (filtro.mes) qs.set('mes', filtro.mes);
  const res = await fetch(`/api/sinapi/insumos?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao buscar insumos SINAPI: ${res.status}`);
  return (await res.json()) as SinapiInsumoResumo[];
}

/** Explode uma composição isolada nos insumos-folha (materiais/mão de obra/equipamentos), já multiplicados pela quantidade informada. */
export async function buscarItensComposicaoSinapi(codigo: number, filtro: SinapiFiltro, quantidade = 1): Promise<SinapiMaterialExplodido[]> {
  const qs = new URLSearchParams({ uf: filtro.uf, quantidade: String(quantidade) });
  if (filtro.desoneracao) qs.set('desoneracao', filtro.desoneracao);
  if (filtro.mes) qs.set('mes', filtro.mes);
  const res = await fetch(`/api/sinapi/composicoes/${codigo}/itens?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao explodir composição SINAPI: ${res.status}`);
  return (await res.json()) as SinapiMaterialExplodido[];
}

/** Lista de materiais consolidada entre várias linhas de orçamento (composição × quantidade). */
export async function buscarMateriaisConsolidadosSinapi(
  linhas: { composicaoCodigo: number; quantidade: number }[],
  filtro: SinapiFiltro,
): Promise<SinapiMaterialExplodido[]> {
  const res = await fetch('/api/sinapi/materiais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ uf: filtro.uf, desoneracao: filtro.desoneracao, mes: filtro.mes, linhas }),
  });
  if (!res.ok) throw new Error(`Falha ao consolidar materiais SINAPI: ${res.status}`);
  return (await res.json()) as SinapiMaterialExplodido[];
}
