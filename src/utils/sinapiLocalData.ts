/**
 * Cache em memória + busca/explosão da base SINAPI importada localmente (ver
 * sinapiLocalImport.ts). Guarda só o mês mais recente importado — reimportar substitui
 * o anterior. Mesma lógica de busca/explosão de composição que o backend Go faz em SQL,
 * só que em memória, já que aqui não existe Postgres pra consultar.
 */
import { lerBlobSinapi } from './sinapiLocalStore';
import type { SinapiComposicaoResumo, SinapiFiltro, SinapiInsumoResumo, SinapiMaterialExplodido } from '../data/apiSync';

export interface InsumoLocal {
  codigo: number;
  desoneracao: 'SD' | 'CD';
  classificacao: string | null;
  descricao: string;
  unidade: string;
  precos: Record<string, number>;
}

export interface ComposicaoLocal {
  codigo: number;
  desoneracao: 'SD' | 'CD';
  grupo: string | null;
  descricao: string;
  unidade: string;
  custos: Record<string, number>;
}

export interface ItemComposicaoLocal {
  composicaoCodigo: number;
  tipoItem: 'INSUMO' | 'COMPOSICAO';
  itemCodigo: number;
  descricao: string;
  unidade: string;
  coeficiente: number;
}

export interface SinapiLocalMeta {
  mesReferencia: string;
  importadoEm: string;
  totalInsumos: number;
  totalComposicoes: number;
  totalItens: number;
}

interface CacheSinapi {
  meta: SinapiLocalMeta | null;
  insumos: Map<string, InsumoLocal>;
  composicoes: Map<string, ComposicaoLocal>;
  itensPorComposicao: Map<number, ItemComposicaoLocal[]>;
}

let cache: CacheSinapi | null = null;
let cachePromise: Promise<CacheSinapi> | null = null;

export function invalidarCacheSinapiLocal(): void {
  cache = null;
  cachePromise = null;
}

async function carregarCache(): Promise<CacheSinapi> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const [meta, insumosArr, composicoesArr, itensArr] = await Promise.all([
      lerBlobSinapi<SinapiLocalMeta>('meta'),
      lerBlobSinapi<InsumoLocal[]>('insumos'),
      lerBlobSinapi<ComposicaoLocal[]>('composicoes'),
      lerBlobSinapi<ItemComposicaoLocal[]>('itens'),
    ]);

    const insumos = new Map<string, InsumoLocal>();
    for (const i of insumosArr ?? []) insumos.set(`${i.codigo}_${i.desoneracao}`, i);

    const composicoes = new Map<string, ComposicaoLocal>();
    for (const c of composicoesArr ?? []) composicoes.set(`${c.codigo}_${c.desoneracao}`, c);

    const itensPorComposicao = new Map<number, ItemComposicaoLocal[]>();
    for (const it of itensArr ?? []) {
      const lista = itensPorComposicao.get(it.composicaoCodigo);
      if (lista) lista.push(it);
      else itensPorComposicao.set(it.composicaoCodigo, [it]);
    }

    const resultado: CacheSinapi = { meta: meta ?? null, insumos, composicoes, itensPorComposicao };
    cache = resultado;
    return resultado;
  })();

  return cachePromise;
}

function normaliza(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function resolverDesoneracao(filtro: SinapiFiltro): 'SD' | 'CD' {
  return filtro.desoneracao === 'CD' ? 'CD' : 'SD';
}

export async function obterMetaSinapiLocal(): Promise<SinapiLocalMeta | null> {
  const c = await carregarCache();
  return c.meta;
}

export async function fetchSinapiMesesLocal(): Promise<string[]> {
  const c = await carregarCache();
  return c.meta ? [c.meta.mesReferencia] : [];
}

export async function fetchSinapiGruposLocal(): Promise<string[]> {
  const c = await carregarCache();
  const grupos = new Set<string>();
  for (const comp of c.composicoes.values()) {
    if (comp.grupo) grupos.add(comp.grupo);
  }
  return [...grupos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function buscarComposicoesSinapiLocal(
  q: string,
  filtro: SinapiFiltro,
  limit = 30,
  grupo?: string,
): Promise<SinapiComposicaoResumo[]> {
  const c = await carregarCache();
  const desoneracao = resolverDesoneracao(filtro);
  const palavras = normaliza(q ?? '').split(/\s+/).filter(Boolean);

  const resultado: SinapiComposicaoResumo[] = [];
  for (const comp of c.composicoes.values()) {
    if (comp.desoneracao !== desoneracao) continue;
    if (grupo && comp.grupo !== grupo) continue;
    if (palavras.length > 0) {
      const descNorm = normaliza(comp.descricao);
      if (!palavras.every((p) => descNorm.includes(p))) continue;
    } else if (!grupo) {
      continue; // sem termo de busca nem grupo, não lista tudo à toa
    }
    resultado.push({
      codigo: comp.codigo,
      grupo: comp.grupo,
      descricao: comp.descricao,
      unidade: comp.unidade,
      custo: comp.custos[filtro.uf] ?? null,
    });
    if (resultado.length >= limit) break;
  }
  return resultado;
}

export async function buscarInsumosSinapiLocal(q: string, filtro: SinapiFiltro, limit = 30): Promise<SinapiInsumoResumo[]> {
  const c = await carregarCache();
  const desoneracao = resolverDesoneracao(filtro);
  const palavras = normaliza(q ?? '').split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [];

  const resultado: SinapiInsumoResumo[] = [];
  for (const insumo of c.insumos.values()) {
    if (insumo.desoneracao !== desoneracao) continue;
    const descNorm = normaliza(insumo.descricao);
    if (!palavras.every((p) => descNorm.includes(p))) continue;
    resultado.push({
      codigo: insumo.codigo,
      classificacao: insumo.classificacao,
      descricao: insumo.descricao,
      unidade: insumo.unidade,
      preco: insumo.precos[filtro.uf] ?? null,
    });
    if (resultado.length >= limit) break;
  }
  return resultado;
}

/** Explode uma ou mais composições nos insumos-folha que as formam, consolidando por código de insumo
 * (mesma composição/insumo repetido soma a quantidade) — espelha o explodeComposicoes do backend Go. */
async function explodirComposicoes(
  composicoes: { codigo: number; quantidade: number }[],
  filtro: SinapiFiltro,
): Promise<SinapiMaterialExplodido[]> {
  const c = await carregarCache();
  const desoneracao = resolverDesoneracao(filtro);
  const acumulado = new Map<number, { descricao: string; unidade: string; coeficiente: number }>();

  function visitar(codigo: number, fator: number, visitados: Set<number>) {
    if (visitados.has(codigo)) return;
    const itens = c.itensPorComposicao.get(codigo);
    if (!itens) return;
    const proximosVisitados = new Set(visitados);
    proximosVisitados.add(codigo);
    for (const item of itens) {
      const novoFator = fator * item.coeficiente;
      if (item.tipoItem === 'INSUMO') {
        const atual = acumulado.get(item.itemCodigo);
        if (atual) atual.coeficiente += novoFator;
        else acumulado.set(item.itemCodigo, { descricao: item.descricao, unidade: item.unidade, coeficiente: novoFator });
      } else {
        visitar(item.itemCodigo, novoFator, proximosVisitados);
      }
    }
  }

  for (const { codigo, quantidade } of composicoes) visitar(codigo, quantidade, new Set());

  const resultado: SinapiMaterialExplodido[] = [];
  for (const [codigo, { descricao, unidade, coeficiente }] of acumulado) {
    const insumo = c.insumos.get(`${codigo}_${desoneracao}`);
    const precoUnitario = insumo?.precos[filtro.uf] ?? null;
    resultado.push({
      codigo,
      descricao,
      unidade,
      classificacao: insumo?.classificacao ?? null,
      coeficiente,
      precoUnitario,
      custoTotal: precoUnitario != null ? precoUnitario * coeficiente : null,
    });
  }
  resultado.sort((a, b) => (b.custoTotal ?? 0) - (a.custoTotal ?? 0));
  return resultado;
}

export async function buscarItensComposicaoSinapiLocal(
  codigo: number,
  filtro: SinapiFiltro,
  quantidade = 1,
): Promise<SinapiMaterialExplodido[]> {
  return explodirComposicoes([{ codigo, quantidade }], filtro);
}

export async function buscarMateriaisConsolidadosSinapiLocal(
  linhas: { composicaoCodigo: number; quantidade: number }[],
  filtro: SinapiFiltro,
): Promise<SinapiMaterialExplodido[]> {
  return explodirComposicoes(linhas.map((l) => ({ codigo: l.composicaoCodigo, quantidade: l.quantidade })), filtro);
}
