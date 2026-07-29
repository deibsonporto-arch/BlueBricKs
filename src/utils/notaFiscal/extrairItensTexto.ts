import type { UnidadeMedida } from '../../types/domain';
import type { ItemExtraido } from './types';

const REGEX_MOEDA = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const REGEX_NUMERO_SIMPLES = /^\d+(?:[.,]\d+)?$/;

const UNIDADES_CONHECIDAS: Record<string, UnidadeMedida> = {
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

const PALAVRAS_IGNORAR = [
  'total', 'subtotal', 'icms', 'ipi', 'pis', 'cofins', 'base de calculo', 'base de cálculo',
  'desconto', 'frete', 'seguro', 'outras despesas', 'valor aproximado', 'tributos', 'informacoes complementares',
  'informações complementares', 'dados adicionais', 'reservado ao fisco',
];

function paraNumeroBR(texto: string): number {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

/**
 * Tenta reconhecer linhas de tabela de produto num PDF/foto de nota (DANFE ou similar):
 * descrição ... [quantidade] [unidade] valorUnitário valorTotal, nessa ordem no fim da linha.
 * Best-effort — sem informação de coluna real, então cada linha candidata passa por uma
 * checagem de sanidade (quantidade × valorUnitário ≈ valorTotal); a tela de confirmação
 * sempre deixa o usuário corrigir ou descartar qualquer linha antes de gravar.
 */
export function extrairItensDeLinhas(linhas: string[]): ItemExtraido[] {
  const itens: ItemExtraido[] = [];

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    if (linha.length < 8) continue;
    const linhaBaixa = linha.toLowerCase();
    if (PALAVRAS_IGNORAR.some((p) => linhaBaixa.includes(p))) continue;

    const tokens = linha.split(/\s+/);
    if (tokens.length < 3) continue;

    const ultimo = tokens[tokens.length - 1];
    const penultimo = tokens[tokens.length - 2];
    if (!REGEX_MOEDA.test(ultimo) || !REGEX_MOEDA.test(penultimo)) continue;

    const valorTotal = paraNumeroBR(ultimo);
    const valorUnitario = paraNumeroBR(penultimo);
    if (valorTotal <= 0 || valorUnitario <= 0) continue;

    let quantidade = 1;
    let fimDescricao = tokens.length - 2;

    const candidatoQtd = tokens[fimDescricao - 1];
    if (candidatoQtd && REGEX_NUMERO_SIMPLES.test(candidatoQtd)) {
      const q = Number(candidatoQtd.replace(',', '.'));
      if (q > 0) {
        quantidade = q;
        fimDescricao -= 1;
      }
    }

    let unidade: UnidadeMedida = 'un';
    const candidatoUnidade = tokens[fimDescricao - 1];
    if (candidatoUnidade && UNIDADES_CONHECIDAS[candidatoUnidade.toUpperCase()]) {
      unidade = UNIDADES_CONHECIDAS[candidatoUnidade.toUpperCase()];
      fimDescricao -= 1;
    }

    // Quantidade × valor unitário deveria bater com o total — se não bate, o "quantidade" que
    // achamos provavelmente era outra coisa (código, NCM...), então volta pro caso simples (qtd 1).
    if (Math.abs(quantidade * valorUnitario - valorTotal) > Math.max(0.5, valorTotal * 0.05)) {
      quantidade = 1;
      fimDescricao = tokens.length - 2;
      unidade = 'un';
    }

    const descricao = tokens
      .slice(0, fimDescricao)
      .filter((t) => !/^\d+$/.test(t)) // descarta código/NCM/CST/CFOP soltos (só dígitos) — nome de produto real não é um número puro
      .join(' ')
      .trim();
    if (descricao.length < 3) continue;

    itens.push({ descricao, quantidade, unidade, valorUnitario, valorTotal });
    if (itens.length >= 40) break;
  }

  return itens;
}
