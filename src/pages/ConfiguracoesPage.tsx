import { useState } from 'react';
import { IconArrowDown, IconArrowUp, IconCopy, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { AppHeader } from '../components/layout/AppHeader';
import { useOrcamentoConfig } from '../hooks/useOrcamentoConfig';
import './ConfiguracoesPage.css';

export function ConfiguracoesPage() {
  const {
    modelos, createModelo, duplicarModelo, renomearModelo, removerModelo,
    updateEtapa, addEtapa, removeEtapa, reorderEtapas, updateSplit,
  } = useOrcamentoConfig();

  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? '');
  const [renomeando, setRenomeando] = useState(false);
  const [nomeDraft, setNomeDraft] = useState('');

  const modelo = modelos.find((m) => m.id === modeloId) ?? modelos[0];

  if (!modelo) return null;

  const etapasOrdenadas = [...modelo.etapas].sort((a, b) => a.ordem - b.ordem);
  const somaPercentualPadrao = etapasOrdenadas.reduce((s, e) => s + e.percentualPadrao, 0);
  const somaSplit = modelo.materialPercentual + modelo.maoDeObraPercentual;

  function moveEtapa(id: string, direction: -1 | 1) {
    const ids = etapasOrdenadas.map((e) => e.id);
    const idx = ids.indexOf(id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const newIds = [...ids];
    [newIds[idx], newIds[targetIdx]] = [newIds[targetIdx], newIds[idx]];
    reorderEtapas(modelo.id, newIds);
  }

  function handleNovoModelo() {
    const nome = prompt('Nome do novo modelo de orçamento (ex: "Reforma", "Ampliação"):');
    if (!nome) return;
    const novo = createModelo(nome);
    setModeloId(novo.id);
  }

  function handleDuplicar() {
    const copia = duplicarModelo(modelo.id);
    if (copia) setModeloId(copia.id);
  }

  function handleRemoverModelo() {
    if (modelos.length <= 1) {
      alert('Precisa sobrar pelo menos um modelo de orçamento.');
      return;
    }
    if (!confirm(`Excluir o modelo "${modelo.nome}"? Obras que usam esse modelo continuam com os valores já salvos, mas não vão mais poder editá-lo por aqui.`)) return;
    const restante = modelos.find((m) => m.id !== modelo.id);
    removerModelo(modelo.id);
    if (restante) setModeloId(restante.id);
  }

  function iniciarRenomear() {
    setNomeDraft(modelo.nome);
    setRenomeando(true);
  }

  function confirmarRenomear() {
    if (nomeDraft.trim()) renomearModelo(modelo.id, nomeDraft.trim());
    setRenomeando(false);
  }

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="configuracoes-header">
          <h1>Configurações</h1>
          <p className="configuracoes-subtitle">Modelos de orçamento reutilizáveis (etapas, faixas esperadas e divisão material × mão de obra) — cada obra escolhe qual modelo usar na aba Orçamento.</p>
        </div>

        <div className="configuracoes-section">
          <div className="configuracoes-modelos-tabs">
            {modelos.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`configuracoes-modelos-tab${m.id === modelo.id ? ' is-active' : ''}`}
                onClick={() => { setModeloId(m.id); setRenomeando(false); }}
              >
                {m.nome}
              </button>
            ))}
            <button type="button" className="btn btn-ghost" onClick={handleNovoModelo}>
              <IconPlus size={14} /> Novo modelo
            </button>
          </div>

          <div className="configuracoes-modelos-acoes">
            {renomeando ? (
              <>
                <input autoFocus value={nomeDraft} onChange={(e) => setNomeDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmarRenomear()} />
                <button type="button" className="btn btn-primary" onClick={confirmarRenomear}>Salvar nome</button>
                <button type="button" className="btn btn-ghost" onClick={() => setRenomeando(false)}>Cancelar</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={iniciarRenomear}><IconPencil size={14} /> Renomear</button>
                <button type="button" className="btn btn-ghost" onClick={handleDuplicar}><IconCopy size={14} /> Duplicar</button>
                <button type="button" className="btn btn-ghost" onClick={handleRemoverModelo}><IconTrash size={14} /> Excluir modelo</button>
              </>
            )}
          </div>
        </div>

        <div className="configuracoes-section">
          <div className="configuracoes-section__header">
            <h2>Etapas do Orçamento — {modelo.nome}</h2>
            <button type="button" className="btn btn-primary" onClick={() => addEtapa(modelo.id)}>
              <IconPlus size={16} /> Nova etapa
            </button>
          </div>

          <div className="scroll-x">
            <table className="config-etapas-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Etapa</th>
                  <th>% Padrão</th>
                  <th>% Mín</th>
                  <th>% Máx</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {etapasOrdenadas.map((etapa, idx) => (
                  <tr key={etapa.id}>
                    <td className="config-etapas-table__reorder">
                      <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => moveEtapa(etapa.id, -1)} aria-label="Mover para cima">
                        <IconArrowUp size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost" disabled={idx === etapasOrdenadas.length - 1} onClick={() => moveEtapa(etapa.id, 1)} aria-label="Mover para baixo">
                        <IconArrowDown size={14} />
                      </button>
                    </td>
                    <td>
                      <input value={etapa.nome} onChange={(e) => updateEtapa(modelo.id, etapa.id, { nome: e.target.value })} />
                    </td>
                    <td>
                      <input type="number" min={0} max={100} step="0.1" value={etapa.percentualPadrao} onChange={(e) => updateEtapa(modelo.id, etapa.id, { percentualPadrao: Number(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <input type="number" min={0} max={100} step="0.1" value={etapa.percentualMin} onChange={(e) => updateEtapa(modelo.id, etapa.id, { percentualMin: Number(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <input type="number" min={0} max={100} step="0.1" value={etapa.percentualMax} onChange={(e) => updateEtapa(modelo.id, etapa.id, { percentualMax: Number(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => removeEtapa(modelo.id, etapa.id)} aria-label="Excluir etapa">
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {etapasOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="config-etapas-table__empty">Nenhuma etapa cadastrada neste modelo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className={`configuracoes-soma${Math.round(somaPercentualPadrao) !== 100 ? ' is-aviso' : ''}`}>
            Soma do % padrão: {somaPercentualPadrao.toFixed(1)}%{Math.round(somaPercentualPadrao) !== 100 && ' — o ideal é somar 100%'}
          </p>
        </div>

        <div className="configuracoes-section">
          <div className="configuracoes-section__header">
            <h2>Divisão Material × Mão de obra — {modelo.nome}</h2>
          </div>
          <div className="configuracoes-split">
            <div className="form-field">
              <label>Material (%)</label>
              <input
                type="number" min={0} max={100} step="0.1"
                value={modelo.materialPercentual}
                onChange={(e) => updateSplit(modelo.id, Number(e.target.value) || 0, modelo.maoDeObraPercentual)}
              />
            </div>
            <div className="form-field">
              <label>Mão de obra (%)</label>
              <input
                type="number" min={0} max={100} step="0.1"
                value={modelo.maoDeObraPercentual}
                onChange={(e) => updateSplit(modelo.id, modelo.materialPercentual, Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className={`configuracoes-soma${Math.round(somaSplit) !== 100 ? ' is-aviso' : ''}`}>
            Soma: {somaSplit.toFixed(1)}%{Math.round(somaSplit) !== 100 && ' — o ideal é somar 100%'}
          </p>
        </div>
      </div>
    </div>
  );
}
