import { useEffect, useMemo, useState } from 'react';
import { IconInfoCircle, IconPaperclip, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { FornecedorPicker } from './FornecedorPicker';
import { DynamicListField } from '../obra-detail/DynamicListField';
import { NotaFiscalExtracaoPanel } from './NotaFiscalExtracaoPanel';
import { ProdutosLancamentoField } from './ProdutosLancamentoField';
import { ServicoPicker } from '../materiais/ServicoPicker';
import { mapItensExtraidosParaProdutos, type ItemMaterialConfirmado } from '../../utils/notaFiscal/produtoLancamento';
import type {
  Anexo,
  Atividade,
  CategoriaLancamento,
  DadosPagamento,
  Fornecedor,
  FormaPagamento,
  HistoricoEntry,
  LancamentoFinanceiro,
  Locacao,
  LocacaoItem,
  OrigemHistoricoPreco,
  Pagamento,
  ParcelaLancamento,
  StatusLancamento,
} from '../../types/domain';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useLocacoes } from '../../hooks/useLocacoes';
import { useMateriaisCatalogo } from '../../hooks/useMateriaisCatalogo';
import { useHistoricoPrecos } from '../../hooks/useHistoricoPrecos';
import { generateId } from '../../utils/id';
import { todayISO, formatDate, addDays } from '../../utils/dateUtils';
import { formatBRL } from '../../utils/currency';
import { getCurrentUserName } from '../../utils/currentUser';
import { readFileAsAnexo } from '../../utils/anexoUpload';
import { deleteBlob, downloadAnexo, storeAnexo } from '../../utils/attachmentStore';
import { extractNotaFiscal, type NotaFiscalExtraida } from '../../utils/notaFiscal/extractNotaFiscal';
import './LancamentoFormModal.css';

function origemHistoricoDaConfianca(confianca: NotaFiscalExtraida['confianca'] | undefined): OrigemHistoricoPreco {
  if (confianca === 'alta') return 'nfe_xml';
  if (confianca === 'media') return 'pdf_texto';
  if (confianca === 'baixa') return 'ocr_imagem';
  return 'manual';
}

function extraidaTemSinalUtil(extraida: NotaFiscalExtraida): boolean {
  return !!extraida.fornecedorDocumento || !!extraida.fornecedorNome || !!extraida.data || extraida.valorTotal !== undefined || extraida.itens.length > 0;
}

interface LancamentoPrefill {
  fornecedorId?: string;
  atividadeId?: string;
  descricao?: string;
  categoria?: CategoriaLancamento;
  valorPago?: string;
}

interface DescontoEntradaConfig {
  valorEntrada: number;
  valorBase: number;
}

interface LancamentoFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  lancamento?: LancamentoFinanceiro;
  fornecedores: Fornecedor[];
  atividades: Atividade[];
  onClose: () => void;
  onSaved: () => void;
  prefill?: LancamentoPrefill;
  onCreated?: (lancamento: LancamentoFinanceiro) => void;
  descontoEntrada?: DescontoEntradaConfig;
}

type DescontoEntradaOpcao = 'nenhum' | 'total' | 'metade';

const CATEGORIA_OPTIONS: { value: CategoriaLancamento; label: string }[] = [
  { value: 'sem_categoria', label: 'Sem categoria' },
  { value: 'mao_de_obra', label: 'Mão de obra' },
  { value: 'material', label: 'Material' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'alimentacao', label: 'Alimentação/Marmitas' },
  { value: 'servico', label: 'Serviço' },
  { value: 'taxa', label: 'Taxa' },
  { value: 'empreitada', label: 'Empreitada' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'sondagem', label: 'Sondagem' },
];

const FORMA_PAGAMENTO_OPTIONS: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
];

const STATUS_OPTIONS: { value: StatusLancamento; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'atrasado', label: 'Atrasado' },
];

const STATUS_LABEL: Record<StatusLancamento, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label])) as Record<StatusLancamento, string>;

interface FormState {
  data: string;
  dataVencimento: string;
  fornecedorId: string;
  atividadeId: string;
  descricao: string;
  categoria: CategoriaLancamento;
  valorPrevisto: string;
  naoPrevisto: boolean;
  valorPago: string;
  formaPagamento: FormaPagamento;
  dadosPagamento: DadosPagamento;
  nf: boolean;
  numeroNF: string;
  observacoes: string;
  status: StatusLancamento;
  anexos: Anexo[];
  retroativo: boolean;
  descontoEntradaOpcao: DescontoEntradaOpcao;
  locacaoInicio: string;
  locacaoFim: string;
  locacaoContrato: string;
  locacaoFatura: string;
  locacaoFrete: string;
  locacaoEndereco: string;
  locacaoItens: LocacaoItem[];
  parcelas: ParcelaLancamento[];
}

/** Monta o plano de pagamento: entrada opcional (vence na data base) + N parcelas iguais do
 * restante (a última absorve o resto do arredondamento), com vencimento sugerido a cada 30 dias
 * a partir da entrada (ou da data base, se não houver entrada) — tudo editável depois. */
function gerarPlano(n: number, valorPagoStr: string, temEntrada: boolean, valorEntradaStr: string, dataVencimentoBase: string): ParcelaLancamento[] {
  const total = Number(valorPagoStr) || 0;
  const valorEntrada = temEntrada ? Math.min(Number(valorEntradaStr) || 0, total) : 0;
  const restante = Math.max(0, total - valorEntrada);
  const plano: ParcelaLancamento[] = [];
  if (temEntrada) {
    plano.push({ id: generateId(), numero: 0, ehEntrada: true, valor: valorEntrada, vencimento: dataVencimentoBase, pago: false });
  }
  const valorBase = n > 0 ? Math.floor((restante / n) * 100) / 100 : 0;
  let somaAnteriores = 0;
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? Math.round((restante - somaAnteriores) * 100) / 100 : valorBase;
    somaAnteriores += valor;
    plano.push({ id: generateId(), numero: i + 1, valor, vencimento: addDays(dataVencimentoBase, (temEntrada ? i + 1 : i) * 30), pago: false });
  }
  return plano;
}

/** Reconstrói o ledger de pagamentos a partir do estado atual do plano de parcelas: preserva
 * pagamentos sem vínculo com nenhuma parcela (ex: registros antigos), sincroniza valor/data dos
 * vinculados a parcelas ainda marcadas como pagas (mantendo comprovante, se houver) e remove os
 * que foram desmarcados. */
function reconciliarPagamentos(parcelas: ParcelaLancamento[], existentes: Pagamento[]): Pagamento[] {
  const idsDeParcelas = new Set(parcelas.map((p) => p.pagamentoId).filter((id): id is string => !!id));
  const semVinculo = existentes.filter((pg) => !idsDeParcelas.has(pg.id));
  const dasParcelasPagas = parcelas
    .filter((p) => p.pago && p.pagamentoId)
    .map((p) => {
      const existente = existentes.find((pg) => pg.id === p.pagamentoId);
      return { ...(existente ?? { id: p.pagamentoId! }), data: p.dataPagamento ?? existente?.data ?? todayISO(), valor: p.valor };
    });
  return [...semVinculo, ...dasParcelasPagas];
}

function toFormState(l?: LancamentoFinanceiro, prefill?: LancamentoPrefill, locacaoExistente?: Locacao): FormState {
  return {
    data: l?.data ?? todayISO(),
    dataVencimento: l?.dataVencimento ?? todayISO(),
    fornecedorId: l?.fornecedorId ?? prefill?.fornecedorId ?? '',
    atividadeId: l?.atividadeId ?? prefill?.atividadeId ?? '',
    descricao: l?.descricao ?? prefill?.descricao ?? '',
    categoria: l?.categoria ?? prefill?.categoria ?? 'material',
    valorPrevisto: l ? String(l.valorPrevisto) : '',
    naoPrevisto: l?.naoPrevisto ?? false,
    valorPago: l ? String(l.valorPago) : prefill?.valorPago ?? '',
    formaPagamento: l?.formaPagamento ?? 'pix',
    dadosPagamento: l?.dadosPagamento ?? {},
    nf: l?.nf ?? false,
    numeroNF: l?.numeroNF ?? '',
    observacoes: l?.observacoes ?? '',
    status: l?.status ?? 'pendente',
    anexos: l?.anexos ?? [],
    retroativo: false,
    descontoEntradaOpcao: 'nenhum',
    locacaoInicio: locacaoExistente?.dataInicio ?? todayISO(),
    locacaoFim: locacaoExistente?.dataFim ?? todayISO(),
    locacaoContrato: locacaoExistente?.numeroContrato ?? '',
    locacaoFatura: locacaoExistente?.numeroFatura ?? '',
    locacaoFrete: locacaoExistente ? String(locacaoExistente.valorFrete) : '',
    locacaoEndereco: locacaoExistente?.enderecoObra ?? '',
    locacaoItens: locacaoExistente?.itens ?? [],
    parcelas: l?.parcelas ?? [],
  };
}

function buildHistoricoResumo(antigo: LancamentoFinanceiro, novo: ReturnType<typeof toBase>, fornecedores: Fornecedor[]): string {
  const mudancas: string[] = [];
  const nomeFornecedor = (id?: string) => fornecedores.find((f) => f.id === id)?.nome ?? 'nenhum';

  if (antigo.descricao !== novo.descricao) mudancas.push(`Descrição alterada para "${novo.descricao}"`);
  if (antigo.valorPago !== novo.valorPago) mudancas.push(`Valor a pagar alterado de ${formatBRL(antigo.valorPago)} para ${formatBRL(novo.valorPago)}`);
  if (!!antigo.naoPrevisto !== !!novo.naoPrevisto) mudancas.push(novo.naoPrevisto ? 'Marcado como sem valor previsto' : 'Valor previsto informado');
  else if (antigo.valorPrevisto !== novo.valorPrevisto) mudancas.push(`Valor previsto alterado de ${formatBRL(antigo.valorPrevisto)} para ${formatBRL(novo.valorPrevisto)}`);
  if (antigo.status !== novo.status) mudancas.push(`Status alterado de ${STATUS_LABEL[antigo.status]} para ${STATUS_LABEL[novo.status]}`);
  if (antigo.fornecedorId !== novo.fornecedorId) mudancas.push(`Fornecedor alterado de ${nomeFornecedor(antigo.fornecedorId)} para ${nomeFornecedor(novo.fornecedorId)}`);
  if (antigo.dataVencimento !== novo.dataVencimento) mudancas.push(`Vencimento alterado de ${formatDate(antigo.dataVencimento)} para ${formatDate(novo.dataVencimento)}`);
  if (antigo.anexos.length !== novo.anexos.length) mudancas.push(`Anexos alterados (${antigo.anexos.length} → ${novo.anexos.length})`);
  if ((antigo.observacoes ?? '') !== (novo.observacoes ?? '')) mudancas.push('Observações atualizadas');

  return mudancas.length > 0 ? mudancas.join('; ') : 'Lançamento salvo sem alterações de campos rastreados';
}

function toBase(form: FormState, obraId: string) {
  const proximaParcelaPendente = form.parcelas.length > 0
    ? [...form.parcelas].filter((p) => !p.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0]
    : undefined;

  return {
    obraId,
    data: form.data,
    dataVencimento: proximaParcelaPendente?.vencimento ?? form.dataVencimento,
    fornecedorId: form.fornecedorId || undefined,
    atividadeId: form.atividadeId || undefined,
    descricao: form.descricao,
    categoria: form.categoria,
    valorPrevisto: form.naoPrevisto ? 0 : Number(form.valorPrevisto) || 0,
    naoPrevisto: form.naoPrevisto,
    valorPago: Number(form.valorPago) || 0,
    formaPagamento: form.formaPagamento,
    dadosPagamento: form.dadosPagamento,
    nf: form.nf,
    numeroNF: form.numeroNF || undefined,
    observacoes: form.observacoes || undefined,
    status: form.status,
    anexos: form.anexos,
    parcelas: form.parcelas.length > 0 ? form.parcelas : undefined,
    parcelaTotal: form.parcelas.length > 0 ? form.parcelas.length : undefined,
  };
}

export function LancamentoFormModal({ open, mode, obraId, lancamento, fornecedores, atividades, onClose, onSaved, prefill, onCreated, descontoEntrada }: LancamentoFormModalProps) {
  const { createLancamento, updateLancamento } = useLancamentos(obraId);
  const { locacoes, createLocacao, updateLocacao, deleteLocacao } = useLocacoes(obraId);
  const locacaoExistente = useMemo(
    () => (lancamento ? locacoes.find((loc) => loc.lancamentoId === lancamento.id) : undefined),
    [locacoes, lancamento],
  );
  const [form, setForm] = useState<FormState>(() => toFormState(lancamento, prefill, locacaoExistente));
  const [anexoErro, setAnexoErro] = useState('');
  const { materiais: materiaisCatalogo, createMaterial } = useMateriaisCatalogo();
  const { createHistoricoPreco } = useHistoricoPrecos();
  const [notaFiscalExtraida, setNotaFiscalExtraida] = useState<NotaFiscalExtraida | null>(null);
  const [notaFiscalOrigemAnexoId, setNotaFiscalOrigemAnexoId] = useState<string | undefined>(undefined);
  const [produtos, setProdutos] = useState<ItemMaterialConfirmado[]>([]);

  useEffect(() => {
    if (open) {
      setForm(toFormState(lancamento, prefill, locacaoExistente));
      setAnexoErro('');
      setNotaFiscalExtraida(null);
      setNotaFiscalOrigemAnexoId(undefined);
      setProdutos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lancamento, prefill]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const locacaoValorItens = form.locacaoItens.reduce((s, i) => s + i.valorTotal, 0);
  const locacaoValorTotal = locacaoValorItens + (Number(form.locacaoFrete) || 0);

  function toggleRetroativo(retroativo: boolean) {
    setForm((f) => ({
      ...f,
      retroativo,
      ...(retroativo
        ? { fornecedorId: '', dataVencimento: f.data, naoPrevisto: true, status: 'pago' as StatusLancamento }
        : {}),
    }));
  }

  function updateDadosPagamento<K extends keyof DadosPagamento>(key: K, value: DadosPagamento[K]) {
    setForm((f) => ({ ...f, dadosPagamento: { ...f.dadosPagamento, [key]: value } }));
  }

  function aplicarDescontoEntrada(opcao: DescontoEntradaOpcao) {
    if (!descontoEntrada) return;
    const desconto = opcao === 'total' ? descontoEntrada.valorEntrada : opcao === 'metade' ? descontoEntrada.valorEntrada / 2 : 0;
    const novoValorPago = Math.max(0, descontoEntrada.valorBase - desconto);
    setForm((f) => ({ ...f, descontoEntradaOpcao: opcao, valorPago: String(novoValorPago) }));
  }

  function toggleParcelas(dividir: boolean) {
    setForm((f) => ({ ...f, parcelas: dividir ? gerarPlano(2, f.valorPago, false, '', f.dataVencimento) : [] }));
  }

  function toggleEntrada(temEntrada: boolean) {
    setForm((f) => {
      const n = f.parcelas.filter((p) => !p.ehEntrada).length || 2;
      const valorEntradaStr = temEntrada ? String(Math.round(((Number(f.valorPago) || 0) / 2) * 100) / 100) : '';
      return { ...f, parcelas: gerarPlano(n, f.valorPago, temEntrada, valorEntradaStr, f.dataVencimento) };
    });
  }

  function updateValorEntrada(valorEntradaStr: string) {
    setForm((f) => {
      const n = f.parcelas.filter((p) => !p.ehEntrada).length;
      return { ...f, parcelas: gerarPlano(n, f.valorPago, true, valorEntradaStr, f.dataVencimento) };
    });
  }

  function updateQuantidadeParcelas(n: number) {
    const temEntrada = form.parcelas.some((p) => p.ehEntrada);
    if (!n || n < (temEntrada ? 1 : 2)) return;
    setForm((f) => {
      const entradaAtual = f.parcelas.find((p) => p.ehEntrada);
      return { ...f, parcelas: gerarPlano(n, f.valorPago, !!entradaAtual, entradaAtual ? String(entradaAtual.valor) : '', f.dataVencimento) };
    });
  }

  function updateVencimentoParcela(id: string, vencimento: string) {
    setForm((f) => ({ ...f, parcelas: f.parcelas.map((p) => (p.id === id ? { ...p, vencimento } : p)) }));
  }

  function toggleParcelaPaga(id: string, pago: boolean) {
    setForm((f) => ({
      ...f,
      parcelas: f.parcelas.map((p) =>
        p.id === id
          ? { ...p, pago, dataPagamento: pago ? (p.dataPagamento ?? todayISO()) : p.dataPagamento, pagamentoId: pago ? (p.pagamentoId ?? generateId()) : p.pagamentoId }
          : p,
      ),
    }));
  }

  function updateDataPagamentoParcela(id: string, dataPagamento: string) {
    setForm((f) => ({ ...f, parcelas: f.parcelas.map((p) => (p.id === id ? { ...p, dataPagamento } : p)) }));
  }

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setAnexoErro('');
    Array.from(files).forEach((file) => {
      readFileAsAnexo(file)
        .then((anexo) => {
          extractNotaFiscal(file).then((extraida) => {
            if (extraidaTemSinalUtil(extraida)) {
              setNotaFiscalExtraida(extraida);
              setNotaFiscalOrigemAnexoId(anexo.id);
              if (extraida.categoriaDetectada === 'material' && extraida.itens.length > 0) {
                setProdutos((prev) => (prev.length === 0 ? mapItensExtraidosParaProdutos(extraida.itens, materiaisCatalogo) : prev));
              }
            }
          });
          return storeAnexo(anexo);
        })
        .then((anexo) => setForm((f) => ({ ...f, anexos: [...f.anexos, anexo] })))
        .catch((err: Error) => setAnexoErro(err.message));
    });
    e.target.value = '';
  }

  function removeAnexo(id: string) {
    deleteBlob(id).catch((err) => console.error('Erro ao remover anexo do armazenamento:', err));
    setForm((f) => ({ ...f, anexos: f.anexos.filter((a) => a.id !== id) }));
  }

  function syncLocacao(lancamentoId: string) {
    const now = new Date().toISOString();
    if (form.categoria !== 'aluguel') {
      if (locacaoExistente) deleteLocacao(locacaoExistente.id);
      return;
    }
    const patch = {
      obraId,
      lancamentoId,
      fornecedorId: form.fornecedorId || undefined,
      numeroContrato: form.locacaoContrato || undefined,
      numeroFatura: form.locacaoFatura || undefined,
      dataInicio: form.locacaoInicio,
      dataFim: form.locacaoFim,
      itens: form.locacaoItens,
      valorLocacao: locacaoValorItens,
      valorFrete: Number(form.locacaoFrete) || 0,
      valorTotal: locacaoValorTotal,
      enderecoObra: form.locacaoEndereco || undefined,
    };
    if (locacaoExistente) {
      const historico: HistoricoEntry[] = [...locacaoExistente.historico, { data: now, usuario: getCurrentUserName(), resumo: 'Locação atualizada a partir do lançamento' }];
      updateLocacao(locacaoExistente.id, { ...patch, updatedBy: getCurrentUserName(), historico });
    } else {
      const historico: HistoricoEntry[] = [{ data: now, usuario: getCurrentUserName(), resumo: 'Locação criada a partir do lançamento' }];
      createLocacao({
        id: generateId(),
        createdBy: getCurrentUserName(),
        updatedBy: getCurrentUserName(),
        historico,
        createdAt: now,
        updatedAt: now,
        ...patch,
      });
    }
  }

  /**
   * Alimenta o histórico de preços a partir de um lançamento recém-criado. Serviço sempre
   * gera 1 registro a partir dos próprios campos do lançamento (não depende de extração de
   * nota — o clique em Salvar já é a confirmação). Material só grava se o usuário confirmou
   * os itens no painel de extração (dados vêm da nota, não do lançamento em si).
   */
  async function registrarHistoricoDePrecos(novo: LancamentoFinanceiro, now: string) {
    const origem = origemHistoricoDaConfianca(notaFiscalExtraida?.confianca);
    const dataHistorico = notaFiscalExtraida?.data ?? novo.data;

    if (novo.categoria === 'servico') {
      await createHistoricoPreco({
        id: generateId(),
        tipo: 'servico',
        nome: novo.descricao,
        unidade: 'verba',
        quantidade: 1,
        valorUnitario: novo.valorPago,
        valorTotal: novo.valorPago,
        fornecedorId: novo.fornecedorId,
        fornecedorNomeDetectado: notaFiscalExtraida?.fornecedorNome,
        data: dataHistorico,
        obraId,
        origemLancamentoId: novo.id,
        origemAnexoId: notaFiscalOrigemAnexoId,
        origem,
        createdAt: now,
      });
    }

    if (novo.categoria === 'material' && produtos.length > 0) {
      for (const item of produtos) {
        let materialCatalogId = item.materialCatalogId;
        if (!materialCatalogId) {
          const novoMaterial = {
            id: generateId(),
            nome: item.nome,
            categoria: item.categoriaNovoMaterial || 'Sem categoria',
            unidade: item.unidade,
            custoUnitario: item.valorUnitario,
            createdAt: now,
            updatedAt: now,
          };
          await createMaterial(novoMaterial);
          materialCatalogId = novoMaterial.id;
        }
        await createHistoricoPreco({
          id: generateId(),
          tipo: 'material',
          nome: item.nome,
          materialCatalogId,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          fornecedorId: novo.fornecedorId,
          fornecedorNomeDetectado: notaFiscalExtraida?.fornecedorNome,
          data: dataHistorico,
          obraId,
          origemLancamentoId: novo.id,
          origemAnexoId: notaFiscalOrigemAnexoId,
          origem,
          createdAt: now,
        });
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const base = toBase(form, obraId);
    const baseComPagamentos = form.parcelas.length > 0
      ? { ...base, pagamentos: reconciliarPagamentos(form.parcelas, lancamento?.pagamentos ?? []) }
      : base;

    if (mode === 'create') {
      const historico: HistoricoEntry[] = [{ data: now, usuario: getCurrentUserName(), resumo: 'Lançamento criado' }];
      const novo: LancamentoFinanceiro = {
        id: generateId(),
        createdBy: getCurrentUserName(),
        updatedBy: getCurrentUserName(),
        historico,
        createdAt: now,
        updatedAt: now,
        ...baseComPagamentos,
      };
      createLancamento(novo)
        .then(() => { syncLocacao(novo.id); return registrarHistoricoDePrecos(novo, now); })
        .then(() => { onCreated?.(novo); onSaved(); });
    } else if (lancamento) {
      const resumo = buildHistoricoResumo(lancamento, base, fornecedores);
      const historico: HistoricoEntry[] = [...lancamento.historico, { data: now, usuario: getCurrentUserName(), resumo }];
      updateLancamento(lancamento.id, { ...baseComPagamentos, updatedBy: getCurrentUserName(), historico, updatedAt: now }).then(() => syncLocacao(lancamento.id)).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo lançamento' : 'Editar lançamento'}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="lancamento-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="lancamento-form" className="form-grid" onSubmit={handleSubmit}>
        {mode === 'create' && (
          <div className="form-field form-field--full">
            <label className="lancamento-retroativo-toggle">
              <input type="checkbox" checked={form.retroativo} onChange={(e) => toggleRetroativo(e.target.checked)} />
              Lançamento retroativo (já pago antes de usar o sistema — só para contabilizar)
            </label>
            {form.retroativo && (
              <div className="banner-info">
                <IconInfoCircle size={18} style={{ flexShrink: 0 }} />
                <div>Sem fornecedor e sem data de vencimento — só descrição, etapa, categoria e valor, marcado como já pago.</div>
              </div>
            )}
          </div>
        )}

        <div className="form-field">
          <label>Tipo de lançamento</label>
          <select value={form.categoria} onChange={(e) => update('categoria', e.target.value as CategoriaLancamento)}>
            {CATEGORIA_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="form-field">
          <label>Data</label>
          <input required type="date" value={form.data} disabled={mode === 'create'} onChange={(e) => update('data', e.target.value)} />
          {mode === 'create' && <span className="form-field__hint">Travada no dia de hoje</span>}
        </div>
        {!form.retroativo && (
          <div className="form-field">
            <label>Data de vencimento</label>
            <input required type="date" value={form.dataVencimento} onChange={(e) => update('dataVencimento', e.target.value)} />
          </div>
        )}

        {!form.retroativo && (
          <div className="form-field form-field--full">
            <label>Fornecedor</label>
            <FornecedorPicker fornecedores={fornecedores} value={form.fornecedorId} onChange={(id) => update('fornecedorId', id)} />
          </div>
        )}

        <div className="form-field form-field--full">
          <label>Etapa/Atividade vinculada</label>
          <select value={form.atividadeId} onChange={(e) => update('atividadeId', e.target.value)}>
            <option value="">Nenhuma</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        <div className="form-field form-field--full">
          <label>Descrição</label>
          {form.categoria === 'servico' ? (
            <ServicoPicker
              required
              value={form.descricao}
              onChange={(v) => update('descricao', v)}
              onSelecionarSugestao={(s) => {
                if (!form.valorPago) update('valorPago', String(s.valorUnitario));
                if (!form.fornecedorId && s.fornecedorId) update('fornecedorId', s.fornecedorId);
              }}
            />
          ) : (
            <input required value={form.descricao} onChange={(e) => update('descricao', e.target.value)} />
          )}
        </div>

        <div className="form-field form-field--full">
          <label>Observações (opcional)</label>
          <textarea
            rows={2}
            placeholder="Ex: motivo do desconto, combinado com o empreiteiro, etc."
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
          />
        </div>

        {form.categoria === 'aluguel' && (
          <div className="form-field form-field--full locacao-bloco">
            <label>Locação de Bens Móveis</label>
            <div className="locacao-bloco__grid">
              <div className="form-field">
                <label>Início da locação</label>
                <input required type="date" value={form.locacaoInicio} onChange={(e) => update('locacaoInicio', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Fim da locação</label>
                <input required type="date" value={form.locacaoFim} onChange={(e) => update('locacaoFim', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Nº do contrato</label>
                <input value={form.locacaoContrato} onChange={(e) => update('locacaoContrato', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Fatura(s) de locação</label>
                <input value={form.locacaoFatura} onChange={(e) => update('locacaoFatura', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Frete (R$)</label>
                <input type="number" min={0} step="0.01" value={form.locacaoFrete} onChange={(e) => update('locacaoFrete', e.target.value)} />
              </div>
              <div className="form-field form-field--full">
                <label>Endereço da obra (opcional, se diferente do cliente)</label>
                <input value={form.locacaoEndereco} onChange={(e) => update('locacaoEndereco', e.target.value)} />
              </div>
            </div>

            <DynamicListField<LocacaoItem>
              label="Itens locados"
              items={form.locacaoItens}
              onChange={(itens) => update('locacaoItens', itens)}
              newItem={() => ({ id: generateId(), descricao: '', patrimonio: '', quantidade: 1, valorUnitario: 0, valorTotal: 0 })}
              renderRowFields={(item, upd) => (
                <div className="locacao-item-row">
                  <input placeholder="Descrição (ex: Vibrador de Concreto)" value={item.descricao} onChange={(e) => upd({ descricao: e.target.value })} />
                  <input placeholder="Patrimônio" value={item.patrimonio ?? ''} onChange={(e) => upd({ patrimonio: e.target.value })} />
                  <input
                    type="number" min={0} step="1" placeholder="Qtd"
                    value={item.quantidade}
                    onChange={(e) => {
                      const quantidade = Number(e.target.value);
                      upd({ quantidade, valorTotal: quantidade * item.valorUnitario });
                    }}
                  />
                  <input
                    type="number" min={0} step="0.01" placeholder="Valor unitário"
                    value={item.valorUnitario}
                    onChange={(e) => {
                      const valorUnitario = Number(e.target.value);
                      upd({ valorUnitario, valorTotal: item.quantidade * valorUnitario });
                    }}
                  />
                  <span className="locacao-item-row__valor">{formatBRL(item.valorTotal)}</span>
                </div>
              )}
            />
            <p className="locacao-bloco__total">
              Valor locação: {formatBRL(locacaoValorItens)} + Frete: {formatBRL(Number(form.locacaoFrete) || 0)} = <strong>{formatBRL(locacaoValorTotal)}</strong>
              {locacaoValorTotal > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => update('valorPago', String(locacaoValorTotal))}>
                  Usar este valor no lançamento
                </button>
              )}
            </p>
          </div>
        )}

        {!form.retroativo && (
          <div className="form-field">
            <label>Forma de pagamento</label>
            <select value={form.formaPagamento} onChange={(e) => update('formaPagamento', e.target.value as FormaPagamento)}>
              {FORMA_PAGAMENTO_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        )}

        {!form.retroativo && form.formaPagamento === 'pix' && (
          <div className="form-field form-field--full lancamento-dados-pagamento">
            <label>Dados do PIX</label>
            <div className="lancamento-dados-pagamento__grid">
              <input placeholder="Chave PIX" value={form.dadosPagamento.pixChave ?? ''} onChange={(e) => updateDadosPagamento('pixChave', e.target.value)} />
              <input placeholder="Nome do favorecido" value={form.dadosPagamento.pixFavorecido ?? ''} onChange={(e) => updateDadosPagamento('pixFavorecido', e.target.value)} />
              <input placeholder="Banco" value={form.dadosPagamento.pixBanco ?? ''} onChange={(e) => updateDadosPagamento('pixBanco', e.target.value)} />
            </div>
          </div>
        )}
        {!form.retroativo && form.formaPagamento === 'boleto' && (
          <div className="form-field form-field--full lancamento-dados-pagamento">
            <label>Dados do boleto</label>
            <div className="lancamento-dados-pagamento__grid">
              <input placeholder="Linha digitável" value={form.dadosPagamento.boletoLinhaDigitavel ?? ''} onChange={(e) => updateDadosPagamento('boletoLinhaDigitavel', e.target.value)} />
              <input placeholder="Código de barras" value={form.dadosPagamento.boletoCodigoBarras ?? ''} onChange={(e) => updateDadosPagamento('boletoCodigoBarras', e.target.value)} />
              <input placeholder="Banco emissor" value={form.dadosPagamento.boletoBancoEmissor ?? ''} onChange={(e) => updateDadosPagamento('boletoBancoEmissor', e.target.value)} />
            </div>
          </div>
        )}
        {!form.retroativo && form.formaPagamento === 'transferencia' && (
          <div className="form-field form-field--full lancamento-dados-pagamento">
            <label>Dados da transferência</label>
            <div className="lancamento-dados-pagamento__grid">
              <input placeholder="Banco" value={form.dadosPagamento.transferenciaBanco ?? ''} onChange={(e) => updateDadosPagamento('transferenciaBanco', e.target.value)} />
              <input placeholder="Agência" value={form.dadosPagamento.transferenciaAgencia ?? ''} onChange={(e) => updateDadosPagamento('transferenciaAgencia', e.target.value)} />
              <input placeholder="Conta" value={form.dadosPagamento.transferenciaConta ?? ''} onChange={(e) => updateDadosPagamento('transferenciaConta', e.target.value)} />
              <input placeholder="Tipo de conta" value={form.dadosPagamento.transferenciaTipoConta ?? ''} onChange={(e) => updateDadosPagamento('transferenciaTipoConta', e.target.value)} />
            </div>
          </div>
        )}

        {!form.retroativo && (
          <div className="form-field">
            <div className="lancamento-previsto-header">
              <label>Valor previsto (R$)</label>
              <label className="lancamento-previsto-header__toggle">
                <input type="checkbox" checked={form.naoPrevisto} onChange={(e) => update('naoPrevisto', e.target.checked)} />
                Não previsto
              </label>
            </div>
            {!form.naoPrevisto && (
              <input type="number" min={0} step="0.01" value={form.valorPrevisto} onChange={(e) => update('valorPrevisto', e.target.value)} />
            )}
          </div>
        )}
        {descontoEntrada && descontoEntrada.valorEntrada > 0 && (
          <div className="form-field form-field--full lancamento-desconto-entrada">
            <label>Descontar entrada deste pagamento</label>
            <div className="lancamento-desconto-entrada__opcoes">
              <label>
                <input
                  type="radio"
                  name="descontoEntrada"
                  checked={form.descontoEntradaOpcao === 'nenhum'}
                  onChange={() => aplicarDescontoEntrada('nenhum')}
                />
                Não descontar
              </label>
              <label>
                <input
                  type="radio"
                  name="descontoEntrada"
                  checked={form.descontoEntradaOpcao === 'total'}
                  onChange={() => aplicarDescontoEntrada('total')}
                />
                Valor total da entrada ({formatBRL(descontoEntrada.valorEntrada)})
              </label>
              <label>
                <input
                  type="radio"
                  name="descontoEntrada"
                  checked={form.descontoEntradaOpcao === 'metade'}
                  onChange={() => aplicarDescontoEntrada('metade')}
                />
                Metade da entrada ({formatBRL(descontoEntrada.valorEntrada / 2)})
              </label>
            </div>
            <span className="form-field__hint">Ajusta o valor a pagar abaixo, descontando o que já foi adiantado como entrada.</span>
          </div>
        )}
        <div className="form-field">
          <label>{form.retroativo ? 'Valor pago (R$)' : 'Valor a pagar (R$)'}</label>
          <input type="number" min={0} step="0.01" value={form.valorPago} onChange={(e) => update('valorPago', e.target.value)} />
        </div>

        {!form.retroativo && (
          <div className="form-field form-field--full lancamento-parcelas">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.parcelas.length > 0} onChange={(e) => toggleParcelas(e.target.checked)} style={{ width: 'auto' }} />
              Dividir em parcelas
            </label>
            {form.parcelas.length > 0 && (() => {
              const algumaPaga = form.parcelas.some((p) => p.pago);
              const entrada = form.parcelas.find((p) => p.ehEntrada);
              const parcelasReais = form.parcelas.filter((p) => !p.ehEntrada);
              return (
                <div className="lancamento-parcelas__bloco">
                  <label className="lancamento-parcelas__entrada-toggle">
                    <input
                      type="checkbox"
                      checked={!!entrada}
                      disabled={algumaPaga}
                      onChange={(e) => toggleEntrada(e.target.checked)}
                    />
                    Tem entrada
                  </label>
                  {entrada && (
                    <div className="form-field lancamento-parcelas__qtd">
                      <label>Valor da entrada (R$)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={entrada.valor}
                        disabled={entrada.pago}
                        onChange={(e) => updateValorEntrada(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="form-field lancamento-parcelas__qtd">
                    <label>Quantas parcelas{entrada ? ' (além da entrada)' : ''}?</label>
                    <input
                      type="number"
                      min={entrada ? 1 : 2}
                      value={parcelasReais.length}
                      disabled={algumaPaga}
                      onChange={(e) => updateQuantidadeParcelas(Number(e.target.value))}
                    />
                    {algumaPaga && <span className="form-field__hint">Já tem parcela paga — não dá pra mudar a quantidade ou a entrada.</span>}
                  </div>
                  <div className="lancamento-parcelas__lista">
                    {form.parcelas.map((p) => (
                      <div className="lancamento-parcelas__linha" key={p.id}>
                        <span>{p.ehEntrada ? <strong>Entrada</strong> : `Parcela ${p.numero}`} — {formatBRL(p.valor)}</span>
                        <div className="lancamento-parcelas__linha-controles">
                          <label className="lancamento-parcelas__pago-toggle">
                            <input type="checkbox" checked={p.pago} onChange={(e) => toggleParcelaPaga(p.id, e.target.checked)} />
                            Pago
                          </label>
                          {p.pago ? (
                            <input
                              type="date"
                              value={p.dataPagamento ?? todayISO()}
                              onChange={(e) => updateDataPagamentoParcela(p.id, e.target.value)}
                              title="Data do pagamento"
                            />
                          ) : (
                            <input
                              type="date"
                              value={p.vencimento}
                              onChange={(e) => updateVencimentoParcela(p.id, e.target.value)}
                              title="Data de vencimento"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="form-field">
          <label>Status</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value as StatusLancamento)}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {!form.retroativo && (
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.nf} onChange={(e) => update('nf', e.target.checked)} style={{ width: 'auto' }} />
              Emite NF
            </label>
            {form.nf && (
              <input placeholder="Número da NF" value={form.numeroNF} onChange={(e) => update('numeroNF', e.target.value)} />
            )}
          </div>
        )}

        <div className="form-field form-field--full">
          <label>Anexos (Nota Fiscal, boletos, comprovantes, contratos)</label>
          <label className="btn btn-secondary lancamento-anexo-btn">
            <IconPaperclip size={16} /> Anexar arquivo
            <input type="file" multiple onChange={handleAnexoChange} hidden />
          </label>
          {anexoErro && <p className="lancamento-anexo-erro">{anexoErro}</p>}
          {form.anexos.length > 0 && (
            <ul className="lancamento-anexos-list">
              {form.anexos.map((a) => (
                <li key={a.id}>
                  <button type="button" className="lancamento-anexo-nome" onClick={() => downloadAnexo(a)}>{a.nome}</button>
                  <button type="button" onClick={() => removeAnexo(a.id)} aria-label="Remover anexo">
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notaFiscalExtraida && (
            <NotaFiscalExtracaoPanel
              extraida={notaFiscalExtraida}
              fornecedores={fornecedores}
              materiaisCatalogo={materiaisCatalogo}
              descricaoAtual={form.descricao}
              valorAtual={form.valorPago}
              fornecedorIdAtual={form.fornecedorId}
              numeroNFAtual={form.numeroNF}
              onAplicarDescricao={(valor) => update('descricao', valor)}
              onAplicarValor={(valor) => update('valorPago', String(valor))}
              onSelecionarFornecedor={(fornecedorId) => update('fornecedorId', fornecedorId)}
              onAplicarNumeroNF={(valor) => setForm((f) => ({ ...f, numeroNF: valor, nf: true }))}
              onImportarItens={setProdutos}
              onDispensar={() => setNotaFiscalExtraida(null)}
            />
          )}
          {form.categoria === 'material' && (
            <ProdutosLancamentoField produtos={produtos} onChange={setProdutos} materiaisCatalogo={materiaisCatalogo} />
          )}
        </div>

        {mode === 'edit' && lancamento && lancamento.historico.length > 0 && (
          <div className="form-field form-field--full">
            <label>Histórico</label>
            <ul className="lancamento-historico-list">
              {[...lancamento.historico].reverse().map((h, i) => (
                <li key={i}>
                  <span className="lancamento-historico-data">{formatDate(h.data.slice(0, 10))} — {h.usuario}</span>
                  <span>{h.resumo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
