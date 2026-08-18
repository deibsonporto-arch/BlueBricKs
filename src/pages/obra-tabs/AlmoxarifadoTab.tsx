import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconArrowDown, IconArrowUp, IconBox, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useEstoque } from '../../hooks/useEstoque';
import { EntradaEstoqueFormModal } from '../../components/almoxarifado/EntradaEstoqueFormModal';
import { SaidaEstoqueFormModal } from '../../components/almoxarifado/SaidaEstoqueFormModal';
import { calcularSaldos, corDaEtapa } from '../../utils/estoque';
import { formatNumberBR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { EmptyState } from '../../components/common/EmptyState';
import './AlmoxarifadoTab.css';

export function AlmoxarifadoTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades } = useAtividades(obraId);
  const { entradas, saidas, createEntrada, deleteEntrada, createSaida, deleteSaida } = useEstoque(obraId);

  const [entradaModalOpen, setEntradaModalOpen] = useState(false);
  const [saidaModalOpen, setSaidaModalOpen] = useState(false);

  const saldosPorCodigo = useMemo(() => calcularSaldos(entradas, saidas), [entradas, saidas]);
  const saldos = useMemo(() => [...saldosPorCodigo.values()].sort((a, b) => a.material.localeCompare(b.material)), [saldosPorCodigo]);

  const entradasOrdenadas = useMemo(() => [...entradas].sort((a, b) => b.data.localeCompare(a.data)), [entradas]);
  const saidasOrdenadas = useMemo(() => [...saidas].sort((a, b) => b.data.localeCompare(a.data)), [saidas]);

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

  if (!obra) return null;

  return (
    <div className="almoxarifado-tab">
      <div className="almoxarifado-head">
        <div>
          <p className="almoxarifado-head__crumb">Almoxarifado</p>
          <h1>Controle de Estoque <span>— {obra.nome}</span></h1>
        </div>
        <div className="almoxarifado-head__actions">
          <button type="button" className="btn btn-secondary" onClick={() => setSaidaModalOpen(true)}>
            <IconArrowDown size={16} /> Registrar saída
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEntradaModalOpen(true)}>
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

      {/* ---------- ENTRADA ---------- */}
      <section className="almoxarifado-section">
        <div className="almoxarifado-section__head">
          <h2>Entrada de materiais</h2>
          <p>Recebimentos vinculados a nota fiscal — alimentam o saldo do estoque</p>
        </div>
        {entradasOrdenadas.length === 0 ? (
          <EmptyState title="Nenhuma entrada registrada" description="Clique em “Registrar entrada” para lançar o primeiro recebimento de material." />
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
                  <th>Saldo disponível</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entradasOrdenadas.map((e) => {
                  const saldo = saldosPorCodigo.get(e.codigo);
                  return (
                    <tr key={e.id}>
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
                      <td className="mono almoxarifado-saldo">{saldo ? `${formatNumberBR(saldo.saldo)} ${saldo.unidade}` : '—'}</td>
                      <td>
                        <button type="button" className="btn btn-ghost" onClick={() => deleteEntrada(e.id)} aria-label="Remover entrada">
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
        {saidasOrdenadas.length === 0 ? (
          <EmptyState title="Nenhuma saída registrada" description="Clique em “Registrar saída” para retirar um material do estoque e vincular à etapa que consumiu." icon={<IconPlus size={40} stroke={1.5} />} />
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
                {saidasOrdenadas.map((s) => {
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
        onClose={() => setEntradaModalOpen(false)}
        onCreate={(entrada) => { createEntrada(entrada); setEntradaModalOpen(false); }}
      />
      <SaidaEstoqueFormModal
        open={saidaModalOpen}
        obraId={obraId}
        obraNome={obra.nome}
        saldos={saldos}
        atividades={atividades}
        onClose={() => setSaidaModalOpen(false)}
        onCreate={(saida) => { createSaida(saida); setSaidaModalOpen(false); }}
      />
    </div>
  );
}
