import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { QuantitativoExtraido } from './types';
import { extrairQuantitativosDeLinhas } from './extrairQuantitativosDeLinhas';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TOLERANCIA_MESMA_LINHA_PX = 2;

/**
 * Reconstrói linhas de texto a partir dos fragmentos posicionados que o pdf.js devolve (cada um
 * com sua própria coordenada X/Y) — mesma técnica usada em notaFiscal/parseNotaPdf.ts, duplicada
 * aqui (função pequena) pra não acoplar os dois pipelines de extração.
 */
function agruparEmLinhas(fragmentos: { str: string; x: number; y: number }[]): string[] {
  const porY = new Map<number, { str: string; x: number }[]>();
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
    .map(([, itens]) => itens.sort((a, b) => a.x - b.x).map((t) => t.str).join(' '));
}

/** Extrai quantitativos de um memorial descritivo em PDF (texto, não escaneado) — percorre todas as páginas. */
export async function parseQuantitativosPdf(file: File): Promise<QuantitativoExtraido[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const linhas: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pagina = await pdf.getPage(pageNum);
    const conteudo = await pagina.getTextContent();
    const fragmentos = conteudo.items
      .filter((item): item is { str: string; transform: number[] } & typeof item => 'str' in item && 'transform' in item)
      .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
    linhas.push(...agruparEmLinhas(fragmentos));
  }

  return extrairQuantitativosDeLinhas(linhas);
}
