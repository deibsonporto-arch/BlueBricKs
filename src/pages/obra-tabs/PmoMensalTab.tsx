import { Fragment, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconPrinter } from '@tabler/icons-react';
import { useObras } from '../../hooks/useObras';
import { useAtividades } from '../../hooks/useAtividades';
import { useLancamentos } from '../../hooks/useLancamentos';
import { usePmoEntries } from '../../hooks/usePmoEntries';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { useItensProvidenciados } from '../../hooks/useItensProvidenciados';
import { CurvaSSection } from '../../components/obra-detail/CurvaSSection';
import { ProgressBar } from '../../components/common/ProgressBar';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate, weekBucketsOfMonth } from '../../utils/dateUtils';
import { itemOverlapsMonth, pmoPrevistoPct } from '../../utils/pmo';
import { buildReagendamentoAtrasoPatch, getOrderedSubatividades, getTaskNumber, isAtrasado } from '../../utils/subatividades';
import type { Atividade, Equipamento, Material } from '../../types/domain';
import './PmoMensalTab.css';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface PmoRow {
  id: string; // chave de PmoEntry.subatividadeId (id da subatividade, ou da própria atividade no fallback)
  numero: string;
  nome: string;
  depth: number;
  dataInicio: string;
  dataFim: string;
  dataInicioOriginal?: string;
  concluida: boolean;
  equipe: string;
  materiais: Material[];
  equipamentos: Equipamento[];
  isFallback: boolean;
}

function equipeText(s: { maoDeObraNecessaria: { tipo: string; quantidadePessoas: number }[] }): string {
  return s.maoDeObraNecessaria.length ? s.maoDeObraNecessaria.map((m) => `${m.tipo} (${m.quantidadePessoas})`).join(', ') : '—';
}

function buildRows(atividade: Atividade, allAtividades: Atividade[], year: number, month: number): PmoRow[] {
  if (atividade.subatividades.length === 0) {
    if (!itemOverlapsMonth(atividade, year, month)) return [];
    return [{
      id: atividade.id,
      numero: getTaskNumber(allAtividades, atividade.id),
      nome: atividade.nome,
      depth: 0,
      dataInicio: atividade.dataInicio,
      dataFim: atividade.dataFim,
      dataInicioOriginal: atividade.dataInicioOriginal,
      concluida: atividade.concluida,
      equipe: equipeText(atividade),
      materiais: atividade.materiaisNecessarios,
      equipamentos: atividade.equipamentosAluguel,
      isFallback: true,
    }];
  }
  return getOrderedSubatividades(atividade.subatividades)
    .filter(({ subatividade: s }) => itemOverlapsMonth(s, year, month))
    .map(({ subatividade: s, depth }) => ({
      id: s.id,
      numero: getTaskNumber(allAtividades, s.id),
      nome: s.nome,
      depth,
      dataInicio: s.dataInicio,
      dataFim: s.dataFim,
      dataInicioOriginal: s.dataInicioOriginal,
      concluida: s.concluida,
      equipe: equipeText(s),
      materiais: s.materiaisNecessarios,
      equipamentos: s.equipamentosAluguel,
      isFallback: false,
    }));
}

function materialItemKeys(row: PmoRow, atividadeId: string): string[] {
  return [
    ...row.materiais.map((m) => `${atividadeId}:mat:${m.id}`),
    ...row.equipamentos.map((e) => `${atividadeId}:eq:${e.id}`),
  ];
}

export function PmoMensalTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { atividades, updateAtividade, updateSubatividade } = useAtividades(obraId);
  const { lancamentos } = useLancamentos(obraId);
  const { nomeEmpresa, setNomeEmpresa } = useEmpresaConfig();
  const { isProvidenciado, toggle: toggleProvidenciado } = useItensProvidenciados(obraId);

  const today = new Date();
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));

  const mesKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const { getEntry, upsertEntry } = usePmoEntries(obraId, mesKey);

  const semanas = useMemo(() => weekBucketsOfMonth(cursor.year, cursor.month), [cursor]);

  const grupos = useMemo(
    () =>
      atividades
        .map((a) => ({ atividade: a, linhas: buildRows(a, atividades, cursor.year, cursor.month) }))
        .filter((g) => g.linhas.length > 0),
    [atividades, cursor],
  );

  function goPrevMonth() {
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  }
  function goNextMonth() {
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  }

  // Qualquer sinal de progresso (% real digitado ou uma semana do checklist marcada) indica que o
  // trabalho começou — marca como "em andamento" se ainda estiver pendente.
  function marcarIniciada(atividade: Atividade, row: PmoRow) {
    if (row.isFallback) {
      if (atividade.status === 'pendente') updateAtividade(atividade.id, { status: 'em_andamento' });
    } else {
      const sub = atividade.subatividades.find((s) => s.id === row.id);
      if (sub && !sub.iniciada && !sub.concluida) updateSubatividade(atividade.id, row.id, { iniciada: true });
    }
  }

  // Concluído é derivado só do % real chegar a 100 — marcar semanas do checklist é só um
  // controle de acompanhamento visual, não deve por si só mudar o status da tarefa.
  function handlePercentualRealChange(atividade: Atividade, row: PmoRow, value: number) {
    upsertEntry(atividade.id, row.id, { percentualReal: value }, semanas.length);
    const sub = row.isFallback ? undefined : atividade.subatividades.find((s) => s.id === row.id);
    const estavaConcluida = row.isFallback ? atividade.concluida : sub?.concluida;
    if (value >= 100 && !estavaConcluida) {
      const patch = { concluida: true, status: 'concluida' as const };
      if (row.isFallback) updateAtividade(atividade.id, patch);
      else updateSubatividade(atividade.id, row.id, patch);
    } else if (value < 100 && estavaConcluida) {
      const patch = { concluida: false, status: 'em_andamento' as const };
      if (row.isFallback) updateAtividade(atividade.id, patch);
      else updateSubatividade(atividade.id, row.id, patch);
    } else if (value > 0) {
      marcarIniciada(atividade, row);
    }
  }

  function handleToggleSemana(atividade: Atividade, row: PmoRow, idx: number, checked: boolean, checklistAtual: boolean[]) {
    const next = [...checklistAtual];
    next[idx] = checked;
    upsertEntry(atividade.id, row.id, { checklistSemanal: next }, semanas.length);
    if (checked) marcarIniciada(atividade, row);
  }

  // Reagenda o início de um item atrasado, empurrando dataFim junto (preserva a duração e tira a linha
  // do estado "atrasada"). buildReagendamentoAtrasoPatch guarda a data de início perdida em
  // dataInicioOriginal (só na primeira vez) — assim o atraso continua registrado mesmo após reagendar.
  function handleReagendar(atividade: Atividade, row: PmoRow, novaDataInicio: string) {
    if (row.isFallback) {
      updateAtividade(atividade.id, buildReagendamentoAtrasoPatch(atividade, novaDataInicio));
      return;
    }
    const sub = atividade.subatividades.find((s) => s.id === row.id);
    if (sub) updateSubatividade(atividade.id, row.id, buildReagendamentoAtrasoPatch(sub, novaDataInicio));
  }

  if (!obra) return null;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="pmo-print-header">
        <div className="pmo-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
        <h2>PMO — Planejamento Mensal da Obra</h2>
        <div className="pmo-print-header__grid">
          <span><strong>Obra:</strong> {obra.nome}</span>
          <span><strong>Responsável:</strong> {obra.responsavelTecnico}</span>
          <span><strong>Mês/Ano:</strong> {MONTH_NAMES[cursor.month]}, {cursor.year}</span>
        </div>
      </div>

      <div className="pmo-toolbar">
        <label className="pmo-toolbar__empresa">
          Empresa
          <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Nome da empresa" />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <IconPrinter size={16} /> Imprimir / Exportar PDF
        </button>
      </div>

      <div className="pmo-month-nav">
        <button type="button" className="btn btn-ghost" onClick={goPrevMonth} aria-label="Mês anterior">
          <IconChevronLeft size={18} />
        </button>
        <h2>{MONTH_NAMES[cursor.month]}/{cursor.year}</h2>
        <button type="button" className="btn btn-ghost" onClick={goNextMonth} aria-label="Próximo mês">
          <IconChevronRight size={18} />
        </button>
      </div>

      <div className="pmo-weeks-banner">
        {MONTH_NAMES[cursor.month]}/{cursor.year} tem {semanas.length} semanas: {semanas.map((s) => s.label).join(' · ')}
      </div>

      <div className="pmo-curva-s">
        <CurvaSSection obra={obra} atividades={atividades} lancamentos={lancamentos} />
      </div>

      <div className="pmo-table-card">
        <h3>Planejamento mensal — atividades e subtarefas</h3>
        {grupos.length === 0 ? (
          <EmptyState title="Nenhuma atividade prevista neste mês" description="Ajuste as datas das atividades/subatividades na Visão Geral ou navegue para outro mês." />
        ) : (
          <div className="scroll-x">
            <table className="pmo-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="pmo-table__col-real">% Real executado</th>
                  {semanas.map((s) => (
                    <th key={s.index}>
                      <span className="pmo-table__week-date">{s.start.slice(8, 10)}.{s.start.slice(5, 7)}</span>
                      <span className="pmo-table__week-label">S{s.index}</span>
                    </th>
                  ))}
                  <th className="pmo-table__col-desvio">Desvio</th>
                  <th>Equipe</th>
                  <th>Material</th>
                  <th>Pendências / Observações</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(({ atividade: a, linhas }) => (
                  <Fragment key={a.id}>
                    <tr className="pmo-table__grupo-row">
                      <td colSpan={6 + semanas.length}>{getTaskNumber(atividades, a.id)} — {a.nome}</td>
                    </tr>
                    {linhas.map((row) => {
                      const previstoCalculado = pmoPrevistoPct({ dataInicio: row.dataInicio, dataFim: row.dataFim }, cursor.year, cursor.month);
                      const entry = getEntry(row.id);
                      const previsto = entry?.percentualPrevisto ?? previstoCalculado;
                      const real = entry?.percentualReal ?? 0;
                      const checklist = entry?.checklistSemanal ?? new Array(semanas.length).fill(false);
                      const desvio = real - previsto;
                      const atrasada = isAtrasado(row);

                      return (
                        <tr key={row.id} className={atrasada ? 'pmo-table__row--atrasada' : ''}>
                          <td className="pmo-table__nome" style={{ paddingLeft: 10 + row.depth * 16 }}>
                            <span className="pmo-table__numero">{row.numero}</span> {row.nome}
                            {atrasada && (
                              <div className="pmo-table__atraso">
                                <span className="pmo-table__atraso-badge"><IconAlertTriangle size={12} /> Atrasada</span>
                                <label>
                                  Nova data de início
                                  <input
                                    type="date"
                                    value={row.dataInicio}
                                    onChange={(e) => handleReagendar(a, row, e.target.value)}
                                  />
                                </label>
                                {row.dataInicioOriginal && (
                                  <span className="pmo-table__atraso-original">início previsto: {formatDate(row.dataInicioOriginal)}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="pmo-table__bar-cell">
                            <div className="pmo-table__real-editable">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={real}
                                onChange={(e) => handlePercentualRealChange(a, row, Number(e.target.value))}
                                className="pmo-table__real-input"
                              />
                              <ProgressBar value={real} color="success" />
                              <span className="pmo-table__previsto-edit">
                                previsto
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={previsto}
                                  onChange={(e) => upsertEntry(a.id, row.id, { percentualPrevisto: Number(e.target.value) }, semanas.length)}
                                  className="pmo-table__previsto-input"
                                  title="Clique para editar o % previsto (calculado automaticamente por padrão)"
                                />
                                %
                              </span>
                            </div>
                            <span className="pmo-table__real-print">{real}% (previsto {previsto}%)</span>
                          </td>
                          {semanas.map((s, idx) => {
                            const isPlanejada = row.dataInicio <= s.end && row.dataFim >= s.start;
                            return (
                              <td
                                key={s.index}
                                className={`pmo-table__checkbox-cell${checklist[idx] ? ' is-checked' : ''}${isPlanejada ? ' is-planejada' : ''}`}
                                title={isPlanejada ? 'Planejado para esta semana' : undefined}
                              >
                                <input
                                  type="checkbox"
                                  checked={checklist[idx] ?? false}
                                  onChange={(e) => handleToggleSemana(a, row, idx, e.target.checked, checklist)}
                                />
                              </td>
                            );
                          })}
                          <td className={`pmo-table__desvio ${desvio >= 0 ? 'is-positive' : 'is-negative'}`}>
                            {desvio >= 0 ? '+' : ''}{desvio}%
                          </td>
                          <td>
                            <textarea
                              className="pmo-table__equipe pmo-table__obs--editable"
                              defaultValue={entry?.equipe ?? (row.equipe !== '—' ? row.equipe : '')}
                              onBlur={(e) => upsertEntry(a.id, row.id, { equipe: e.target.value }, semanas.length)}
                              placeholder="Ex: 2 pedreiros, 1 servente"
                            />
                            <span className="pmo-table__obs-print">{entry?.equipe ?? row.equipe}</span>
                          </td>
                          {(() => {
                            const keys = materialItemKeys(row, a.id);
                            const cellClass = keys.length === 0 ? '' : keys.every(isProvidenciado) ? ' is-comprado' : ' is-pendente-compra';
                            return (
                              <td className={`pmo-table__material-cell${cellClass}`}>
                                {keys.length === 0 ? (
                                  <>
                                    <textarea
                                      className="pmo-table__equipe pmo-table__obs--editable"
                                      defaultValue={entry?.material ?? ''}
                                      onBlur={(e) => upsertEntry(a.id, row.id, { material: e.target.value }, semanas.length)}
                                      placeholder="Ex: aguardando definição"
                                    />
                                    <span className="pmo-table__obs-print">{entry?.material ?? ''}</span>
                                  </>
                                ) : (
                                  <ul className="pmo-table__material-list">
                                    {row.materiais.map((m) => {
                                      const key = `${a.id}:mat:${m.id}`;
                                      return (
                                        <li key={key}>
                                          <label>
                                            <input type="checkbox" checked={isProvidenciado(key)} onChange={() => toggleProvidenciado(key)} />
                                            {m.nome}
                                          </label>
                                        </li>
                                      );
                                    })}
                                    {row.equipamentos.map((e) => {
                                      const key = `${a.id}:eq:${e.id}`;
                                      return (
                                        <li key={key}>
                                          <label>
                                            <input type="checkbox" checked={isProvidenciado(key)} onChange={() => toggleProvidenciado(key)} />
                                            {e.nome}
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </td>
                            );
                          })()}
                          <td>
                            <textarea
                              className="pmo-table__obs pmo-table__obs--editable"
                              defaultValue={entry?.observacoes ?? ''}
                              onBlur={(e) => upsertEntry(a.id, row.id, { observacoes: e.target.value }, semanas.length)}
                              placeholder="Ex: em cotação, aguardando cliente..."
                            />
                            <span className="pmo-table__obs-print">{entry?.observacoes ?? ''}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
