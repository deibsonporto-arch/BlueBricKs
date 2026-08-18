import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconArrowDown, IconArrowUp, IconBox, IconEdit, IconMapPin, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useEstoque } from '../../hooks/useEstoque';
import { EntradaEstoqueFormModal } from '../../components/almoxarifado/EntradaEstoqueFormModal';
import { SaidaEstoqueFormModal, type SaidaEstoquePrefill } from '../../components/almoxarifado/SaidaEstoqueFormModal';
import { calcularSaldos, corDaEtapa } from '../../utils/estoque';
import { formatNumberBR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { EmptyState } from '../../components/common/EmptyState';
import type { EntradaEstoque } from '../../types/domain';
import './AlmoxarifadoTab.css';

export function AlmoxarifadoTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades } = useAtividades(obraId);
  const { entradas, saidas, createEntrada, updateEntrada, deleteEntrada, createSaida, deleteSaida } = useEstoque(obraId);

  const [entradaModalOpen, setEntradaModalOpen] = useState(false);
  const [entradaEditando, setEntradaEditando] = useState<EntradaEstoque | null>(null);
  const [saidaModalOpen, setSaidaModalOpen] = useState(false);
  const [saidaPrefill, setSaidaPrefill] = useState<SaidaEstoquePrefill | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [filtroAtividadeId, setFiltroAtividadeId] = useState('');

  const saldosPorCodigo = useMemo(() => calcularSaldos(entradas, saidas), [entradas, saidas]);
  const saldos = useMemo(() => [...saldosPorCodigo.values()].sort((a, b) => a.material.localeCompare(b.material)), [saldosPorCodigo]);

  const entradasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return [...entradas]
      .filter((e) => !termo || e.material.toLowerCase().includes(termo) || e.codigo.toLowerCase().includes(termo))
      .filter((e) => !filtroAtividadeId || e.atividadeId === filtroAtividadeId)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [entradas, busca, filtroAtividadeId]);

  const saidasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return [...saidas]
      .filter((s) => !termo || s.material.toLowerCase().includes(termo) || s.codigo.toLowerCase().includes(termo))
      .filter((s) => !filtroAtividadeId || s.atividadeId === filtroAtividadeId)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [saidas, busca, filtroAtividadeId]);

  const materiaisAbaixoDoMinimo = saldos.filter((s) => s.saldo <= 0).length;

  const consumoPorEtapa = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const s of saidas) {
      const chave = s.etapaNome ?? 'Sem etapa';
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    const total = saidas.length || 1;
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, qtd]) => ({ nome, qtd, pct: Math.round((qtd / total) * 100) }));
  }, [saidas]);

  function abrirEdicaoEntrada(entrada: EntradaEstoque) {
    setEntradaEditando(entrada);
    setEntradaModalOpen(true);
  }

  function abrirNovaEntrada() {
    setEntradaEditando(null);
    setEntradaModalOpen(true);
  }

  function abrirSaidaAPartirDeEntrada(entrada: EntradaEstoque) {
    setSaidaPrefill({ codigo: entrada.codigo, atividadeId: entrada.atividadeId, local: entrada.fornecedor });
    setSaidaModalOpen(true);
  }

  function abrirNovaSaida() {
    setSaidaPrefill(undefined);
    setSaidaModalOpen(true);
  }

  if (!obra) return null;

  return (
    <div className="almoxarifado-tab">
      <div className="almoxarifado-head">
        <div>
          <p className="almoxarifado-head__crumb">Almoxarifado</p>
          <h1>Controle de Estoque <span>— {obra.nome}</span></h1>
        </div>
        <div className="almoxarifado-head__actions">
          <button type="button" className="btn btn-secondary" onClick={abrirNovaSaida}>
            <IconArrowDown size={16} /> Registrar saída
          </button>
          <button type="button" className="btn btn-primary" onClick={abrirNovaEntrada}>
            <IconArrowUp size={16} /> Registrar entrada
          </button>
        </div>
      </div>

      <div className="almoxarifado-stats">
        <div className="almoxarifado-stat-card">
          <div className="almoxarifado-stat-card__label"><IconBox size={14} /> Materiais em estoque</div>
          <div className="almoxarifado-stat-card__value">{saldos.length}</div>
          <div className="almoxarifado-stat-card__sub">{materiaisAbaixoDoMinimo > 0 ? `${materiaisAbaixoDoMinimo} zerado(s)` : 'nenhum zerado'}</div>
        </div>
        <div className="almoxarifado-stat-card">
          <div className="almoxarifado-stat-card__label"><IconArrowUp size={14} /> Entradas</div>
          <div className="almoxarifado-stat-card__value">{entradas.length}</div>
          <div className="almoxarifado-stat-card__sub">lançamentos registrados</div>
        </div>
        <div className="almoxarifado-stat-card">
          <div className="almoxarifado-stat-card__label"><IconArrowDown size={14} /> Saídas</div>
          <div className="almoxarifado-stat-card__value">{saidas.length}</div>
          <div className="almoxarifado-stat-card__sub">retiradas registradas</div>
        </div>
        <div className="almoxarifado-stat-card">
          <div className="almoxarifado-stat-card__label"><IconBox size={14} /> Consumo por etapa</div>
          {consumoPorEtapa.length === 0 ? (
            <div className="almoxarifado-stat-card__sub">Sem saídas ainda</div>
          ) : (
            <div className="almoxarifado-etapa-mini">
              {consumoPorEtapa.map((e) => (
                <div className="almoxarifado-etapa-mini__row" key={e.nome}>
                  <span>{e.nome}</span>
                  <span className="track"><span className="fill" style={{ width: `${e.pct}%`, background: corDaEtapa(e.nome) }} /></span>
                  <span className="pct">{e.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="almoxarifado-flow-note">
        Toda saída reduz automaticamente o saldo do material correspondente e fica vinculada à etapa da obra onde foi utilizado.
      </p>

      <div className="almoxarifado-filtros">
        <div className="almoxarifado-filtros__busca">
          <IconSearch size={16} />
          <input
            type="text"
            placeholder="Buscar por material ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select value={filtroAtividadeId} onChange={(e) => setFiltroAtividadeId(e.target.value)}>
          <option value="">Todas as etapas</option>
          {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        {(busca || filtroAtividadeId) && (
          <button type="button" className="btn btn-ghost" onClick={() => { setBusca(''); setFiltroAtividadeId(''); }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ---------- ENTRADA ---------- */}
      <section className="almoxarifado-section">
        <div className="almoxarifado-section__head">
          <h2>Entrada de materiais</h2>
          <p>Recebimentos vinculados a nota fiscal — alimentam o saldo do estoque. Clique num item pra editar.</p>
        </div>
        {entradasFiltradas.length === 0 ? (
          <EmptyState title="Nenhuma entrada encontrada" description={entradas.length === 0 ? 'Clique em “Registrar entrada” para lançar o primeiro recebimento de material.' : 'Nenhum lançamento bate com o filtro atual.'} />
        ) : (
          <div className="scroll-x">
            <table className="almoxarifado-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Marca</th>
                  <th>Qtd.</th>
                  <th>Un.</th>
                  <th>Medidas</th>
                  <th>Fornecedor</th>
                  <th>Nota fiscal</th>
                  <th>Localização</th>
                  <th>Etapa / subetapa</th>
                  <th>Saldo disponível</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entradasFiltradas.map((e) => {
                  const saldo = saldosPorCodigo.get(e.codigo);
                  const cor = corDaEtapa(e.etapaNome);
                  return (
                    <tr key={e.id} className="almoxarifado-row-clickable" onClick={() => abrirEdicaoEntrada(e)}>
                      <td className="mono text-muted">{formatDate(e.data)}</td>
                      <td className="mono">{e.codigo}</td>
                      <td><strong>{e.material}</strong></td>
                      <td className="text-muted">{e.marca ?? '—'}</td>
                      <td className="num">{formatNumberBR(e.quantidade)}</td>
                      <td><span className="almoxarifado-pill">{e.unidade}</span></td>
                      <td className="text-muted">{e.medidas ?? '—'}</td>
                      <td className="text-muted">{e.fornecedor}</td>
                      <td className="mono text-muted">{e.notaFiscal ?? '—'}</td>
                      <td className="text-muted">
                        {e.localizacao ? <span className="almoxarifado-loc"><IconMapPin size={12} />{e.localizacao}</span> : '—'}
                      </td>
                      <td>
                        {e.etapaNome ? (
                          <span className="almoxarifado-etapa-chip" style={{ background: cor }}>
                            <span className="dot" />{e.etapaNome}{e.subetapaNome ? ` — ${e.subetapaNome}` : ''}
                          </span>
                        ) : <span className="text-faint">Sem etapa</span>}
                      </td>
                      <td className="mono almoxarifado-saldo">{saldo ? `${formatNumberBR(saldo.saldo)} ${saldo.unidade}` : '—'}</td>
                      <td className="almoxarifado-row-actions" onClick={(evt) => evt.stopPropagation()}>
                        <button type="button" className="btn btn-ghost" onClick={() => abrirEdicaoEntrada(e)} aria-label="Editar entrada" title="Editar">
                          <IconEdit size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => abrirSaidaAPartirDeEntrada(e)} aria-label="Dar saída deste material" title="Dar saída">
                          <IconArrowDown size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => deleteEntrada(e.id)} aria-label="Remover entrada" title="Remover">
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- SAÍDA ---------- */}
      <section className="almoxarifado-section">
        <div className="almoxarifado-section__head">
          <h2>Saída / consumo de materiais</h2>
          <p>Cada retirada reduz o saldo do material e fica vinculada à etapa de uso</p>
        </div>
        {saidasFiltradas.length === 0 ? (
          <EmptyState title="Nenhuma saída encontrada" description={saidas.length === 0 ? 'Clique em “Registrar saída” para retirar um material do estoque e vincular à etapa que consumiu.' : 'Nenhum lançamento bate com o filtro atual.'} icon={<IconPlus size={40} stroke={1.5} />} />
        ) : (
          <div className="scroll-x">
            <table className="almoxarifado-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Material</th>
                  <th>Marca</th>
                  <th>Qtd. retirada</th>
                  <th>Un.</th>
                  <th>Responsável</th>
                  <th>Serviço</th>
                  <th>Etapa de uso</th>
                  <th>Local / obra</th>
                  <th>Para que foi utilizado</th>
                  <th>Observação</th>
                  <th>Saldo após saída</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {saidasFiltradas.map((s) => {
                  const saldo = saldosPorCodigo.get(s.codigo);
                  const cor = corDaEtapa(s.etapaNome);
                  return (
                    <tr key={s.id} className="almoxarifado-row-accent" style={{ ['--stripe' as string]: cor }}>
                      <td className="mono text-muted">{formatDate(s.data)}</td>
                      <td><strong>{s.material}</strong></td>
                      <td className="text-muted">{s.marca ?? '—'}</td>
                      <td className="num">{formatNumberBR(s.quantidade)}</td>
                      <td><span className="almoxarifado-pill">{s.unidade}</span></td>
                      <td>{s.responsavel}</td>
                      <td className="text-muted">{s.etapaServico ?? '—'}</td>
                      <td>
                        {s.etapaNome
                          ? <span className="almoxarifado-etapa-chip" style={{ background: cor }}><span className="dot" />{s.etapaNome}</span>
                          : <span className="text-faint">Sem etapa</span>}
                      </td>
                      <td className="text-muted">{s.local}</td>
                      <td className="text-muted">{s.utilizacaoPara ?? '—'}</td>
                      <td className="almoxarifado-obs">{s.observacao ?? '—'}</td>
                      <td className="mono almoxarifado-saldo">{saldo ? `${formatNumberBR(saldo.saldo)} ${saldo.unidade}` : '—'}</td>
                      <td>
                        <button type="button" className="btn btn-ghost" onClick={() => deleteSaida(s.id)} aria-label="Remover saída">
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EntradaEstoqueFormModal
        open={entradaModalOpen}
        obraId={obraId}
        entradas={entradas}
        atividades={atividades}
        editing={entradaEditando ?? undefined}
        onClose={() => { setEntradaModalOpen(false); setEntradaEditando(null); }}
        onCreate={(entrada) => { createEntrada(entrada); setEntradaModalOpen(false); }}
        onUpdate={(idEntrada, patch) => { updateEntrada(idEntrada, patch); setEntradaModalOpen(false); setEntradaEditando(null); }}
      />
      <SaidaEstoqueFormModal
        open={saidaModalOpen}
        obraId={obraId}
        obraNome={obra.nome}
        saldos={saldos}
        atividades={atividades}
        prefill={saidaPrefill}
        onClose={() => { setSaidaModalOpen(false); setSaidaPrefill(undefined); }}
        onCreate={(saida) => { createSaida(saida); setSaidaModalOpen(false); setSaidaPrefill(undefined); }}
      />
    </div>
  );
}
