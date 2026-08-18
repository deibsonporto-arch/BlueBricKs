import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Atividade, EntradaEstoque } from '../../types/domain';
import { generateId } from '../../utils/id';
import { todayISO } from '../../utils/dateUtils';
import { proximoCodigoMaterial } from '../../utils/estoque';

export interface EntradaEstoquePrefill {
  material?: string;
  unidade?: string;
  quantidade?: number;
  atividadeId?: string;
  subatividadeId?: string;
  requisicaoId?: string;
}

interface EntradaEstoqueFormModalProps {
  open: boolean;
  obraId: string;
  entradas: EntradaEstoque[];
  atividades: Atividade[];
  prefill?: EntradaEstoquePrefill;
  onClose: () => void;
  onCreate: (entrada: EntradaEstoque) => void;
}

interface FormState {
  data: string;
  material: string;
  marca: string;
  quantidade: string;
  unidade: string;
  medidas: string;
  fornecedor: string;
  notaFiscal: string;
  localizacao: string;
  atividadeId: string;
  subatividadeId: string;
}

function vazio(prefill?: EntradaEstoquePrefill): FormState {
  return {
    data: todayISO(),
    material: prefill?.material ?? '',
    marca: '',
    quantidade: prefill?.quantidade ? String(prefill.quantidade) : '',
    unidade: prefill?.unidade ?? 'un',
    medidas: '',
    fornecedor: '',
    notaFiscal: '',
    localizacao: '',
    atividadeId: prefill?.atividadeId ?? '',
    subatividadeId: prefill?.subatividadeId ?? '',
  };
}

export function EntradaEstoqueFormModal({ open, obraId, entradas, atividades, prefill, onClose, onCreate }: EntradaEstoqueFormModalProps) {
  const [form, setForm] = useState<FormState>(() => vazio(prefill));

  useEffect(() => {
    if (open) setForm(vazio(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const materiaisConhecidos = useMemo(() => {
    const vistos = new Map<string, EntradaEstoque>();
    for (const e of entradas) if (!vistos.has(e.material.toLowerCase())) vistos.set(e.material.toLowerCase(), e);
    return [...vistos.values()];
  }, [entradas]);

  const materialExistente = materiaisConhecidos.find((e) => e.material.toLowerCase() === form.material.trim().toLowerCase());

  const atividadeSelecionada = atividades.find((a) => a.id === form.atividadeId);
  const subatividadesDaAtividade = atividadeSelecionada?.subatividades ?? [];

  function aplicarMaterialConhecido(material: string) {
    update('material', material);
    const existente = materiaisConhecidos.find((e) => e.material.toLowerCase() === material.trim().toLowerCase());
    if (existente) {
      setForm((f) => ({ ...f, marca: existente.marca ?? f.marca, unidade: existente.unidade, medidas: existente.medidas ?? f.medidas }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantidade = Number(form.quantidade);
    if (!(quantidade > 0) || !form.material.trim() || !form.fornecedor.trim()) return;

    const codigo = materialExistente?.codigo ?? proximoCodigoMaterial(entradas);
    const atividade = atividades.find((a) => a.id === form.atividadeId);
    const subatividade = atividade?.subatividades.find((s) => s.id === form.subatividadeId);
    const now = new Date().toISOString();
    onCreate({
      id: generateId(),
      obraId,
      data: form.data,
      codigo,
      material: form.material.trim(),
      marca: form.marca.trim() || undefined,
      quantidade,
      unidade: form.unidade.trim() || 'un',
      medidas: form.medidas.trim() || undefined,
      fornecedor: form.fornecedor.trim(),
      notaFiscal: form.notaFiscal.trim() || undefined,
      localizacao: form.localizacao.trim() || undefined,
      atividadeId: atividade?.id,
      subatividadeId: subatividade?.id,
      etapaNome: atividade?.nome,
      subetapaNome: subatividade?.nome,
      requisicaoId: prefill?.requisicaoId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <Modal
      open={open}
      title="Registrar entrada de material"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="entrada-estoque-form" className="btn btn-primary">Salvar entrada</button>
        </>
      }
    >
      <form id="entrada-estoque-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Data de entrada</label>
          <input required type="date" value={form.data} onChange={(e) => update('data', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Material</label>
          <input
            required
            autoFocus
            list="materiais-conhecidos"
            value={form.material}
            onChange={(e) => aplicarMaterialConhecido(e.target.value)}
            placeholder="ex: Bloco Cerâmico Estrutural"
          />
          <datalist id="materiais-conhecidos">
            {materiaisConhecidos.map((m) => <option key={m.codigo} value={m.material} />)}
          </datalist>
          {materialExistente && (
            <span className="form-field__hint">Material já cadastrado ({materialExistente.codigo}) — essa entrada soma ao saldo existente.</span>
          )}
        </div>
        <div className="form-field">
          <label>Marca</label>
          <input value={form.marca} onChange={(e) => update('marca', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Quantidade</label>
          <input required type="number" min={0} step="0.01" value={form.quantidade} onChange={(e) => update('quantidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Unidade de medida</label>
          <input required value={form.unidade} onChange={(e) => update('unidade', e.target.value)} placeholder="UN, m², m³, kg, litro..." />
        </div>
        <div className="form-field">
          <label>Medidas / dimensões</label>
          <input value={form.medidas} onChange={(e) => update('medidas', e.target.value)} placeholder="ex: 14x19x29cm" />
        </div>
        <div className="form-field">
          <label>Etapa</label>
          <select value={form.atividadeId} onChange={(e) => { update('atividadeId', e.target.value); update('subatividadeId', ''); }}>
            <option value="">Sem etapa vinculada</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Subetapa</label>
          <select value={form.subatividadeId} onChange={(e) => update('subatividadeId', e.target.value)} disabled={subatividadesDaAtividade.length === 0}>
            <option value="">{subatividadesDaAtividade.length === 0 ? 'Escolha uma etapa primeiro' : 'Sem subetapa específica'}</option>
            {subatividadesDaAtividade.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Fornecedor</label>
          <input required value={form.fornecedor} onChange={(e) => update('fornecedor', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Número da nota fiscal</label>
          <input value={form.notaFiscal} onChange={(e) => update('notaFiscal', e.target.value)} />
        </div>
        <div className="form-field form-field--full">
          <label>Localização no estoque</label>
          <input value={form.localizacao} onChange={(e) => update('localizacao', e.target.value)} placeholder="ex: Galpão A — Prateleira 3" />
        </div>
      </form>
    </Modal>
  );
}
