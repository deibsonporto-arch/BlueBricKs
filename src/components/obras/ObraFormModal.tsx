import { useEffect, useMemo, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import type { Obra, TipoObra } from '../../types/domain';
import { useObras } from '../../hooks/useObras';
import { useTemplates } from '../../hooks/useTemplates';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { atividadeRepository } from '../../data/repositories/atividadeRepository';
import { generateId, generateObraCodigo } from '../../utils/id';

interface ObraFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: Obra;
  onClose: () => void;
  onSaved: () => void;
}

const TIPO_OPTIONS: { value: TipoObra; label: string }[] = [
  { value: 'casa', label: 'Casa' },
  { value: 'galpao', label: 'Galpão' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'comercial', label: 'Comercial' },
];

interface FormState {
  nome: string;
  tipo: TipoObra;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  responsavelTecnico: string;
  dataInicio: string;
  previsaoEntrega: string;
  orcamentoTotal: string;
  contratoAssinado: string;
  descricao: string;
}

function toFormState(obra?: Obra): FormState {
  if (!obra) {
    return {
      nome: '', tipo: 'casa', logradouro: '', numero: '', bairro: '', cidade: '', estado: '',
      cep: '', responsavelTecnico: '', dataInicio: '', previsaoEntrega: '', orcamentoTotal: '',
      contratoAssinado: '', descricao: '',
    };
  }
  return {
    nome: obra.nome,
    tipo: obra.tipo,
    logradouro: obra.endereco.logradouro,
    numero: obra.endereco.numero ?? '',
    bairro: obra.endereco.bairro ?? '',
    cidade: obra.endereco.cidade,
    estado: obra.endereco.estado,
    cep: obra.endereco.cep ?? '',
    responsavelTecnico: obra.responsavelTecnico,
    dataInicio: obra.dataInicio,
    previsaoEntrega: obra.previsaoEntrega,
    orcamentoTotal: String(obra.orcamentoTotal),
    contratoAssinado: obra.contratoAssinado ? String(obra.contratoAssinado) : '',
    descricao: obra.descricao ?? '',
  };
}

export function ObraFormModal({ open, mode, initialValue, onClose, onSaved }: ObraFormModalProps) {
  const { obras, createObra, updateObra } = useObras();
  const { getTemplateByTipo, applyTemplateToNewObra } = useTemplates();
  const { nomeEmpresa, setNomeEmpresa } = useEmpresaConfig();
  const [form, setForm] = useState<FormState>(() => toFormState(initialValue));
  const [applyTemplate, setApplyTemplate] = useState(false);

  const newObraId = useMemo(() => generateId(), [open]);

  useEffect(() => {
    if (open) {
      setForm(toFormState(initialValue));
      setApplyTemplate(false);
    }
  }, [open, initialValue]);

  const template = mode === 'create' ? getTemplateByTipo(form.tipo) : undefined;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const orcamentoTotal = Number(form.orcamentoTotal) || 0;

    if (mode === 'create') {
      const obra: Obra = {
        id: newObraId,
        codigo: generateObraCodigo(obras),
        nome: form.nome,
        tipo: form.tipo,
        endereco: {
          logradouro: form.logradouro,
          numero: form.numero || undefined,
          bairro: form.bairro || undefined,
          cidade: form.cidade,
          estado: form.estado,
          cep: form.cep || undefined,
        },
        responsavelTecnico: form.responsavelTecnico,
        dataInicio: form.dataInicio,
        previsaoEntrega: form.previsaoEntrega,
        orcamentoTotal: applyTemplate && template ? template.orcamentoBase : orcamentoTotal,
        contratoAssinado: form.contratoAssinado ? Number(form.contratoAssinado) : undefined,
        descricao: form.descricao || undefined,
        status: 'nao_iniciada',
        gastoReal: 0,
        colaboradoresAtivos: 0,
        progressoFisico: 0,
        templateOrigemId: applyTemplate && template ? template.id : undefined,
        createdAt: now,
        updatedAt: now,
      };
      createObra(obra).then(() => {
        if (applyTemplate && template) {
          applyTemplateToNewObra(template, newObraId, form.dataInicio).forEach((atividade) =>
            atividadeRepository.create(atividade),
          );
        }
        onSaved();
      });
    } else if (initialValue) {
      updateObra(initialValue.id, {
        nome: form.nome,
        tipo: form.tipo,
        endereco: {
          logradouro: form.logradouro,
          numero: form.numero || undefined,
          bairro: form.bairro || undefined,
          cidade: form.cidade,
          estado: form.estado,
          cep: form.cep || undefined,
        },
        responsavelTecnico: form.responsavelTecnico,
        dataInicio: form.dataInicio,
        previsaoEntrega: form.previsaoEntrega,
        orcamentoTotal,
        contratoAssinado: form.contratoAssinado ? Number(form.contratoAssinado) : undefined,
        descricao: form.descricao || undefined,
        updatedAt: now,
      }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova obra' : 'Editar obra'}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="obra-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="obra-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome da obra</label>
          <input required value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>

        <div className="form-field form-field--full">
          <label>Nome da empresa</label>
          <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Sua empresa/construtora" />
          <span className="form-field__hint">Aparece no cabeçalho dos relatórios impressos (Financeiro, PMO, Diário, Cotações) de todas as obras.</span>
        </div>

        <div className="form-field">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => update('tipo', e.target.value as TipoObra)}>
            {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Responsável técnico</label>
          <input required value={form.responsavelTecnico} onChange={(e) => update('responsavelTecnico', e.target.value)} />
        </div>

        {mode === 'create' && template && (
          <div className="form-field--full">
            <div className="banner-info">
              <IconInfoCircle size={18} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                Template encontrado para <strong>{TIPO_OPTIONS.find((t) => t.value === form.tipo)?.label}</strong> ("{template.nome}") —
                pré-preencher etapas e orçamento base?
              </div>
              <button
                type="button"
                className={`btn ${applyTemplate ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setApplyTemplate((v) => !v)}
              >
                {applyTemplate ? 'Aplicado' : 'Pré-preencher'}
              </button>
            </div>
          </div>
        )}

        <div className="form-field form-field--full">
          <label>Endereço — logradouro</label>
          <input required value={form.logradouro} onChange={(e) => update('logradouro', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Número</label>
          <input value={form.numero} onChange={(e) => update('numero', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Bairro</label>
          <input value={form.bairro} onChange={(e) => update('bairro', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Cidade</label>
          <input required value={form.cidade} onChange={(e) => update('cidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Estado</label>
          <input required maxLength={2} value={form.estado} onChange={(e) => update('estado', e.target.value.toUpperCase())} />
        </div>
        <div className="form-field">
          <label>CEP</label>
          <input value={form.cep} onChange={(e) => update('cep', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Data de início</label>
          <input required type="date" value={form.dataInicio} onChange={(e) => update('dataInicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Previsão de entrega</label>
          <input required type="date" value={form.previsaoEntrega} onChange={(e) => update('previsaoEntrega', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Orçamento total (R$)</label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            disabled={mode === 'create' && applyTemplate}
            value={applyTemplate && template ? template.orcamentoBase : form.orcamentoTotal}
            onChange={(e) => update('orcamentoTotal', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Contrato assinado (R$)</label>
          <input type="number" min={0} step="0.01" value={form.contratoAssinado} onChange={(e) => update('contratoAssinado', e.target.value)} />
        </div>

        <div className="form-field form-field--full">
          <label>Descrição</label>
          <textarea value={form.descricao} onChange={(e) => update('descricao', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
