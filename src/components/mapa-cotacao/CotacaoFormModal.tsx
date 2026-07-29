import { useEffect, useState } from 'react';
import { IconInfoCircle, IconPaperclip, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import { DynamicListField } from '../obra-detail/DynamicListField';
import { ServicoPicker } from '../materiais/ServicoPicker';
import type { Anexo, Atividade, Cotacao, FornecedorCotacao, TipoFornecedorCotacao, UnidadeMedida } from '../../types/domain';
import { useCotacoes } from '../../hooks/useCotacoes';
import { generateId } from '../../utils/id';
import { todayISO } from '../../utils/dateUtils';
import { readFileAsAnexo } from '../../utils/anexoUpload';
import { deleteBlob, downloadAnexo, storeAnexo } from '../../utils/attachmentStore';
import { getCurrentUserName } from '../../utils/currentUser';
import { extractNotaFiscal } from '../../utils/notaFiscal/extractNotaFiscal';
import './CotacaoFormModal.css';

interface CotacaoFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  obraId: string;
  atividades: Atividade[];
  cotacao?: Cotacao;
  duplicarDe?: Cotacao;
  defaultAtividadeId?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  atividadeId: string;
  responsavel: string;
  data: string;
  itemServico: string;
  descricaoServico: string;
  quantidade: string;
  unidade: UnidadeMedida;
  valorUnitarioPrevisto: string;
  naoPrevisto: boolean;
  servicosNaoInclusos: string;
  condicoesPagamentoGerais: string;
  melhorOpcaoObservacao: string;
  observacoesGerais: string;
  fornecedores: FornecedorCotacao[];
  melhorFornecedorId: string;
}

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

function estadoInicial(cotacao?: Cotacao, defaultAtividadeId?: string, duplicarDe?: Cotacao): FormState {
  if (!cotacao && duplicarDe) {
    const fornecedoresDuplicados = duplicarDe.fornecedores.map((f) => ({ ...f, id: generateId(), orcamentoAnexo: undefined }));
    const melhorOriginal = duplicarDe.fornecedores.findIndex((f) => f.id === duplicarDe.melhorFornecedorId);
    return {
      atividadeId: duplicarDe.atividadeId ?? defaultAtividadeId ?? '',
      responsavel: duplicarDe.responsavel,
      data: todayISO(),
      itemServico: duplicarDe.itemServico,
      descricaoServico: duplicarDe.descricaoServico ?? '',
      quantidade: String(duplicarDe.quantidade),
      unidade: duplicarDe.unidade,
      valorUnitarioPrevisto: duplicarDe.naoPrevisto ? '' : String(duplicarDe.valorUnitarioPrevisto),
      naoPrevisto: duplicarDe.naoPrevisto ?? false,
      servicosNaoInclusos: duplicarDe.servicosNaoInclusos ?? '',
      condicoesPagamentoGerais: duplicarDe.condicoesPagamentoGerais ?? '',
      melhorOpcaoObservacao: duplicarDe.melhorOpcaoObservacao ?? '',
      observacoesGerais: duplicarDe.observacoesGerais ?? '',
      fornecedores: fornecedoresDuplicados,
      melhorFornecedorId: melhorOriginal >= 0 ? fornecedoresDuplicados[melhorOriginal].id : '',
    };
  }
  if (!cotacao) {
    return {
      atividadeId: defaultAtividadeId ?? '',
      responsavel: '',
      data: todayISO(),
      itemServico: '',
      descricaoServico: '',
      quantidade: '1',
      unidade: 'verba',
      valorUnitarioPrevisto: '',
      naoPrevisto: false,
      servicosNaoInclusos: '',
      condicoesPagamentoGerais: '',
      melhorOpcaoObservacao: '',
      observacoesGerais: '',
      fornecedores: [],
      melhorFornecedorId: '',
    };
  }
  return {
    atividadeId: cotacao.atividadeId ?? '',
    responsavel: cotacao.responsavel,
    data: cotacao.data,
    itemServico: cotacao.itemServico,
    descricaoServico: cotacao.descricaoServico ?? '',
    quantidade: String(cotacao.quantidade),
    unidade: cotacao.unidade,
    valorUnitarioPrevisto: cotacao.naoPrevisto ? '' : String(cotacao.valorUnitarioPrevisto),
    naoPrevisto: cotacao.naoPrevisto ?? false,
    servicosNaoInclusos: cotacao.servicosNaoInclusos ?? '',
    condicoesPagamentoGerais: cotacao.condicoesPagamentoGerais ?? '',
    melhorOpcaoObservacao: cotacao.melhorOpcaoObservacao ?? '',
    observacoesGerais: cotacao.observacoesGerais ?? '',
    fornecedores: cotacao.fornecedores,
    melhorFornecedorId: cotacao.melhorFornecedorId ?? '',
  };
}

export function CotacaoFormModal({ open, mode, obraId, atividades, cotacao, duplicarDe, defaultAtividadeId, onClose, onSaved }: CotacaoFormModalProps) {
  const { createCotacao, updateCotacao } = useCotacoes(obraId);
  const [form, setForm] = useState<FormState>(() => estadoInicial(cotacao, defaultAtividadeId, duplicarDe));
  const [anexoErro, setAnexoErro] = useState('');
  const [salvarErro, setSalvarErro] = useState('');

  useEffect(() => {
    if (open) { setForm(estadoInicial(cotacao, defaultAtividadeId, duplicarDe)); setAnexoErro(''); setSalvarErro(''); }
  }, [open, cotacao, defaultAtividadeId, duplicarDe]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOrcamentoChange(e: React.ChangeEvent<HTMLInputElement>, item: FornecedorCotacao, upd: (patch: Partial<FornecedorCotacao>) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnexoErro('');
    readFileAsAnexo(file)
      .then((anexo) => {
        // Preenche só os campos vazios dessa linha a partir do orçamento anexado — o usuário confirma tudo normalmente ao salvar a cotação.
        extractNotaFiscal(file).then((extraida) => {
          const patch: Partial<FornecedorCotacao> = {};
          if (!item.nome && extraida.fornecedorNome) patch.nome = extraida.fornecedorNome;
          if (!item.documento && extraida.fornecedorDocumento) patch.documento = extraida.fornecedorDocumento;
          if (!item.valor && extraida.valorTotal !== undefined) patch.valor = extraida.valorTotal;
          if (Object.keys(patch).length > 0) upd(patch);
        });
        return storeAnexo(anexo);
      })
      .then((anexo: Anexo) => upd({ orcamentoAnexo: anexo }))
      .catch((err: Error) => setAnexoErro(err.message));
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvarErro('');
    const now = new Date().toISOString();
    const base = {
      obraId,
      atividadeId: form.atividadeId || undefined,
      responsavel: form.responsavel,
      data: form.data,
      itemServico: form.itemServico,
      descricaoServico: form.descricaoServico || undefined,
      quantidade: Number(form.quantidade) || 0,
      unidade: form.unidade,
      valorUnitarioPrevisto: form.naoPrevisto ? 0 : Number(form.valorUnitarioPrevisto) || 0,
      naoPrevisto: form.naoPrevisto,
      servicosNaoInclusos: form.servicosNaoInclusos || undefined,
      condicoesPagamentoGerais: form.condicoesPagamentoGerais || undefined,
      melhorOpcaoObservacao: form.melhorOpcaoObservacao || undefined,
      observacoesGerais: form.observacoesGerais || undefined,
      fornecedores: form.fornecedores,
      melhorFornecedorId: form.fornecedores.some((f) => f.id === form.melhorFornecedorId) ? form.melhorFornecedorId : undefined,
    };

    const erroArmazenamento = 'Não foi possível salvar — o armazenamento local do navegador está cheio. Remova anexos de orçamento antigos (desta ou de outras cotações) e tente novamente.';

    if (mode === 'create') {
      const nova: Cotacao = {
        id: generateId(),
        status: 'em_cotacao',
        historico: [{
          data: now,
          usuario: getCurrentUserName(),
          resumo: duplicarDe ? `Duplicada a partir de "${duplicarDe.itemServico}"` : 'Cotação criada',
        }],
        createdAt: now,
        updatedAt: now,
        ...base,
      };
      createCotacao(nova).then(onSaved).catch((err) => {
        console.error('Erro ao criar cotação:', err);
        setSalvarErro(erroArmazenamento);
      });
    } else if (cotacao) {
      updateCotacao(cotacao.id, { ...base, updatedAt: now }).then(onSaved).catch((err) => {
        console.error('Erro ao salvar cotação:', err);
        setSalvarErro(erroArmazenamento);
      });
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova cotação' : 'Editar cotação'}
      onClose={onClose}
      width={1200}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="cotacao-form" className="btn btn-primary">Salvar</button>
        </>
      }
    >
      <form id="cotacao-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <div className="banner-info">
            <IconInfoCircle size={18} style={{ flexShrink: 0 }} />
            <div>Vincular a cotação a uma atividade ajuda a rastrear o item na Próxima Semana e no Diário de Obra.</div>
          </div>
        </div>
        <div className="form-field form-field--full">
          <label>Atividade vinculada</label>
          <select value={form.atividadeId} onChange={(e) => update('atividadeId', e.target.value)}>
            <option value="">Nenhuma</option>
            {atividades.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Responsável</label>
          <input required value={form.responsavel} onChange={(e) => update('responsavel', e.target.value)} placeholder="Quem está fazendo a cotação" />
        </div>
        <div className="form-field">
          <label>Data</label>
          <input required type="date" value={form.data} onChange={(e) => update('data', e.target.value)} />
        </div>

        <div className="form-field form-field--full">
          <label>Item / serviço</label>
          <ServicoPicker
            required
            value={form.itemServico}
            onChange={(v) => update('itemServico', v)}
            onSelecionarSugestao={(s) => {
              if (!form.naoPrevisto && !form.valorUnitarioPrevisto) update('valorUnitarioPrevisto', String(s.valorUnitario));
              if (s.unidade) update('unidade', s.unidade);
            }}
            placeholder="Ex: Pintura Interna e Externa"
          />
        </div>
        <div className="form-field form-field--full">
          <label>Descrição dos serviços orçados para execução na obra</label>
          <textarea value={form.descricaoServico} onChange={(e) => update('descricaoServico', e.target.value)} placeholder="Detalhe o escopo do que está sendo cotado, item a item" style={{ minHeight: 110 }} />
        </div>

        <div className="form-field form-field--full">
          <label>Orçamento previsto</label>
        </div>
        <div className="form-field">
          <label>Quantidade</label>
          <input type="number" min={0} step="0.01" value={form.quantidade} onChange={(e) => update('quantidade', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Unidade</label>
          <select value={form.unidade} onChange={(e) => update('unidade', e.target.value as UnidadeMedida)}>
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-field form-field--full">
          <div className="cotacao-previsto-header">
            <label>Valor unitário previsto (R$)</label>
            <label className="cotacao-previsto-header__toggle">
              <input type="checkbox" checked={form.naoPrevisto} onChange={(e) => update('naoPrevisto', e.target.checked)} />
              Não previsto
            </label>
          </div>
          {!form.naoPrevisto && (
            <input type="number" min={0} step="0.01" value={form.valorUnitarioPrevisto} onChange={(e) => update('valorUnitarioPrevisto', e.target.value)} />
          )}
        </div>

        <DynamicListField<FornecedorCotacao>
          label="Fornecedores (mínimo recomendado: 3)"
          items={form.fornecedores}
          onChange={(items) => update('fornecedores', items)}
          newItem={() => ({
            id: generateId(), nome: '', documento: '', tipo: 'PJ', marca: '', numeroOrcamento: '', contato: '', valor: 0,
            condicoesPagamento: '', prazoEntrega: '', emiteNF: true, observacao: '',
          })}
          renderRowFields={(item, upd) => (
            <div className={`cotacao-fornecedor-row ${item.id === form.melhorFornecedorId ? 'cotacao-fornecedor-row--melhor' : ''}`}>
              <input placeholder="Nome do fornecedor" value={item.nome} onChange={(e) => upd({ nome: e.target.value })} />
              <select
                value={item.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoFornecedorCotacao;
                  upd({ tipo, emiteNF: tipo === 'PJ' });
                }}
              >
                <option value="PJ">PJ</option>
                <option value="Informal">Autônomo/Informal</option>
              </select>
              <input
                placeholder={item.tipo === 'PJ' ? 'CNPJ' : 'CPF'}
                value={item.documento}
                onChange={(e) => upd({ documento: e.target.value })}
              />
              <input placeholder="Contato (telefone/e-mail)" value={item.contato ?? ''} onChange={(e) => upd({ contato: e.target.value })} />
              <input placeholder="Marca" value={item.marca} onChange={(e) => upd({ marca: e.target.value })} />
              <input placeholder="Nº orçamento" value={item.numeroOrcamento} onChange={(e) => upd({ numeroOrcamento: e.target.value })} />
              <input type="number" min={0} step="0.01" placeholder="Valor (R$)" value={item.valor} onChange={(e) => upd({ valor: Number(e.target.value) })} />
              <input placeholder="Condições de pagamento" value={item.condicoesPagamento} onChange={(e) => upd({ condicoesPagamento: e.target.value })} />
              <input placeholder="Prazo de entrega" value={item.prazoEntrega} onChange={(e) => upd({ prazoEntrega: e.target.value })} />
              <label className="cotacao-nf-toggle">
                <input type="checkbox" checked={item.emiteNF} onChange={(e) => upd({ emiteNF: e.target.checked })} />
                Emite NF
              </label>
              <button
                type="button"
                className={`cotacao-melhor-btn ${item.id === form.melhorFornecedorId ? 'is-active' : ''}`}
                onClick={() => update('melhorFornecedorId', form.melhorFornecedorId === item.id ? '' : item.id)}
                title={item.id === form.melhorFornecedorId ? 'Remover como melhor opção' : 'Marcar como melhor opção'}
              >
                {item.id === form.melhorFornecedorId ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                Melhor opção
              </button>
              <input placeholder="Observação" value={item.observacao} onChange={(e) => upd({ observacao: e.target.value })} />
              <div className="cotacao-fornecedor-orcamento">
                {item.orcamentoAnexo ? (
                  <span className="cotacao-fornecedor-orcamento__anexo">
                    <button type="button" onClick={() => downloadAnexo(item.orcamentoAnexo!)}>
                      <IconPaperclip size={13} /> {item.orcamentoAnexo.nome}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteBlob(item.orcamentoAnexo!.id).catch((err) => console.error('Erro ao remover anexo do armazenamento:', err));
                        upd({ orcamentoAnexo: undefined });
                      }}
                      aria-label="Remover orçamento"
                    >
                      <IconTrash size={12} />
                    </button>
                  </span>
                ) : (
                  <label className="btn btn-secondary cotacao-fornecedor-orcamento__btn">
                    <IconPaperclip size={13} /> Anexar orçamento
                    <input type="file" onChange={(e) => handleOrcamentoChange(e, item, upd)} hidden />
                  </label>
                )}
              </div>
            </div>
          )}
        />
        {anexoErro && <p className="cotacao-anexo-erro">{anexoErro}</p>}

        <div className="form-field form-field--full">
          <label>Condições de pagamento (gerais)</label>
          <textarea value={form.condicoesPagamentoGerais} onChange={(e) => update('condicoesPagamentoGerais', e.target.value)} placeholder="Ex: pagamento mediante medições periódicas, retenção de garantia, etc." />
        </div>
        <div className="form-field form-field--full">
          <label>Serviços não inclusos</label>
          <textarea value={form.servicosNaoInclusos} onChange={(e) => update('servicosNaoInclusos', e.target.value)} placeholder="Liste o que fica de fora do escopo desta cotação" />
        </div>
        <div className="form-field form-field--full">
          <label>Melhor opção</label>
          <textarea value={form.melhorOpcaoObservacao} onChange={(e) => update('melhorOpcaoObservacao', e.target.value)} placeholder="Alguma observação sobre a escolha do melhor fornecedor" />
        </div>
        <div className="form-field form-field--full">
          <label>Observações gerais</label>
          <textarea value={form.observacoesGerais} onChange={(e) => update('observacoesGerais', e.target.value)} />
        </div>
        {salvarErro && <p className="cotacao-anexo-erro form-field--full">{salvarErro}</p>}
      </form>
    </Modal>
  );
}
