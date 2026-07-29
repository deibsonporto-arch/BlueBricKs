import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Fornecedor, TipoFornecedor } from '../../types/domain';
import { useFornecedores } from '../../hooks/useFornecedores';
import { generateFornecedorCodigo, generateId } from '../../utils/id';

interface FornecedorFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  fornecedor?: Fornecedor;
  onClose: () => void;
  onSaved: () => void;
}

const TIPO_OPTIONS: { value: TipoFornecedor; label: string }[] = [
  { value: 'PJ', label: 'PJ' },
  { value: 'PF', label: 'PF' },
  { value: 'Informal', label: 'Informal' },
];

function toFormState(f?: Fornecedor) {
  return {
    nome: f?.nome ?? '',
    documento: f?.documento ?? '',
    tipo: f?.tipo ?? ('PJ' as TipoFornecedor),
    contato: f?.contato ?? '',
    cidade: f?.cidade ?? '',
    banco: f?.banco ?? '',
    agencia: f?.agencia ?? '',
    conta: f?.conta ?? '',
    pix: f?.pix ?? '',
    observacoes: f?.observacoes ?? '',
  };
}

export function FornecedorFormModal({ open, mode, fornecedor, onClose, onSaved }: FornecedorFormModalProps) {
  const { fornecedores, createFornecedor, updateFornecedor } = useFornecedores();
  const [form, setForm] = useState(() => toFormState(fornecedor));

  useEffect(() => {
    if (open) setForm(toFormState(fornecedor));
  }, [open, fornecedor]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      nome: form.nome,
      documento: form.documento,
      tipo: form.tipo,
      contato: form.contato || undefined,
      cidade: form.cidade || undefined,
      banco: form.banco || undefined,
      agencia: form.agencia || undefined,
      conta: form.conta || undefined,
      pix: form.pix || undefined,
      observacoes: form.observacoes || undefined,
    };
    const now = new Date().toISOString();

    if (mode === 'create') {
      const novo: Fornecedor = {
        id: generateId(),
        codigo: generateFornecedorCodigo(fornecedores),
        createdAt: now,
        updatedAt: now,
        ...base,
      };
      createFornecedor(novo).then(onSaved);
    } else if (fornecedor) {
      updateFornecedor(fornecedor.id, { ...base, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Novo fornecedor' : `Editar fornecedor ${fornecedor?.codigo ?? ''}`}
      onClose={onClose}
      width={600}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="fornecedor-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="fornecedor-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome</label>
          <input required value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => update('tipo', e.target.value as TipoFornecedor)}>
            {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>CNPJ ou CPF</label>
          <input value={form.documento} onChange={(e) => update('documento', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Contato</label>
          <input value={form.contato} onChange={(e) => update('contato', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Cidade</label>
          <input value={form.cidade} onChange={(e) => update('cidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>PIX</label>
          <input value={form.pix} onChange={(e) => update('pix', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Banco</label>
          <input value={form.banco} onChange={(e) => update('banco', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Agência</label>
          <input value={form.agencia} onChange={(e) => update('agencia', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Conta</label>
          <input value={form.conta} onChange={(e) => update('conta', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Observações</label>
          <textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
