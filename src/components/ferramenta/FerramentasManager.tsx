import { useMemo, useState } from 'react';
import { IconEdit, IconPlus, IconPrinter, IconSearch, IconSend2, IconTrash, IconTool } from '@tabler/icons-react';
import { useFerramentas } from '../../hooks/useFerramentas';
import { useObras } from '../../hooks/useObras';
import { useLocaisFerramentas } from '../../hooks/useLocaisFerramentas';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { FerramentaFormModal } from './FerramentaFormModal';
import { EnviarFerramentaModal } from './EnviarFerramentaModal';
import { EmptyState } from '../common/EmptyState';
import type { Ferramenta } from '../../types/domain';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { normalizarBusca } from '../../utils/text';
import './FerramentasManager.css';

interface FerramentasManagerProps {
  contextId: string; // id da obra ou do local (CD) onde as ferramentas estão
  contextNome: string;
}

export function FerramentasManager({ contextId, contextNome }: FerramentasManagerProps) {
  const { ferramentas, deleteFerramenta, refresh } = useFerramentas(contextId);
  const { obras } = useObras();
  const { locais } = useLocaisFerramentas();
  const { nomeEmpresa } = useEmpresaConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editando, setEditando] = useState<Ferramenta | undefined>(undefined);
  const [enviando, setEnviando] = useState<Ferramenta | undefined>(undefined);
  const [busca, setBusca] = useState('');

  const ferramentasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    if (!termo) return ferramentas;
    return ferramentas.filter((f) => normalizarBusca(f.nome).includes(termo));
  }, [ferramentas, busca]);

  const totaisPorUnidade = useMemo(() => {
    const totais = new Map<string, number>();
    for (const f of ferramentasFiltradas) {
      totais.set(f.unidade, (totais.get(f.unidade) ?? 0) + f.quantidade);
    }
    return Array.from(totais.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ferramentasFiltradas]);

  function openCreate() {
    setModalMode('create');
    setEditando(undefined);
    setModalOpen(true);
  }

  function openEdit(f: Ferramenta) {
    setModalMode('edit');
    setEditando(f);
    setModalOpen(true);
  }

  function handleDelete(f: Ferramenta) {
    if (confirm(`Remover "${f.nome}" do controle de ferramentas de ${contextNome}?`)) deleteFerramenta(f.id);
  }

  function nomeLocalizacao(idAlvo: string) {
    return obras.find((o) => o.id === idAlvo)?.nome ?? locais.find((l) => l.id === idAlvo)?.nome ?? 'local desconhecido';
  }

  function handleImprimir() {
    requestAnimationFrame(() => window.print());
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="ferramentas-header">
        <h2>Ferramentas</h2>
        <div className="ferramentas-header__actions">
          {ferramentas.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={handleImprimir}>
              <IconPrinter size={16} /> Imprimir lista
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={16} /> Nova ferramenta
          </button>
        </div>
      </div>

      {ferramentas.length === 0 ? (
        <EmptyState
          icon={<IconTool size={40} stroke={1.5} />}
          title="Nenhuma ferramenta cadastrada"
          description='Cadastre as ferramentas e equipamentos (ex: "2 carrinhos de mão") para ter controle de onde cada um está.'
        />
      ) : (
        <>
          <div className="ferramentas-toolbar">
            <div className="ferramentas-toolbar__busca">
              <IconSearch size={15} />
              <input
                type="text"
                placeholder="Buscar ferramenta..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="ferramentas-toolbar__totais">
              <strong>{ferramentasFiltradas.length}</strong> {ferramentasFiltradas.length === 1 ? 'ferramenta' : 'ferramentas'}
              {totaisPorUnidade.map(([unidade, total]) => (
                <span key={unidade} className="ferramentas-toolbar__total-badge">{total} {unidade}</span>
              ))}
            </div>
          </div>

          {ferramentasFiltradas.length === 0 ? (
            <EmptyState
              icon={<IconSearch size={32} stroke={1.5} />}
              title="Nenhuma ferramenta encontrada"
              description="Ajuste a busca para ver outras ferramentas."
            />
          ) : (
            <div className="ferramentas-grid">
              {ferramentasFiltradas.map((f) => {
                const ultimaMovimentacao = [...f.movimentacoes].reverse().find((m) => m.obraDestinoId === f.obraId);
                return (
                  <div className="ferramenta-card" key={f.id}>
                    <div className="ferramenta-card__main">
                      <strong>{f.nome}</strong>
                      <span className="ferramenta-card__quantidade">{f.quantidade} {f.unidade}</span>
                    </div>
                    {(f.observacoes || ultimaMovimentacao) && (
                      <div className="ferramenta-card__meta">
                        {f.observacoes && <span className="ferramenta-card__obs" title={f.observacoes}>{f.observacoes}</span>}
                        {ultimaMovimentacao && (
                          <span className="ferramenta-card__movimentacao">
                            Recebido de {nomeLocalizacao(ultimaMovimentacao.obraOrigemId)} em {formatDate(ultimaMovimentacao.data)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="ferramenta-card__actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setEnviando(f)} aria-label="Enviar para outra obra ou local" title="Enviar para outra obra ou local">
                        <IconSend2 size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => openEdit(f)} aria-label="Editar ferramenta" title="Editar">
                        <IconEdit size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => handleDelete(f)} aria-label="Excluir ferramenta" title="Excluir">
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="ferramentas-print-view">
        <div className="ferramentas-print-header">
          <div className="ferramentas-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
          <h2>Lista de ferramentas</h2>
          <div className="ferramentas-print-header__grid">
            <span><strong>Local:</strong> {contextNome}</span>
            <span><strong>Gerado em:</strong> {formatDate(todayISO())}</span>
          </div>
        </div>
        <table className="ferramentas-print-table">
          <thead>
            <tr>
              <th>Ferramenta</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {ferramentasFiltradas.map((f) => (
              <tr key={f.id}>
                <td>{f.nome}</td>
                <td>{f.quantidade}</td>
                <td>{f.unidade}</td>
                <td>{f.observacoes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ferramentas-print-totais">
          {ferramentasFiltradas.length} {ferramentasFiltradas.length === 1 ? 'ferramenta' : 'ferramentas'}
          {totaisPorUnidade.map(([unidade, total]) => ` · ${total} ${unidade}`).join('')}
        </p>
      </div>

      <FerramentaFormModal
        open={modalOpen}
        mode={modalMode}
        obraId={contextId}
        ferramenta={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); refresh(); }}
      />

      {enviando && (
        <EnviarFerramentaModal
          open
          ferramenta={enviando}
          onClose={() => setEnviando(undefined)}
          onSaved={() => { setEnviando(undefined); refresh(); }}
        />
      )}
    </div>
  );
}
