import type { QuantitativoExtraido } from './types';

const REGEX_NUMERO = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+,\d+$/;

const UNIDADES_CONHECIDAS = new Set([
  'UN', 'UND', 'UNID', 'PC', 'PÇ', 'PCT', 'KG', 'M', 'MT', 'M2', 'M²', 'M3', 'M³',
  'SC', 'SAC', 'SACO', 'L', 'LT', 'CX', 'VB', 'VERBA', 'H', 'HORA', 'TON', 'T',
]);

const PALAVRAS_IGNORAR = ['total', 'subtotal', 'página', 'pagina', 'sumário', 'sumario', 'índice', 'indice'];

function paraNumeroBR(texto: string): number {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

/**
 * Reconhece linhas de memorial descritivo/planilha de quantitativos no formato "descrição ...
 * [quantidade] [unidade]" (sem valor monetário, diferente da nota fiscal) — ex: "Alvenaria de
 * vedação: 382,50 m²". Best-effort, como o pipeline de nota fiscal: a tela de confirmação sempre
 * deixa o usuário corrigir ou descartar qualquer linha antes de lançar no orçamento.
 */
export function extrairQuantitativosDeLinhas(linhas: string[]): QuantitativoExtraido[] {
  const itens: QuantitativoExtraido[] = [];

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    if (linha.length < 6) continue;
    const linhaBaixa = linha.toLowerCase();
    if (PALAVRAS_IGNORAR.some((p) => linhaBaixa.includes(p))) continue;

    const tokens = linha.split(/\s+/);
    if (tokens.length < 2) continue;

    const ultimo = tokens[tokens.length - 1].replace(/[.,;:]+$/, '');
    const unidade = ultimo.toUpperCase();
    if (!UNIDADES_CONHECIDAS.has(unidade)) continue;

    const candidatoQtd = tokens[tokens.length - 2]?.replace(/^[:\-–]+/, '');
    if (!candidatoQtd || !REGEX_NUMERO.test(candidatoQtd)) continue;
    const quantidade = paraNumeroBR(candidatoQtd);
    if (!(quantidade > 0)) continue;

    const descricao = tokens
      .slice(0, tokens.length - 2)
      .join(' ')
      .replace(/[:\-–]+$/, '')
      .trim();
    if (descricao.length < 3) continue;

    itens.push({ descricao, quantidade, unidade: ultimo });
    if (itens.length >= 60) break;
  }

  return itens;
}
