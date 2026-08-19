import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFileInvoice } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { ComposicaoInsumosField } from './ComposicaoInsumosField';
import type { Atividade, Cotacao, Equipamento, ItemInsumoAtividade, MaoDeObra, Material, Obra, Subatividade, TipoInsumoAtividade } from '../../types/domain';
import { useAtividades } from '../../hooks/useAtividades';
import { useListasDeMateriais } from '../../hooks/useListasDeMateriais';
import { useMateriaisCatalogo } from '../../hooks/useMateriaisCatalogo';
import { useCotacoes } from '../../hooks/useCotacoes';
import { useModelosSubatividade } from '../../hooks/useModelosSubatividade';
import { totaisPorTipo } from '../../utils/insumosAtividade';
import { formatBRL } from '../../utils/currency';
import { generateId } from '../../utils/id';
import { getTaskNumber } from '../../utils/subatividades';
import { businessDaysBetween, durationDays, endDateFromDuration, endDateFromDurationUteis, todayISO } from '../../utils/dateUtils';
import { getCurrentUserName } from '../../utils/currentUser';
import { ROUTES } from '../../routes/routes';

interface SubatividadeFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  obra?: Obra; // quando ausente, a busca de composição SINAPI fica oculta
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

export function SubatividadeFormModal({ open, mode, obraId, obra, atividadeId, subatividade, todasAtividades, onClose, onSaved }: SubatividadeFormModalProps) {
  const { createSubatividade, updateSubatividade } = useAtividades(obraId);
  const { listas } = useListasDeMateriais();
  const { materiais: catalogo } = useMateriaisCatalogo();
  const { createCotacao } = useCotacoes(obraId);
  const { modelos, salvarModelo } = useModelosSubatividade();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => toFormState(subatividade));
  const [enviandoCotacao, setEnviandoCotacao] = useState(false);
  const [insumos, setInsumos] = useState<ItemInsumoAtividade[]>(() => subatividade?.insumos ?? []);
  const [buscaModelo, setBuscaModelo] = useState('');

  useEffect(() => {
    if (open) { setForm(toFormState(subatividade)); setInsumos(subatividade?.insumos ?? []); setBuscaModelo(''); }
  }, [open, subatividade]);

  const atividadePai = todasAtividades.find((a) => a.id === atividadeId);
  const temInsumos = insumos.length > 0;
  const totaisInsumos = totaisPorTipo(insumos);

  const modelosFiltrados = (() => {
    const termo = buscaModelo.trim().toLowerCase();
    const base = termo ? modelos.filter((m) => m.nome.toLowerCase().includes(termo)) : modelos;
    if (!atividadePai) return base;
    // modelos salvos a partir da mesma etapa aparecem primeiro
    return [...base].sort((a, b) => {
      const aMatch = a.etapaSugerida === atividadePai.nome ? 0 : 1;
      const bMatch = b.etapaSugerida === atividadePai.nome ? 0 : 1;
      return aMatch - bMatch;
    });
  })();

  function usarModelo(modeloId: string) {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) return;
    setInsumos(modelo.insumos);
    setForm((f) => ({ ...f, nome: f.nome || modelo.nome }));
    setBuscaModelo('');
  }

  function handleSalvarComoModelo() {
    if (!temInsumos) return;
    const nome = prompt('Nome do modelo (ex: "Alvenaria bloco cerâmico 14cm"):', form.nome);
    if (!nome?.trim()) return;
    salvarModelo({
      id: generateId(),
      nome: nome.trim(),
      etapaSugerida: atividadePai?.nome,
      custoMaoDeObra: totaisInsumos.mao_de_obra,
      custoMaterial: totaisInsumos.material,
      custoAluguel: totaisInsumos.aluguel,
      insumos,
      createdAt: new Date().toISOString(),
    });
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function aplicarListaDeMateriais(listaId: string) {
    const lista = listas.find((l) => l.id === listaId);
    if (!lista) return;
    const novosInsumos: ItemInsumoAtividade[] = lista.itens.flatMap((item) => {
      const cat = catalogo.find((m) => m.id === item.materialId);
      if (!cat) return [];
      return [{ id: generateId(), descricao: cat.nome, unidade: cat.unidade, quantidade: item.quantidade, custoUnitario: cat.custoUnitario ?? 0, tipo: 'material' as TipoInsumoAtividade }];
    });
    setInsumos((prev) => [...prev, ...novosInsumos]);
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

  function salvar(): Promise<void> {
    const base = {
      nome: form.nome,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      dependeDe: form.dependeDe,
      diasEsperaAposPredecessora: Number(form.diasEsperaAposPredecessora) || 0,
      dataAutomatica: form.dataAutomatica,
      contagemDias: form.contagemDias,
      custoMaoDeObra: temInsumos ? totaisInsumos.mao_de_obra : (Number(form.custoMaoDeObra) || 0),
      custoMaterial: temInsumos ? totaisInsumos.material : (Number(form.custoMaterial) || 0),
      custoAluguel: temInsumos ? totaisInsumos.aluguel : (Number(form.custoAluguel) || 0),
      materiaisNecessarios: form.materiaisNecessarios,
      maoDeObraNecessaria: form.maoDeObraNecessaria,
      equipamentosAluguel: form.equipamentosAluguel,
      insumos,
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
      return createSubatividade(atividadeId, nova).then(() => undefined);
    } else if (subatividade) {
      return updateSubatividade(atividadeId, subatividade.id, base).then(() => undefined);
    }
    return Promise.resolve();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    salvar().then(onSaved);
  }

  async function enviarInsumosParaCotacao() {
    const materiaisInsumos = insumos.filter((i) => i.tipo === 'material');
    if (materiaisInsumos.length === 0) return;

    setEnviandoCotacao(true);
    try {
      await salvar();
      const now = new Date().toISOString();
      for (const item of materiaisInsumos) {
        const cotacao: Cotacao = {
          id: generateId(),
          obraId,
          atividadeId,
          responsavel: getCurrentUserName(),
          data: todayISO(),
          itemServico: item.descricao,
          descricaoServico: item.sinapiCodigo ? `SINAPI ${item.sinapiCodigo}` : undefined,
          quantidade: item.quantidade,
          unidade: item.unidade as UnidadeMedida,
          valorUnitarioPrevisto: item.custoUnitario,
          fornecedores: [],
          status: 'em_cotacao',
          createdAt: now,
          updatedAt: now,
        };
        await createCotacao(cotacao);
      }
      onSaved();
      navigate(ROUTES.obraMapaCotacao(obraId));
    } finally {
      setEnviandoCotacao(false);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova subatividade' : 'Editar subatividade'}
      onClose={onClose}
      width="96vw"
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

        {modelos.length > 0 && (
          <div className="form-field form-field--full">
            <label>Usar modelo salvo (subatividade + insumos já ajustados antes)</label>
            <input
              value={buscaModelo}
              onChange={(e) => setBuscaModelo(e.target.value)}
              placeholder="Buscar modelo salvo..."
            />
            {buscaModelo && modelosFiltrados.length > 0 && (
              <ul className="atividade-sinapi-resultados">
                {modelosFiltrados.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => usarModelo(m.id)}>
                      <strong>{m.nome}</strong>
                      <span>{m.insumos.length} insumos · {formatBRL(m.custoMaoDeObra + m.custoMaterial + m.custoAluguel)}{m.etapaSugerida ? ` · ${m.etapaSugerida}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {obra && (
          <div className="form-field form-field--full">
            <ComposicaoInsumosField
              uf={obra.endereco.estado || 'GO'}
              etapaNome={atividadePai?.nome}
              insumos={insumos}
              onChangeInsumos={setInsumos}
              onSugerirNome={(nome) => setForm((f) => ({ ...f, nome: f.nome || nome }))}
            />
          </div>
        )}

        {temInsumos ? (
          <div className="form-field form-field--full">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label>Custo (calculado dos insumos acima)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {insumos.some((i) => i.tipo === 'material') && (
                  <button type="button" className="btn btn-secondary" disabled={enviandoCotacao} onClick={enviarInsumosParaCotacao}>
                    <IconFileInvoice size={14} /> {enviandoCotacao ? 'Enviando...' : 'Enviar materiais para Mapa de Cotação'}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={handleSalvarComoModelo}>
                  Salvar como modelo
                </button>
              </div>
            </div>
            <p className="atividade-orcamento-hint">
              Mão de obra {formatBRL(totaisInsumos.mao_de_obra)} · Material {formatBRL(totaisInsumos.material)} · Aluguel {formatBRL(totaisInsumos.aluguel)}
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}

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
              <option value="">Escolher uma lista para adicionar em lote nos insumos...</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.itens.length} itens)</option>)}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}
