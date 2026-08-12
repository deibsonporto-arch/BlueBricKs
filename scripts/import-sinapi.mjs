#!/usr/bin/env node
// Importador da base de referência SINAPI (CAIXA) pro BRICS.
//
// Uso:
//   node scripts/import-sinapi.mjs <caminho-do-zip-sinapi> <mes-referencia YYYY-MM> [dir-saida]
//
// Gera 3 CSVs (insumos.csv, composicoes.csv, composicao_itens.csv) prontos pra carregar nas
// tabelas sinapi_* via `\copy` do psql. Não conecta no banco diretamente — a carga é um passo
// manual separado (ver o comando impresso no final), pra manter esse script sem depender de
// credenciais/rede do Postgres.
//
// Layout esperado dentro do ZIP: um arquivo "SINAPI_Referência_AAAA_MM.xlsx" com as abas ISD,
// ICD, CSD, CCD e Analítico (confirmado contra o pacote real de 07/2026). As demais planilhas do
// ZIP (mão de obra, famílias e coeficientes, manutenções) não são usadas nesta fase.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AdmZip from 'adm-zip';
import XLSX from 'xlsx';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

function usage(msg) {
  if (msg) console.error(`Erro: ${msg}\n`);
  console.error('Uso: node scripts/import-sinapi.mjs <caminho-do-zip> <mes-referencia YYYY-MM> [dir-saida]');
  process.exit(1);
}

const [, , zipPathArg, mesArg, outDirArg] = process.argv;
if (!zipPathArg) usage('faltou o caminho do ZIP');
if (!mesArg || !/^\d{4}-\d{2}$/.test(mesArg)) usage('mês de referência precisa estar no formato AAAA-MM (ex: 2026-07)');

const zipPath = resolve(zipPathArg);
const mesReferencia = mesArg;
const outDir = resolve(outDirArg ?? `sinapi-import-${mesReferencia}`);
mkdirSync(outDir, { recursive: true });

console.log(`Lendo ${zipPath}...`);
const zip = new AdmZip(zipPath);
const referenciaEntry = zip.getEntries().find((e) => /refer.ncia/i.test(e.entryName) && e.entryName.toLowerCase().endsWith('.xlsx'));
if (!referenciaEntry) {
  console.error('Não encontrei "SINAPI_Referência_*.xlsx" dentro do ZIP. Entradas encontradas:');
  zip.getEntries().forEach((e) => console.error(`  ${e.entryName}`));
  process.exit(1);
}

console.log(`Abrindo ${referenciaEntry.entryName}...`);
const wb = XLSX.read(referenciaEntry.getData(), { type: 'buffer', cellFormula: true });

function sheet(name) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Aba "${name}" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
  return ws;
}

function cellAt(ws, r, c) {
  return ws[XLSX.utils.encode_cell({ r, c })];
}

// ---------- Insumos (ISD / ICD): Classificação, Código, Descrição, Unidade, Origem, depois 1 coluna de preço por UF ----------
function parseInsumos(sheetName, desoneracao) {
  const ws = sheet(sheetName);
  const range = XLSX.utils.decode_range(ws['!ref']);

  let headerRow = -1;
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 20); R++) {
    if (cellAt(ws, R, 0)?.v === 'Classificação') { headerRow = R; break; }
  }
  if (headerRow === -1) throw new Error(`Cabeçalho ("Classificação") não encontrado em ${sheetName}`);

  const ufCols = []; // [{uf, col}]
  for (let C = 5; C <= range.e.c; C++) {
    const v = cellAt(ws, headerRow, C)?.v;
    if (typeof v === 'string' && UFS.includes(v)) ufCols.push({ uf: v, col: C });
  }
  if (ufCols.length === 0) throw new Error(`Nenhuma coluna de UF encontrada em ${sheetName}`);

  const out = [];
  for (let R = headerRow + 1; R <= range.e.r; R++) {
    const codigo = cellAt(ws, R, 1)?.v;
    if (!codigo) continue;
    const precos = {};
    for (const { uf, col } of ufCols) {
      const v = cellAt(ws, R, col)?.v;
      // 0 é o jeito do SINAPI marcar "sem preço" nessa UF (célula exibida como "-") — nunca um preço real
      if (v !== '' && v != null && v !== 0) precos[uf] = v;
    }
    out.push({
      codigo,
      desoneracao,
      classificacao: cellAt(ws, R, 0)?.v ?? '',
      descricao: cellAt(ws, R, 2)?.v ?? '',
      unidade: cellAt(ws, R, 3)?.v ?? '',
      origemPreco: cellAt(ws, R, 4)?.v ?? '',
      precos,
    });
  }
  return out;
}

// ---------- Composições (CSD / CCD): Grupo, Código (fórmula HYPERLINK!), Descrição, Unidade, depois pares (Custo, %AS) por UF ----------
const HYPERLINK_CODE_RE = /,\s*(\d+)\s*\)\s*$/;

function parseComposicoes(sheetName, desoneracao) {
  const ws = sheet(sheetName);
  const range = XLSX.utils.decode_range(ws['!ref']);

  let headerRow = -1;
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 20); R++) {
    if (cellAt(ws, R, 0)?.v === 'Grupo') { headerRow = R; break; }
  }
  if (headerRow === -1) throw new Error(`Cabeçalho ("Grupo") não encontrado em ${sheetName}`);

  // a linha logo acima do cabeçalho repete o código de UF a cada 2 colunas (par Custo/%AS)
  const ufRow = headerRow - 1;
  const ufCols = []; // [{uf, col}]
  for (let C = 4; C <= range.e.c; C++) {
    const v = cellAt(ws, ufRow, C)?.v;
    if (typeof v === 'string' && UFS.includes(v)) ufCols.push({ uf: v, col: C });
  }
  if (ufCols.length === 0) throw new Error(`Nenhuma coluna de UF encontrada em ${sheetName}`);

  const out = [];
  for (let R = headerRow + 1; R <= range.e.r; R++) {
    const grupo = cellAt(ws, R, 0)?.v;
    if (!grupo) continue;

    const codigoCell = cellAt(ws, R, 1);
    let codigo = null;
    if (codigoCell?.f) {
      const m = HYPERLINK_CODE_RE.exec(codigoCell.f);
      if (m) codigo = Number(m[1]);
    }
    if (codigo == null && typeof codigoCell?.v === 'number' && codigoCell.v > 0) codigo = codigoCell.v;
    if (codigo == null) continue; // linha sem código válido (não deveria acontecer, mas não trava a importação)

    const custos = {};
    for (const { uf, col } of ufCols) {
      const custo = cellAt(ws, R, col)?.v;
      // 0 é o jeito do SINAPI marcar "SEM CUSTO" (pelo menos um item da composição sem preço) — célula
      // exibida como "-", nunca uma composição que custa R$0. Tratar como ausente, senão vira R$0,00 na UI.
      if (custo !== '' && custo != null && custo !== 0) {
        const pctAS = cellAt(ws, R, col + 1)?.v;
        custos[uf] = { custo, pctAS: pctAS ?? 0 };
      }
    }

    out.push({
      codigo,
      desoneracao,
      grupo,
      descricao: cellAt(ws, R, 2)?.v ?? '',
      unidade: cellAt(ws, R, 3)?.v ?? '',
      custos,
    });
  }
  return out;
}

// ---------- Analítico: Grupo, Código da Composição, Tipo Item, Código do Item, Descrição, Unidade, Coeficiente, Situação ----------
function parseAnalitico() {
  const ws = sheet('Analítico');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  const headerIdx = rows.findIndex((r) => r[0] === 'Grupo' && r[2] === 'Tipo Item');
  if (headerIdx === -1) throw new Error('Cabeçalho não encontrado na aba Analítico');

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const tipoItem = r[2];
    // linhas com Tipo Item vazio são só o "título" da própria composição (descrição repetida) — não são itens
    if (tipoItem !== 'COMPOSICAO' && tipoItem !== 'INSUMO') continue;
    const composicaoCodigo = r[1];
    const itemCodigo = r[3];
    if (!composicaoCodigo || !itemCodigo) continue;
    out.push({
      composicaoCodigo,
      tipoItem,
      itemCodigo,
      descricao: r[4] ?? '',
      unidade: r[5] ?? '',
      coeficiente: r[6],
    });
  }
  return out;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(fileName, header, rows) {
  const path = resolve(outDir, fileName);
  const lines = [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
  console.log(`  ${path}  (${rows.length} linhas)`);
  return path;
}

console.log('Lendo insumos (ISD/ICD)...');
const insumos = [...parseInsumos('ISD', 'SD'), ...parseInsumos('ICD', 'CD')];
console.log('Lendo composições (CSD/CCD)...');
const composicoes = [...parseComposicoes('CSD', 'SD'), ...parseComposicoes('CCD', 'CD')];
console.log('Lendo árvore de itens (Analítico)...');
const itens = parseAnalitico();

console.log(`\nGravando CSVs em ${outDir}:`);
const insumosCsv = writeCsv('insumos.csv',
  ['codigo', 'mes_referencia', 'desoneracao', 'classificacao', 'descricao', 'unidade', 'origem_preco', 'precos'],
  insumos.map((i) => [i.codigo, mesReferencia, i.desoneracao, i.classificacao, i.descricao, i.unidade, i.origemPreco, JSON.stringify(i.precos)]));

const composicoesCsv = writeCsv('composicoes.csv',
  ['codigo', 'mes_referencia', 'desoneracao', 'grupo', 'descricao', 'unidade', 'custos'],
  composicoes.map((c) => [c.codigo, mesReferencia, c.desoneracao, c.grupo, c.descricao, c.unidade, JSON.stringify(c.custos)]));

const itensCsv = writeCsv('composicao_itens.csv',
  ['composicao_codigo', 'mes_referencia', 'tipo_item', 'item_codigo', 'descricao', 'unidade', 'coeficiente'],
  itens.map((it) => [it.composicaoCodigo, mesReferencia, it.tipoItem, it.itemCodigo, it.descricao, it.unidade, it.coeficiente]));

console.log(`\nPronto. Pra carregar no Postgres do container (ajuste o nome do container se for diferente de brics-db-1):\n`);
console.log(`# Reimportar o mesmo mês substitui os dados antigos dele, sem afetar outros meses já carregados:`);
console.log(`docker exec brics-db-1 psql -U brics -d brics -c "DELETE FROM sinapi_insumos WHERE mes_referencia = '${mesReferencia}'; DELETE FROM sinapi_composicoes WHERE mes_referencia = '${mesReferencia}'; DELETE FROM sinapi_composicao_itens WHERE mes_referencia = '${mesReferencia}';"`);
console.log(`\n# Os CSVs estão na sua máquina e o Postgres roda dentro do container — copie-os pra dentro antes do \\copy:`);
console.log(`  docker cp "${insumosCsv}" brics-db-1:/tmp/insumos.csv`);
console.log(`  docker cp "${composicoesCsv}" brics-db-1:/tmp/composicoes.csv`);
console.log(`  docker cp "${itensCsv}" brics-db-1:/tmp/composicao_itens.csv`);
console.log(`  docker exec brics-db-1 psql -U brics -d brics -c "\\copy sinapi_insumos (codigo, mes_referencia, desoneracao, classificacao, descricao, unidade, origem_preco, precos) FROM '/tmp/insumos.csv' WITH (FORMAT csv, HEADER true)"`);
console.log(`  docker exec brics-db-1 psql -U brics -d brics -c "\\copy sinapi_composicoes (codigo, mes_referencia, desoneracao, grupo, descricao, unidade, custos) FROM '/tmp/composicoes.csv' WITH (FORMAT csv, HEADER true)"`);
console.log(`  docker exec brics-db-1 psql -U brics -d brics -c "\\copy sinapi_composicao_itens (composicao_codigo, mes_referencia, tipo_item, item_codigo, descricao, unidade, coeficiente) FROM '/tmp/composicao_itens.csv' WITH (FORMAT csv, HEADER true)"`);
