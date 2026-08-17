import { useEffect, useRef, useState } from 'react';
import { IconDatabase, IconTrash, IconUpload } from '@tabler/icons-react';
import type { SinapiLocalMeta } from '../../utils/sinapiLocalData';
import './SinapiImportSection.css';

// xlsx/jszip (usados pra processar o .zip do SINAPI) só entram no bundle quando essa tela é
// aberta — são pesados e usados raramente, então tudo aqui é importado sob demanda.

export function SinapiImportSection() {
  const [meta, setMeta] = useState<SinapiLocalMeta | null | undefined>(undefined);
  const [etapa, setEtapa] = useState('');
  const [erro, setErro] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import('../../utils/sinapiLocalData')
      .then(({ obterMetaSinapiLocal }) => obterMetaSinapiLocal())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    setErro('');
    setEtapa('Iniciando...');
    try {
      const { importarSinapiLocal } = await import('../../utils/sinapiLocalImport');
      const novaMeta = await importarSinapiLocal(arquivo, (p) => setEtapa(p.etapa));
      setMeta(novaMeta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui processar esse arquivo.');
    } finally {
      setEtapa('');
    }
  }

  async function handleLimpar() {
    if (!confirm('Remover a base SINAPI importada neste navegador? A busca de composições fica indisponível até importar de novo.')) return;
    const { limparSinapiLocal } = await import('../../utils/sinapiLocalImport');
    await limparSinapiLocal();
    setMeta(null);
  }

  const importando = etapa !== '';

  return (
    <div className="configuracoes-section">
      <div className="configuracoes-section__header">
        <h2>Base SINAPI</h2>
      </div>
      <p className="configuracoes-subtitle">
        A base de composições e insumos do SINAPI (CAIXA) é grande e só muda uma vez por mês, então em vez de guardar
        na nuvem, cada pessoa importa o arquivo .zip oficial ("formato-xlsx") direto no seu navegador. Fica salvo
        localmente e alimenta a busca de composições no Orçamento e no Cronograma.
      </p>

      {meta === undefined && <p className="configuracoes-sinapi__hint">Verificando...</p>}

      {meta && (
        <div className="configuracoes-sinapi__status">
          <IconDatabase size={16} />
          <div>
            <strong>Base de {meta.mesReferencia} importada</strong>
            <span>{meta.totalComposicoes.toLocaleString('pt-BR')} composições · {meta.totalInsumos.toLocaleString('pt-BR')} insumos · importado em {new Date(meta.importadoEm).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      )}

      {meta === null && <p className="configuracoes-sinapi__hint">Nenhuma base importada ainda neste navegador.</p>}

      {importando && <p className="configuracoes-sinapi__hint">{etapa}</p>}
      {erro && <p className="configuracoes-sinapi__hint configuracoes-sinapi__hint--erro">{erro}</p>}

      <div className="configuracoes-sinapi__acoes">
        <label className="btn btn-primary">
          <IconUpload size={14} /> {meta ? 'Reimportar arquivo .zip' : 'Importar arquivo .zip'}
          <input ref={inputRef} type="file" accept=".zip" onChange={handleArquivo} disabled={importando} hidden />
        </label>
        {meta && (
          <button type="button" className="btn btn-ghost" onClick={handleLimpar} disabled={importando}>
            <IconTrash size={14} /> Remover base local
          </button>
        )}
      </div>
    </div>
  );
}
