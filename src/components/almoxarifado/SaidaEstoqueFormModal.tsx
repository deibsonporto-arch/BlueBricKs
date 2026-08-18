import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Atividade, SaidaEstoque } from '../../types/domain';
import type { SaldoMaterial } from '../../utils/estoque';
import { generateId } from '../../utils/id';
import { todayISO } from '../../utils/dateUtils';
import { formatNumberBR } from '../../utils/currency';

export interface SaidaEstoquePrefill {
  codigo?: string;
  atividadeId?: string;
  local?: string;
}

interface SaidaEstoqueFormModalProps {
  open: boolean;
  obraId: string;
  obraNome: string;
  saldos: SaldoMaterial[];
  atividades: Atividade[];
  prefill?: SaidaEstoquePrefill;
  onClose: () => void;
  onCreate: (saida: SaidaEstoque) => void;
}

interface FormState {
  codigo: string;
  data: string;
  quantidade: string;
  responsavel: string;
  atividadeId: string;
  etapaServico: string;
  local: string;
  utilizacaoPara: string;
  observacao: string;
}

function vazio(obraNome: string, prefill?: SaidaEstoquePrefill): FormState {
  return {
    codigo: prefill?.codigo ?? '',
    data: todayISO(),
    quantidade: '',
    responsavel: '',
    atividadeId: prefill?.atividadeId ?? '',
    etapaServico: '',
    local: prefill?.local ?? obraNome,
    utilizacaoPara: '',
    observacao: '',
  };
}

export function SaidaEstoqueFormModal({ open, obraId, obraNome, saldos, atividades, prefill, onClose, onCreate }: SaidaEstoqueFormModalProps) {
  const [form, setForm] = useState<FormState>(() => vazio(obraNome, prefill));
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (open) { setForm(vazio(obraNome, prefill)); setErro(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, obraNome]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErro('');
  }

  const materialSelecionado = saldos.find((s) => s.codigo === form.codigo);
  const quantidade = Number(form.quantidade);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialSelecionado) return setErro('Escolha um material com saldo em estoque.');
    if (!(quantidade > 0)) return setErro('Informe uma quantidade válida.');
    if (quantidade > materialSelecionado.saldo) {
      return setErro(`Saldo insuficiente — disponível: ${formatNumberBR(materialSelecionado.saldo)} ${materialSelecionado.unidade}.`);
    }
    if (!form.responsavel.trim()) return setErro('Informe o responsável pela retirada.');

    const atividade = atividades.find((a) => a.id === form.atividadeId);
    const now = new Date().toISOString();
    onCreate({
      id: generateId(),
      obraId,
      codigo: materialSelecionado.codigo,
      data: form.data,
      material: materialSelecionado.material,
      marca: materialSelecionado.marca,
      quantidade,
      unidade: materialSelecionado.unidade,
      responsavel: form.responsavel.trim(),
      atividadeId: atividade?.id,
      etapaNome: atividade?.nome,
      etapaServico: form.etapaServico.trim() || undefined,
      local: form.local.trim() || obraNome,
      utilizacaoPara: form.utilizacaoPara.trim() || undefined,
      observacao: form.observacao.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <Modal
      open={open}
      title="Registrar saída de material"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="saida-estoque-form" className="btn btn-primary">Salvar saída</button>
        </>
      }
    >
      <form id="saida-estoque-form" className="form-grid" onSubmit={handleSubmit}>
        {erro && <p className="form-field form-field--full" style={{ color: 'var(--color-danger)', margin: 0 }}>{erro}</p>}

        <div className="form-field form-field--full">
          <label>Material</label>
          <select required value={form.codigo} onChange={(e) => update('codigo', e.target.value)}>
            <option value="">Escolher material com saldo em estoque...</option>
            {saldos.filter((s) => s.saldo > 0).map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.material}{s.marca ? ` · ${s.marca}` : ''} — saldo: {formatNumberBR(s.saldo)} {s.unidade}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Data da saída</label>
          <input required type="date" value={form.data} onChange={(e) => update('data', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Quantidade retirada {materialSelecionado ? `(${materialSelecionado.unidade})` : ''}</label>
          <input required type="number" min={0} step="0.01" value={form.quantidade} onChange={(e) => update('quantidade', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Responsável pela retirada</label>
          <input required value={form.responsavel} onChange={(e) => update('responsavel', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Etapa de uso</label>
          <select value={form.atividadeId} onChange={(e) => update('atividadeId', e.target.value)}>
            <option value="">Sem etapa vinculada</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        <div className="form-field">
          <label>Serviço específico (opcional)</label>
          <input value={form.etapaServico} onChange={(e) => update('etapaServico', e.target.value)} placeholder="ex: Alvenaria de Vedação — Nível 01" />
        </div>
        <div className="form-field">
          <label>Local / obra</label>
          <input required value={form.local} onChange={(e) => update('local', e.target.value)} />
        </div>

        <div className="form-field form-field--full">
          <label>Para que foi utilizado</label>
          <input value={form.utilizacaoPara} onChange={(e) => update('utilizacaoPara', e.target.value)} placeholder="ex: Levantamento de paredes internas" />
        </div>
        <div className="form-field form-field--full">
          <label>Observação</label>
          <textarea value={form.observacao} onChange={(e) => update('observacao', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
