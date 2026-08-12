import { useEffect, useMemo, useState } from 'react';
import { IconFileImport, IconPlus, IconSearch, IconTrash, IconArrowBackUp } from '@tabler/icons-react';
import type { ItemMaterialOrcamento, ItemOrcamentoAnalitico, Obra, SinapiDesoneracao } from '../../types/domain';
import {
  buscarComposicoesSinapi,
  buscarMateriaisConsolidadosSinapi,
  fetchSinapiGrupos,
  fetchSinapiMeses,
  type SinapiComposicaoResumo,
  type SinapiMaterialExplodido,
} from '../../data/apiSync';
import { formatBRL, formatNumberBR, parseNumberBR } from '../../utils/currency';
import { criarItemOrcamentoAnalitico } from '../../utils/orcamentoAnalitico';
import { generateId } from '../../utils/id';
import { ImportarQuantitativosPanel } from './ImportarQuantitativosPanel';
import type { QuantitativoExtraido } from '../../utils/quantitativos/types';
import './OrcamentoAnaliticoSection.css';

interface OrcamentoAnaliticoSectionProps {
  obra: Obra;
  itens: ItemOrcamentoAnalitico[];
  onCreateItem: (item: ItemOrcamentoAnalitico) => void;
  onUpdateItem: (id: string, patch: Partial<ItemOrcamentoAnalitico>) => void;
  onDeleteItem: (id: string) => void;
  materiaisOverrides: ItemMaterialOrcamento[];
  onCreateMaterialOverride: (item: ItemMaterialOrcamento) => void;
  onUpdateMaterialOverride: (id: string, patch: Partial<ItemMaterialOrcamento>) => void;
}

interface LinhaMaterialExibicao {
  chave: string;
  overrideId?: string;
  insumoCodigo?: number;
  descricao: string;
  classificacao?: string;
  unidade: string;
  quantidade?: number;
  precoUnitarioSinapi?: number;
  custoSinapi?: number;
  custoReal?: number;
  excluido: boolean;
  classeABC?: 'A' | 'B' | 'C';
  manual: boolean;
}

/** Classificação A/B/C por % acumulado do custo (80/95), igual à convenção usual de Curva ABC. */
function classificarABC(itens: SinapiMaterialExplodido[]): (SinapiMaterialExplodido & { classeABC: 'A' | 'B' | 'C'; pctAcumulado: number })[] {
  const ordenados = [...itens].filter((i) => i.custoTotal != null).sort((a, b) => (b.custoTotal ?? 0) - (a.custoTotal ?? 0));
  const total = ordenados.reduce((s, i) => s + (i.custoTotal ?? 0), 0) || 1;
  let acumulado = 0;
  return ordenados.map((i) => {
    acumulado += i.custoTotal ?? 0;
    const pctAcumulado = (acumulado / total) * 100;
    const classeABC = pctAcumulado <= 80 ? 'A' : pctAcumulado <= 95 ? 'B' : 'C';
    return { ...i, classeABC, pctAcumulado };
  });
}

export function OrcamentoAnaliticoSection({
  obra,
  itens,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  materiaisOverrides,
  onCreateMaterialOverride,
  onUpdateMaterialOverride,
}: OrcamentoAnaliticoSectionProps) {
  const [uf, setUf] = useState(obra.endereco.estado || 'GO');
  const [mes, setMes] = useState('');
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [desoneracao, setDesoneracao] = useState<SinapiDesoneracao>('SD');

  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [gruposDisponiveis, setGruposDisponiveis] = useState<string[]>([]);
  const [resultados, setResultados] = useState<SinapiComposicaoResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState('');
  const [selecionada, setSelecionada] = useState<SinapiComposicaoResumo | null>(null);
  const [quantidadeInput, setQuantidadeInput] = useState('');

  const [materiais, setMateriais] = useState<SinapiMaterialExplodido[]>([]);
  const [materiaisCarregando, setMateriaisCarregando] = useState(false);

  const [importando, setImportando] = useState(false);
  const [erroImportacao, setErroImportacao] = useState('');
  const [itensExtraidos, setItensExtraidos] = useState<QuantitativoExtraido[] | null>(null);

  useEffect(() => {
    fetchSinapiMeses()
      .then((meses) => {
        setMesesDisponiveis(meses);
        setMes((atual) => atual || meses[0] || '');
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mes) return;
    fetchSinapiGrupos(mes).then(setGruposDisponiveis).catch(() => undefined);
  }, [mes]);

  useEffect(() => {
    if ((!busca.trim() && !grupo) || !uf || !mes) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    setErroBusca('');
    const timer = setTimeout(() => {
      buscarComposicoesSinapi(busca, { uf, desoneracao, mes }, 30, grupo || undefined)
        .then(setResultados)
        .catch(() => setErroBusca('Falha ao buscar composições no SINAPI.'))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [busca, grupo, uf, mes, desoneracao]);

  useEffect(() => {
    if (itens.length === 0 || !uf || !mes) {
      setMateriais([]);
      return;
    }
    setMateriaisCarregando(true);
    buscarMateriaisConsolidadosSinapi(
      itens.map((i) => ({ composicaoCodigo: i.composicaoCodigo, quantidade: i.quantidade })),
      { uf, desoneracao, mes },
    )
      .then(setMateriais)
      .catch(() => setMateriais([]))
      .finally(() => setMateriaisCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, uf, mes, desoneracao]);

  const quantidade = parseNumberBR(quantidadeInput);
  const semCusto = selecionada != null && selecionada.custo == null;
  const custoUnitario = selecionada?.custo ?? 0;
  const custoTotalPreview = quantidade * custoUnitario;

  const totalGeral = useMemo(() => itens.reduce((s, i) => s + i.custoTotal, 0), [itens]);
  const materiaisClassificados = useMemo(() => classificarABC(materiais), [materiais]);

  // Mescla o cálculo ao vivo (materiaisClassificados) com os ajustes persistidos desta obra
  // (materiaisOverrides): sobrescrita de valor real, exclusão (soft-delete) e insumos manuais que
  // não vêm do SINAPI. O cálculo em si nunca é persistido — só os ajustes por cima dele.
  const linhasMateriais = useMemo<LinhaMaterialExibicao[]>(() => {
    const doSinapi: LinhaMaterialExibicao[] = materiaisClassificados.map((m) => {
      const override = materiaisOverrides.find((o) => o.insumoCodigo === m.codigo);
      return {
        chave: `sinapi-${m.codigo}`,
        overrideId: override?.id,
        insumoCodigo: m.codigo,
        descricao: m.descricao,
        classificacao: m.classificacao ?? undefined,
        unidade: m.unidade,
        quantidade: m.coeficiente,
        precoUnitarioSinapi: m.precoUnitario ?? undefined,
        custoSinapi: m.custoTotal ?? undefined,
        custoReal: override?.custoReal,
        excluido: override?.excluido ?? false,
        classeABC: m.classeABC,
        manual: false,
      };
    });
    const manuais: LinhaMaterialExibicao[] = materiaisOverrides
      .filter((o) => o.insumoCodigo == null)
      .map((o) => ({
        chave: `manual-${o.id}`,
        overrideId: o.id,
        descricao: o.descricao,
        unidade: o.unidade,
        custoReal: o.custoReal,
        excluido: o.excluido,
        manual: true,
      }));
    return [...doSinapi, ...manuais];
  }, [materiaisClassificados, materiaisOverrides]);

  const totalMateriais = useMemo(
    () => linhasMateriais.reduce((s, l) => (l.excluido ? s : s + (l.custoReal ?? l.custoSinapi ?? 0)), 0),
    [linhasMateriais],
  );

  const [novoInsumoDescricao, setNovoInsumoDescricao] = useState('');
  const [novoInsumoValor, setNovoInsumoValor] = useState('');

  function handleMeuValorChange(linha: LinhaMaterialExibicao, raw: string) {
    const custoReal = parseNumberBR(raw);
    const now = new Date().toISOString();
    if (linha.overrideId) {
      onUpdateMaterialOverride(linha.overrideId, { custoReal, updatedAt: now });
    } else {
      onCreateMaterialOverride({
        id: generateId(), obraId: obra.id, insumoCodigo: linha.insumoCodigo, descricao: linha.descricao,
        unidade: linha.unidade, custoReal, excluido: false, createdAt: now, updatedAt: now,
      });
    }
  }

  function handleToggleExcluido(linha: LinhaMaterialExibicao) {
    const now = new Date().toISOString();
    if (linha.overrideId) {
      onUpdateMaterialOverride(linha.overrideId, { excluido: !linha.excluido, updatedAt: now });
    } else {
      onCreateMaterialOverride({
        id: generateId(), obraId: obra.id, insumoCodigo: linha.insumoCodigo, descricao: linha.descricao,
        unidade: linha.unidade, excluido: true, createdAt: now, updatedAt: now,
      });
    }
  }

  function adicionarInsumoManual() {
    const valor = parseNumberBR(novoInsumoValor);
    if (!novoInsumoDescricao.trim() || !(valor > 0)) return;
    const now = new Date().toISOString();
    onCreateMaterialOverride({
      id: generateId(), obraId: obra.id, descricao: novoInsumoDescricao.trim(), unidade: 'vb',
      custoReal: valor, excluido: false, createdAt: now, updatedAt: now,
    });
    setNovoInsumoDescricao('');
    setNovoInsumoValor('');
  }

  function selecionarComposicao(c: SinapiComposicaoResumo) {
    setSelecionada(c);
    setBusca(c.descricao);
    setResultados([]);
  }

  function adicionarLinha() {
    if (!selecionada || quantidade <= 0 || !mes || semCusto) return;
    onCreateItem(criarItemOrcamentoAnalitico(obra.id, selecionada, quantidade, { uf, mes, desoneracao }));
    setSelecionada(null);
    setBusca('');
    setQuantidadeInput('');
  }

  function handleCustoUnitarioRealChange(item: ItemOrcamentoAnalitico, raw: string) {
    const custoUnitarioReal = parseNumberBR(raw);
    onUpdateItem(item.id, { custoUnitarioReal, custoTotal: item.quantidade * custoUnitarioReal, updatedAt: new Date().toISOString() });
  }

  async function handleArquivoQuantitativos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    setErroImportacao('');
    setImportando(true);
    try {
      const nome = arquivo.name.toLowerCase();
      let extraidos: QuantitativoExtraido[];
      // pdfjs-dist e xlsx são pesados e só usados aqui — carregam sob demanda, mesmo padrão do
      // pipeline de nota fiscal, pra não engordar o bundle principal com algo usado ocasionalmente
      if (nome.endsWith('.pdf')) {
        const { parseQuantitativosPdf } = await import('../../utils/quantitativos/parseQuantitativosPdf');
        extraidos = await parseQuantitativosPdf(arquivo);
      } else {
        const { parseQuantitativosPlanilha } = await import('../../utils/quantitativos/parseQuantitativosPlanilha');
        extraidos = await parseQuantitativosPlanilha(arquivo);
      }
      setItensExtraidos(extraidos);
    } catch {
      setErroImportacao('Não consegui ler esse arquivo. Confira se é um PDF de texto, .xlsx ou .csv.');
    } finally {
      setImportando(false);
    }
  }

  function handleImportarQuantitativos(novosItens: ItemOrcamentoAnalitico[]) {
    for (const item of novosItens) onCreateItem(item);
    setItensExtraidos(null);
  }

  return (
    <div className="orcamento-analitico">
      <div className="orcamento-card orcamento-analitico__filtros">
        <div className="form-field">
          <label>UF</label>
          <input maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
        </div>
        <div className="form-field">
          <label>Mês de referência</label>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {mesesDisponiveis.length === 0 && <option value="">Nenhum mês importado</option>}
            {mesesDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Encargos sociais</label>
          <div className="orcamento-analitico__desoneracao">
            <label><input type="radio" checked={desoneracao === 'SD'} onChange={() => setDesoneracao('SD')} /> Não desonerado</label>
            <label><input type="radio" checked={desoneracao === 'CD'} onChange={() => setDesoneracao('CD')} /> Desonerado</label>
          </div>
        </div>
      </div>

      <div className="orcamento-card">
        <div className="orcamento-analitico__busca-header">
          <h3>Buscar composição SINAPI</h3>
          <label className="btn btn-secondary">
            <IconFileImport size={14} /> {importando ? 'Lendo arquivo...' : 'Importar planilha/memorial'}
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleArquivoQuantitativos} disabled={importando} hidden />
          </label>
        </div>
        {erroImportacao && <p className="orcamento-analitico__hint orcamento-analitico__hint--erro">{erroImportacao}</p>}
        <div className="orcamento-analitico__busca-linha">
          <div className="orcamento-analitico__busca">
            <IconSearch size={16} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setSelecionada(null); }}
              placeholder="ex: alvenaria bloco cerâmico"
            />
          </div>
          <select className="orcamento-analitico__grupo-select" value={grupo} onChange={(e) => { setGrupo(e.target.value); setSelecionada(null); }}>
            <option value="">Todos os grupos</option>
            {gruposDisponiveis.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <p className="orcamento-analitico__hint">Filtre por grupo (estrutura, cobertura, acabamento...) pra localizar mais rápido, e digite pra refinar dentro dele.</p>
        {buscando && <p className="orcamento-analitico__hint">Buscando...</p>}
        {erroBusca && <p className="orcamento-analitico__hint orcamento-analitico__hint--erro">{erroBusca}</p>}
        {resultados.length > 0 && (
          <ul className="orcamento-analitico__resultados">
            {resultados.map((r) => (
              <li key={r.codigo}>
                <button type="button" onClick={() => selecionarComposicao(r)}>
                  <strong>{r.descricao}</strong>
                  <span>{r.codigo} · {r.unidade} · {r.custo != null ? formatBRL(r.custo) : 'sem custo na UF'}{r.grupo ? ` · ${r.grupo}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selecionada && semCusto && (
          <p className="orcamento-analitico__hint orcamento-analitico__hint--erro">
            Esta composição está SEM CUSTO em {uf}/{mes} (falta preço de pelo menos um insumo). Tente outra variante da composição, outro mês de referência, ou lance o insumo diretamente.
          </p>
        )}
        {selecionada && !semCusto && (
          <div className="orcamento-analitico__selecionada">
            <div>
              <strong>{selecionada.descricao}</strong>
              <span>{selecionada.codigo} · {selecionada.unidade} · custo unitário {formatBRL(custoUnitario)}</span>
            </div>
            <div className="form-field">
              <label>Quantidade ({selecionada.unidade})</label>
              <input type="text" inputMode="decimal" value={quantidadeInput} onChange={(e) => setQuantidadeInput(e.target.value)} placeholder="0,00" />
            </div>
            <div className="orcamento-analitico__preview">
              Total: <strong>{formatBRL(custoTotalPreview)}</strong>
            </div>
            <button type="button" className="btn btn-primary" onClick={adicionarLinha} disabled={quantidade <= 0}>
              <IconPlus size={14} /> Adicionar
            </button>
          </div>
        )}
      </div>

      <div className="orcamento-card">
        <h3>Composições lançadas</h3>
        <div className="scroll-x">
          <table className="orcamento-etapas-table">
            <thead>
              <tr>
                <th>Composição</th>
                <th>Qtd.</th>
                <th>Un.</th>
                <th>Custo unit.</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id}>
                  <td>{item.composicaoDescricao}</td>
                  <td>{formatNumberBR(item.quantidade)}</td>
                  <td>{item.unidade}</td>
                  <td>
                    <input
                      type="text" inputMode="decimal"
                      defaultValue={formatNumberBR(item.custoUnitarioReal ?? item.custoUnitarioSinapi)}
                      onBlur={(e) => handleCustoUnitarioRealChange(item, e.target.value)}
                    />
                  </td>
                  <td>{formatBRL(item.custoTotal)}</td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => onDeleteItem(item.id)} aria-label="Remover">
                      <IconTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr><td colSpan={6} className="config-etapas-table__empty">Nenhuma composição lançada ainda.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td></td><td></td><td></td>
                <td>{formatBRL(totalGeral)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="orcamento-card">
        <h3>Lista de Materiais</h3>
        <p className="orcamento-analitico__hint">
          "Meu valor" é o que você vai usar de fato no orçamento desta obra — o valor do SINAPI fica ao lado só como referência de comparação. "Excluir" risca a linha e tira do total, mas mantém visível.
        </p>
        {materiaisCarregando && <p className="orcamento-analitico__hint">Calculando...</p>}
        {!materiaisCarregando && linhasMateriais.length === 0 && <p className="orcamento-analitico__hint">Lance composições acima para ver a lista consolidada.</p>}
        {linhasMateriais.length > 0 && (
          <div className="scroll-x">
            <table className="orcamento-etapas-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Classe</th>
                  <th>Un.</th>
                  <th>Quantidade</th>
                  <th>SINAPI (referência)</th>
                  <th>Meu valor</th>
                  <th>Curva ABC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linhasMateriais.map((linha) => {
                  const diffPct = linha.custoReal != null && linha.custoSinapi != null && linha.custoSinapi > 0
                    ? ((linha.custoReal - linha.custoSinapi) / linha.custoSinapi) * 100
                    : null;
                  return (
                    <tr key={linha.chave} className={linha.excluido ? 'orcamento-analitico__linha-excluida' : undefined}>
                      <td>{linha.descricao}{linha.manual && <span className="orcamento-analitico__manual-tag">manual</span>}</td>
                      <td>{linha.classificacao ?? (linha.manual ? '—' : '')}</td>
                      <td>{linha.unidade}</td>
                      <td>{linha.quantidade != null ? formatNumberBR(linha.quantidade) : '—'}</td>
                      <td>{linha.custoSinapi != null ? formatBRL(linha.custoSinapi) : '—'}</td>
                      <td>
                        <input
                          type="text" inputMode="decimal"
                          defaultValue={linha.custoReal != null ? formatNumberBR(linha.custoReal) : ''}
                          placeholder={linha.custoSinapi != null ? formatNumberBR(linha.custoSinapi) : '0,00'}
                          disabled={linha.excluido}
                          onBlur={(e) => e.target.value.trim() !== '' && handleMeuValorChange(linha, e.target.value)}
                        />
                        {diffPct != null && (
                          <span className={`orcamento-analitico__diff ${Math.abs(diffPct) <= 10 ? 'orcamento-analitico__diff--ok' : 'orcamento-analitico__diff--aviso'}`}>
                            {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}% vs SINAPI
                          </span>
                        )}
                      </td>
                      <td>{linha.classeABC && <span className={`orcamento-analitico__abc orcamento-analitico__abc--${linha.classeABC}`}>{linha.classeABC}</span>}</td>
                      <td>
                        <button type="button" className="btn btn-ghost" onClick={() => handleToggleExcluido(linha)} aria-label={linha.excluido ? 'Restaurar' : 'Excluir'}>
                          {linha.excluido ? <IconArrowBackUp size={14} /> : <IconTrash size={14} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td></td><td></td><td></td><td></td>
                  <td>{formatBRL(totalMateriais)}</td>
                  <td></td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="orcamento-analitico__novo-manual">
          <input
            placeholder="Descrição do insumo (ex: frete de material)"
            value={novoInsumoDescricao}
            onChange={(e) => setNovoInsumoDescricao(e.target.value)}
          />
          <input
            type="text" inputMode="decimal"
            placeholder="Valor total (R$)"
            value={novoInsumoValor}
            onChange={(e) => setNovoInsumoValor(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={adicionarInsumoManual}>
            <IconPlus size={14} /> Adicionar insumo manual
          </button>
        </div>
      </div>

      {itensExtraidos && (
        <ImportarQuantitativosPanel
          obraId={obra.id}
          itensExtraidos={itensExtraidos}
          filtro={{ uf, mes, desoneracao }}
          onImportar={handleImportarQuantitativos}
          onFechar={() => setItensExtraidos(null)}
        />
      )}
    </div>
  );
}
