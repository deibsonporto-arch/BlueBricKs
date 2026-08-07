import { Fragment, useState } from 'react';
import { IconAlertTriangle, IconBan, IconChevronDown, IconChevronUp, IconCircleCheck, IconCopy, IconEdit, IconLink, IconPaperclip, IconPlus, IconPrinter, IconReceipt, IconTrash, IconX } from '@tabler/icons-react';
import type { Atividade, Empreitada, Fornecedor, LancamentoFinanceiro, MedicaoEmpreitada } from '../../types/domain';
import { formatBRL } from '../../utils/currency';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { atividadeIdDoItem, calcularAbatimentosEntrada, calcularMedicao, calcularTotaisEmpreitada, comprovanteDoLancamento, entradaRestanteParaDesconto, rotuloExibicaoMedicao, usaCobrancaPorUnidade } from '../../utils/empreitada';
import { generateId } from '../../utils/id';
import { downloadAnexo } from '../../utils/attachmentStore';
import './EmpreitadaCard.css';

interface EmpreitadaCardProps {
  empreitada: Empreitada;
  fornecedor?: Fornecedor;
  atividades: Atividade[];
  lancamentos: LancamentoFinanceiro[];
  onEdit: () => void;
  onDelete: () => void;
  onConcluir: () => void;
  onCancelar: () => void;
  onDuplicar: () => void;
  onRegistrarMedicao: (lista: Omit<MedicaoEmpreitada, 'id' | 'sequencia'>[]) => void;
  onEditarMedicao: (medicaoId: string, patch: Partial<MedicaoEmpreitada>) => void;
  onGerarLancamento: (medicoes: MedicaoEmpreitada[]) => void;
  onGerarLancamentoEntrada: () => void;
  onRemoverMedicao: (medicaoId: string) => void;
  onVincularEntrada: (lancamentoId: string) => void;
  onImprimir: () => void;
}

const STATUS_LABEL_LANCAMENTO: Record<LancamentoFinanceiro['status'], string> = {
  pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado',
};

const STATUS_LABEL_EMPREITADA: Record<Empreitada['status'], string> = {
  em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
};

interface MedicaoLinha {
  key: string;
  itemId: string;
  modoMedicao: 'percentual' | 'quantidade';
  percentual: string;
  quantidade: string;
}

function novaLinhaVazia(): MedicaoLinha {
  return { key: generateId(), itemId: '', modoMedicao: 'quantidade', percentual: '', quantidade: '' };
}

export function EmpreitadaCard({ empreitada, fornecedor, atividades, lancamentos, onEdit, onDelete, onConcluir, onCancelar, onDuplicar, onRegistrarMedicao, onEditarMedicao, onGerarLancamento, onGerarLancamentoEntrada, onRemoverMedicao, onVincularEntrada, onImprimir }: EmpreitadaCardProps) {
  const atividadeNome = atividades.find((a) => a.id === empreitada.atividadeId)?.nome;
  const nomeAtividade = (atividadeId?: string) => atividades.find((a) => a.id === atividadeId)?.nome;
  const multiplasAtividades = new Set(empreitada.itens.map((i) => atividadeIdDoItem(empreitada, i.id)).filter(Boolean)).size > 1;
  const [expandida, setExpandida] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoMedicaoId, setEditandoMedicaoId] = useState<string | undefined>(undefined);
  const [novaData, setNovaData] = useState(todayISO());
  const [linhas, setLinhas] = useState<MedicaoLinha[]>([novaLinhaVazia()]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [novoDescontoEntrada, setNovoDescontoEntrada] = useState<'nenhum' | 'total' | 'metade'>('nenhum');
  const [vinculando, setVinculando] = useState<number | 'entrada' | undefined>(undefined);
  const [lancamentoParaVincular, setLancamentoParaVincular] = useState('');

  const entradaRestante = entradaRestanteParaDesconto(empreitada, editandoMedicaoId);
  const valorDescontoEntradaEscolhido =
    novoDescontoEntrada === 'total' ? entradaRestante : novoDescontoEntrada === 'metade' ? Math.min(entradaRestante, (empreitada.valorEntrada ?? 0) / 2) : 0;

  const lancamentosDoFornecedor = [...lancamentos]
    .filter((l) => !empreitada.fornecedorId || l.fornecedorId === empreitada.fornecedorId)
    .sort((a, b) => b.data.localeCompare(a.data));

  function confirmarVinculo(grupoDaMedicao: MedicaoEmpreitada[]) {
    if (!lancamentoParaVincular) return;
    for (const m of grupoDaMedicao) onEditarMedicao(m.id, { lancamentoId: lancamentoParaVincular });
    setVinculando(undefined);
    setLancamentoParaVincular('');
  }

  function confirmarVinculoEntrada() {
    if (!lancamentoParaVincular) return;
    onVincularEntrada(lancamentoParaVincular);
    setVinculando(undefined);
    setLancamentoParaVincular('');
  }

  const lancamentoDaEntrada = empreitada.entradaLancamentoId ? lancamentos.find((l) => l.id === empreitada.entradaLancamentoId) : undefined;
  const comprovanteEntrada = comprovanteDoLancamento(lancamentoDaEntrada);

  const { valorAMedir, totalMedido, totalPago, saldo } = calcularTotaisEmpreitada(empreitada, lancamentos);
  const abatimentosEntrada = calcularAbatimentosEntrada(empreitada);
  const temContratoFixo = empreitada.valorContrato > 0;
  const percentualContrato = valorAMedir > 0 ? (totalMedido / valorAMedir) * 100 : 0;
  const totalQuantidadeMedida = empreitada.medicoes.reduce((s, m) => s + (m.quantidadeExecutada ?? 0), 0);
  // medições sem item (ex: registradas antes dos itens existirem) já consomem parte do valor a medir —
  // o % de cada item é relativo só ao que ainda não foi coberto por essas medições, não ao contrato inteiro
  const totalMedidoSemItem = empreitada.medicoes.filter((m) => !m.itemId).reduce((s, m) => s + m.valor, 0);
  const valorAMedirParaItens = Math.max(0, valorAMedir - totalMedidoSemItem);

  function baseParaItem(itemId: string) {
    const item = empreitada.itens.find((i) => i.id === itemId);
    return item
      ? { valor: item.valor, quantidade: item.quantidade, valorUnitario: item.valorUnitario }
      : { valor: valorAMedir, quantidade: empreitada.quantidadeContratada, valorUnitario: empreitada.valorUnitario };
  }

  function jaExecutadoParaItem(itemId: string) {
    const medicoesDoAlvo = empreitada.medicoes.filter((m) => (itemId ? m.itemId === itemId : !m.itemId) && m.id !== editandoMedicaoId);
    const ultimaMedicaoDoAlvo = medicoesDoAlvo.length > 0 ? medicoesDoAlvo.reduce((a, b) => (a.sequencia > b.sequencia ? a : b)) : undefined;
    // recalcula a % já executada a partir do valor (R$) já pago, em vez de usar o % gravado na medição —
    // esse % pode ter ficado desatualizado se a entrada/desconto mudou depois que a medição foi registrada
    const valorJaPago = medicoesDoAlvo.reduce((s, m) => s + m.valor, 0);
    const base = baseParaItem(itemId);
    return {
      percentualExecutado: base.valor > 0 ? (valorJaPago / base.valor) * 100 : ultimaMedicaoDoAlvo?.percentualExecutado,
      quantidadeExecutada: ultimaMedicaoDoAlvo?.quantidadeExecutada,
    };
  }

  function calcularLinha(linha: MedicaoLinha) {
    const item = empreitada.itens.find((i) => i.id === linha.itemId);
    const base = baseParaItem(linha.itemId);
    const permiteEscolhaUnidade = usaCobrancaPorUnidade(base);
    const modoEfetivo = permiteEscolhaUnidade ? linha.modoMedicao : 'percentual';
    const unidadeMedicao = item?.unidade ?? empreitada.unidadeContratada;
    const jaExecutado = jaExecutadoParaItem(linha.itemId);
    const resultado = calcularMedicao(
      base,
      {
        percentualExecutado: modoEfetivo === 'percentual' ? Number(linha.percentual) || 0 : undefined,
        quantidadeExecutada: modoEfetivo === 'quantidade' && linha.quantidade !== '' ? Number(linha.quantidade) : undefined,
      },
      jaExecutado,
    );
    return { item, permiteEscolhaUnidade, modoEfetivo, unidadeMedicao, jaExecutado, resultado };
  }

  const linhasCalculadas = linhas.map((linha) => ({ linha, calc: calcularLinha(linha) }));
  const totalLinhasCalculadas = linhasCalculadas.reduce((s, { calc }) => s + calc.resultado.valor, 0);
  const totalLiquidoLinhasCalculadas = Math.max(0, totalLinhasCalculadas - valorDescontoEntradaEscolhido);

  function atualizarLinha(key: string, patch: Partial<MedicaoLinha>) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinhaVazia()]);
  }

  function removerLinha(key: string) {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function fecharFormulario() {
    setFormAberto(false);
    setEditandoMedicaoId(undefined);
    setLinhas([novaLinhaVazia()]);
    setNovaData(todayISO());
    setNovaObservacao('');
    setNovoDescontoEntrada('nenhum');
  }

  function abrirEdicao(m: MedicaoEmpreitada) {
    setEditandoMedicaoId(m.id);
    setFormAberto(true);
    setNovaData(m.data);
    setNovaObservacao(m.observacoes ?? '');
    const eps = 0.01;
    setNovoDescontoEntrada(
      !m.descontoEntrada
        ? 'nenhum'
        : Math.abs(m.descontoEntrada - (empreitada.valorEntrada ?? 0)) < eps
          ? 'total'
          : Math.abs(m.descontoEntrada - (empreitada.valorEntrada ?? 0) / 2) < eps
            ? 'metade'
            : 'nenhum',
    );
    setLinhas([{
      key: generateId(),
      itemId: m.itemId ?? '',
      modoMedicao: m.quantidadeExecutada != null ? 'quantidade' : 'percentual',
      percentual: m.quantidadeExecutada != null ? '' : String(m.percentualExecutado),
      quantidade: m.quantidadeExecutada != null ? String(m.quantidadeExecutada) : '',
    }]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editandoMedicaoId) {
      const { calc } = linhasCalculadas[0];
      onEditarMedicao(editandoMedicaoId, {
        data: novaData,
        itemId: linhasCalculadas[0].linha.itemId || undefined,
        descricaoServico: calc.item?.nome ?? empreitada.servico,
        percentualExecutado: calc.resultado.percentualExecutado,
        quantidadeExecutada: calc.resultado.quantidadeExecutada,
        valor: calc.resultado.valor,
        observacoes: novaObservacao || undefined,
        descontoEntrada: valorDescontoEntradaEscolhido || undefined,
      });
    } else {
      onRegistrarMedicao(
        linhasCalculadas.map(({ linha, calc }, index) => ({
          data: novaData,
          itemId: linha.itemId || undefined,
          descricaoServico: calc.item?.nome ?? empreitada.servico,
          percentualExecutado: calc.resultado.percentualExecutado,
          quantidadeExecutada: calc.resultado.quantidadeExecutada,
          valor: calc.resultado.valor,
          observacoes: novaObservacao || undefined,
          // o desconto é um valor único por rodada — aplicado só na primeira linha para não somar em dobro
          descontoEntrada: index === 0 ? valorDescontoEntradaEscolhido || undefined : undefined,
        })),
      );
    }
    fecharFormulario();
  }

  return (
    <div className={`empreitada-card${empreitada.status !== 'em_andamento' ? ' empreitada-card--finalizada' : ''}`}>
      <button type="button" className="empreitada-card__header" onClick={() => setExpandida((v) => !v)}>
        <div className="empreitada-card__header-main">
          <strong>{fornecedor?.nome ?? 'Sem fornecedor'}</strong>
          <span className="empreitada-card__servico" title={empreitada.servico}>{empreitada.resumo || empreitada.servico}</span>
          {atividadeNome && <span className="empreitada-card__etapa">{atividadeNome}</span>}
        </div>
        <div className="empreitada-card__header-metrics">
          <span>{temContratoFixo ? formatBRL(empreitada.valorContrato) : `${formatBRL(totalMedido)} medido`}</span>
          {temContratoFixo && <span className="empreitada-card__pct">{percentualContrato.toFixed(0)}% medido</span>}
          <span className={`empreitada-card__status empreitada-card__status--${empreitada.status}`}>
            {STATUS_LABEL_EMPREITADA[empreitada.status]}
          </span>
          {expandida ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </div>
      </button>

      {expandida && (
        <div className="empreitada-card__body">
          <div className="empreitada-card__actions">
            <button type="button" className="btn btn-ghost" onClick={onEdit}><IconEdit size={14} /> Editar</button>
            <button type="button" className="btn btn-ghost" onClick={onDelete}><IconTrash size={14} /> Excluir</button>
            {empreitada.status === 'em_andamento' && (
              <>
                <button type="button" className="btn btn-ghost" onClick={onConcluir}><IconCircleCheck size={14} /> Concluir</button>
                <button type="button" className="btn btn-ghost" onClick={onCancelar}><IconBan size={14} /> Cancelar</button>
              </>
            )}
            <button type="button" className="btn btn-ghost" onClick={onDuplicar}><IconCopy size={14} /> Duplicar p/ novo empreiteiro</button>
            {empreitada.status === 'em_andamento' && (
              <button type="button" className="btn btn-secondary" onClick={() => (formAberto ? fecharFormulario() : setFormAberto(true))}>
                <IconPlus size={14} /> Registrar medição
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onImprimir}>
              <IconPrinter size={14} /> Imprimir folha de medição
            </button>
          </div>

          {empreitada.resumo && (
            <p className="empreitada-card__descricao-completa">{empreitada.servico}</p>
          )}

          {empreitada.itens.length > 0 && (
            <table className="empreitada-card__table">
              <thead>
                <tr>
                  <th>Etapa/serviço</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                  <th>% do item</th>
                  {multiplasAtividades && <th>Atividade</th>}
                </tr>
              </thead>
              <tbody>
                {empreitada.itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td>
                    <td>{i.quantidade != null ? `${i.quantidade} ${i.unidade} × ${formatBRL(i.valorUnitario ?? 0)}` : '—'}</td>
                    <td>{formatBRL(i.valor)}</td>
                    <td>{valorAMedirParaItens > 0 ? `${((i.valor / valorAMedirParaItens) * 100).toFixed(1)}%` : '—'}</td>
                    {multiplasAtividades && <td>{nomeAtividade(atividadeIdDoItem(empreitada, i.id)) ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {formAberto && (
            <form className="empreitada-card__medicao-form" onSubmit={handleSubmit}>
              <div className="empreitada-card__medicao-topo">
                {editandoMedicaoId && <span className="empreitada-card__medicao-editando">Editando medição</span>}
                <input type="date" required value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </div>

              {linhasCalculadas.map(({ linha, calc }) => (
                <div className="empreitada-card__medicao-linha" key={linha.key}>
                  {empreitada.itens.length > 0 && (
                    <select
                      required value={linha.itemId}
                      onChange={(e) => atualizarLinha(linha.key, { itemId: e.target.value })}
                      disabled={!!editandoMedicaoId}
                    >
                      <option value="">Selecione a etapa</option>
                      {empreitada.itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  )}
                  {calc.permiteEscolhaUnidade && (
                    <div className="empreitada-card__modo-medicao">
                      <label>
                        <input
                          type="radio" name={`modo-medicao-${linha.key}`} value="quantidade"
                          checked={calc.modoEfetivo === 'quantidade'}
                          onChange={() => atualizarLinha(linha.key, { modoMedicao: 'quantidade' })}
                        />
                        Por {calc.unidadeMedicao || 'unidade'}
                      </label>
                      <label>
                        <input
                          type="radio" name={`modo-medicao-${linha.key}`} value="percentual"
                          checked={calc.modoEfetivo === 'percentual'}
                          onChange={() => atualizarLinha(linha.key, { modoMedicao: 'percentual' })}
                        />
                        Por %
                      </label>
                    </div>
                  )}
                  {calc.modoEfetivo === 'quantidade' ? (
                    <input
                      type="number" min={0} step="any" required
                      placeholder={`Quantidade executada (${calc.unidadeMedicao})`}
                      value={linha.quantidade}
                      onChange={(e) => atualizarLinha(linha.key, { quantidade: e.target.value })}
                    />
                  ) : (
                    <input
                      type="number" min={0} max={100} step="any" required
                      placeholder="% executado"
                      value={linha.percentual}
                      onChange={(e) => atualizarLinha(linha.key, { percentual: e.target.value })}
                    />
                  )}
                  <span className="empreitada-card__medicao-valor">
                    {formatBRL(calc.resultado.valor)} a pagar {calc.modoEfetivo === 'quantidade' && `(${calc.resultado.percentualExecutado.toFixed(1)}% no total)`}
                  </span>
                  {!editandoMedicaoId && linhas.length > 1 && (
                    <button type="button" className="btn btn-ghost" onClick={() => removerLinha(linha.key)} aria-label="Remover etapa">
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              ))}

              {linhas.length > 1 && (
                <p className="empreitada-card__medicao-total">
                  Total desta rodada: <strong>{formatBRL(totalLiquidoLinhasCalculadas)}</strong>
                  {valorDescontoEntradaEscolhido > 0 && ` (já descontando ${formatBRL(valorDescontoEntradaEscolhido)} de entrada)`}
                </p>
              )}

              {!editandoMedicaoId && empreitada.itens.length > 0 && (
                <button type="button" className="btn btn-ghost empreitada-card__medicao-add" onClick={adicionarLinha}>
                  <IconPlus size={14} /> Adicionar outra etapa
                </button>
              )}

              <div className="empreitada-card__medicao-campo-extra">
                <label>Observações (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Ex: combinado com o empreiteiro, condição climática, etc."
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                />
              </div>

              {!!empreitada.valorEntrada && entradaRestante > 0 && (
                <div className="empreitada-card__medicao-campo-extra">
                  <label>Descontar entrada nesta parcela</label>
                  <div className="empreitada-card__desconto-entrada-opcoes">
                    <label>
                      <input type="radio" name="desconto-entrada" checked={novoDescontoEntrada === 'nenhum'} onChange={() => setNovoDescontoEntrada('nenhum')} />
                      Não descontar
                    </label>
                    <label>
                      <input type="radio" name="desconto-entrada" checked={novoDescontoEntrada === 'total'} onChange={() => setNovoDescontoEntrada('total')} />
                      100% da entrada ({formatBRL(entradaRestante)})
                    </label>
                    <label>
                      <input type="radio" name="desconto-entrada" checked={novoDescontoEntrada === 'metade'} onChange={() => setNovoDescontoEntrada('metade')} />
                      50% da entrada ({formatBRL(Math.min(entradaRestante, (empreitada.valorEntrada ?? 0) / 2))})
                    </label>
                  </div>
                </div>
              )}

              <div className="empreitada-card__medicao-form-actions">
                <button type="submit" className="btn btn-primary">
                  {editandoMedicaoId ? 'Salvar alteração' : linhas.length > 1 ? 'Registrar medições' : 'Registrar'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={fecharFormulario} aria-label="Cancelar">
                  <IconX size={14} />
                </button>
              </div>
            </form>
          )}
          {formAberto && linhasCalculadas.some(({ calc }) => (calc.jaExecutado.percentualExecutado ?? 0) > 0) && (
            <p className="empreitada-card__medicao-hint">
              Uma ou mais etapas já tinham progresso medido antes — o valor mostrado é só a diferença.
            </p>
          )}
          {formAberto && editandoMedicaoId && empreitada.medicoes.find((m) => m.id === editandoMedicaoId)?.lancamentoId && (
            <p className="empreitada-card__medicao-hint empreitada-card__medicao-hint--aviso">
              Esta medição já tem um lançamento financeiro vinculado — ajuste o valor lá no Financeiro também, se necessário, pois não é atualizado automaticamente.
            </p>
          )}

          <table className="empreitada-card__table">
            <thead>
              <tr><th>Seq.</th><th>Data</th><th>Etapa</th><th>%</th><th>Valor</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {empreitada.medicoes.length === 0 && (
                <tr><td colSpan={7} className="empreitada-card__vazio">Nenhuma medição registrada.</td></tr>
              )}
              {!!empreitada.valorEntrada && (
                <Fragment>
                <tr className={!lancamentoDaEntrada ? 'empreitada-card__medicao-linha-pendente' : undefined}>
                  <td>0ª</td>
                  <td>{lancamentoDaEntrada ? formatDate(lancamentoDaEntrada.data) : '—'}</td>
                  <td>Entrada</td>
                  <td>{empreitada.valorContrato > 0 ? `${((empreitada.valorEntrada / empreitada.valorContrato) * 100).toFixed(1)}%` : '—'}</td>
                  <td>{formatBRL(empreitada.valorEntrada)}</td>
                  <td>
                    {lancamentoDaEntrada ? (
                      <span className={`empreitada-card__lancamento-status empreitada-card__lancamento-status--${lancamentoDaEntrada.status}`}>
                        {STATUS_LABEL_LANCAMENTO[lancamentoDaEntrada.status]}
                      </span>
                    ) : (
                      <span className="empreitada-card__sem-lancamento">
                        <IconAlertTriangle size={13} /> Falta lançar p/ pagamento
                      </span>
                    )}
                  </td>
                  <td className="empreitada-card__medicao-acoes">
                    {!lancamentoDaEntrada && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={onGerarLancamentoEntrada}>
                          <IconReceipt size={14} /> Gerar lançamento
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setVinculando(vinculando === 'entrada' ? undefined : 'entrada');
                            setLancamentoParaVincular('');
                          }}
                        >
                          <IconLink size={14} /> Vincular a lançamento existente
                        </button>
                      </>
                    )}
                    {comprovanteEntrada && (
                      <button type="button" className="btn btn-ghost" onClick={() => downloadAnexo(comprovanteEntrada)}>
                        <IconPaperclip size={14} /> Ver comprovante
                      </button>
                    )}
                  </td>
                </tr>
                {vinculando === 'entrada' && (
                  <tr className="empreitada-card__medicao-linha-pendente">
                    <td colSpan={7}>
                      <div className="empreitada-card__vincular-lancamento">
                        <select value={lancamentoParaVincular} onChange={(e) => setLancamentoParaVincular(e.target.value)}>
                          <option value="">Selecione o lançamento já existente...</option>
                          {lancamentosDoFornecedor.map((l) => (
                            <option key={l.id} value={l.id}>
                              {formatDate(l.data)} — {l.descricao} — {formatBRL(l.valorPago || l.valorPrevisto)} ({STATUS_LABEL_LANCAMENTO[l.status]})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-primary" disabled={!lancamentoParaVincular} onClick={confirmarVinculoEntrada}>
                          Vincular
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setVinculando(undefined)}>
                          <IconX size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )}
              {(() => {
                const gruposRenderizados = new Set<number>();
                const notasRenderizadas = new Set<number>();
                return [...empreitada.medicoes]
                  .sort((a, b) => a.sequencia - b.sequencia)
                  .map((m) => {
                  const lancamento = m.lancamentoId ? lancamentos.find((l) => l.id === m.lancamentoId) : undefined;
                  const comprovanteMedicao = comprovanteDoLancamento(lancamento);
                  const itemDaMedicao = m.itemId ? empreitada.itens.find((i) => i.id === m.itemId) : undefined;
                  const unidadeDaMedicao = itemDaMedicao?.unidade ?? empreitada.unidadeContratada;

                  const grupoDaMedicao = !m.lancamentoId
                    ? empreitada.medicoes.filter((x) => !x.lancamentoId && x.sequencia === m.sequencia)
                    : [];
                  const ehRepresentanteDoGrupo = !m.lancamentoId && !gruposRenderizados.has(m.sequencia);
                  if (ehRepresentanteDoGrupo) gruposRenderizados.add(m.sequencia);

                  const primeiraOcorrenciaSequencia = !notasRenderizadas.has(m.sequencia);
                  if (primeiraOcorrenciaSequencia) notasRenderizadas.add(m.sequencia);
                  const abatimentoGrupo = abatimentosEntrada.get(m.sequencia) ?? 0;
                  const medicoesDoGrupoCompleto = empreitada.medicoes.filter((x) => x.sequencia === m.sequencia);
                  const valorGrupoTotal = medicoesDoGrupoCompleto.reduce((s, x) => s + x.valor, 0);
                  const descontoManualGrupo = medicoesDoGrupoCompleto.reduce((s, x) => s + (x.descontoEntrada ?? 0), 0);
                  // "Valor" mostra o líquido a lançar (já descontando entrada) — o valor bruto medido continua
                  // intacto em m.valor por baixo dos panos, usado no cálculo de "Medido"/progresso do contrato
                  const valorLiquidoLinha = m.valor - (m.descontoEntrada ?? 0) - (primeiraOcorrenciaSequencia ? abatimentoGrupo : 0);

                  return (
                    <Fragment key={m.id}>
                    <tr className={!m.lancamentoId ? 'empreitada-card__medicao-linha-pendente' : undefined}>
                      <td>{m.sequencia}ª</td>
                      <td>{formatDate(m.data)}</td>
                      <td>
                        {rotuloExibicaoMedicao(empreitada, m)}
                        {multiplasAtividades && (
                          <span className="empreitada-card__medicao-atividade">
                            {nomeAtividade(atividadeIdDoItem(empreitada, m.itemId)) ?? 'sem atividade'}
                          </span>
                        )}
                      </td>
                      <td>
                        {m.quantidadeExecutada != null ? `${m.quantidadeExecutada} ${unidadeDaMedicao} (${m.percentualExecutado.toFixed(1)}%)` : `${m.percentualExecutado}%`}
                        {m.itemId && <span className="empreitada-card__medicao-pct-hint"> do item</span>}
                      </td>
                      <td>
                        {formatBRL(valorLiquidoLinha)}
                        {valorLiquidoLinha !== m.valor && <span className="empreitada-card__medicao-pct-hint"> (bruto: {formatBRL(m.valor)})</span>}
                      </td>
                      <td>
                        {lancamento ? (
                          <span className={`empreitada-card__lancamento-status empreitada-card__lancamento-status--${lancamento.status}`}>
                            {STATUS_LABEL_LANCAMENTO[lancamento.status]}
                          </span>
                        ) : (
                          <span className="empreitada-card__sem-lancamento">
                            <IconAlertTriangle size={13} /> Falta lançar p/ pagamento
                          </span>
                        )}
                      </td>
                      <td className="empreitada-card__medicao-acoes">
                        {ehRepresentanteDoGrupo && (
                          <>
                            <button type="button" className="btn btn-ghost" onClick={() => onGerarLancamento(grupoDaMedicao)}>
                              <IconReceipt size={14} /> Gerar lançamento{grupoDaMedicao.length > 1 ? ` (${grupoDaMedicao.length} itens)` : ''}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setVinculando(vinculando === m.sequencia ? undefined : m.sequencia);
                                setLancamentoParaVincular('');
                              }}
                            >
                              <IconLink size={14} /> Vincular a lançamento existente
                            </button>
                          </>
                        )}
                        {comprovanteMedicao && (
                          <button type="button" className="btn btn-ghost" onClick={() => downloadAnexo(comprovanteMedicao)}>
                            <IconPaperclip size={14} /> Ver comprovante
                          </button>
                        )}
                        <button type="button" className="btn btn-ghost" onClick={() => abrirEdicao(m)} aria-label="Editar medição">
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            const aviso = lancamento
                              ? `Excluir a ${m.sequencia}ª medição (${m.descricaoServico})? Essa ação não pode ser desfeita. O lançamento financeiro vinculado (${lancamento.descricao}) NÃO será excluído automaticamente — exclua-o também no Financeiro se foi lançado por engano.`
                              : `Excluir a ${m.sequencia}ª medição (${m.descricaoServico})? Essa ação não pode ser desfeita.`;
                            if (confirm(aviso)) onRemoverMedicao(m.id);
                          }}
                          aria-label="Excluir medição"
                        >
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                    {ehRepresentanteDoGrupo && vinculando === m.sequencia && (
                      <tr className="empreitada-card__medicao-linha-pendente">
                        <td colSpan={7}>
                          <div className="empreitada-card__vincular-lancamento">
                            <select value={lancamentoParaVincular} onChange={(e) => setLancamentoParaVincular(e.target.value)}>
                              <option value="">Selecione o lançamento já existente...</option>
                              {lancamentosDoFornecedor.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {formatDate(l.data)} — {l.descricao} — {formatBRL(l.valorPago || l.valorPrevisto)} ({STATUS_LABEL_LANCAMENTO[l.status]})
                                </option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-primary" disabled={!lancamentoParaVincular} onClick={() => confirmarVinculo(grupoDaMedicao)}>
                              Vincular
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setVinculando(undefined)}>
                              <IconX size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {primeiraOcorrenciaSequencia && abatimentoGrupo > 0 && (
                      <tr className="empreitada-card__abatimento-linha">
                        <td colSpan={7}>
                          Entrada diluída abate {formatBRL(abatimentoGrupo)} desta rodada (valor bruto medido: {formatBRL(valorGrupoTotal)})
                        </td>
                      </tr>
                    )}
                    {primeiraOcorrenciaSequencia && descontoManualGrupo > 0 && (
                      <tr className="empreitada-card__abatimento-linha">
                        <td colSpan={7}>
                          Desconto de entrada aplicado nesta parcela: {formatBRL(descontoManualGrupo)} (valor bruto medido: {formatBRL(valorGrupoTotal)})
                        </td>
                      </tr>
                    )}
                    {m.observacoes && (
                      <tr className="empreitada-card__abatimento-linha">
                        <td colSpan={7}>Observação: {m.observacoes}</td>
                      </tr>
                    )}
                    </Fragment>
                  );
                });
              })()}
            </tbody>
          </table>

          <div className="empreitada-card__totais">
            {!!empreitada.valorEntrada && (
              <span>
                <strong>Entrada:</strong> {formatBRL(empreitada.valorEntrada)}
                {lancamentoDaEntrada ? ` (${STATUS_LABEL_LANCAMENTO[lancamentoDaEntrada.status]})` : ' (falta lançar)'}
                {empreitada.entradaDiluicao === 'parcelas' && ` — diluída em ${empreitada.entradaDiluicaoParcelas ?? 1}x`}
              </span>
            )}
            <span><strong>Medido:</strong> {formatBRL(totalMedido)}{valorAMedir > 0 && ` (${percentualContrato.toFixed(0)}% de ${formatBRL(valorAMedir)} a medir)`}</span>
            {totalQuantidadeMedida > 0 && empreitada.unidadeContratada && (
              <span><strong>Quantidade medida:</strong> {totalQuantidadeMedida} {empreitada.unidadeContratada}</span>
            )}
            <span><strong>Pago:</strong> {formatBRL(totalPago)}</span>
            {valorAMedir > 0 && <span><strong>Saldo a medir:</strong> {formatBRL(saldo)}</span>}
            {!!empreitada.retencaoPercentual && (
              <span><strong>Retenção ({empreitada.retencaoPercentual}%):</strong> {formatBRL(totalMedido * empreitada.retencaoPercentual / 100)}</span>
            )}
            {!!empreitada.desconto && (
              <span className="empreitada-card__desconto"><strong>Desconto:</strong> -{formatBRL(empreitada.desconto)}</span>
            )}
          </div>
          {empreitada.observacoes && (
            <p className="empreitada-card__observacoes"><strong>Obs:</strong> {empreitada.observacoes}</p>
          )}
          {(empreitada.anexos ?? []).length > 0 && (
            <div className="empreitada-card__anexos">
              <strong>Anexos:</strong>
              <ul>
                {empreitada.anexos.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => downloadAnexo(a)}>
                      <IconPaperclip size={13} /> {a.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
