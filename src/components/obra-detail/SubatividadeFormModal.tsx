import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { DynamicListField } from './DynamicListField';
import type { Atividade, Equipamento, MaoDeObra, Material, Subatividade, UnidadeMedida } from '../../types/domain';
import { useAtividades } from '../../hooks/useAtividades';
import { useListasDeMateriais } from '../../hooks/useListasDeMateriais';
import { useMateriaisCatalogo } from '../../hooks/useMateriaisCatalogo';
import { generateId } from '../../utils/id';
import { getTaskNumber } from '../../utils/subatividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis, todayISO } from '../../utils/dateUtils';

interface SubatividadeFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  atividadeId: string;
  subatividade?: Subatividade;
  todasAtividades: Atividade[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  nome: string;
  dataInicio: string;
  dataFim: string;
  dependeDe: string[];
  diasEsperaAposPredecessora: string;
  dataAutomatica: boolean;
  contagemDias: 'corridos' | 'uteis';
  custoMaoDeObra: string;
  custoMaterial: string;
  custoAluguel: string;
  materiaisNecessarios: Material[];
  maoDeObraNecessaria: MaoDeObra[];
  equipamentosAluguel: Equipamento[];
}

function toFormState(s?: Subatividade): FormState {
  if (!s) {
    return {
      nome: '', dataInicio: todayISO(), dataFim: todayISO(), dependeDe: [],
      diasEsperaAposPredecessora: '0',
      dataAutomatica: true,
      contagemDias: 'uteis',
      custoMaoDeObra: '', custoMaterial: '', custoAluguel: '',
      materiaisNecessarios: [], maoDeObraNecessaria: [], equipamentosAluguel: [],
    };
  }
  return {
    nome: s.nome,
    dataInicio: s.dataInicio,
    dataFim: s.dataFim,
    dependeDe: s.dependeDe,
    diasEsperaAposPredecessora: String(s.diasEsperaAposPredecessora ?? 0),
    dataAutomatica: s.dataAutomatica ?? true,
    contagemDias: s.contagemDias ?? 'uteis',
    custoMaoDeObra: String(s.custoMaoDeObra),
    custoMaterial: String(s.custoMaterial),
    custoAluguel: String(s.custoAluguel),
    materiaisNecessarios: s.materiaisNecessarios,
    maoDeObraNecessaria: s.maoDeObraNecessaria,
    equipamentosAluguel: s.equipamentosAluguel,
  };
}

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç'];

export function SubatividadeFormModal({ open, mode, obraId, atividadeId, subatividade, todasAtividades, onClose, onSaved }: SubatividadeFormModalProps) {
  const { createSubatividade, updateSubatividade } = useAtividades(obraId);
  const { listas } = useListasDeMateriais();
  const { materiais: catalogo } = useMateriaisCatalogo();
  const [form, setForm] = useState<FormState>(() => toFormState(subatividade));

  useEffect(() => {
    if (open) setForm(toFormState(subatividade));
  }, [open, subatividade]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function aplicarListaDeMateriais(listaId: string) {
    const lista = listas.find((l) => l.id === listaId);
    if (!lista) return;
    const novosMateriais: Material[] = lista.itens.flatMap((item) => {
      const cat = catalogo.find((m) => m.id === item.materialId);
      if (!cat) return [];
      return [{ id: generateId(), nome: cat.nome, quantidade: item.quantidade, unidade: cat.unidade, custoUnitario: cat.custoUnitario }];
    });
    setForm((f) => ({ ...f, materiaisNecessarios: [...f.materiaisNecessarios, ...novosMateriais] }));
  }

  const duracaoDias = form.contagemDias === 'uteis' ? businessDaysBetween(form.dataInicio, form.dataFim) : durationDays(form.dataInicio, form.dataFim);

  function handleDuracaoChange(novaDuracao: number) {
    setForm((f) => ({
      ...f,
      dataFim: f.contagemDias === 'uteis' ? endDateFromDurationUteis(f.dataInicio, novaDuracao) : endDateFromDuration(f.dataInicio, novaDuracao),
    }));
  }

  const dataInicioTravada = form.dependeDe.length > 0 && form.dataAutomatica;

  const opcoesPredecessora = [
    ...todasAtividades
      .filter((a) => a.id !== atividadeId)
      .map((a) => ({ id: a.id, label: `${getTaskNumber(todasAtividades, a.id)} — ${a.nome}` })),
    ...todasAtividades.flatMap((a) =>
      a.subatividades
        .filter((s) => s.id !== subatividade?.id)
        .map((s) => ({ id: s.id, label: `${getTaskNumber(todasAtividades, s.id)} — ${s.nome}` })),
    ),
  ];

  const primeiraPredecessora = form.dependeDe[0] ?? '';
  const segundaPredecessora = form.dependeDe[1] ?? '';
  const opcoesSegundaPredecessora = opcoesPredecessora.filter((o) => o.id !== primeiraPredecessora);

  function updatePrimeiraPredecessora(id: string) {
    const nova = segundaPredecessora === id ? '' : segundaPredecessora;
    update('dependeDe', id ? [id, nova].filter(Boolean) : []);
  }

  function updateSegundaPredecessora(id: string) {
    update('dependeDe', [primeiraPredecessora, id].filter(Boolean));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const base = {
      nome: form.nome,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      dependeDe: form.dependeDe,
      diasEsperaAposPredecessora: Number(form.diasEsperaAposPredecessora) || 0,
      dataAutomatica: form.dataAutomatica,
      contagemDias: form.contagemDias,
      custoMaoDeObra: Number(form.custoMaoDeObra) || 0,
      custoMaterial: Number(form.custoMaterial) || 0,
      custoAluguel: Number(form.custoAluguel) || 0,
      materiaisNecessarios: form.materiaisNecessarios,
      maoDeObraNecessaria: form.maoDeObraNecessaria,
      equipamentosAluguel: form.equipamentosAluguel,
    };

    if (mode === 'create') {
      const nova: Subatividade = {
        id: generateId(),
        concluida: false,
        status: 'pendente',
        ordem: Date.now(),
        iniciada: false,
        ...base,
      };
      createSubatividade(atividadeId, nova).then(onSaved);
    } else if (subatividade) {
      updateSubatividade(atividadeId, subatividade.id, base).then(onSaved);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova subatividade' : 'Editar subatividade'}
      onClose={onClose}
      width={960}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="subatividade-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="subatividade-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome da subatividade</label>
          <input required autoFocus value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Data de início</label>
          <input
            required
            type="date"
            value={form.dataInicio}
            disabled={dataInicioTravada}
            title={dataInicioTravada ? 'Calculada automaticamente pela predecessora — desmarque "Data automática" para editar' : undefined}
            onChange={(e) => update('dataInicio', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Duração ({form.contagemDias === 'uteis' ? 'dias úteis' : 'dias corridos'})</label>
          <input type="number" min={0} value={duracaoDias} onChange={(e) => handleDuracaoChange(Number(e.target.value))} />
        </div>
        <div className="form-field">
          <label>Data de fim</label>
          <input required type="date" value={form.dataFim} onChange={(e) => update('dataFim', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Contagem de dias</label>
          <select value={form.contagemDias} onChange={(e) => update('contagemDias', e.target.value as 'corridos' | 'uteis')}>
            <option value="corridos">Dias corridos (conta sábados e domingos)</option>
            <option value="uteis">Dias úteis (pula sábados e domingos)</option>
          </select>
        </div>
        <div className="form-field">
          <label>Predecessora</label>
          <select value={primeiraPredecessora} onChange={(e) => updatePrimeiraPredecessora(e.target.value)}>
            <option value="">Nenhuma</option>
            {opcoesPredecessora.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        {primeiraPredecessora && (
          <div className="form-field">
            <label>2ª predecessora (opcional)</label>
            <select value={segundaPredecessora} onChange={(e) => updateSegundaPredecessora(e.target.value)}>
              <option value="">Nenhuma</option>
              {opcoesSegundaPredecessora.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field">
          <label>Dias de espera após predecessora (cura)</label>
          <input
            type="number"
            min={0}
            value={form.diasEsperaAposPredecessora}
            disabled={form.dependeDe.length === 0}
            onChange={(e) => update('diasEsperaAposPredecessora', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="form-field__checkbox-label">
            <input
              type="checkbox"
              checked={form.dataAutomatica}
              disabled={form.dependeDe.length === 0}
              onChange={(e) => update('dataAutomatica', e.target.checked)}
            />
            {' '}Data automática pela(s) predecessora(s)
          </label>
        </div>

        <div className="form-field">
          <label>Custo mão de obra (R$)</label>
          <input type="number" min={0} step="0.01" value={form.custoMaoDeObra} onChange={(e) => update('custoMaoDeObra', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Custo material (R$)</label>
          <input type="number" min={0} step="0.01" value={form.custoMaterial} onChange={(e) => update('custoMaterial', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Custo aluguel (R$)</label>
          <input type="number" min={0} step="0.01" value={form.custoAluguel} onChange={(e) => update('custoAluguel', e.target.value)} />
        </div>

        {listas.length > 0 && (
          <div className="form-field form-field--full">
            <label>Aplicar lista de materiais</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) aplicarListaDeMateriais(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Escolher uma lista para adicionar em lote...</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.itens.length} itens)</option>)}
            </select>
          </div>
        )}

        <DynamicListField<Material>
          label="Materiais necessários"
          items={form.materiaisNecessarios}
          onChange={(items) => update('materiaisNecessarios', items)}
          newItem={() => ({ id: generateId(), nome: '', quantidade: 1, unidade: 'un' })}
          renderRowFields={(item, upd) => (
            <>
              <input placeholder="Material" value={item.nome} onChange={(e) => upd({ nome: e.target.value })} style={{ flex: 2 }} />
              <input type="number" min={0} placeholder="Qtd" value={item.quantidade} onChange={(e) => upd({ quantidade: Number(e.target.value) })} style={{ width: 70 }} />
              <select value={item.unidade} onChange={(e) => upd({ unidade: e.target.value as UnidadeMedida })} style={{ width: 80 }}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </>
          )}
        />

        <DynamicListField<MaoDeObra>
          label="Mão de obra necessária"
          items={form.maoDeObraNecessaria}
          onChange={(items) => update('maoDeObraNecessaria', items)}
          newItem={() => ({ id: generateId(), tipo: '', quantidadePessoas: 1 })}
          renderRowFields={(item, upd) => (
            <>
              <input placeholder="Tipo (ex: Pedreiro)" value={item.tipo} onChange={(e) => upd({ tipo: e.target.value })} style={{ flex: 2 }} />
              <input type="number" min={0} placeholder="Pessoas" value={item.quantidadePessoas} onChange={(e) => upd({ quantidadePessoas: Number(e.target.value) })} style={{ width: 90 }} />
            </>
          )}
        />

        <DynamicListField<Equipamento>
          label="Equipamentos / aluguel"
          items={form.equipamentosAluguel}
          onChange={(items) => update('equipamentosAluguel', items)}
          newItem={() => ({ id: generateId(), nome: '', dias: 1, valorDia: 0 })}
          renderRowFields={(item, upd) => (
            <>
              <input placeholder="Equipamento" value={item.nome} onChange={(e) => upd({ nome: e.target.value })} style={{ flex: 2 }} />
              <input type="number" min={0} placeholder="Dias" value={item.dias} onChange={(e) => upd({ dias: Number(e.target.value) })} style={{ width: 70 }} />
              <input type="number" min={0} placeholder="R$/dia" value={item.valorDia} onChange={(e) => upd({ valorDia: Number(e.target.value) })} style={{ width: 90 }} />
            </>
          )}
        />
      </form>
    </Modal>
  );
}
