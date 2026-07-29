import type { NotaFiscalExtraida } from './types';

export type { NotaFiscalExtraida, ItemExtraido, CategoriaDetectada, NivelConfianca } from './types';

const RESULTADO_VAZIO: NotaFiscalExtraida = { categoriaDetectada: 'indeterminado', itens: [], confianca: 'baixa' };

function ehXml(file: File): boolean {
  return file.type === 'text/xml' || file.type === 'application/xml' || file.name.toLowerCase().endsWith('.xml');
}
function ehPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
function ehImagem(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Ponto único de entrada da extração de nota fiscal (XML de NF-e/NFS-e, PDF com ou sem
 * texto, foto). Cada parser é importado sob demanda (bundle de OCR/PDF só carrega quando
 * usado). Nunca lança erro pro chamador — na pior hipótese devolve o resultado vazio, e a
 * tela de confirmação abre em branco pra digitação manual; anexar um arquivo nunca quebra
 * por causa da extração.
 */
export async function extractNotaFiscal(file: File): Promise<NotaFiscalExtraida> {
  try {
    if (ehXml(file)) {
      const { parseNFeXml } = await import('./parseNFeXml');
      return await parseNFeXml(file);
    }
    if (ehPdf(file)) {
      const { parseNotaPdf } = await import('./parseNotaPdf');
      return await parseNotaPdf(file);
    }
    if (ehImagem(file)) {
      const { parseNotaImagem } = await import('./parseNotaImagem');
      return await parseNotaImagem(file);
    }
  } catch (err) {
    console.error('Falha ao extrair dados da nota fiscal:', err);
  }
  return RESULTADO_VAZIO;
}
