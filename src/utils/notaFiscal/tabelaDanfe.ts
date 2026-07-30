import type { UnidadeMedida } from '../../types/domain';
import type { ItemExtraido } from './types';

export interface TokenPosicionado {
  str: string;
  x: number;
}
export type LinhaPosicionada = TokenPosicionado[];

const UNIDADE_MAP: Record<string, UnidadeMedida> = {
  UN: 'un', UND: 'un', UNID: 'un', PC: 'pç', 'PÇ': 'pç', PCT: 'pç',
  KG: 'kg', KGM: 'kg',
  M: 'm', MT: 'm',
  M2: 'm2', 'M²': 'm2',
  M3: 'm3', 'M³': 'm3',
  SC: 'saco', SAC: 'saco',
  L: 'l', LT: 'l',
  CX: 'cx',
  VB: 'verba',
};

function mapUnidade(bruto: string): UnidadeMedida {
  return UNIDADE_MAP[bruto.trim().toUpperCase()] ?? 'un';
}

function normalizar(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function paraNumeroBR(t: string): number {
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

type NomeColuna = 'codigo' | 'descricao' | 'ncm' | 'cst' | 'cfop' | 'unid' | 'qtde' | 'valorUnit' | 'valorTotal';
interface Ancora { nome: NomeColuna; x: number; }

const PALAVRAS_CABECALHO = ['COD', 'DESCRI', 'NCM', 'CST', 'CFOP', 'UNID', 'QTD', 'QUANT', 'VALOR', 'BASE', 'ICMS', 'IPI', 'ALIQ', 'DESCONTO', 'LIQUIDO', 'TOTAL'];

/** Rótulo de coluna que menciona alguma palavra de cabeçalho conhecida — usado só pra decidir até onde juntar linhas empilhadas do cabeçalho, não confundir com produto/dado real. */
function pareceLinhaDeCabecalho(linha: LinhaPosicionada): boolean {
  if (linha.length === 0) return false;
  const texto = normalizar(linha.map((t) => t.str).join(' '));
  return PALAVRAS_CABECALHO.some((p) => texto.includes(p));
}

/**
 * Reconhece as colunas da tabela de produtos a partir de um "bloco" de cabeçalho (uma ou
 * mais linhas seguidas — muitas DANFEs quebram "VALOR" numa linha e "UNITÁRIO"/"LÍQUIDO" na
 * de baixo, dentro da mesma célula) e devolve a posição X de cada coluna que importa.
 * Os tokens do bloco são todos juntados e reordenados por X — assim "VALOR" (linha de cima)
 * e "UNITÁRIO" (linha de baixo) na mesma coluna acabam vizinhos na leitura, não importa a
 * altura de cada um.
 */
function acharAncorasCabecalho(bloco: LinhaPosicionada): Ancora[] | undefined {
  const linha = [...bloco].sort((a, b) => a.x - b.x);
  const ancoras: Ancora[] = [];
  for (let i = 0; i < linha.length; i++) {
    const tok = normalizar(linha[i].str);
    const prox = normalizar(linha[i + 1]?.str ?? '');
    if (tok.startsWith('COD')) ancoras.push({ nome: 'codigo', x: linha[i].x });
    else if (tok.startsWith('DESCRI')) ancoras.push({ nome: 'descricao', x: linha[i].x });
    else if (tok.startsWith('NCM')) ancoras.push({ nome: 'ncm', x: linha[i].x });
    else if (tok === 'CST' || tok.startsWith('CST')) ancoras.push({ nome: 'cst', x: linha[i].x });
    else if (tok.startsWith('CFOP')) ancoras.push({ nome: 'cfop', x: linha[i].x });
    else if (tok.startsWith('UNID')) ancoras.push({ nome: 'unid', x: linha[i].x });
    else if (tok.startsWith('QTD') || tok.startsWith('QUANT')) ancoras.push({ nome: 'qtde', x: linha[i].x });
    else if (tok.startsWith('VALOR') && prox.startsWith('UNIT')) ancoras.push({ nome: 'valorUnit', x: linha[i].x });
    else if (tok.startsWith('VALOR') && (prox.startsWith('LIQ') || prox.startsWith('TOTAL'))) ancoras.push({ nome: 'valorTotal', x: linha[i].x });
  }
  const temONecessario = ancoras.some((a) => a.nome === 'descricao') && ancoras.some((a) => a.nome === 'qtde') && ancoras.some((a) => a.nome === 'valorUnit');
  return temONecessario ? ancoras.sort((a, b) => a.x - b.x) : undefined;
}

const PALAVRAS_FIM_TABELA = [
  'CALCULO DO IMPOSTO', 'DADOS ADICIONAIS', 'TRANSPORTADOR', 'VOLUMES TRANSPORTADOS',
  'INFORMACOES COMPLEMENTARES', 'RESERVADO AO FISCO',
];

/**
 * DANFE (nota fiscal de produto) tem layout de tabela nacional padronizado — em vez de
 * adivinhar por "linha termina em dois valores" (frágil, porque tem várias colunas de
 * imposto depois do valor do item), localiza o cabeçalho da tabela (CÓDIGO, DESCRIÇÃO,
 * NCM, CST, CFOP, UNID, QTDE, VALOR UNITÁRIO, VALOR LÍQUIDO...) e usa a posição X de cada
 * rótulo como fronteira de coluna pras linhas seguintes. Se não achar esse cabeçalho,
 * devolve vazio — quem chama cai pro heurístico mais simples.
 */
export function extrairItensTabelaDanfe(linhas: LinhaPosicionada[]): ItemExtraido[] {
  let ancoras: Ancora[] | undefined;
  let headerIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (!pareceLinhaDeCabecalho(linhas[i])) continue;
    // Junta essa linha com as seguintes enquanto elas também parecerem parte do cabeçalho
    // (rótulo de coluna quebrado em 2 linhas) — pra da assim reconhecer colunas mesmo quando
    // "VALOR" e "UNITÁRIO"/"LÍQUIDO" vêm empilhados em alturas diferentes.
    let fim = i;
    while (fim + 1 < linhas.length && pareceLinhaDeCabecalho(linhas[fim + 1])) fim += 1;
    const bloco = linhas.slice(i, fim + 1).flat();
    const encontrado = acharAncorasCabecalho(bloco);
    if (encontrado) {
      ancoras = encontrado;
      headerIdx = fim;
      break;
    }
    i = fim; // não achou colunas suficientes nesse bloco — pula pra depois dele e continua procurando
  }
  if (!ancoras) return [];
  const ancorasOrdenadas = ancoras;

  function bucket(x: number): NomeColuna | undefined {
    let melhor: Ancora | undefined;
    for (const a of ancorasOrdenadas) {
      if (x >= a.x - 3 && (!melhor || a.x > melhor.x)) melhor = a;
    }
    return melhor?.nome;
  }

  const itens: ItemExtraido[] = [];
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (linha.length === 0) continue;
    const textoLinha = normalizar(linha.map((t) => t.str).join(' '));
    if (PALAVRAS_FIM_TABELA.some((p) => textoLinha.includes(p))) break;

    const celulas: Partial<Record<NomeColuna, string[]>> = {};
    for (const tok of linha) {
      const b = bucket(tok.x);
      if (!b) continue;
      (celulas[b] ??= []).push(tok.str);
    }

    const descricao = (celulas.descricao ?? []).join(' ').trim();
    const qtdeTexto = (celulas.qtde ?? []).join('');
    const valorUnitTexto = (celulas.valorUnit ?? []).join('');
    if (!descricao || descricao.length < 3 || !qtdeTexto || !valorUnitTexto) continue;

    const quantidade = paraNumeroBR(qtdeTexto) || Number(qtdeTexto.replace(',', '.'));
    const valorUnitario = paraNumeroBR(valorUnitTexto);
    if (!quantidade || !valorUnitario) continue;

    const valorTotalTexto = (celulas.valorTotal ?? []).join('');
    const valorTotal = valorTotalTexto ? paraNumeroBR(valorTotalTexto) : Math.round(quantidade * valorUnitario * 100) / 100;

    const unidade = mapUnidade((celulas.unid ?? []).join(''));

    itens.push({ descricao, quantidade, unidade, valorUnitario, valorTotal });
    if (itens.length >= 60) break;
  }
  return itens;
}
