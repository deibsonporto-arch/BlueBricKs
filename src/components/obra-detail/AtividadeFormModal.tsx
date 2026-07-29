import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Atividade, LancamentoFinanceiro } from '../../types/domain';
import { useAtividades } from '../../hooks/useAtividades';
import { generateId } from '../../utils/id';
import { getDescendantIds } from '../../utils/subatividades';
import { formatBRL } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import './AtividadeFormModal.css';

interface AtividadeFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  obraDataInicio: string;
  atividade?: Atividade;
  todasAtividades: Atividade[];
  lancamentos: LancamentoFinanceiro[];
  onClose: () => void;
  onSaved: () => void;
}

type UnidadeDuracao = 'semanas' | 'dias';

interface FormState {
  nome: string;
  dependeDe: string;
  duracaoValor: string;
  duracaoUnidade: UnidadeDuracao;
  custoMaoDeObra: string;
  custoMaterial: string;
  custoAluguel: string;
}

function toFormState(a?: Atividade): FormState {
  if (!a) return { nome: '', dependeDe: '', duracaoValor: '1', duracaoUnidade: 'semanas', custoMaoDeObra: '', custoMaterial: '', custoAluguel: '' };
  const usaDias = a.duracaoDias != null;
  return {
    nome: a.nome,
    dependeDe: a.dependeDe[0] ?? '',
    duracaoValor: String(usaDias ? a.duracaoDias : (a.duracaoSemanas ?? 1)),
    duracaoUnidade: usaDias ? 'dias' : 'semanas',
    custoMaoDeObra: String(a.custoMaoDeObra),
    custoMaterial: String(a.custoMaterial),
    custoAluguel: String(a.custoAluguel),
  };
}

export function AtividadeFormModal({ open, mode, obraId, obraDataInicio, atividade, todasAtividades, lancamentos, onClose, onSaved }: AtividadeFormModalProps) {
  const { createAtividade, updateAtividade } = useAtividades(obraId);
  const [form, setForm] = useState<FormState>(() => toFormState(atividade));

  useEffect(() => {
    if (open) setForm(toFormState(atividade));
  }, [open, atividade]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleUnidadeDuracaoChange(novaUnidade: UnidadeDuracao) {
    setForm((f) => {
      if (f.duracaoUnidade === novaUnidade) return f;
      const atual = Number(f.duracaoValor) || 1;
      const convertido = novaUnidade === 'dias' ? atual * 7 : Math.max(1, Math.round(atual / 7));
      return { ...f, duracaoUnidade: novaUnidade, duracaoValor: String(convertido) };
    });
  }

  const excludedIds = atividade ? new Set([atividade.id, ...getDescendantIds(atividade.id, todasAtividades)]) : new Set<string>();
  const dependeDeOptions = todasAtividades.filter((a) => !excludedIds.has(a.id));

  const temSubatividades = !!atividade && atividade.subatividades.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();

    const duracaoValorNum = Math.max(1, Number(form.duracaoValor) || 1);
    const duracaoCampos =
      form.duracaoUnidade === 'dias'
        ? { duracaoDias: duracaoValorNum, duracaoSemanas: undefined }
        : { duracaoSemanas: duracaoValorNum, duracaoDias: undefined };
    const custoMaoDeObra = Number(form.custoMaoDeObra) || 0;
    const custoMaterial = Number(form.custoMaterial) || 0;
    const custoAluguel = Number(form.custoAluguel) || 0;

    if (mode === 'create') {
      const nova: Atividade = {
        id: generateId(),
        obraId,
        nome: form.nome,
        etapa: form.nome,
        dependeDe: form.dependeDe ? [form.dependeDe] : [],
        dataInicio: obraDataInicio,
        dataFim: obraDataInicio,
        ...duracaoCampos,
        status: 'pendente',
        concluida: false,
        custoMaoDeObra,
        custoMaterial,
        custoAluguel,
        materiaisNecessarios: [],
        maoDeObraNecessaria: [],
        equipamentosAluguel: [],
        subatividades: [],
        createdAt: now,
        updatedAt: now,
      };
      createAtividade(nova).then(onSaved);
    } else if (atividade) {
      updateAtividade(atividade.id, {
        nome: form.nome,
        etapa: form.nome,
        dependeDe: form.dependeDe ? [form.dependeDe] : [],
        ...duracaoCampos,
        ...(temSubatividades ? {} : { custoMaoDeObra, custoMaterial, custoAluguel }),
        updatedAt: now,
      }).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova atividade' : 'Editar atividade'}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="atividade-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="atividade-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome da atividade</label>
          <input required autoFocus value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>

        <div className="form-field">
          <label>Predecessora</label>
          <select value={form.dependeDe} onChange={(e) => update('dependeDe', e.target.value)}>
            <option value="">Nenhuma</option>
            {dependeDeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Duração</label>
          <div className="atividade-duracao-campo">
            <input type="number" min={1} value={form.duracaoValor} onChange={(e) => update('duracaoValor', e.target.value)} />
            <select value={form.duracaoUnidade} onChange={(e) => handleUnidadeDuracaoChange(e.target.value as UnidadeDuracao)}>
              <option value="semanas">semanas</option>
              <option value="dias">dias</option>
            </select>
          </div>
        </div>

        <div className="form-field form-field--full">
          <label>Orçamento previsto da etapa</label>
          {temSubatividades ? (
            <p className="atividade-orcamento-hint">
              Somado automaticamente das subtarefas — para ajustar, edite as subtarefas individualmente.
            </p>
          ) : (
            <div className="atividade-orcamento-grid">
              <div>
                <span>Mão de obra (R$)</span>
                <input type="number" min={0} step="0.01" value={form.custoMaoDeObra} onChange={(e) => update('custoMaoDeObra', e.target.value)} />
              </div>
              <div>
                <span>Material (R$)</span>
                <input type="number" min={0} step="0.01" value={form.custoMaterial} onChange={(e) => update('custoMaterial', e.target.value)} />
              </div>
              <div>
                <span>Aluguel (R$)</span>
                <input type="number" min={0} step="0.01" value={form.custoAluguel} onChange={(e) => update('custoAluguel', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {mode === 'edit' && atividade && (() => {
          const vinculados = lancamentos.filter((l) => l.atividadeId === atividade.id);
          const previsto = temSubatividades
            ? atividade.custoMaoDeObra + atividade.custoMaterial + atividade.custoAluguel
            : (Number(form.custoMaoDeObra) || 0) + (Number(form.custoMaterial) || 0) + (Number(form.custoAluguel) || 0);
          const pago = vinculados.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
          const saldo = previsto - pago;
          return (
            <div className="form-field form-field--full atividade-financeiro">
              <label>Financeiro</label>
              <div className="atividade-financeiro__grid">
                <div><span>Previsto</span><strong>{formatBRL(previsto)}</strong></div>
                <div><span>Pago</span><strong className="is-success">{formatBRL(pago)}</strong></div>
                <div><span>Saldo</span><strong className={saldo > 0 ? 'is-warning' : ''}>{formatBRL(saldo)}</strong></div>
                <div><span>Lançamentos</span><strong>{vinculados.length}</strong></div>
              </div>
              {vinculados.length > 0 && (
                <ul className="atividade-financeiro__lista">
                  {vinculados.map((l) => (
                    <li key={l.id}>
                      <span>{formatDate(l.data)} — {l.descricao}</span>
                      <span>{formatBRL(l.valorPago || l.valorPrevisto)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </form>
    </Modal>
  );
}
