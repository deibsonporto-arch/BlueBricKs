import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Ferramenta, UnidadeMedida } from '../../types/domain';
import { useFerramentas } from '../../hooks/useFerramentas';
import { useFerramentasCatalogo } from '../../hooks/useFerramentasCatalogo';
import { generateId } from '../../utils/id';

interface FerramentaFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  ferramenta?: Ferramenta;
  onClose: () => void;
  onSaved: () => void;
}

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

function toFormState(f?: Ferramenta) {
  return {
    nome: f?.nome ?? '',
    quantidade: f ? String(f.quantidade) : '1',
    unidade: f?.unidade ?? ('un' as UnidadeMedida),
    observacoes: f?.observacoes ?? '',
  };
}

export function FerramentaFormModal({ open, mode, obraId, ferramenta, onClose, onSaved }: FerramentaFormModalProps) {
  const { createFerramenta, updateFerramenta } = useFerramentas(obraId);
  const { catalogo, createItem: createCatalogoItem } = useFerramentasCatalogo();
  const [form, setForm] = useState(() => toFormState(ferramenta));

  useEffect(() => {
    if (open) setForm(toFormState(ferramenta));
  }, [open, ferramenta]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();

    // Padroniza o nome pelo catálogo (evita "Carrinho de mão" numa obra e "Carrinho" em outra);
    // se o nome digitado ainda não existe no catálogo, cadastra ele agora.
    const nomeDigitado = form.nome.trim();
    const existenteNoCatalogo = catalogo.find((c) => c.nome.trim().toLowerCase() === nomeDigitado.toLowerCase());
    const nomeFinal = existenteNoCatalogo?.nome ?? nomeDigitado;
    if (!existenteNoCatalogo && nomeFinal) {
      await createCatalogoItem({ id: generateId(), nome: nomeFinal, createdAt: now, updatedAt: now });
    }

    const base = {
      nome: nomeFinal,
      quantidade: Math.max(0, Number(form.quantidade) || 0),
      unidade: form.unidade,
      observacoes: form.observacoes || undefined,
    };

    if (mode === 'create') {
      createFerramenta({ id: generateId(), obraId, movimentacoes: [], createdAt: now, updatedAt: now, ...base }).then(onSaved);
    } else if (ferramenta) {
      updateFerramenta(ferramenta.id, { ...base, updatedAt: now }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova ferramenta' : 'Editar ferramenta'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="ferramenta-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="ferramenta-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome</label>
          <input
            required
            autoFocus
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
            placeholder="Ex: Carrinho de mão"
            list="ferramentas-nomes-catalogo"
          />
          <datalist id="ferramentas-nomes-catalogo">
            {catalogo.map((c) => <option key={c.id} value={c.nome} />)}
          </datalist>
        </div>
        <div className="form-field">
          <label>Quantidade</label>
          <input required type="number" min={0} step="1" value={form.quantidade} onChange={(e) => update('quantidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Unidade</label>
          <select value={form.unidade} onChange={(e) => update('unidade', e.target.value as UnidadeMedida)}>
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-field form-field--full">
          <label>Observações (opcional)</label>
          <textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} placeholder="Ex: patrimônio, estado de conservação" />
        </div>
      </form>
    </Modal>
  );
}
