import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { NotaFiscalExtraida } from './types';
import { extrairCamposPorTexto } from './heuristicasTexto';
import { extrairItensDeLinhas } from './extrairItensTexto';
import { extrairItensTabelaDanfe, type LinhaPosicionada } from './tabelaDanfe';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_CARACTERES_TEXTO_UTIL = 20;
const TOLERANCIA_MESMA_LINHA_PX = 2;

/**
 * Reconstrói linhas de texto a partir dos fragmentos posicionados que o pdf.js devolve
 * (cada um com sua própria coordenada X/Y) — sem isso, tudo vira uma frase só sem quebra de
 * linha nem noção de coluna, e não dá pra reconhecer nem cabeçalho nem tabela de produtos.
 */
function agruparEmLinhas(fragmentos: { str: string; x: number; y: number }[]): LinhaPosicionada[] {
  const porY = new Map<number, LinhaPosicionada>();
  for (const f of fragmentos) {
    if (!f.str.trim()) continue;
    let chave = f.y;
    for (const k of porY.keys()) {
      if (Math.abs(k - f.y) <= TOLERANCIA_MESMA_LINHA_PX) { chave = k; break; }
    }
    if (!porY.has(chave)) porY.set(chave, []);
    porY.get(chave)!.push({ str: f.str, x: f.x });
  }
  return Array.from(porY.entries())
    .sort((a, b) => b[0] - a[0]) // no PDF, Y maior fica mais acima na página
    .map(([, itens]) => itens.sort((a, b) => a.x - b.x))
    .filter((l) => l.length > 0);
}

async function extrairLinhasOuCanvas(file: File): Promise<{ linhas: LinhaPosicionada[]; canvas?: HTMLCanvasElement }> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pagina = await pdf.getPage(1);

  const conteudo = await pagina.getTextContent();
  const fragmentos = conteudo.items
    .filter((item): item is { str: string; transform: number[] } & typeof item => 'str' in item && 'transform' in item)
    .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
  const linhas = agruparEmLinhas(fragmentos);
  const totalCaracteres = linhas.reduce((s, l) => s + l.reduce((s2, t) => s2 + t.str.length, 0), 0);
  if (totalCaracteres >= MIN_CARACTERES_TEXTO_UTIL) return { linhas };

  // Sem camada de texto (nota escaneada/foto virou PDF) — renderiza a página como imagem pro caminho de OCR.
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext('2d');
  if (!contexto) return { linhas: [] };
  await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
  return { linhas: [], canvas };
}

export async function parseNotaPdf(file: File): Promise<NotaFiscalExtraida> {
  const { linhas, canvas } = await extrairLinhasOuCanvas(file);
  if (linhas.length > 0) {
    const linhasTexto = linhas.map((l) => l.map((t) => t.str).join(' '));
    const cabecalho = extrairCamposPorTexto(linhasTexto);
    // Primeiro tenta reconhecer a tabela padrão de DANFE pela posição das colunas (mais confiável);
    // se não achar esse cabeçalho, cai pro heurístico simples (linha termina em dois valores).
    let itens = extrairItensTabelaDanfe(linhas);
    if (itens.length === 0) itens = extrairItensDeLinhas(linhasTexto);
    return {
      ...cabecalho,
      categoriaDetectada: itens.length > 0 ? 'material' : cabecalho.categoriaDetectada,
      itens,
      confianca: 'media',
    };
  }
  if (canvas) {
    const { parseNotaImagemCanvas } = await import('./parseNotaImagem');
    return parseNotaImagemCanvas(canvas);
  }
  return { categoriaDetectada: 'indeterminado', itens: [], confianca: 'baixa' };
}
