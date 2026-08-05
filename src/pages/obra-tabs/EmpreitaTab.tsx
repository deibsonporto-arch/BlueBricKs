import { Fragment, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { useEmpreitadas } from '../../hooks/useEmpreitadas';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useAtividades } from '../../hooks/useAtividades';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useObras } from '../../hooks/useObras';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { EmpreitadaCard } from '../../components/empreita/EmpreitadaCard';
import { EmpreitadaFormModal } from '../../components/empreita/EmpreitadaFormModal';
import { LancamentoFormModal } from '../../components/financeiro/LancamentoFormModal';
import { EmptyState } from '../../components/common/EmptyState';
import type { Empreitada, MedicaoEmpreitada, StatusLancamento } from '../../types/domain';
import { formatBRL } from '../../utils/currency';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { generateId } from '../../utils/id';
import { atividadeIdDoItem, calcularAbatimentosEntrada, calcularTotaisEmpreitada, entradaRestanteParaDesconto, rotuloExibicaoMedicao, rotuloServicoEmpreitada } from '../../utils/empreitada';
import './EmpreitaTab.css';

const STATUS_LABEL_LANCAMENTO: Record<StatusLancamento, string> = {
  pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado',
};

type GerandoLancamento =
  | { kind: 'medicao'; empreitada: Empreitada; medicoes: MedicaoEmpreitada[] }
  | { kind: 'entrada'; empreitada: Empreitada };

interface LinhaFolhaMedicao {
  itemId?: string;
  nome: string;
  quantidadeContratada?: number;
  unidade?: string;
  valorItem: number;
  percentualJaMedido: number;
  valorJaPago: number;
}

function montarFolhaMedicao(empreitada: Empreitada): LinhaFolhaMedicao[] {
  function linhaPara(itemId: string | undefined, nome: string, valorItem: number, quantidadeContratada?: number, unidade?: string): LinhaFolhaMedicao {
    const medicoesDoAlvo = empreitada.medicoes.filter((m) => (itemId ? m.itemId === itemId : !m.itemId));
    const ultima = medicoesDoAlvo.length > 0 ? medicoesDoAlvo.reduce((a, b) => (a.sequencia > b.sequencia ? a : b)) : undefined;
    const valorJaPago = medicoesDoAlvo.reduce((s, m) => s + m.valor, 0);
    return {
      itemId,
      nome,
      quantidadeContratada,
      unidade,
      valorItem,
      percentualJaMedido: ultima?.percentualExecutado ?? 0,
      valorJaPago,
    };
  }

  if (empreitada.itens.length > 0) {
    return empreitada.itens.map((i) => linhaPara(i.id, i.nome, i.valor, i.quantidade, i.unidade));
  }
  return [linhaPara(undefined, rotuloServicoEmpreitada(empreitada), empreitada.valorContrato, empreitada.quantidadeContratada, empreitada.unidadeContratada)];
}

/** Descrição sugerida para o lançamento gerado a partir de uma medição — usa rótulos curtos, e só repete
 * o detalhe entre parênteses quando ele traz informação além do rótulo do serviço (ex: nome de um item). */
function descricaoLancamentoMedicao(empreitada: Empreitada, medicoes: MedicaoEmpreitada[]): string {
  const rotulo = rotuloServicoEmpreitada(empreitada);
  const detalhes = [...new Set(medicoes.map((m) => rotuloExibicaoMedicao(empreitada, m)))].filter((d) => d !== rotulo);
  if (medicoes.length > 1) {
    return detalhes.length > 0
      ? `${rotulo} — Medição ${formatDate(medicoes[0].data)} (${detalhes.join(', ')})`
      : `${rotulo} — Medição ${formatDate(medicoes[0].data)}`;
  }
  return detalhes.length > 0
    ? `${rotulo} — Medição ${medicoes[0].sequencia}ª (${detalhes[0]})`
    : `${rotulo} — Medição ${medicoes[0].sequencia}ª`;
}

export function EmpreitaTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { nomeEmpresa } = useEmpresaConfig();
  const { empreitadas, createEmpreitada, updateEmpreitada, deleteEmpreitada, registrarMedicoes, atualizarMedicao, removerMedicao, refresh } = useEmpreitadas(obraId);
  const { fornecedores } = useFornecedores();
  const { atividades, refresh: refreshAtividades } = useAtividades(obraId);
  const { lancamentos, refresh: refreshLancamentos } = useLancamentos(obraId);

  // "Em andamento" primeiro — cancelada/concluída já estão resolvidas e não precisam de atenção imediata,
  // ficam abaixo mantendo a ordem relativa original entre si
  const empreitadasOrdenadas = useMemo(
    () => [...empreitadas].sort((a, b) => (a.status === 'em_andamento' ? 0 : 1) - (b.status === 'em_andamento' ? 0 : 1)),
    [empreitadas],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEmpreitada, setEditingEmpreitada] = useState<Empreitada | undefined>(undefined);
  const [gerandoLancamento, setGerandoLancamento] = useState<GerandoLancamento | undefined>(undefined);
  const [imprimindoEmpreitada, setImprimindoEmpreitada] = useState<Empreitada | undefined>(undefined);

  function handleImprimir(empreitada: Empreitada) {
    setImprimindoEmpreitada(empreitada);
    requestAnimationFrame(() => window.print());
  }

  const folhaMedicao = imprimindoEmpreitada ? montarFolhaMedicao(imprimindoEmpreitada) : [];
  const fornecedorImprimindo = imprimindoEmpreitada ? fornecedores.find((f) => f.id === imprimindoEmpreitada.fornecedorId) : undefined;
  const historicoMedicoes = imprimindoEmpreitada
    ? [...imprimindoEmpreitada.medicoes].sort((a, b) => a.sequencia - b.sequencia || a.data.localeCompare(b.data))
    : [];
  const totaisImpressao = imprimindoEmpreitada ? calcularTotaisEmpreitada(imprimindoEmpreitada, lancamentos) : undefined;
  const abatimentosImpressao = imprimindoEmpreitada ? calcularAbatimentosEntrada(imprimindoEmpreitada) : new Map<number, number>();
  const lancamentoEntradaImpressao = imprimindoEmpreitada?.entradaLancamentoId
    ? lancamentos.find((l) => l.id === imprimindoEmpreitada.entradaLancamentoId)
    : undefined;

  function openCreate() {
    setModalMode('create');
    setEditingEmpreitada(undefined);
    setModalOpen(true);
  }

  function openEdit(empreitada: Empreitada) {
    setModalMode('edit');
    setEditingEmpreitada(empreitada);
    setModalOpen(true);
  }

  function handleDelete(empreitada: Empreitada) {
    if (confirm(`Excluir a empreitada "${empreitada.servico}"? As medições registradas também serão perdidas.`)) deleteEmpreitada(empreitada.id);
  }

  function handleConcluir(empreitada: Empreitada) {
    if (confirm(`Marcar a empreitada "${empreitada.servico}" com ${fornecedores.find((f) => f.id === empreitada.fornecedorId)?.nome ?? 'este fornecedor'} como concluída? Mantém o histórico e a % já medida — não será mais possível registrar novas medições nela.`)) {
      updateEmpreitada(empreitada.id, { status: 'concluida' });
    }
  }

  function handleCancelar(empreitada: Empreitada) {
    if (confirm(`Cancelar a empreitada "${empreitada.servico}" com ${fornecedores.find((f) => f.id === empreitada.fornecedorId)?.nome ?? 'este fornecedor'}? Ela fica marcada como cancelada, mantendo o histórico e a % já medida — não será mais possível registrar novas medições nela.`)) {
      updateEmpreitada(empreitada.id, { status: 'cancelada' });
    }
  }

  function handleDuplicar(empreitada: Empreitada) {
    const now = new Date().toISOString();
    const copia: Empreitada = {
      ...empreitada,
      id: generateId(),
      itens: empreitada.itens.map((i) => ({ ...i, id: generateId() })),
      medicoes: [],
      valorEntrada: undefined, // entrada era do contrato anterior — não se aplica ao novo empreiteiro
      entradaLancamentoId: undefined,
      entradaDiluicao: undefined,
      entradaDiluicaoParcelas: undefined,
      anexos: [], // contrato/comprovantes eram do empreiteiro anterior — anexa os novos na cópia
      status: 'em_andamento',
      createdAt: now,
      updatedAt: now,
    };
    createEmpreitada(copia).then(() => openEdit(copia));
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="empreita-header">
        <h2>Empreitadas</h2>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={16} /> Nova empreitada
        </button>
      </div>

      {empreitadasOrdenadas.length === 0 ? (
        <EmptyState
          title="Nenhuma empreitada cadastrada"
          description="Cadastre um contrato de empreitada para acompanhar o valor, as etapas e as medições periódicas."
        />
      ) : (
        empreitadasOrdenadas.map((e) => (
          <EmpreitadaCard
            key={e.id}
            empreitada={e}
            fornecedor={fornecedores.find((f) => f.id === e.fornecedorId)}
            atividades={atividades}
            lancamentos={lancamentos}
            onEdit={() => openEdit(e)}
            onDelete={() => handleDelete(e)}
            onConcluir={() => handleConcluir(e)}
            onCancelar={() => handleCancelar(e)}
            onDuplicar={() => handleDuplicar(e)}
            onRegistrarMedicao={(lista) => registrarMedicoes(e.id, lista)}
            onEditarMedicao={(medicaoId, patch) => atualizarMedicao(e.id, medicaoId, patch)}
            onGerarLancamento={(medicoes) => setGerandoLancamento({ kind: 'medicao', empreitada: e, medicoes })}
            onGerarLancamentoEntrada={() => setGerandoLancamento({ kind: 'entrada', empreitada: e })}
            onRemoverMedicao={(medicaoId) => removerMedicao(e.id, medicaoId)}
            onVincularEntrada={(lancamentoId) => updateEmpreitada(e.id, { entradaLancamentoId: lancamentoId })}
            onImprimir={() => handleImprimir(e)}
          />
        ))
      )}

      <EmpreitadaFormModal
        open={modalOpen}
        mode={modalMode}
        obraId={obraId}
        empreitada={editingEmpreitada}
        fornecedores={fornecedores}
        atividades={atividades}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          refresh();
        }}
      />

      {gerandoLancamento && (
        <LancamentoFormModal
          open
          mode="create"
          obraId={obraId}
          fornecedores={fornecedores}
          atividades={atividades}
          obraDataInicio={obra?.dataInicio}
          onAtividadeCriada={refreshAtividades}
          prefill={
            gerandoLancamento.kind === 'entrada'
              ? {
                  fornecedorId: gerandoLancamento.empreitada.fornecedorId,
                  atividadeId: gerandoLancamento.empreitada.atividadeId,
                  descricao: `${rotuloServicoEmpreitada(gerandoLancamento.empreitada)} — Entrada`,
                  categoria: 'empreitada',
                  valorPago: String(gerandoLancamento.empreitada.valorEntrada ?? 0),
                }
              : {
                  fornecedorId: gerandoLancamento.empreitada.fornecedorId,
                  atividadeId: (() => {
                    const idsDoGrupo = new Set(
                      gerandoLancamento.medicoes.map((m) => atividadeIdDoItem(gerandoLancamento.empreitada, m.itemId)).filter(Boolean),
                    );
                    // se as medições do lançamento pertencem a etapas diferentes, deixa em branco pro usuário escolher
                    return idsDoGrupo.size === 1 ? [...idsDoGrupo][0] : undefined;
                  })(),
                  descricao: descricaoLancamentoMedicao(gerandoLancamento.empreitada, gerandoLancamento.medicoes),
                  categoria: 'empreitada',
                  valorPago: String(
                    gerandoLancamento.medicoes.reduce((s, m) => s + m.valor, 0) -
                      (calcularAbatimentosEntrada(gerandoLancamento.empreitada).get(gerandoLancamento.medicoes[0].sequencia) ?? 0) -
                      gerandoLancamento.medicoes.reduce((s, m) => s + (m.descontoEntrada ?? 0), 0),
                  ),
                }
          }
          descontoEntrada={
            gerandoLancamento.kind === 'medicao' &&
            gerandoLancamento.medicoes.every((m) => !m.descontoEntrada) &&
            entradaRestanteParaDesconto(gerandoLancamento.empreitada) > 0
              ? {
                  valorEntrada: entradaRestanteParaDesconto(gerandoLancamento.empreitada),
                  valorBase: gerandoLancamento.medicoes.reduce((s, m) => s + m.valor, 0),
                }
              : undefined
          }
          onClose={() => setGerandoLancamento(undefined)}
          onSaved={() => {
            setGerandoLancamento(undefined);
            refreshLancamentos();
          }}
          onCreated={(lancamento) => {
            if (gerandoLancamento.kind === 'entrada') {
              updateEmpreitada(gerandoLancamento.empreitada.id, { entradaLancamentoId: lancamento.id });
            } else {
              for (const m of gerandoLancamento.medicoes) {
                atualizarMedicao(gerandoLancamento.empreitada.id, m.id, { lancamentoId: lancamento.id });
              }
            }
          }}
        />
      )}

      {imprimindoEmpreitada && (
        <div className="empreita-print-view">
          <div className="empreita-print-header">
            <div className="empreita-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
            <h2>Folha de medição</h2>
            <div className="empreita-print-header__grid">
              <span><strong>Obra:</strong> {obra?.nome ?? '—'}</span>
              <span><strong>Empreiteiro:</strong> {fornecedorImprimindo?.nome ?? '—'}</span>
              <span><strong>Serviço:</strong> {imprimindoEmpreitada.servico}</span>
              <span><strong>Valor do contrato:</strong> {formatBRL(imprimindoEmpreitada.valorContrato)}</span>
              {!!imprimindoEmpreitada.valorEntrada && (
                <span>
                  <strong>Entrada:</strong> {formatBRL(imprimindoEmpreitada.valorEntrada)}
                  {lancamentoEntradaImpressao
                    ? ` — ${STATUS_LABEL_LANCAMENTO[lancamentoEntradaImpressao.status]} em ${formatDate(lancamentoEntradaImpressao.data)}`
                    : ' — falta lançar'}
                  {imprimindoEmpreitada.entradaDiluicao === 'parcelas' &&
                    ` (diluída nas primeiras ${imprimindoEmpreitada.entradaDiluicaoParcelas ?? 1} medições)`}
                </span>
              )}
              {!!imprimindoEmpreitada.desconto && (
                <span><strong>Desconto:</strong> -{formatBRL(imprimindoEmpreitada.desconto)}</span>
              )}
              <span><strong>Data da medição:</strong> {formatDate(todayISO())}</span>
            </div>
            {imprimindoEmpreitada.observacoes && (
              <p className="empreita-print-header__obs"><strong>Obs:</strong> {imprimindoEmpreitada.observacoes}</p>
            )}
          </div>

          <table className="empreita-print-table">
            <thead>
              <tr>
                <th>Item / etapa</th>
                <th>Qtd. contratada</th>
                <th>Valor do item</th>
                <th>% já medido</th>
                <th>Já pago</th>
                <th>Nova % medida</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {folhaMedicao.map((linha, i) => (
                <tr key={linha.itemId ?? i}>
                  <td>{linha.nome}</td>
                  <td>{linha.quantidadeContratada != null ? `${linha.quantidadeContratada} ${linha.unidade ?? ''}` : '—'}</td>
                  <td>{formatBRL(linha.valorItem)}</td>
                  <td>{linha.percentualJaMedido.toFixed(1)}%</td>
                  <td>{formatBRL(linha.valorJaPago)}</td>
                  <td className="empreita-print-table__blank"></td>
                  <td className="empreita-print-table__blank"></td>
                </tr>
              ))}
              <tr className="is-total">
                <td colSpan={4}>Total</td>
                <td>{formatBRL(folhaMedicao.reduce((s, l) => s + l.valorJaPago, 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>

          {(historicoMedicoes.length > 0 || !!imprimindoEmpreitada.valorEntrada) && totaisImpressao && (
            <>
              <h3 className="empreita-print-subtitulo">Histórico de medições</h3>
              <table className="empreita-print-table">
                <thead>
                  <tr>
                    <th>Seq.</th>
                    <th>Data</th>
                    <th>Etapa</th>
                    <th>%</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!!imprimindoEmpreitada.valorEntrada && (
                    <tr>
                      <td>0ª</td>
                      <td>{lancamentoEntradaImpressao ? formatDate(lancamentoEntradaImpressao.data) : '—'}</td>
                      <td>Entrada</td>
                      <td>—</td>
                      <td>{formatBRL(imprimindoEmpreitada.valorEntrada)}</td>
                      <td>{lancamentoEntradaImpressao ? STATUS_LABEL_LANCAMENTO[lancamentoEntradaImpressao.status] : 'Falta lançar'}</td>
                    </tr>
                  )}
                  {(() => {
                    const notasRenderizadas = new Set<number>();
                    return historicoMedicoes.map((m) => {
                      const lancamentoDaMedicao = m.lancamentoId ? lancamentos.find((l) => l.id === m.lancamentoId) : undefined;
                      const primeiraOcorrenciaSequencia = !notasRenderizadas.has(m.sequencia);
                      if (primeiraOcorrenciaSequencia) notasRenderizadas.add(m.sequencia);
                      const abatimentoGrupo = abatimentosImpressao.get(m.sequencia) ?? 0;
                      const valorLiquidoLinha = m.valor - (m.descontoEntrada ?? 0) - (primeiraOcorrenciaSequencia ? abatimentoGrupo : 0);
                      return (
                        <Fragment key={m.id}>
                          <tr>
                            <td>{m.sequencia}ª</td>
                            <td>{formatDate(m.data)}</td>
                            <td>{rotuloExibicaoMedicao(imprimindoEmpreitada, m)}</td>
                            <td>{m.quantidadeExecutada != null ? `${m.quantidadeExecutada} (${m.percentualExecutado.toFixed(1)}%)` : `${m.percentualExecutado}%`}</td>
                            <td>{formatBRL(valorLiquidoLinha)}</td>
                            <td>{lancamentoDaMedicao ? STATUS_LABEL_LANCAMENTO[lancamentoDaMedicao.status] : 'Falta lançar'}</td>
                          </tr>
                          {m.observacoes && (
                            <tr className="empreita-print-table__nota">
                              <td colSpan={6}>Observação: {m.observacoes}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    });
                  })()}
                  <tr className="is-total">
                    <td colSpan={6}>
                      Medido: {formatBRL(totaisImpressao.totalMedido)}
                      {totaisImpressao.valorAMedir > 0 && ` (${((totaisImpressao.totalMedido / totaisImpressao.valorAMedir) * 100).toFixed(0)}% de ${formatBRL(totaisImpressao.valorAMedir)} a medir)`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <div className="empreita-print-assinaturas">
            <div className="empreita-print-assinatura">
              <span>Empreiteiro</span>
            </div>
            <div className="empreita-print-assinatura">
              <span>Responsável técnico</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
