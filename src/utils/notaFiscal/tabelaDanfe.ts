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

type NomeColuna = 'descricao' | 'ncm' | 'cst' | 'cfop' | 'unid' | 'qtde' | 'valorUnit' | 'valorTotal' | 'ignorar';
interface Ancora { nome: NomeColuna; x: number; }

const PALAVRAS_CABECALHO = ['COD', 'DESCRI', 'NCM', 'CST', 'CFOP', 'UNID', 'QTD', 'QUANT', 'VALOR', 'BASE', 'ICMS', 'IPI', 'ALIQ', 'DESCONTO', 'LIQUIDO', 'TOTAL'];

/** Rótulo de coluna que menciona alguma palavra de cabeçalho conhecida — usado só pra decidir até onde juntar linhas empilhadas do cabeçalho, não confundir com produto/dado real. */
function pareceLinhaDeCabecalho(linha: LinhaPosicionada): boolean {
  if (linha.length === 0) return false;
  const texto = normalizar(linha.map((t) => t.str).join(' '));
  return PALAVRAS_CABECALHO.some((p) => texto.includes(p));
}

const DISTANCIA_MAX_MESMA_COLUNA_PX = 6;

/**
 * Reconhece as colunas da tabela de produtos a partir de um "bloco" de cabeçalho (uma ou
 * mais linhas seguidas — muitas DANFEs quebram "VALOR" numa linha e "UNITÁRIO"/"LÍQUIDO" na
 * de baixo, dentro da mesma célula). Como o rótulo de baixo nem sempre fica exatamente sob o
 * de cima (ex: "UNITÁRIO" pode começar alguns pixels ANTES de "VALOR" por causa de centralização
 * diferente), agrupa por proximidade em X em vez de depender da ordem de leitura — tokens cuja
 * distância em X pro vizinho mais próximo é pequena (rótulo de 2 linhas empilhado) formam um
 * único grupo; colunas vizinhas na mesma linha (ex: CST/CFOP) ficam bem mais distantes e não
 * se misturam.
 */
function acharAncorasCabecalho(bloco: LinhaPosicionada): Ancora[] | undefined {
  const tokens = [...bloco].filter((t) => t.str.trim()).sort((a, b) => a.x - b.x);
  if (tokens.length === 0) return undefined;

  const grupos: { xEsquerda: number; ultimoX: number; texto: string }[] = [];
  for (const tok of tokens) {
    const atual = grupos[grupos.length - 1];
    if (atual && tok.x - atual.ultimoX <= DISTANCIA_MAX_MESMA_COLUNA_PX) {
      atual.texto += ' ' + normalizar(tok.str);
      atual.ultimoX = tok.x;
    } else {
      grupos.push({ xEsquerda: tok.x, ultimoX: tok.x, texto: normalizar(tok.str) });
    }
  }

  const ancoras: Ancora[] = [];
  // "CÓDIGO" costuma ser uma coluna estreita cujo rótulo fica logo no início da linha, enquanto
  // "DESCRIÇÃO..." é um rótulo longo que muitas DANFEs centralizam dentro de uma coluna bem mais
  // larga — o texto de verdade do produto começa bem antes de onde o rótulo "DESCRIÇÃO" aparece.
  // Por isso não vira coluna própria: vira só a fronteira esquerda da coluna de descrição (não
  // precisamos do código do produto pra nada).
  let codigoX: number | undefined;
  for (const g of grupos) {
    const x = g.xEsquerda;
    const t = g.texto;
    if (t.includes('COD')) codigoX = x;
    else if (t.includes('DESCRI')) ancoras.push({ nome: 'descricao', x: codigoX ?? x });
    else if (t.includes('NCM')) ancoras.push({ nome: 'ncm', x });
    else if (t === 'CST') ancoras.push({ nome: 'cst', x });
    else if (t.includes('CFOP')) ancoras.push({ nome: 'cfop', x });
    else if (t.includes('UNID')) ancoras.push({ nome: 'unid', x });
    else if (t.includes('QTD') || t.includes('QUANT')) ancoras.push({ nome: 'qtde', x });
    else if (t.includes('VALOR') && t.includes('UNIT')) ancoras.push({ nome: 'valorUnit', x });
    else if (t.includes('VALOR') && (t.includes('LIQ') || t.includes('TOTAL'))) ancoras.push({ nome: 'valorTotal', x });
    // Outros rótulos reconhecidos mas que não usamos (VALOR DESCONTO, VALOR ICMS, BASE DE CÁLC.
    // ICMS, ALÍQ. %...) ainda viram fronteira — sem isso, o valor desses impostos "vazaria" pra
    // dentro da célula da coluna anterior (ex: desconto grudando no valor unitário).
    else ancoras.push({ nome: 'ignorar', x });
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
      if (!b || b === 'ignorar') continue;
      (celulas[b] ??= []).push(tok.str);
    }

    // "descricao" engloba também o código do produto (fronteira esquerda ampliada pra pegar a
    // descrição mesmo quando o rótulo do cabeçalho vem centralizado) — remove o código numérico
    // solto no início, já que ele não é usado.
    const descricao = (celulas.descricao ?? []).join(' ').trim().replace(/^\d+\s+/, '');
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
