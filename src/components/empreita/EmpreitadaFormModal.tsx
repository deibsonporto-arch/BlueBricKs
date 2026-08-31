import { useEffect, useState } from 'react';
import { IconPaperclip, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { FornecedorPicker } from '../financeiro/FornecedorPicker';
import { DynamicListField } from '../obra-detail/DynamicListField';
import type { Anexo, Atividade, Empreitada, EmpreitadaItem, Fornecedor, StatusEmpreitada, UnidadeMedida } from '../../types/domain';
type EntradaDiluicao = 'total' | 'parcelas';
import { useEmpreitadas } from '../../hooks/useEmpreitadas';
import { generateId } from '../../utils/id';
import { formatBRL } from '../../utils/currency';
import { readFileAsAnexo } from '../../utils/anexoUpload';
import { deleteBlob, downloadAnexo, storeAnexo } from '../../utils/attachmentStore';
import './EmpreitadaFormModal.css';

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

interface EmpreitadaFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  empreitada?: Empreitada;
  fornecedores: Fornecedor[];
  atividades: Atividade[];
  onClose: () => void;
  onSaved: () => void;
  itemPrefill?: EmpreitadaItem; // veio de "Enviar para empreita" num insumo de mão de obra — some as etapas/serviços do contrato se ainda não tiver um item com o mesmo origemInsumoId
}

interface FormState {
  fornecedorId: string;
  responsavelTecnico: string;
  servico: string;
  resumo: string;
  atividadeId: string;
  porUnidade: boolean;
  valorContrato: string;
  valorEntrada: string;
  entradaDiluicao: EntradaDiluicao;
  entradaDiluicaoParcelas: string;
  desconto: string;
  observacoes: string;
  quantidadeContratada: string;
  unidadeContratada: UnidadeMedida;
  valorUnitario: string;
  retencaoPercentual: string;
  itens: EmpreitadaItem[];
  status: StatusEmpreitada;
  anexos: Anexo[];
}

function toFormState(e?: Empreitada): FormState {
  return {
    fornecedorId: e?.fornecedorId ?? '',
    responsavelTecnico: e?.responsavelTecnico ?? '',
    servico: e?.servico ?? '',
    resumo: e?.resumo ?? '',
    atividadeId: e?.atividadeId ?? '',
    porUnidade: !!e?.valorUnitario,
    valorContrato: e ? String(e.valorContrato) : '',
    valorEntrada: e?.valorEntrada ? String(e.valorEntrada) : '',
    entradaDiluicao: e?.entradaDiluicao ?? 'total',
    entradaDiluicaoParcelas: e?.entradaDiluicaoParcelas ? String(e.entradaDiluicaoParcelas) : '1',
    desconto: e?.desconto ? String(e.desconto) : '',
    observacoes: e?.observacoes ?? '',
    quantidadeContratada: e?.quantidadeContratada ? String(e.quantidadeContratada) : '',
    unidadeContratada: e?.unidadeContratada ?? 'm',
    valorUnitario: e?.valorUnitario ? String(e.valorUnitario) : '',
    retencaoPercentual: e?.retencaoPercentual ? String(e.retencaoPercentual) : '',
    itens: e?.itens ?? [],
    status: e?.status ?? 'em_andamento',
    anexos: e?.anexos ?? [],
  };
}

export function EmpreitadaFormModal({ open, mode, obraId, empreitada, fornecedores, atividades, onClose, onSaved, itemPrefill }: EmpreitadaFormModalProps) {
  const { createEmpreitada, updateEmpreitada } = useEmpreitadas(obraId);
  const [form, setForm] = useState<FormState>(() => toFormState(empreitada));
  const [anexoErro, setAnexoErro] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = toFormState(empreitada);
    if (itemPrefill && !base.itens.some((i) => i.origemInsumoId && i.origemInsumoId === itemPrefill.origemInsumoId)) {
      base.itens = [...base.itens, itemPrefill];
      if (!base.atividadeId && itemPrefill.atividadeId) base.atividadeId = itemPrefill.atividadeId;
      if (!base.servico.trim()) base.servico = itemPrefill.nome;
    }
    setForm(base);
  }, [open, empreitada, itemPrefill]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setAnexoErro('');
    Array.from(files).forEach((file) => {
      readFileAsAnexo(file)
        .then(storeAnexo)
        .then((anexo) => setForm((f) => ({ ...f, anexos: [...f.anexos, anexo] })))
        .catch((err: Error) => setAnexoErro(err.message));
    });
    e.target.value = '';
  }

  function removeAnexo(id: string) {
    deleteBlob(id).catch((err) => console.error('Erro ao remover anexo do armazenamento:', err));
    setForm((f) => ({ ...f, anexos: f.anexos.filter((a) => a.id !== id) }));
  }

  const quantidadeContratadaNum = Number(form.quantidadeContratada) || 0;
  const valorUnitarioNum = Number(form.valorUnitario) || 0;
  const valorContratoNum = form.porUnidade ? quantidadeContratadaNum * valorUnitarioNum : Number(form.valorContrato) || 0;
  const valorEntradaNum = Number(form.valorEntrada) || 0;
  const descontoNum = Number(form.desconto) || 0;
  const entradaDiluida = valorEntradaNum > 0 && form.entradaDiluicao === 'parcelas';
  const entradaParcelasNum = Math.max(1, Number(form.entradaDiluicaoParcelas) || 1);
  const valorAMedirNum = valorContratoNum - (entradaDiluida ? 0 : valorEntradaNum) - descontoNum;
  const totalItens = form.itens.reduce((s, i) => s + i.valor, 0);
  // medições registradas fora de qualquer item (ex: antes dos itens existirem) já consomem parte do valor a medir —
  // os itens novos só precisam cobrir o que ainda sobra, não o valor a medir do contrato inteiro
  const totalMedidoSemItem = empreitada?.medicoes.filter((m) => !m.itemId).reduce((s, m) => s + m.valor, 0) ?? 0;
  const valorAMedirParaItensNum = Math.max(0, valorAMedirNum - totalMedidoSemItem);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const base = {
      obraId,
      fornecedorId: form.fornecedorId,
      responsavelTecnico: form.responsavelTecnico || undefined,
      servico: form.servico,
      resumo: form.resumo.trim() || undefined,
      atividadeId: form.atividadeId || undefined,
      valorContrato: valorContratoNum,
      valorEntrada: valorEntradaNum > 0 ? valorEntradaNum : undefined,
      entradaDiluicao: valorEntradaNum > 0 ? form.entradaDiluicao : undefined,
      entradaDiluicaoParcelas: entradaDiluida ? entradaParcelasNum : undefined,
      desconto: descontoNum > 0 ? descontoNum : undefined,
      observacoes: form.observacoes.trim() || undefined,
      quantidadeContratada: form.porUnidade && quantidadeContratadaNum > 0 ? quantidadeContratadaNum : undefined,
      unidadeContratada: form.porUnidade ? form.unidadeContratada : undefined,
      valorUnitario: form.porUnidade ? valorUnitarioNum : undefined,
      retencaoPercentual: Number(form.retencaoPercentual) || 0,
      itens: form.itens,
      status: form.status,
      anexos: form.anexos,
    };

    if (mode === 'create') {
      const nova: Empreitada = { id: generateId(), medicoes: [], createdAt: now, updatedAt: now, ...base };
      createEmpreitada(nova).then(onSaved);
    } else if (empreitada) {
      updateEmpreitada(empreitada.id, { ...base, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova empreitada' : 'Editar empreitada'}
      onClose={onClose}
      width={1040}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="empreitada-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="empreitada-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Fornecedor (empresa/empreiteiro)</label>
          <FornecedorPicker fornecedores={fornecedores} value={form.fornecedorId} onChange={(id) => update('fornecedorId', id)} />
        </div>

        <div className="form-field">
          <label>Responsável técnico</label>
          <input value={form.responsavelTecnico} onChange={(e) => update('responsavelTecnico', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Status</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value as StatusEmpreitada)}>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="form-field form-field--full">
          <label>Serviço</label>
          <input required value={form.servico} onChange={(e) => update('servico', e.target.value)} placeholder="Ex: Instalações Hidrossanitárias" />
          <span className="form-field__hint">Pode ser o escopo completo do contrato — se for longo, preencha o resumo abaixo para não pesar a lista.</span>
        </div>
        <div className="form-field form-field--full">
          <label>Resumo curto (aparece na lista, opcional)</label>
          <input value={form.resumo} onChange={(e) => update('resumo', e.target.value)} placeholder="Ex: Pintura total do galpão" />
        </div>
        <div className="form-field form-field--full">
          <label>Etapa/Atividade padrão</label>
          <select value={form.atividadeId} onChange={(e) => update('atividadeId', e.target.value)}>
            <option value="">Nenhuma</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <span className="form-field__hint">
            Usada quando o contrato não é dividido em etapas abaixo. Se o contrato cobrir mais de uma etapa (ex: Estrutura + Cobertura), cadastre cada uma como um item abaixo e escolha a atividade específica de cada um.
          </span>
        </div>

        <div className="form-field form-field--full">
          <label className="empreitada-porunidade-toggle">
            <input type="checkbox" checked={form.porUnidade} onChange={(e) => update('porUnidade', e.target.checked)} />
            Cobrança por unidade (metro, m², etc.)
          </label>
        </div>

        {form.porUnidade ? (
          <>
            <div className="form-field">
              <label>Quantidade contratada (opcional)</label>
              <input type="number" min={0} step="0.01" value={form.quantidadeContratada} onChange={(e) => update('quantidadeContratada', e.target.value)} placeholder="Deixe em branco se ainda não souber" />
              <span className="form-field__hint">Só uma estimativa — o valor de cada medição sempre usa a quantidade informada no dia.</span>
            </div>
            <div className="form-field">
              <label>Unidade</label>
              <select value={form.unidadeContratada} onChange={(e) => update('unidadeContratada', e.target.value as UnidadeMedida)}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Valor unitário (R$)</label>
              <input type="number" min={0} step="0.01" value={form.valorUnitario} onChange={(e) => update('valorUnitario', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Valor de contrato (calculado)</label>
              <p className="empreitada-valor-calculado">
                {quantidadeContratadaNum > 0 ? formatBRL(valorContratoNum) : 'A apurar pelas medições'}
              </p>
            </div>
          </>
        ) : (
          <div className="form-field">
            <label>Valor de contrato (R$)</label>
            <input required type="number" min={0} step="0.01" value={form.valorContrato} onChange={(e) => update('valorContrato', e.target.value)} />
          </div>
        )}
        <div className="form-field">
          <label>Valor de entrada (R$)</label>
          <input type="number" min={0} step="0.01" value={form.valorEntrada} onChange={(e) => update('valorEntrada', e.target.value)} placeholder="0" />
          <span className="form-field__hint">Paga ou a pagar — o vínculo com o pagamento (já feito ou a lançar) fica na tela da empreitada.</span>
        </div>
        <div className="form-field">
          <label>Retenção contratual (%)</label>
          <input type="number" min={0} max={100} step="0.1" value={form.retencaoPercentual} onChange={(e) => update('retencaoPercentual', e.target.value)} />
        </div>
        {valorEntradaNum > 0 && (
          <div className="form-field form-field--full">
            <label>Como abater a entrada</label>
            <div className="empreitada-entrada-diluicao">
              <select value={form.entradaDiluicao} onChange={(e) => update('entradaDiluicao', e.target.value as EntradaDiluicao)}>
                <option value="total">Direto do valor total do contrato (padrão)</option>
                <option value="parcelas">Diluir nas primeiras medições</option>
              </select>
              {form.entradaDiluicao === 'parcelas' && (
                <input
                  type="number" min={1} step="1"
                  value={form.entradaDiluicaoParcelas}
                  onChange={(e) => update('entradaDiluicaoParcelas', e.target.value)}
                  placeholder="Quantas medições"
                />
              )}
            </div>
            <span className="form-field__hint">
              {form.entradaDiluicao === 'total'
                ? `A entrada é descontada de uma vez do contrato — o que sobra (${formatBRL(Math.max(0, valorAMedirNum))}) é medido aos poucos.`
                : `Dividida em ${entradaParcelasNum}x de ${formatBRL(valorEntradaNum / entradaParcelasNum)} — abatida do valor a lançar das primeiras ${entradaParcelasNum === 1 ? 'medição' : 'medições'}, na ordem, até quitar (se faltar valor numa rodada, o restante passa pra próxima).`}
            </span>
          </div>
        )}
        <div className="form-field">
          <label>Desconto (R$)</label>
          <input type="number" min={0} step="0.01" value={form.desconto} onChange={(e) => update('desconto', e.target.value)} placeholder="0" />
          <span className="form-field__hint">Abatido do saldo a medir — ex: material que a empresa acabou não fornecendo.</span>
        </div>
        <div className="form-field form-field--full">
          <label>Observações</label>
          <textarea
            rows={2}
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
            placeholder="Ex: desconto de R$ 75.000 referente às telhas que não fechamos com o empreiteiro"
          />
        </div>

        <div className="form-field form-field--full">
          <label>Anexos (contrato, comprovante de pagamento, etc.)</label>
          <label className="btn btn-secondary empreitada-anexo-btn">
            <IconPaperclip size={16} /> Anexar arquivo
            <input type="file" multiple accept="application/pdf,image/*" onChange={handleAnexoChange} hidden />
          </label>
          {anexoErro && <p className="empreitada-anexo-erro">{anexoErro}</p>}
          {form.anexos.length > 0 && (
            <ul className="empreitada-anexos-list">
              {form.anexos.map((a) => (
                <li key={a.id}>
                  <button type="button" className="empreitada-anexo-nome" onClick={() => downloadAnexo(a)}>{a.nome}</button>
                  <button type="button" onClick={() => removeAnexo(a.id)} aria-label="Remover anexo">
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DynamicListField<EmpreitadaItem>
          label="Etapas/serviços do contrato (opcional — quebra o valor por medição)"
          items={form.itens}
          onChange={(items) => update('itens', items)}
          newItem={() => ({ id: generateId(), nome: '', valor: 0 })}
          renderRowFields={(item, upd) => {
            const itemPorUnidade = item.quantidade != null;
            return (
              <div className="empreitada-item-row">
                <input placeholder="Nome do serviço/etapa" value={item.nome} onChange={(e) => upd({ nome: e.target.value })} />
                {atividades.length > 0 && (
                  <select
                    className="empreitada-item-row__atividade"
                    value={item.atividadeId ?? ''}
                    onChange={(e) => upd({ atividadeId: e.target.value || undefined })}
                  >
                    <option value="">Etapa padrão do contrato</option>
                    {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                )}
                <label className="empreitada-item-row__toggle">
                  <input
                    type="checkbox"
                    checked={itemPorUnidade}
                    onChange={(e) =>
                      e.target.checked
                        ? upd({ quantidade: 0, unidade: 'm', valorUnitario: 0 })
                        : upd({ quantidade: undefined, unidade: undefined, valorUnitario: undefined })
                    }
                  />
                  Por unidade
                </label>
                {itemPorUnidade ? (
                  <>
                    <input
                      type="number" min={0} step="0.01" placeholder="Qtd"
                      value={item.quantidade ?? 0}
                      onChange={(e) => {
                        const quantidade = Number(e.target.value);
                        upd({ quantidade, valor: quantidade * (item.valorUnitario ?? 0) });
                      }}
                    />
                    <select value={item.unidade ?? 'm'} onChange={(e) => upd({ unidade: e.target.value as UnidadeMedida })}>
                      {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input
                      type="number" min={0} step="0.01" placeholder="Valor unitário"
                      value={item.valorUnitario ?? 0}
                      onChange={(e) => {
                        const valorUnitario = Number(e.target.value);
                        upd({ valorUnitario, valor: (item.quantidade ?? 0) * valorUnitario });
                      }}
                    />
                    <span className="empreitada-item-row__valor">{formatBRL(item.valor)}</span>
                  </>
                ) : (
                  <input type="number" min={0} step="0.01" placeholder="Valor (R$)" value={item.valor} onChange={(e) => upd({ valor: Number(e.target.value) })} />
                )}
                <span className="empreitada-item-row__pct">
                  {valorAMedirParaItensNum > 0 ? `${((item.valor / valorAMedirParaItensNum) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            );
          }}
        />
        {form.itens.length > 0 && (
          <p className="empreitada-item-row__total">
            Soma dos itens: {formatBRL(totalItens)}
            {valorAMedirParaItensNum > 0 && Math.abs(totalItens - valorAMedirParaItensNum) > 0.01 && (
              <span className="empreitada-item-row__aviso">
                {' '}(diferente do valor ainda não coberto por medições, de {formatBRL(valorAMedirParaItensNum)}
                {totalMedidoSemItem > 0
                  ? ` — valor a medir do contrato ${formatBRL(valorAMedirNum)} menos ${formatBRL(totalMedidoSemItem)} já medido fora dos itens`
                  : valorEntradaNum > 0
                    ? ` — contrato ${formatBRL(valorContratoNum)} menos entrada ${formatBRL(valorEntradaNum)}`
                    : ''}
                )
              </span>
            )}
          </p>
        )}
      </form>
    </Modal>
  );
}
