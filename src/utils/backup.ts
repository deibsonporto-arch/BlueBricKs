import { clearAllBlobs, getAllBlobsRaw, restoreAllBlobs } from './attachmentStore';

const PREFIX = 'brics';

export async function exportBackup(): Promise<void> {
  const dump: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      dump[key] = localStorage.getItem(key) ?? '';
    }
  }
  const anexos = await getAllBlobsRaw();

  const json = JSON.stringify({ exportedAt: new Date().toISOString(), dados: dump, anexos }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `brics-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      (async () => {
        const parsed = JSON.parse(reader.result as string) as { dados?: Record<string, string>; anexos?: Record<string, string> };
        if (!parsed.dados) throw new Error('Arquivo de backup inválido.');

        // Restaura os anexos (IndexedDB) primeiro e por completo — se isso falhar, o localStorage
        // nem chega a ser tocado, então uma falha no meio do caminho não deixa o app num estado misto.
        await clearAllBlobs();
        await restoreAllBlobs(parsed.anexos ?? {});

        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(PREFIX)) localStorage.removeItem(key);
        }
        for (const [key, value] of Object.entries(parsed.dados)) {
          localStorage.setItem(key, value);
        }
      })()
        .then(resolve)
        .catch((err) => reject(err instanceof Error ? err : new Error('Não foi possível ler o arquivo de backup.')));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}
