import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { FornecedorPicker } from '../financeiro/FornecedorPicker';
import { DynamicListField } from '../obra-detail/DynamicListField';
import type { Fornecedor, HistoricoEntry, Locacao, LocacaoItem } from '../../types/domain';
import { useLocacoes } from '../../hooks/useLocacoes';
import { generateId } from '../../utils/id';
import { formatBRL } from '../../utils/currency';
import { getCurrentUserName } from '../../utils/currentUser';
import './LocacaoFormModal.css';

interface LocacaoFormModalProps {
  open: boolean;
  locacao: Locacao;
  fornecedores: Fornecedor[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  fornecedorId: string;
  numeroContrato: string;
  numeroFatura: string;
  dataInicio: string;
  dataFim: string;
  valorFrete: string;
  enderecoObra: string;
  itens: LocacaoItem[];
}

function toFormState(l: Locacao): FormState {
  return {
    fornecedorId: l.fornecedorId ?? '',
    numeroContrato: l.numeroContrato ?? '',
    numeroFatura: l.numeroFatura ?? '',
    dataInicio: l.dataInicio,
    dataFim: l.dataFim,
    valorFrete: String(l.valorFrete),
    enderecoObra: l.enderecoObra ?? '',
    itens: l.itens,
  };
}

export function LocacaoFormModal({ open, locacao, fornecedores, onClose, onSaved }: LocacaoFormModalProps) {
  const { updateLocacao } = useLocacoes(locacao.obraId);
  const [form, setForm] = useState<FormState>(() => toFormState(locacao));

  useEffect(() => {
    if (open) setForm(toFormState(locacao));
  }, [open, locacao]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const valorLocacao = form.itens.reduce((s, i) => s + i.valorTotal, 0);
  const valorTotal = valorLocacao + (Number(form.valorFrete) || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const historico: HistoricoEntry[] = [...locacao.historico, { data: now, usuario: getCurrentUserName(), resumo: 'Locação editada' }];
    updateLocacao(locacao.id, {
      fornecedorId: form.fornecedorId || undefined,
      numeroContrato: form.numeroContrato || undefined,
      numeroFatura: form.numeroFatura || undefined,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      valorFrete: Number(form.valorFrete) || 0,
      enderecoObra: form.enderecoObra || undefined,
      itens: form.itens,
      valorLocacao,
      valorTotal,
      updatedBy: getCurrentUserName(),
      historico,
    }).then(onSaved);
  }

  return (
    <Modal
      open={open}
      title="Editar locação"
      onClose={onClose}
      width={760}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="locacao-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="locacao-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Locador</label>
          <FornecedorPicker fornecedores={fornecedores} value={form.fornecedorId} onChange={(id) => update('fornecedorId', id)} />
        </div>
        <div className="form-field">
          <label>Início da locação</label>
          <input required type="date" value={form.dataInicio} onChange={(e) => update('dataInicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Fim da locação</label>
          <input required type="date" value={form.dataFim} onChange={(e) => update('dataFim', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Nº do contrato</label>
          <input value={form.numeroContrato} onChange={(e) => update('numeroContrato', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Fatura(s) de locação</label>
          <input value={form.numeroFatura} onChange={(e) => update('numeroFatura', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Frete (R$)</label>
          <input type="number" min={0} step="0.01" value={form.valorFrete} onChange={(e) => update('valorFrete', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Endereço da obra (opcional)</label>
          <input value={form.enderecoObra} onChange={(e) => update('enderecoObra', e.target.value)} />
        </div>

        <DynamicListField<LocacaoItem>
          label="Itens locados"
          items={form.itens}
          onChange={(itens) => update('itens', itens)}
          newItem={() => ({ id: generateId(), descricao: '', patrimonio: '', quantidade: 1, valorUnitario: 0, valorTotal: 0 })}
          renderRowFields={(item, upd) => (
            <div className="locacao-item-row">
              <input placeholder="Descrição" value={item.descricao} onChange={(e) => upd({ descricao: e.target.value })} />
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
          Valor locação: {formatBRL(valorLocacao)} + Frete: {formatBRL(Number(form.valorFrete) || 0)} = <strong>{formatBRL(valorTotal)}</strong>
        </p>
      </form>
    </Modal>
  );
}
