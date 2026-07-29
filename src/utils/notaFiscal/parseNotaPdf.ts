import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { NotaFiscalExtraida } from './types';
import { extrairCamposPorTexto } from './heuristicasTexto';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_CARACTERES_TEXTO_UTIL = 20;

async function extrairTextoOuCanvas(file: File): Promise<{ texto: string; canvas?: HTMLCanvasElement }> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pagina = await pdf.getPage(1);

  const conteudo = await pagina.getTextContent();
  const texto = conteudo.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim();
  if (texto.length >= MIN_CARACTERES_TEXTO_UTIL) return { texto };

  // Sem camada de texto (nota escaneada/foto virou PDF) — renderiza a página como imagem pro caminho de OCR.
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext('2d');
  if (!contexto) return { texto: '' };
  await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
  return { texto: '', canvas };
}

export async function parseNotaPdf(file: File): Promise<NotaFiscalExtraida> {
  const { texto, canvas } = await extrairTextoOuCanvas(file);
  if (texto) return { ...extrairCamposPorTexto(texto), confianca: 'media' };
  if (canvas) {
    const { parseNotaImagemCanvas } = await import('./parseNotaImagem');
    return parseNotaImagemCanvas(canvas);
  }
  return { categoriaDetectada: 'indeterminado', itens: [], confianca: 'baixa' };
}
