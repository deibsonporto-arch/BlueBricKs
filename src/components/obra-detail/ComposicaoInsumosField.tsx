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
  composicaoOrigem?: { codigo: number; unidade: string; quantidade?: number }; // composição SINAPI salva que gerou os insumos atuais (pra reabrir e ainda poder "Restaurar valores do SINAPI")
  onChangeComposicaoOrigem?: (origem: { codigo: number; unidade: string; quantidade?: number } | undefined) => void;
  escalaPedida?: { valor: number; ts: number } | null; // pedido externo (ex: "Aplicar" nas Medidas do ambiente) pra já jogar a "Quantidade do serviço" pra esse valor
}

const TIPO_LABEL: Record<TipoInsumoAtividade, string> = {
  material: 'Material',
  mao_de_obra: 'Mão de obra',
  aluguel: 'Aluguel',
  parametro_calculado: 'Parâmetro calculado',
};

// tipos que aparecem na tabela normal, editável via "Trocar composição ou adicionar insumo" — os
// "parâmetro calculado" (m² de Medidas do ambiente) ficam numa tabela própria, só de referência
const TIPOS_INSUMO_EDITAVEL: TipoInsumoAtividade[] = ['material', 'mao_de_obra', 'aluguel'];

/** Grava em cada insumo o `coeficiente` (quantidade fixa "por 1 unidade" do serviço), calculado a
 * partir da quantidade que veio decomposta pra uma escala `Q` conhecida. A partir daí, reaplicar a
 * "Quantidade do serviço" nunca mais multiplica em cima de um valor que já foi multiplicado antes —
 * sempre recalcula do zero como coeficiente × nova escala, então não acumula erro por mais vezes
 * que o usuário aplicar/reaplicar. */
function fixarCoeficientes(itens: ItemInsumoAtividade[], escalaBase: number): ItemInsumoAtividade[] {
  if (!(escalaBase > 0)) return itens;
  return itens.map((i) => ({ ...i, coeficiente: i.quantidade / escalaBase }));
}

type ResultadoBusca =
  | { origem: 'composicao'; item: SinapiComposicaoResumo }
  | { origem: 'insumo'; item: SinapiInsumoResumo };

export function ComposicaoInsumosField({ uf, etapaNome, insumos, onChangeInsumos, onSugerirNome, composicaoOrigem, onChangeComposicaoOrigem, escalaPedida }: ComposicaoInsumosFieldProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionada, setSelecionada] = useState<ResultadoBusca | null>(null);
  const [quantidadeInput, setQuantidadeInput] = useState('1');
  const [decompondo, setDecompondo] = useState(false);
  const [mes, setMes] = useState('');
  const [desoneracao] = useState<SinapiDesoneracao>('SD');
  // unidade do SERVIÇO decomposto (ex: m² de reboco) — não confundir com a unidade de cada insumo
  // (ex: H de mão de obra, KG de cimento). Usada só pro rótulo do campo "Quantidade" abaixo.
  const [unidadeComposicao, setUnidadeComposicao] = useState<string | undefined>(composicaoOrigem?.unidade);
  // código da última composição SINAPI decomposta — guardado (e persistido via composicaoOrigem) pra
  // dar pra "Restaurar valores do SINAPI" buscar tudo de novo do zero mesmo depois de reabrir a
  // subatividade, desfazendo edições manuais e mão de obra por empreitada.
  const codigoComposicao = composicaoOrigem?.codigo;
  const [restaurando, setRestaurando] = useState(false);

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
      onChangeInsumos(fixarCoeficientes(insumosDeComposicaoExplodida(explodidos), quantidade));
      setEscalaInsumosState(quantidade);
      setUnidadeComposicao(selecionada.item.unidade);
      onChangeComposicaoOrigem?.({ codigo: selecionada.item.codigo, unidade: selecionada.item.unidade, quantidade });
      onSugerirNome?.(selecionada.item.descricao);
      setSelecionada(null);
      setBusca('');
      setQuantidadeInput('1');
    } finally {
      setDecompondo(false);
    }
  }

  async function restaurarValoresSinapi() {
    if (!codigoComposicao || !mes) return;
    setRestaurando(true);
    try {
      const explodidos = await buscarItensComposicaoSinapi(codigoComposicao, { uf, desoneracao, mes }, escalaInsumos);
      onChangeInsumos(fixarCoeficientes(insumosDeComposicaoExplodida(explodidos), escalaInsumos));
    } finally {
      setRestaurando(false);
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
      coeficiente: escalaInsumos > 0 ? quantidade / escalaInsumos : quantidade,
    }]);
    setSelecionada(null);
    setBusca('');
    setQuantidadeInput('1');
  }

  function updateInsumo(id: string, patch: Partial<ItemInsumoAtividade>) {
    onChangeInsumos(insumos.map((i) => {
      if (i.id !== id) return i;
      const atualizado = { ...i, ...patch };
      // editou a Qtd. na mão — refixa o coeficiente a partir desse novo valor, senão a próxima vez
      // que a Quantidade do serviço mudar, essa edição manual seria perdida/sobrescrita errado.
      if (patch.quantidade != null && atualizado.tipo !== 'parametro_calculado') {
        atualizado.coeficiente = escalaInsumos > 0 ? patch.quantidade / escalaInsumos : patch.quantidade;
      }
      return atualizado;
    }));
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
      coeficiente: escalaInsumos > 0 ? quantidade / escalaInsumos : quantidade,
    }]);
    setNovoInsumo({ descricao: '', unidade: '', quantidade: '1', custoUnitario: '', tipo: 'material', sinapiCodigo: undefined });
    setResultadosManual([]);
  }

  const temInsumos = insumos.length > 0;
  const insumosNormais = insumos.filter((i) => i.tipo !== 'parametro_calculado');
  const insumosCalculados = insumos.filter((i) => i.tipo === 'parametro_calculado');
  const totais = totaisPorTipo(insumos);

  // "Quantidade" no topo da tabela = escala de tudo — a composição vem decomposta pra 1 unidade
  // (1 m² de reboco, por ex.); mudar esse número aqui multiplica a quantidade de CADA insumo pela
  // razão entre o novo valor e o anterior, sem precisar editar linha por linha.
  // inicializa com a escala que ficou salva na subatividade — sem isso, reabrir o formulário sempre
  // resetava esse número pra 1, então "Restaurar valores do SINAPI" (que busca a composição de novo
  // usando esse número) decompunha errado pra escala 1 em vez da escala real salva.
  const [escalaInsumos, setEscalaInsumosState] = useState(() => composicaoOrigem?.quantidade ?? 1);
  function setEscalaInsumos(novaEscala: number) {
    setEscalaInsumosState(novaEscala);
    if (composicaoOrigem) onChangeComposicaoOrigem?.({ ...composicaoOrigem, quantidade: novaEscala });
  }
  function aplicarEscala(novaEscala: number) {
    if (!(novaEscala > 0) || novaEscala === escalaInsumos) return;
    onChangeInsumos(insumos.map((i) => {
      // os "parâmetro calculado" (Medidas do ambiente) já vêm com a quantidade final calculada —
      // não escala de novo, senão dobra o valor a cada reaplicação.
      if (i.tipo === 'parametro_calculado') return i;
      // com coeficiente fixo: recalcula sempre do zero (coeficiente × escala nova), nunca multiplica
      // em cima da quantidade atual — assim aplicar/reaplicar várias vezes nunca acumula erro.
      if (i.coeficiente != null) return { ...i, quantidade: i.coeficiente * novaEscala };
      // item sem coeficiente ainda (lançado à mão antes dessa correção) — escala proporcional uma
      // vez e já fixa o coeficiente a partir de agora, pra não voltar a acumular erro depois.
      const coef = escalaInsumos > 0 ? i.quantidade / escalaInsumos : i.quantidade;
      return { ...i, quantidade: coef * novaEscala, coeficiente: coef };
    }));
    setEscalaInsumos(novaEscala);
  }

  // pedido vindo de fora (botão "Aplicar" no resumo de Medidas do ambiente) — joga a quantidade
  // direto pra cá e mostra um aviso rápido confirmando, já que antes ficava sem feedback nenhum se
  // realmente tinha aplicado ou não.
  const [avisoEscalaAplicada, setAvisoEscalaAplicada] = useState<number | null>(null);
  useEffect(() => {
    if (!escalaPedida || !(escalaPedida.valor > 0)) return;
    aplicarEscala(escalaPedida.valor);
    setAvisoEscalaAplicada(escalaPedida.valor);
    const timer = setTimeout(() => setAvisoEscalaAplicada(null), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalaPedida?.ts]);

  // "Mão de obra por empreitada" — ADICIONA uma linha de mão de obra com valor fechado por unidade
  // do serviço (ex: R$ 50/m²), que escala junto com "Quantidade do serviço" igual as demais. Não
  // mexe nas linhas existentes: dá pra ter várias empreitadas lado a lado (ex: eletricista +
  // pedreiro, cada um com seu valor) e apagar na mão só a linha antiga que não quiser mais manter.
  const [empreitaAberto, setEmpreitaAberto] = useState(false);
  const [empreitaDescricaoInput, setEmpreitaDescricaoInput] = useState('Mão de obra (empreitada)');
  const [empreitaValorInput, setEmpreitaValorInput] = useState('');
  function aplicarEmpreitada() {
    const valorPorUnidade = parseNumberBR(empreitaValorInput);
    if (!(valorPorUnidade > 0) || !empreitaDescricaoInput.trim()) return;
    const novoItem: ItemInsumoAtividade = {
      id: generateId(),
      descricao: empreitaDescricaoInput.trim(),
      unidade: unidadeComposicao || 'un',
      quantidade: escalaInsumos,
      custoUnitario: valorPorUnidade,
      tipo: 'mao_de_obra',
      coeficiente: 1, // "1 por unidade do serviço" — sempre igual à escala, então escala 1:1 com ela
    };
    onChangeInsumos([...insumos, novoItem]);
    setEmpreitaAberto(false);
    setEmpreitaDescricaoInput('Mão de obra (empreitada)');
    setEmpreitaValorInput('');
  }

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

      {insumosNormais.length > 0 && (
        <>
          <label className="atividade-insumos-escala">
            {unidadeComposicao
              ? `Quantidade do serviço (${unidadeComposicao}) — recalcula todos os insumos proporcionalmente. Veio pra ${formatNumberBR(escalaInsumos)} ${unidadeComposicao}`
              : 'Quantidade do serviço — recalcula todos os insumos proporcionalmente (decomponha uma composição do SINAPI pra saber a unidade certa; senão, é só um fator de escala)'}
            <input
              type="text" inputMode="decimal"
              key={`escala-${escalaInsumos}`}
              defaultValue={formatNumberBR(escalaInsumos)}
              onBlur={(e) => aplicarEscala(parseNumberBR(e.target.value))}
            />
            {codigoComposicao != null && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={restaurarValoresSinapi}
                disabled={restaurando}
                title="Refaz o cálculo a partir da composição original do SINAPI, desfazendo edições manuais e mão de obra por empreitada"
              >
                {restaurando ? 'Restaurando...' : 'Restaurar valores do SINAPI'}
              </button>
            )}
            {avisoEscalaAplicada != null && (
              <span className="atividade-insumos-escala__aviso">
                ✓ Aplicado {formatNumberBR(avisoEscalaAplicada)} {unidadeComposicao || ''} — insumos recalculados abaixo
              </span>
            )}
          </label>
          <div className="atividade-insumos-empreita">
            {!empreitaAberto ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEmpreitaAberto(true)}>
                + Mão de obra por empreitada...
              </button>
            ) : (
              <>
                <input
                  className="atividade-insumos-empreita__descricao"
                  value={empreitaDescricaoInput}
                  onChange={(e) => setEmpreitaDescricaoInput(e.target.value)}
                  placeholder="ex: Eletricista (empreitada)"
                />
                <span>R$ por {unidadeComposicao || 'unidade'}:</span>
                <input
                  type="text" inputMode="decimal"
                  autoFocus
                  value={empreitaValorInput}
                  onChange={(e) => setEmpreitaValorInput(e.target.value)}
                  placeholder="ex: 50,00"
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={aplicarEmpreitada} disabled={!(parseNumberBR(empreitaValorInput) > 0) || !empreitaDescricaoInput.trim()}>
                  Adicionar linha
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEmpreitaAberto(false); setEmpreitaValorInput(''); setEmpreitaDescricaoInput('Mão de obra (empreitada)'); }}>
                  Cancelar
                </button>
              </>
            )}
          </div>
          <div className="scroll-x">
            <table className="atividade-insumos-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Un.</th>
                  <th title="Quantidade por 1 unidade do serviço (o coeficiente da composição SINAPI)">Coef.</th>
                  <th title={unidadeComposicao ? `Quantidade real pra ${formatNumberBR(escalaInsumos)} ${unidadeComposicao} do serviço` : 'Quantidade real pra sua metragem'}>Qtd.</th>
                  <th>Custo unit.</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumosNormais.map((i) => (
                  <tr key={i.id}>
                    <td><input defaultValue={i.descricao} onBlur={(e) => updateInsumo(i.id, { descricao: e.target.value })} /></td>
                    <td>
                      <select value={i.tipo} onChange={(e) => updateInsumo(i.id, { tipo: e.target.value as TipoInsumoAtividade })}>
                        {TIPOS_INSUMO_EDITAVEL.map((t) => (
                          <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td><input defaultValue={i.unidade} onBlur={(e) => updateInsumo(i.id, { unidade: e.target.value })} /></td>
                    <td className="atividade-insumos-table__coef">
                      {i.coeficiente != null ? formatNumberBR(i.coeficiente) : (escalaInsumos > 0 ? formatNumberBR(i.quantidade / escalaInsumos) : '—')}
                    </td>
                    <td>
                      <input
                        type="text" inputMode="decimal"
                        key={`qtd-${i.id}-${i.quantidade}`}
                        defaultValue={formatNumberBR(i.quantidade)}
                        onBlur={(e) => updateInsumo(i.id, { quantidade: parseNumberBR(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="text" inputMode="decimal"
                        key={`custo-${i.id}-${i.custoUnitario}`}
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
                  <td colSpan={6}>Total material / mão de obra / aluguel</td>
                  <td colSpan={2}>{formatBRL(totais.material)} · {formatBRL(totais.mao_de_obra)} · {formatBRL(totais.aluguel)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {insumosCalculados.length > 0 && (
        <div className="atividade-insumos-calculados">
          <span className="atividade-insumos-calculados__label">
            Parâmetros calculados — base pro cálculo dos materiais acima, não é material em si (não conta no total nem vai pra Requisições)
          </span>
          <div className="scroll-x">
            <table className="atividade-insumos-table atividade-insumos-table--calculados">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Un.</th>
                  <th>Qtd.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumosCalculados.map((i) => (
                  <tr key={i.id}>
                    <td>{i.descricao}</td>
                    <td>{i.unidade}</td>
                    <td>{formatNumberBR(i.quantidade)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => removerInsumo(i.id)} aria-label="Remover parâmetro calculado">
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            {TIPOS_INSUMO_EDITAVEL.map((t) => (
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
