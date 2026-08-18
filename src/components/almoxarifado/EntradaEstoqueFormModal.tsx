import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import type { EntradaEstoque } from '../../types/domain';
import { generateId } from '../../utils/id';
import { todayISO } from '../../utils/dateUtils';
import { proximoCodigoMaterial } from '../../utils/estoque';

interface EntradaEstoqueFormModalProps {
  open: boolean;
  obraId: string;
  entradas: EntradaEstoque[];
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
}

function vazio(): FormState {
  return { data: todayISO(), material: '', marca: '', quantidade: '', unidade: 'un', medidas: '', fornecedor: '', notaFiscal: '', localizacao: '' };
}

export function EntradaEstoqueFormModal({ open, obraId, entradas, onClose, onCreate }: EntradaEstoqueFormModalProps) {
  const [form, setForm] = useState<FormState>(vazio());

  useEffect(() => {
    if (open) setForm(vazio());
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
