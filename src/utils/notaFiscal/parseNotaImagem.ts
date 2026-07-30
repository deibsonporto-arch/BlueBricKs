import type { NotaFiscalExtraida } from './types';
import { extrairCamposPorTexto } from './heuristicasTexto';
import { extrairItensDeLinhas } from './extrairItensTexto';

type Worker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>;

let workerPromise: Promise<Worker> | undefined;

/**
 * Worker do tesseract.js reaproveitado entre chamadas na mesma sessão (evita recarregar o
 * motor OCR a cada foto anexada). O reconhecimento roda inteiramente no navegador via WASM —
 * a imagem nunca sai da máquina; só os arquivos do motor (WASM/dados do idioma) vêm de um
 * CDN público no primeiro uso, e ficam em cache do navegador depois disso.
 */
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('por'));
  }
  return workerPromise;
}

async function reconhecerTexto(fonte: File | HTMLCanvasElement): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(fonte);
  return data.text ?? '';
}

function resultadoDoTexto(texto: string): NotaFiscalExtraida {
  if (!texto.trim()) return { categoriaDetectada: 'indeterminado', itens: [], confianca: 'baixa' };
  const linhas = texto.split('\n');
  const cabecalho = extrairCamposPorTexto(linhas);
  const itens = extrairItensDeLinhas(linhas);
  return {
    ...cabecalho,
    categoriaDetectada: itens.length > 0 ? 'material' : cabecalho.categoriaDetectada,
    itens,
    confianca: 'baixa',
  };
}

export async function parseNotaImagem(file: File): Promise<NotaFiscalExtraida> {
  return resultadoDoTexto(await reconhecerTexto(file));
}

/** Usado pelo parseNotaPdf quando o PDF não tem camada de texto (escaneado) — recebe a página já renderizada em canvas. */
export async function parseNotaImagemCanvas(canvas: HTMLCanvasElement): Promise<NotaFiscalExtraida> {
  return resultadoDoTexto(await reconhecerTexto(canvas));
}
