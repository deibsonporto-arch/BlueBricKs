import * as XLSX from 'xlsx';
import type { QuantitativoExtraido } from './types';

const CABECALHOS_DESCRICAO = ['servico', 'descricao', 'item', 'atividade', 'etapa'];
const CABECALHOS_QUANTIDADE = ['quantidade', 'qtd', 'qtde', 'quant'];
const CABECALHOS_UNIDADE = ['unidade', 'un', 'und', 'unid'];

function normalizar(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function acharColuna(header: unknown[], candidatos: string[]): number {
  return header.findIndex((h) => candidatos.includes(normalizar(h)));
}

function paraNumero(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim().replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Interpreta linhas de uma planilha de quantitativos: procura um cabeçalho reconhecível
 * (Serviço/Descrição, Quantidade/Qtd, Unidade) nas primeiras linhas; se não achar, cai pra
 * heurística posicional (1ª célula de texto = descrição, depois 1º número = quantidade, célula
 * seguinte = unidade). Best-effort — a tela de confirmação sempre deixa revisar antes de lançar.
 */
export function extrairQuantitativosDeLinhasPlanilha(rows: unknown[][]): QuantitativoExtraido[] {
  if (rows.length === 0) return [];

  let headerRow = -1;
  let colDescricao = -1;
  let colQuantidade = -1;
  let colUnidade = -1;

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const header = rows[i] ?? [];
    const d = acharColuna(header, CABECALHOS_DESCRICAO);
    const q = acharColuna(header, CABECALHOS_QUANTIDADE);
    if (d !== -1 && q !== -1) {
      headerRow = i;
      colDescricao = d;
      colQuantidade = q;
      colUnidade = acharColuna(header, CABECALHOS_UNIDADE);
      break;
    }
  }

  const itens: QuantitativoExtraido[] = [];
  const inicio = headerRow !== -1 ? headerRow + 1 : 0;

  for (let i = inicio; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === '' || c == null)) continue;

    let descricao: string | undefined;
    let quantidade: number | undefined;
    let unidade = '';

    if (headerRow !== -1) {
      descricao = row[colDescricao] != null ? String(row[colDescricao]).trim() : undefined;
      quantidade = paraNumero(row[colQuantidade]);
      if (colUnidade !== -1 && row[colUnidade] != null) unidade = String(row[colUnidade]).trim();
    } else {
      const textos = row.map((c) => (c == null ? '' : String(c).trim()));
      const idxDescricao = textos.findIndex((t) => t.length >= 3 && paraNumero(t) === undefined);
      if (idxDescricao === -1) continue;
      descricao = textos[idxDescricao];
      for (let c = idxDescricao + 1; c < row.length; c++) {
        const n = paraNumero(row[c]);
        if (n != null && n > 0) {
          quantidade = n;
          unidade = textos[c + 1] ?? '';
          break;
        }
      }
    }

    if (!descricao || descricao.length < 3 || quantidade == null || !(quantidade > 0)) continue;
    itens.push({ descricao, quantidade, unidade: unidade || 'un' });
    if (itens.length >= 60) break;
  }

  return itens;
}

export async function parseQuantitativosPlanilha(file: File): Promise<QuantitativoExtraido[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const primeiraAba = wb.SheetNames[0];
  const ws = wb.Sheets[primeiraAba];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
  return extrairQuantitativosDeLinhasPlanilha(rows);
}
