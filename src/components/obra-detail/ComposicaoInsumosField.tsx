import { useEffect, useState } from 'react';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import type { ItemInsumoAtividade, SinapiDesoneracao, TipoInsumoAtividade } from '../../types/domain';
import {
  buscarComposicoesSinapi,
  buscarInsumosSinapi,
  buscarItensComposicaoSinapi,
  fetchSinapiMeses,
  type SinapiComposicaoResumo,
  type SinapiInsumoResumo,
} from '../../data/apiSync';
import { classificarTipoInsumo, insumosDeComposicaoExplodida, totaisPorTipo } from '../../utils/insumosAtividade';
import { priorizarPorEtapa } from '../../utils/etapasPadrao';
import { generateId } from '../../utils/id';
import { formatBRL, formatNumberBR, parseNumberBR } from '../../utils/currency';
import './ComposicaoInsumosField.css';

interface ComposicaoInsumosFieldProps {
  uf: string;
  etapaNome?: string; // nome da etapa/atividade-pai, pra priorizar composições do mesmo grupo na busca
  insumos: ItemInsumoAtividade[];
  onChangeInsumos: (insumos: ItemInsumoAtividade[]) => void;
  onSugerirNome?: (nome: string) => void; // chamado ao decompor pela 1ª vez, se o nome do form ainda estiver vazio
}

const TIPO_LABEL: Record<TipoInsumoAtividade, string> = {
  material: 'Material',
  mao_de_obra: 'Mão de obra',
  aluguel: 'Aluguel',
};

type ResultadoBusca =
  | { origem: 'composicao'; item: SinapiComposicaoResumo }
  | { origem: 'insumo'; item: SinapiInsumoResumo };

export function ComposicaoInsumosField({ uf, etapaNome, insumos, onChangeInsumos, onSugerirNome }: ComposicaoInsumosFieldProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionada, setSelecionada] = useState<ResultadoBusca | null>(null);
  const [quantidadeInput, setQuantidadeInput] = useState('1');
  const [decompondo, setDecompondo] = useState(false);
  const [mes, setMes] = useState('');
  const [desoneracao] = useState<SinapiDesoneracao>('SD');

  useEffect(() => {
    fetchSinapiMeses().then((meses) => setMes((atual) => atual || meses[0] || '')).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!busca.trim() || !mes) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(() => {
      Promise.all([
        buscarComposicoesSinapi(busca, { uf, desoneracao, mes }, 20),
        buscarInsumosSinapi(busca, { uf, desoneracao, mes }, 20),
      ])
        .then(([composicoes, insumosEncontrados]) => {
          const composicoesResultado: ResultadoBusca[] = composicoes.map((item) => ({ origem: 'composicao', item }));
          const insumosResultado: ResultadoBusca[] = insumosEncontrados.map((item) => ({ origem: 'insumo', item }));
          const combinado: ResultadoBusca[] = etapaNome
            ? priorizarPorEtapa<SinapiComposicaoResumo>(composicoes, etapaNome).map((item) => ({ origem: 'composicao' as const, item }))
            : composicoesResultado;
          setResultados([...combinado, ...insumosResultado]);
        })
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [busca, mes, uf, desoneracao, etapaNome]);

  function selecionar(r: ResultadoBusca) {
    setSelecionada(r);
    setBusca(r.item.descricao);
    setResultados([]);
  }

  async function trocarComposicao() {
    if (!selecionada || selecionada.origem !== 'composicao' || !mes) return;
    const quantidade = parseNumberBR(quantidadeInput);
    if (!(quantidade > 0)) return;
    setDecompondo(true);
    try {
      const explodidos = await buscarItensComposicaoSinapi(selecionada.item.codigo, { uf, desoneracao, mes }, quantidade);
      onChangeInsumos(insumosDeComposicaoExplodida(explodidos));
      onSugerirNome?.(selecionada.item.descricao);
      setSelecionada(null);
      setBusca('');
      setQuantidadeInput('1');
    } finally {
      setDecompondo(false);
    }
  }

  function adicionarInsumoSelecionado() {
    if (!selecionada || selecionada.origem !== 'insumo') return;
    const quantidade = parseNumberBR(quantidadeInput);
    if (!(quantidade > 0)) return;
    const insumo = selecionada.item;
    onChangeInsumos([...insumos, {
      id: generateId(),
      sinapiCodigo: insumo.codigo,
      descricao: insumo.descricao,
      unidade: insumo.unidade,
      quantidade,
      custoUnitario: insumo.preco ?? 0,
      tipo: classificarTipoInsumo(insumo.classificacao),
    }]);
    setSelecionada(null);
    setBusca('');
    setQuantidadeInput('1');
  }

  function updateInsumo(id: string, patch: Partial<ItemInsumoAtividade>) {
    onChangeInsumos(insumos.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removerInsumo(id: string) {
    onChangeInsumos(insumos.filter((i) => i.id !== id));
  }

  const [novoInsumo, setNovoInsumo] = useState({ descricao: '', unidade: '', quantidade: '1', custoUnitario: '', tipo: 'material' as TipoInsumoAtividade, sinapiCodigo: undefined as number | undefined });
  const [resultadosManual, setResultadosManual] = useState<SinapiInsumoResumo[]>([]);
  const [buscandoManual, setBuscandoManual] = useState(false);

  useEffect(() => {
    if (!novoInsumo.descricao.trim() || !mes || novoInsumo.sinapiCodigo) {
      setResultadosManual([]);
      return;
    }
    setBuscandoManual(true);
    const timer = setTimeout(() => {
      buscarInsumosSinapi(novoInsumo.descricao, { uf, desoneracao, mes }, 8)
        .then(setResultadosManual)
        .catch(() => setResultadosManual([]))
        .finally(() => setBuscandoManual(false));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoInsumo.descricao, mes, uf, desoneracao]);

  function selecionarInsumoManual(item: SinapiInsumoResumo) {
    setNovoInsumo({
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: '1',
      custoUnitario: item.preco != null ? formatNumberBR(item.preco) : '',
      tipo: classificarTipoInsumo(item.classificacao),
      sinapiCodigo: item.codigo,
    });
    setResultadosManual([]);
  }

  function adicionarInsumoManual() {
    const quantidade = parseNumberBR(novoInsumo.quantidade);
    const custoUnitario = parseNumberBR(novoInsumo.custoUnitario);
    if (!novoInsumo.descricao.trim() || !(quantidade > 0)) return;
    onChangeInsumos([...insumos, {
      id: generateId(),
      sinapiCodigo: novoInsumo.sinapiCodigo,
      descricao: novoInsumo.descricao.trim(),
      unidade: novoInsumo.unidade.trim() || 'vb',
      quantidade,
      custoUnitario,
      tipo: novoInsumo.tipo,
    }]);
    setNovoInsumo({ descricao: '', unidade: '', quantidade: '1', custoUnitario: '', tipo: 'material', sinapiCodigo: undefined });
    setResultadosManual([]);
  }

  const temInsumos = insumos.length > 0;
  const totais = totaisPorTipo(insumos);

  const custoSelecionado = selecionada
    ? selecionada.origem === 'composicao' ? selecionada.item.custo : selecionada.item.preco
    : null;

  return (
    <div className="composicao-insumos-field">
      <label>{temInsumos ? 'Trocar composição ou adicionar insumo' : 'Buscar composição ou insumo SINAPI'}</label>
      <div className="atividade-sinapi-busca">
        <IconSearch size={16} />
        <input
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setSelecionada(null); }}
          placeholder="ex: alvenaria bloco cerâmico"
        />
      </div>
      {buscando && <p className="atividade-orcamento-hint">Buscando...</p>}
      {resultados.length > 0 && (
        <ul className="atividade-sinapi-resultados">
          {resultados.map((r) => (
            <li key={`${r.origem}-${r.item.codigo}`}>
              <button type="button" onClick={() => selecionar(r)}>
                <span className={`atividade-sinapi-tag atividade-sinapi-tag--${r.origem}`}>
                  {r.origem === 'composicao' ? 'Composição' : 'Insumo'}
                </span>
                <strong>{r.item.descricao}</strong>
                <span>
                  {r.item.codigo} · {r.item.unidade} · {(r.origem === 'composicao' ? r.item.custo : r.item.preco) != null ? formatBRL((r.origem === 'composicao' ? r.item.custo : r.item.preco)!) : 'sem custo na UF'}
                  {r.origem === 'composicao' && r.item.grupo ? ` · ${r.item.grupo}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selecionada && (
        <div className="atividade-sinapi-selecionada">
          <span className={`atividade-sinapi-tag atividade-sinapi-tag--${selecionada.origem}`}>
            {selecionada.origem === 'composicao' ? 'Composição' : 'Insumo'}
          </span>
          <span>{selecionada.item.descricao} · {selecionada.item.unidade}</span>
          <input
            type="text" inputMode="decimal"
            value={quantidadeInput}
            onChange={(e) => setQuantidadeInput(e.target.value)}
            placeholder={`Quantidade (${selecionada.item.unidade})`}
          />
          {selecionada.origem === 'composicao' ? (
            <button type="button" className="btn btn-secondary" onClick={trocarComposicao} disabled={decompondo || !(parseNumberBR(quantidadeInput) > 0)}>
              {decompondo ? 'Decompondo...' : temInsumos ? 'Trocar' : 'Decompor em insumos'}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={adicionarInsumoSelecionado} disabled={!(parseNumberBR(quantidadeInput) > 0)}>
              <IconPlus size={14} /> Adicionar insumo
            </button>
          )}
        </div>
      )}
      {selecionada && custoSelecionado == null && (
        <p className="atividade-orcamento-hint">Sem custo em {uf} — o valor unitário fica 0, ajuste depois na tabela.</p>
      )}
      {temInsumos && selecionada?.origem === 'composicao' && (
        <p className="atividade-orcamento-hint">Trocar a composição substitui a lista de insumos abaixo inteira.</p>
      )}

      {temInsumos && (
        <div className="scroll-x">
            <table className="atividade-insumos-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Un.</th>
                  <th>Qtd.</th>
                  <th>Custo unit.</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id}>
                    <td><input defaultValue={i.descricao} onBlur={(e) => updateInsumo(i.id, { descricao: e.target.value })} /></td>
                    <td>
                      <select value={i.tipo} onChange={(e) => updateInsumo(i.id, { tipo: e.target.value as TipoInsumoAtividade })}>
                        {(Object.keys(TIPO_LABEL) as TipoInsumoAtividade[]).map((t) => (
                          <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td><input defaultValue={i.unidade} onBlur={(e) => updateInsumo(i.id, { unidade: e.target.value })} /></td>
                    <td>
                      <input
                        type="text" inputMode="decimal"
                        defaultValue={formatNumberBR(i.quantidade)}
                        onBlur={(e) => updateInsumo(i.id, { quantidade: parseNumberBR(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="text" inputMode="decimal"
                        defaultValue={formatNumberBR(i.custoUnitario)}
                        onBlur={(e) => updateInsumo(i.id, { custoUnitario: parseNumberBR(e.target.value) })}
                      />
                    </td>
                    <td>{formatBRL(i.quantidade * i.custoUnitario)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => removerInsumo(i.id)} aria-label="Remover insumo">
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total material / mão de obra / aluguel</td>
                  <td colSpan={2}>{formatBRL(totais.material)} · {formatBRL(totais.mao_de_obra)} · {formatBRL(totais.aluguel)}</td>
                </tr>
              </tfoot>
            </table>
        </div>
      )}

      <div className="atividade-sinapi-novo-manual-wrap">
        <div className="atividade-sinapi-novo-manual">
          <div className="atividade-sinapi-novo-manual__descricao">
            <input
              placeholder="Descrição — busca no SINAPI ou digite livre"
              value={novoInsumo.descricao}
              onChange={(e) => setNovoInsumo((n) => ({ ...n, descricao: e.target.value, sinapiCodigo: undefined }))}
            />
            {novoInsumo.sinapiCodigo && <span className="atividade-sinapi-tag atividade-sinapi-tag--insumo">SINAPI {novoInsumo.sinapiCodigo}</span>}
          </div>
          <input placeholder="Un." value={novoInsumo.unidade} onChange={(e) => setNovoInsumo((n) => ({ ...n, unidade: e.target.value }))} />
          <input type="text" inputMode="decimal" placeholder="Qtd." value={novoInsumo.quantidade} onChange={(e) => setNovoInsumo((n) => ({ ...n, quantidade: e.target.value }))} />
          <input type="text" inputMode="decimal" placeholder="Custo unit." value={novoInsumo.custoUnitario} onChange={(e) => setNovoInsumo((n) => ({ ...n, custoUnitario: e.target.value }))} />
          <select value={novoInsumo.tipo} onChange={(e) => setNovoInsumo((n) => ({ ...n, tipo: e.target.value as TipoInsumoAtividade }))}>
            {(Object.keys(TIPO_LABEL) as TipoInsumoAtividade[]).map((t) => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={adicionarInsumoManual}>
            <IconPlus size={14} /> Item manual
          </button>
        </div>
        {buscandoManual && <p className="atividade-orcamento-hint">Buscando no SINAPI...</p>}
        {resultadosManual.length > 0 && (
          <ul className="atividade-sinapi-resultados atividade-sinapi-resultados--manual">
            {resultadosManual.map((item) => (
              <li key={item.codigo}>
                <button type="button" onClick={() => selecionarInsumoManual(item)}>
                  <span className="atividade-sinapi-tag atividade-sinapi-tag--insumo">Insumo</span>
                  <strong>{item.descricao}</strong>
                  <span>{item.codigo} · {item.unidade} · {item.preco != null ? formatBRL(item.preco) : 'sem custo na UF'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="atividade-orcamento-hint">Achou no SINAPI? Clique no resultado pra preencher automático. Não achou? Só digitar e completar os campos na mão mesmo.</p>
      </div>
    </div>
  );
}
