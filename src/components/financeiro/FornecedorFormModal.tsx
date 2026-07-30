import { useEffect, useState } from 'react';
import { IconCheck, IconPaperclip } from '@tabler/icons-react';
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
    nomeFantasia: f?.nomeFantasia ?? '',
    documento: f?.documento ?? '',
    tipo: f?.tipo ?? ('PJ' as TipoFornecedor),
    porte: f?.porte ?? '',
    dataAbertura: f?.dataAbertura ?? '',
    contato: f?.contato ?? '',
    telefone: f?.telefone ?? '',
    email: f?.email ?? '',
    logradouro: f?.logradouro ?? '',
    numero: f?.numero ?? '',
    complemento: f?.complemento ?? '',
    bairro: f?.bairro ?? '',
    cep: f?.cep ?? '',
    cidade: f?.cidade ?? '',
    uf: f?.uf ?? '',
    situacaoCadastral: f?.situacaoCadastral ?? '',
    dataSituacaoCadastral: f?.dataSituacaoCadastral ?? '',
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
  const [cartaoCnpjErro, setCartaoCnpjErro] = useState('');
  const [cartaoCnpjAplicado, setCartaoCnpjAplicado] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(fornecedor));
      setCartaoCnpjErro('');
      setCartaoCnpjAplicado(false);
    }
  }, [open, fornecedor]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCartaoCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCartaoCnpjErro('');
    setCartaoCnpjAplicado(false);
    import('../../utils/cnpj/parseCartaoCnpj').then(({ parseCartaoCnpj }) => parseCartaoCnpj(file)).then((extraido) => {
      if (!extraido.nome && !extraido.documento) {
        setCartaoCnpjErro('Não consegui ler os dados desse PDF — confira se é o Comprovante de Inscrição e de Situação Cadastral (cartão CNPJ) e preencha manualmente se precisar.');
        return;
      }
      setForm((f) => ({
        ...f,
        nome: f.nome || extraido.nome || f.nome,
        nomeFantasia: f.nomeFantasia || extraido.nomeFantasia || f.nomeFantasia,
        documento: f.documento || extraido.documento || f.documento,
        tipo: extraido.documento ? 'PJ' : f.tipo,
        porte: f.porte || extraido.porte || f.porte,
        dataAbertura: f.dataAbertura || extraido.dataAbertura || f.dataAbertura,
        telefone: f.telefone || extraido.telefone || f.telefone,
        email: f.email || extraido.email || f.email,
        logradouro: f.logradouro || extraido.logradouro || f.logradouro,
        numero: f.numero || extraido.numero || f.numero,
        complemento: f.complemento || extraido.complemento || f.complemento,
        bairro: f.bairro || extraido.bairro || f.bairro,
        cep: f.cep || extraido.cep || f.cep,
        cidade: f.cidade || extraido.cidade || f.cidade,
        uf: f.uf || extraido.uf || f.uf,
        situacaoCadastral: f.situacaoCadastral || extraido.situacaoCadastral || f.situacaoCadastral,
        dataSituacaoCadastral: f.dataSituacaoCadastral || extraido.dataSituacaoCadastral || f.dataSituacaoCadastral,
      }));
      setCartaoCnpjAplicado(true);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      nome: form.nome,
      nomeFantasia: form.nomeFantasia || undefined,
      documento: form.documento,
      tipo: form.tipo,
      porte: form.porte || undefined,
      dataAbertura: form.dataAbertura || undefined,
      contato: form.contato || undefined,
      telefone: form.telefone || undefined,
      email: form.email || undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cep: form.cep || undefined,
      cidade: form.cidade || undefined,
      uf: form.uf || undefined,
      situacaoCadastral: form.situacaoCadastral || undefined,
      dataSituacaoCadastral: form.dataSituacaoCadastral || undefined,
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
      width={640}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="fornecedor-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="fornecedor-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Cartão CNPJ (opcional)</label>
          <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', cursor: 'pointer' }}>
            <IconPaperclip size={16} /> Anexar PDF do CNPJ pra preencher automático
            <input type="file" accept="application/pdf" onChange={handleCartaoCnpjChange} hidden />
          </label>
          {cartaoCnpjAplicado && (
            <p style={{ color: 'var(--color-success)', fontSize: 13, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheck size={14} /> Dados preenchidos abaixo — confira antes de salvar.
            </p>
          )}
          {cartaoCnpjErro && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '6px 0 0' }}>{cartaoCnpjErro}</p>}
        </div>

        <div className="form-section-title">Identificação</div>
        <div className="form-field form-field--full">
          <label>Nome / Razão social</label>
          <input required value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Nome fantasia</label>
          <input value={form.nomeFantasia} onChange={(e) => update('nomeFantasia', e.target.value)} />
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
          <label>Porte</label>
          <input value={form.porte} onChange={(e) => update('porte', e.target.value)} placeholder="Ex: ME, EPP" />
        </div>
        <div className="form-field">
          <label>Data de abertura</label>
          <input type="date" value={form.dataAbertura} onChange={(e) => update('dataAbertura', e.target.value)} />
        </div>

        <div className="form-section-title">Contato</div>
        <div className="form-field">
          <label>Telefone</label>
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} />
        </div>
        <div className="form-field">
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Contato (nome/observação livre)</label>
          <input value={form.contato} onChange={(e) => update('contato', e.target.value)} />
        </div>

        <div className="form-section-title">Endereço</div>
        <div className="form-field">
          <label>Logradouro</label>
          <input value={form.logradouro} onChange={(e) => update('logradouro', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Número</label>
          <input value={form.numero} onChange={(e) => update('numero', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Complemento</label>
          <input value={form.complemento} onChange={(e) => update('complemento', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Bairro</label>
          <input value={form.bairro} onChange={(e) => update('bairro', e.target.value)} />
        </div>
        <div className="form-field">
          <label>CEP</label>
          <input value={form.cep} onChange={(e) => update('cep', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Cidade</label>
          <input value={form.cidade} onChange={(e) => update('cidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>UF</label>
          <input value={form.uf} onChange={(e) => update('uf', e.target.value)} maxLength={2} style={{ textTransform: 'uppercase' }} />
        </div>

        <div className="form-section-title">Situação cadastral</div>
        <div className="form-field">
          <label>Situação</label>
          <input value={form.situacaoCadastral} onChange={(e) => update('situacaoCadastral', e.target.value)} placeholder="Ex: ATIVA" />
        </div>
        <div className="form-field">
          <label>Data da situação</label>
          <input type="date" value={form.dataSituacaoCadastral} onChange={(e) => update('dataSituacaoCadastral', e.target.value)} />
        </div>

        <div className="form-section-title">Dados bancários</div>
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
