import type { Anexo, Empreitada, LancamentoFinanceiro } from '../types/domain';

interface BaseCobranca {
  valor: number;
  quantidade?: number;
  valorUnitario?: number;
}

export interface TotaisEmpreitada {
  valorAMedir: number;
  totalMedido: number;
  totalPago: number;
  saldo: number;
}

/**
 * Quanto da entrada é abatido do valor lançado de cada rodada de medição, quando `entradaDiluicao === 'parcelas'`.
 * Retorna um mapa sequencia -> valor abatido (somando todos os itens medidos naquela rodada).
 * A entrada é consumida em ordem de sequência; se uma rodada não tiver valor suficiente para cobrir
 * a cota, o restante passa para a rodada seguinte, até a entrada ser totalmente absorvida.
 */
export function calcularAbatimentosEntrada(empreitada: Empreitada): Map<number, number> {
  const abatimentos = new Map<number, number>();
  if (empreitada.entradaDiluicao !== 'parcelas' || !empreitada.valorEntrada) return abatimentos;
  const parcelas = Math.max(1, empreitada.entradaDiluicaoParcelas ?? 1);
  const cota = empreitada.valorEntrada / parcelas;

  const porSequencia = new Map<number, number>();
  for (const m of empreitada.medicoes) porSequencia.set(m.sequencia, (porSequencia.get(m.sequencia) ?? 0) + m.valor);
  const sequenciasOrdenadas = [...porSequencia.keys()].sort((a, b) => a - b);

  let restante = empreitada.valorEntrada;
  let pendente = 0;
  for (const seq of sequenciasOrdenadas) {
    if (restante <= 0) break;
    const valorGrupo = porSequencia.get(seq)!;
    const alvo = Math.min(cota + pendente, restante);
    const abatido = Math.min(alvo, valorGrupo);
    if (abatido > 0) abatimentos.set(seq, abatido);
    pendente = alvo - abatido;
    restante -= abatido;
  }
  return abatimentos;
}

/**
 * Quanto da entrada ainda pode ser descontado manualmente (opção "Descontar entrada" ao registrar
 * uma medição), descontando o que já foi aplicado em outras medições. Só faz sentido quando a
 * diluição automática (`entradaDiluicao === 'parcelas'`) não está em uso — os dois mecanismos não se combinam.
 */
export function entradaRestanteParaDesconto(empreitada: Empreitada, excluirMedicaoId?: string): number {
  if (!empreitada.valorEntrada || empreitada.entradaDiluicao === 'parcelas') return 0;
  const jaDescontado = empreitada.medicoes
    .filter((m) => m.id !== excluirMedicaoId)
    .reduce((s, m) => s + (m.descontoEntrada ?? 0), 0);
  return Math.max(0, empreitada.valorEntrada - jaDescontado);
}

export function calcularTotaisEmpreitada(empreitada: Empreitada, lancamentos: LancamentoFinanceiro[]): TotaisEmpreitada {
  const diluida = empreitada.entradaDiluicao === 'parcelas';
  const valorAMedir = empreitada.valorContrato - (diluida ? 0 : (empreitada.valorEntrada ?? 0)) - (empreitada.desconto ?? 0);
  const totalMedido = empreitada.medicoes.reduce((s, m) => s + m.valor, 0);

  const abatimentos = calcularAbatimentosEntrada(empreitada);
  const gruposVistos = new Set<number>();
  let totalPago = 0;
  // a entrada é um pagamento à parte (não vem de uma medição) — soma no total pago se já tiver sido lançada e paga
  if (empreitada.valorEntrada && empreitada.entradaLancamentoId) {
    if (lancamentos.find((l) => l.id === empreitada.entradaLancamentoId)?.status === 'pago') {
      totalPago += empreitada.valorEntrada;
    }
  }
  for (const m of empreitada.medicoes) {
    if (!m.lancamentoId || gruposVistos.has(m.sequencia)) continue;
    gruposVistos.add(m.sequencia);
    if (lancamentos.find((l) => l.id === m.lancamentoId)?.status !== 'pago') continue;
    const medicoesDoGrupo = empreitada.medicoes.filter((x) => x.sequencia === m.sequencia);
    const valorGrupo = medicoesDoGrupo.reduce((s, x) => s + x.valor, 0);
    const descontoManualGrupo = medicoesDoGrupo.reduce((s, x) => s + (x.descontoEntrada ?? 0), 0);
    totalPago += valorGrupo - (abatimentos.get(m.sequencia) ?? 0) - descontoManualGrupo;
  }

  const saldo = valorAMedir - totalMedido;
  return { valorAMedir, totalMedido, totalPago, saldo };
}

/** Comprovante do pagamento mais recente registrado no lançamento (ledger de pagamentos), se houver. */
export function comprovanteDoLancamento(lancamento?: LancamentoFinanceiro): Anexo | undefined {
  const pagamentos = lancamento?.pagamentos ?? [];
  for (let i = pagamentos.length - 1; i >= 0; i--) {
    if (pagamentos[i].comprovante) return pagamentos[i].comprovante;
  }
  return undefined;
}

/** Atividade/etapa de um item do contrato — usa a atividade específica do item, ou a padrão da empreitada. */
export function atividadeIdDoItem(empreitada: Empreitada, itemId?: string): string | undefined {
  const item = itemId ? empreitada.itens.find((i) => i.id === itemId) : undefined;
  return item?.atividadeId || empreitada.atividadeId;
}

/**
 * Rótulo curto do serviço — usa o resumo se houver, senão o próprio texto do serviço (só quando curto).
 * Evita repetir uma descrição de contrato enorme em toda linha de tabela onde só um identificador é necessário
 * (o texto completo já aparece uma vez no cabeçalho da folha de medição).
 */
export function rotuloServicoEmpreitada(empreitada: Empreitada): string {
  if (empreitada.resumo) return empreitada.resumo;
  return empreitada.servico.length > 60 ? 'Serviço' : empreitada.servico;
}

/** Rótulo de exibição de uma medição: se a descrição salva é literalmente o texto completo do serviço
 * (medição sem item vinculado, contrato sem itens), mostra o rótulo curto em vez de repetir tudo. */
export function rotuloExibicaoMedicao(empreitada: Empreitada, medicao: { descricaoServico: string }): string {
  return medicao.descricaoServico === empreitada.servico ? rotuloServicoEmpreitada(empreitada) : medicao.descricaoServico;
}

export function usaCobrancaPorUnidade(base: BaseCobranca): boolean {
  // quantidade contratada é só uma estimativa opcional — o que decide o modo "por unidade" é ter um valor unitário definido
  return !!base.valorUnitario;
}

/**
 * `jaExecutado` é o acumulado até a medição anterior (mesmo item/contrato). O valor retornado é só a
 * diferença a pagar nesta rodada — ex: 25% medido antes + agora 50% informado = paga só os 25% de diferença.
 * `percentualExecutado`/`quantidadeExecutada` retornados continuam sendo o acumulado (o que foi digitado),
 * para a próxima medição comparar contra este valor.
 */
export function calcularMedicao(
  base: BaseCobranca,
  input: { quantidadeExecutada?: number; percentualExecutado?: number },
  jaExecutado: { percentualExecutado?: number; quantidadeExecutada?: number } = {},
): { percentualExecutado: number; valor: number; quantidadeExecutada?: number } {
  if (usaCobrancaPorUnidade(base) && input.quantidadeExecutada != null) {
    const quantidadeExecutada = input.quantidadeExecutada;
    const percentualAnterior = jaExecutado.percentualExecutado ?? 0;
    // a medição anterior pode ter sido registrada em modo % (sem quantidadeExecutada) — nesse caso,
    // converte o % anterior para quantidade equivalente, senão a diferença cobraria de novo o que já foi pago
    const quantidadeAnterior =
      jaExecutado.quantidadeExecutada ?? (base.quantidade ? (percentualAnterior / 100) * base.quantidade : 0);
    const delta = Math.max(0, quantidadeExecutada - quantidadeAnterior);
    const valor = delta * base.valorUnitario!;
    // % sempre calculado a partir do valor (R$), nunca da quantidade — assim continua correto mesmo quando
    // o contrato não tem uma quantidade total contratada informada (só valor unitário), que antes zerava o %
    const percentualExecutado = base.valor > 0 ? percentualAnterior + (valor / base.valor) * 100 : 0;
    return { percentualExecutado, valor, quantidadeExecutada };
  }
  const percentualExecutado = input.percentualExecutado ?? 0;
  const percentualAnterior = jaExecutado.percentualExecutado ?? 0;
  const deltaPercentual = Math.max(0, percentualExecutado - percentualAnterior);
  const valor = base.valor * (deltaPercentual / 100);
  return { percentualExecutado, valor };
}
