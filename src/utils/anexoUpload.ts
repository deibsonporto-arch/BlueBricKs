import type { Anexo } from '../types/domain';
import { generateId } from './id';

export const MAX_ANEXO_BYTES = 4 * 1024 * 1024;

/** Lê um arquivo como Anexo (data URL embutido). Rejeita se passar de MAX_ANEXO_BYTES. */
export function readFileAsAnexo(file: File): Promise<Anexo> {
  if (file.size > MAX_ANEXO_BYTES) {
    return Promise.reject(new Error(`"${file.name}" tem mais de 4MB e não foi anexado — arquivos grandes podem estourar o espaço local do navegador.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: generateId(), nome: file.name, tipo: file.type, dataUrl: reader.result as string });
    reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo "${file.name}"`));
    reader.readAsDataURL(file);
  });
}
