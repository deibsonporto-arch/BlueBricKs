/**
 * Lê o pacote oficial "formato-xlsx" do SINAPI (CAIXA) direto no navegador — mesma lógica do
 * scripts/import-sinapi.mjs do backend Go, só que rodando no cliente e gravando no IndexedDB
 * local em vez de gerar CSVs pro Postgres. Layout esperado: um .xlsx "SINAPI_Referência_AAAA_MM"
 * dentro do .zip, com as abas ISD, ICD, CSD, CCD e Analítico.
 */
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { salvarBlobSinapi, limparBlobsSinapi } from './sinapiLocalStore';
import type { ComposicaoLocal, InsumoLocal, ItemComposicaoLocal, SinapiLocalMeta } from './sinapiLocalData';
import { invalidarCacheSinapiLocal } from './sinapiLocalData';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const HYPERLINK_CODE_RE = /,\s*(\d+)\s*\)\s*$/;

function cellAt(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })];
}

function parseInsumos(wb: XLSX.WorkBook, sheetName: string, desoneracao: 'SD' | 'CD'): InsumoLocal[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
  const range = XLSX.utils.decode_range(ws['!ref'] as string);

  let headerRow = -1;
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 20); R++) {
    if (cellAt(ws, R, 0)?.v === 'Classificação') { headerRow = R; break; }
  }
  if (headerRow === -1) throw new Error(`Cabeçalho ("Classificação") não encontrado em ${sheetName}`);

  const ufCols: { uf: string; col: number }[] = [];
  for (let C = 5; C <= range.e.c; C++) {
    const v = cellAt(ws, headerRow, C)?.v;
    if (typeof v === 'string' && UFS.includes(v)) ufCols.push({ uf: v, col: C });
  }
  if (ufCols.length === 0) throw new Error(`Nenhuma coluna de UF encontrada em ${sheetName}`);

  const out: InsumoLocal[] = [];
  for (let R = headerRow + 1; R <= range.e.r; R++) {
    const codigo = cellAt(ws, R, 1)?.v;
    if (!codigo) continue;
    const precos: Record<string, number> = {};
    for (const { uf, col } of ufCols) {
      const v = cellAt(ws, R, col)?.v;
      if (v !== '' && v != null && v !== 0) precos[uf] = Number(v);
    }
    out.push({
      codigo: Number(codigo),
      desoneracao,
      classificacao: String(cellAt(ws, R, 0)?.v ?? ''),
      descricao: String(cellAt(ws, R, 2)?.v ?? ''),
      unidade: String(cellAt(ws, R, 3)?.v ?? ''),
      precos,
    });
  }
  return out;
}

function parseComposicoes(wb: XLSX.WorkBook, sheetName: string, desoneracao: 'SD' | 'CD'): ComposicaoLocal[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
  const range = XLSX.utils.decode_range(ws['!ref'] as string);

  let headerRow = -1;
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 20); R++) {
    if (cellAt(ws, R, 0)?.v === 'Grupo') { headerRow = R; break; }
  }
  if (headerRow === -1) throw new Error(`Cabeçalho ("Grupo") não encontrado em ${sheetName}`);

  const ufRow = headerRow - 1;
  const ufCols: { uf: string; col: number }[] = [];
  for (let C = 4; C <= range.e.c; C++) {
    const v = cellAt(ws, ufRow, C)?.v;
    if (typeof v === 'string' && UFS.includes(v)) ufCols.push({ uf: v, col: C });
  }
  if (ufCols.length === 0) throw new Error(`Nenhuma coluna de UF encontrada em ${sheetName}`);

  const out: ComposicaoLocal[] = [];
  for (let R = headerRow + 1; R <= range.e.r; R++) {
    const grupo = cellAt(ws, R, 0)?.v;
    if (!grupo) continue;

    const codigoCell = cellAt(ws, R, 1);
    let codigo: number | null = null;
    if (codigoCell?.f) {
      const m = HYPERLINK_CODE_RE.exec(codigoCell.f);
      if (m) codigo = Number(m[1]);
    }
    if (codigo == null && typeof codigoCell?.v === 'number' && codigoCell.v > 0) codigo = codigoCell.v;
    if (codigo == null) continue;

    const custos: Record<string, number> = {};
    for (const { uf, col } of ufCols) {
      const custo = cellAt(ws, R, col)?.v;
      if (custo !== '' && custo != null && custo !== 0) custos[uf] = Number(custo);
    }

    out.push({
      codigo,
      desoneracao,
      grupo: String(grupo),
      descricao: String(cellAt(ws, R, 2)?.v ?? ''),
      unidade: String(cellAt(ws, R, 3)?.v ?? ''),
      custos,
    });
  }
  return out;
}

function parseAnalitico(wb: XLSX.WorkBook): ItemComposicaoLocal[] {
  const ws = wb.Sheets['Analítico'];
  if (!ws) throw new Error(`Aba "Analítico" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });

  const headerIdx = rows.findIndex((r) => r[0] === 'Grupo' && r[2] === 'Tipo Item');
  if (headerIdx === -1) throw new Error('Cabeçalho não encontrado na aba Analítico');

  const out: ItemComposicaoLocal[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const tipoItem = r[2];
    if (tipoItem !== 'COMPOSICAO' && tipoItem !== 'INSUMO') continue;
    const composicaoCodigo = r[1];
    const itemCodigo = r[3];
    if (!composicaoCodigo || !itemCodigo) continue;
    out.push({
      composicaoCodigo: Number(composicaoCodigo),
      tipoItem,
      itemCodigo: Number(itemCodigo),
      descricao: String(r[4] ?? ''),
      unidade: String(r[5] ?? ''),
      coeficiente: Number(r[6]),
    });
  }
  return out;
}

function detectarMesReferencia(nomeArquivo: string): string | null {
  const m = /(\d{4})[_-](\d{2})/.exec(nomeArquivo);
  return m ? `${m[1]}-${m[2]}` : null;
}

export interface ProgressoImportacaoSinapi {
  etapa: string;
}

/** Lê o .zip do SINAPI, processa tudo em memória e grava no IndexedDB local. */
export async function importarSinapiLocal(
  arquivo: File,
  onProgresso?: (p: ProgressoImportacaoSinapi) => void,
): Promise<SinapiLocalMeta> {
  onProgresso?.({ etapa: 'Abrindo arquivo...' });
  const zip = await JSZip.loadAsync(arquivo);
  const nomeEntrada = Object.keys(zip.files).find((n) => /refer.ncia/i.test(n) && n.toLowerCase().endsWith('.xlsx'));
  if (!nomeEntrada) {
    throw new Error('Não encontrei "SINAPI_Referência_*.xlsx" dentro do arquivo .zip selecionado.');
  }

  onProgresso?.({ etapa: 'Lendo planilha...' });
  const bytes = await zip.files[nomeEntrada].async('arraybuffer');
  const wb = XLSX.read(bytes, { type: 'array', cellFormula: true });

  onProgresso?.({ etapa: 'Lendo insumos (materiais, mão de obra, equipamentos)...' });
  const insumos = [...parseInsumos(wb, 'ISD', 'SD'), ...parseInsumos(wb, 'ICD', 'CD')];

  onProgresso?.({ etapa: 'Lendo composições...' });
  const composicoes = [...parseComposicoes(wb, 'CSD', 'SD'), ...parseComposicoes(wb, 'CCD', 'CD')];

  onProgresso?.({ etapa: 'Lendo árvore de itens de cada composição...' });
  const itens = parseAnalitico(wb);

  const mesReferencia = detectarMesReferencia(nomeEntrada) ?? detectarMesReferencia(arquivo.name) ?? 'desconhecido';

  onProgresso?.({ etapa: 'Salvando localmente...' });
  await limparBlobsSinapi();
  const meta: SinapiLocalMeta = {
    mesReferencia,
    importadoEm: new Date().toISOString(),
    totalInsumos: insumos.length,
    totalComposicoes: composicoes.length,
    totalItens: itens.length,
  };
  await Promise.all([
    salvarBlobSinapi('meta', meta),
    salvarBlobSinapi('insumos', insumos),
    salvarBlobSinapi('composicoes', composicoes),
    salvarBlobSinapi('itens', itens),
  ]);
  invalidarCacheSinapiLocal();

  return meta;
}

export async function limparSinapiLocal(): Promise<void> {
  await limparBlobsSinapi();
  invalidarCacheSinapiLocal();
}
