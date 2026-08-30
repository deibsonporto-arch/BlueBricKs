import { useState } from 'react';
import { IconAdjustments, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { AberturaAmbiente, ChaveItemResumoAmbiente, ConfigItemAmbiente, MedidasAmbiente, PontoEletricoAmbiente, SegmentoParede, SegmentoPlano, TipoInsumoAtividade } from '../../types/domain';
import { calcularResumoAmbiente } from '../../utils/medidasAmbiente';
import { generateId } from '../../utils/id';
import { formatNumberBR, parseNumberBR } from '../../utils/currency';
import './MedidasAmbienteField.css';

interface AplicarInsumoOpts {
  tag: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  tipo: TipoInsumoAtividade;
}

interface MedidasAmbienteFieldProps {
  medidas: MedidasAmbiente | undefined;
  onChangeMedidas: (m: MedidasAmbiente) => void;
  onAplicarInsumo: (opts: AplicarInsumoOpts) => void;
}

function vazias(): MedidasAmbiente {
  return { portas: [], janelas: [], pontosEletricos: [] };
}

function linhaAbertura(): AberturaAmbiente {
  return { id: generateId(), largura: 0, altura: 0, quantidade: 1 };
}

function linhaPonto(): PontoEletricoAmbiente {
  return { id: generateId(), descricao: '', quantidade: 1 };
}

const ITENS_RESUMO_LABEL: Record<ChaveItemResumoAmbiente, string> = {
  alvenaria: 'Alvenaria',
  reboco: 'Reboco',
  porcelanatoPiso: 'Porcelanato — piso',
  porcelanatoParede: 'Porcelanato — parede',
  pintura: 'Pintura',
  forro: 'Forro (teto)',
};
const ORDEM_ITENS_RESUMO: ChaveItemResumoAmbiente[] = ['alvenaria', 'reboco', 'porcelanatoPiso', 'porcelanatoParede', 'pintura', 'forro'];

export function MedidasAmbienteField({ medidas, onChangeMedidas, onAplicarInsumo }: MedidasAmbienteFieldProps) {
  const m = medidas ?? vazias();
  const temAlgumaMedida = !!(m.largura || m.comprimento || m.peDireito || m.portas.length || m.janelas.length || m.pontosEletricos.length);
  const [aberto, setAberto] = useState(temAlgumaMedida);
  const resumo = calcularResumoAmbiente(m);

  function atualizar(patch: Partial<MedidasAmbiente>) {
    onChangeMedidas({ ...m, ...patch });
  }

  function atualizarAbertura(lista: 'portas' | 'janelas', id: string, patch: Partial<AberturaAmbiente>) {
    atualizar({ [lista]: m[lista].map((a) => (a.id === id ? { ...a, ...patch } : a)) } as Partial<MedidasAmbiente>);
  }
  function removerAbertura(lista: 'portas' | 'janelas', id: string) {
    atualizar({ [lista]: m[lista].filter((a) => a.id !== id) } as Partial<MedidasAmbiente>);
  }

  function atualizarPonto(id: string, patch: Partial<PontoEletricoAmbiente>) {
    atualizar({ pontosEletricos: m.pontosEletricos.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }
  function removerPonto(id: string) {
    atualizar({ pontosEletricos: m.pontosEletricos.filter((p) => p.id !== id) });
  }

  const itensAtivos = m.itensResumoAtivos ?? [];
  const itensDisponiveis = ORDEM_ITENS_RESUMO.filter((chave) => !itensAtivos.includes(chave));
  function removerItemAtivo(chave: ChaveItemResumoAmbiente) {
    atualizar({ itensResumoAtivos: itensAtivos.filter((c) => c !== chave) });
  }

  // marcar 2+ itens (ex: porcelanato piso + parede, quando é o mesmo pedreiro/azulejista fazendo os
  // dois) e aplicar a SOMA das áreas de uma vez só, em vez de aplicar um de cada vez e um sobrescrever
  // a quantidade do serviço que o outro já tinha jogado.
  const [selecionados, setSelecionados] = useState<ChaveItemResumoAmbiente[]>([]);
  function toggleSelecionado(chave: ChaveItemResumoAmbiente) {
    setSelecionados((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]));
  }
  const areaPorChave: Record<ChaveItemResumoAmbiente, number> = {
    alvenaria: resumo.areaAlvenaria,
    reboco: resumo.areaReboco,
    porcelanatoPiso: resumo.areaPorcelanatoPiso,
    porcelanatoParede: resumo.areaPorcelanatoParede,
    pintura: resumo.areaPintura,
    forro: resumo.areaForro,
  };
  const somaSelecionados = selecionados.reduce((acc, c) => acc + (areaPorChave[c] || 0), 0);
  function aplicarSomaSelecionados() {
    if (selecionados.length < 2 || somaSelecionados <= 0) return;
    const nomes = selecionados.map((c) => ITENS_RESUMO_LABEL[c]).join(' + ');
    onAplicarInsumo({
      tag: `soma:${selecionados.slice().sort().join(',')}`,
      descricao: `${nomes} (calculado)`,
      unidade: 'm²',
      quantidade: somaSelecionados,
      tipo: 'parametro_calculado',
    });
  }

  return (
    <div className="medidas-ambiente">
      <button type="button" className="medidas-ambiente__toggle" onClick={() => setAberto((v) => !v)}>
        {aberto ? '▾' : '▸'} Medidas do ambiente (opcional) — calcula alvenaria, reboco, porcelanato e pontos elétricos sozinho
      </button>

      {aberto && (
        <div className="medidas-ambiente__body">
          <div className="medidas-ambiente__dimensoes">
            <label>
              Largura (m)
              <input
                type="text" inputMode="decimal"
                key={`largura-${m.largura ?? ''}`}
                defaultValue={m.largura ? formatNumberBR(m.largura) : ''}
                onBlur={(e) => atualizar({ largura: parseNumberBR(e.target.value) })}
                placeholder="1,30"
              />
            </label>
            <label>
              Comprimento (m)
              <input
                type="text" inputMode="decimal"
                key={`comprimento-${m.comprimento ?? ''}`}
                defaultValue={m.comprimento ? formatNumberBR(m.comprimento) : ''}
                onBlur={(e) => atualizar({ comprimento: parseNumberBR(e.target.value) })}
                placeholder="2,30"
              />
            </label>
            <label>
              Pé-direito / altura (m)
              <input
                type="text" inputMode="decimal"
                key={`peDireito-${m.peDireito ?? ''}`}
                defaultValue={m.peDireito ? formatNumberBR(m.peDireito) : ''}
                onBlur={(e) => atualizar({ peDireito: parseNumberBR(e.target.value) })}
                placeholder="2,50"
              />
            </label>
          </div>

          <div className="medidas-ambiente__aberturas">
            <div className="medidas-ambiente__aberturas-col">
              <div className="medidas-ambiente__aberturas-header">
                <span>Portas</span>
                <button type="button" className="btn btn-ghost" onClick={() => atualizar({ portas: [...m.portas, linhaAbertura()] })}>
                  <IconPlus size={13} /> Porta
                </button>
              </div>
              {m.portas.length === 0 && <p className="medidas-ambiente__vazio">Nenhuma porta.</p>}
              {m.portas.map((p) => (
                <div className="medidas-ambiente__abertura-linha" key={p.id}>
                  <input type="text" inputMode="decimal" placeholder="Larg." key={`pl-${p.id}-${p.largura}`} defaultValue={p.largura ? formatNumberBR(p.largura) : ''} onBlur={(e) => atualizarAbertura('portas', p.id, { largura: parseNumberBR(e.target.value) })} />
                  <span>x</span>
                  <input type="text" inputMode="decimal" placeholder="Alt." key={`pa-${p.id}-${p.altura}`} defaultValue={p.altura ? formatNumberBR(p.altura) : ''} onBlur={(e) => atualizarAbertura('portas', p.id, { altura: parseNumberBR(e.target.value) })} />
                  <input type="number" min={1} placeholder="Qtd" value={p.quantidade} onChange={(e) => atualizarAbertura('portas', p.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })} />
                  <button type="button" className="btn btn-ghost" onClick={() => removerAbertura('portas', p.id)} aria-label="Remover porta"><IconTrash size={13} /></button>
                </div>
              ))}
            </div>

            <div className="medidas-ambiente__aberturas-col">
              <div className="medidas-ambiente__aberturas-header">
                <span>Janelas</span>
                <button type="button" className="btn btn-ghost" onClick={() => atualizar({ janelas: [...m.janelas, linhaAbertura()] })}>
                  <IconPlus size={13} /> Janela
                </button>
              </div>
              {m.janelas.length === 0 && <p className="medidas-ambiente__vazio">Não tem.</p>}
              {m.janelas.map((j) => (
                <div className="medidas-ambiente__abertura-linha" key={j.id}>
                  <input type="text" inputMode="decimal" placeholder="Larg." key={`jl-${j.id}-${j.largura}`} defaultValue={j.largura ? formatNumberBR(j.largura) : ''} onBlur={(e) => atualizarAbertura('janelas', j.id, { largura: parseNumberBR(e.target.value) })} />
                  <span>x</span>
                  <input type="text" inputMode="decimal" placeholder="Alt." key={`ja-${j.id}-${j.altura}`} defaultValue={j.altura ? formatNumberBR(j.altura) : ''} onBlur={(e) => atualizarAbertura('janelas', j.id, { altura: parseNumberBR(e.target.value) })} />
                  <input type="number" min={1} placeholder="Qtd" value={j.quantidade} onChange={(e) => atualizarAbertura('janelas', j.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })} />
                  <button type="button" className="btn btn-ghost" onClick={() => removerAbertura('janelas', j.id)} aria-label="Remover janela"><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="medidas-ambiente__eletrica">
            <div className="medidas-ambiente__aberturas-header">
              <span>Elétrica — pontos</span>
              <button type="button" className="btn btn-ghost" onClick={() => atualizar({ pontosEletricos: [...m.pontosEletricos, linhaPonto()] })}>
                <IconPlus size={13} /> Ponto
              </button>
            </div>
            {m.pontosEletricos.length === 0 && <p className="medidas-ambiente__vazio">Nenhum ponto elétrico.</p>}
            {m.pontosEletricos.map((p) => (
              <div className="medidas-ambiente__ponto-linha" key={p.id}>
                <input placeholder="ex: Interruptor simples com tomada" value={p.descricao} onChange={(e) => atualizarPonto(p.id, { descricao: e.target.value })} />
                <input type="number" min={1} placeholder="Qtd" value={p.quantidade} onChange={(e) => atualizarPonto(p.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!p.descricao.trim()}
                  onClick={() => onAplicarInsumo({ tag: `eletrica:${p.id}`, descricao: p.descricao.trim(), unidade: 'pt', quantidade: p.quantidade, tipo: 'material' })}
                >
                  Aplicar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => removerPonto(p.id)} aria-label="Remover ponto"><IconTrash size={13} /></button>
              </div>
            ))}
          </div>

          <div className="medidas-ambiente__resumo">
            <div className="medidas-ambiente__resumo-header">
              <span className="medidas-ambiente__resumo-titulo">Resumo calculado</span>
              {itensDisponiveis.length > 0 && (
                <select
                  className="medidas-ambiente__add-item-select"
                  value=""
                  onChange={(e) => {
                    const chave = e.target.value as ChaveItemResumoAmbiente;
                    if (chave) atualizar({ itensResumoAtivos: [...itensAtivos, chave] });
                  }}
                >
                  <option value="">+ Adicionar item...</option>
                  {itensDisponiveis.map((chave) => (
                    <option key={chave} value={chave}>{ITENS_RESUMO_LABEL[chave]}</option>
                  ))}
                </select>
              )}
            </div>

            {itensAtivos.length === 0 ? (
              <p className="medidas-ambiente__vazio">
                Nenhum item calculado ainda — escolha "+ Adicionar item..." acima (ex: Alvenaria) pra ver o m² calculado dele.
              </p>
            ) : (
              <p className="medidas-ambiente__hint" style={{ margin: '0 0 4px' }}>
                Cada item usa as medidas do ambiente por padrão. Clique no ícone de ajuste pra detalhar parede por parede (alvenaria/reboco/porcelanato-parede/pintura) ou dar uma largura/comprimento/desconto de abertura diferente (piso/forro). O "x" tira o item da lista sem apagar o ajuste salvo. Marque a caixinha de 2+ itens (ex: porcelanato piso e parede) pra aplicar a soma dos dois juntos.
              </p>
            )}

            {selecionados.length >= 2 && (
              <div className="medidas-ambiente__soma-selecionados">
                <span>{selecionados.map((c) => ITENS_RESUMO_LABEL[c]).join(' + ')} = <strong>{formatNumberBR(somaSelecionados)} m²</strong></span>
                <button type="button" className="btn btn-secondary" disabled={somaSelecionados <= 0} onClick={aplicarSomaSelecionados}>
                  Aplicar soma
                </button>
              </div>
            )}

            {itensAtivos.includes('alvenaria') && (
              <LinhaResumoItem
                label="Alvenaria" tipoItem="parede"
                area={resumo.areaAlvenaria} m={m}
                config={m.configAlvenaria}
                onConfigChange={(cfg) => atualizar({ configAlvenaria: cfg })}
                onRemover={() => removerItemAtivo('alvenaria')}
                onAplicar={() => onAplicarInsumo({ tag: 'alvenaria', descricao: 'Alvenaria (calculado)', unidade: 'm²', quantidade: resumo.areaAlvenaria, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('alvenaria')}
                onToggleSelecionado={() => toggleSelecionado('alvenaria')}
              />
            )}
            {itensAtivos.includes('reboco') && (
              <LinhaResumoItem
                label="Reboco" tipoItem="parede"
                area={resumo.areaReboco} m={m}
                config={m.configReboco}
                onConfigChange={(cfg) => atualizar({ configReboco: cfg })}
                onRemover={() => removerItemAtivo('reboco')}
                onAplicar={() => onAplicarInsumo({ tag: 'reboco-parede', descricao: 'Reboco de parede (calculado)', unidade: 'm²', quantidade: resumo.areaReboco, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('reboco')}
                onToggleSelecionado={() => toggleSelecionado('reboco')}
              />
            )}
            {itensAtivos.includes('porcelanatoPiso') && (
              <LinhaResumoItem
                label="Porcelanato — piso" tipoItem="plano"
                area={resumo.areaPorcelanatoPiso} m={m}
                config={m.configPorcelanatoPiso}
                onConfigChange={(cfg) => atualizar({ configPorcelanatoPiso: cfg })}
                onRemover={() => removerItemAtivo('porcelanatoPiso')}
                onAplicar={() => onAplicarInsumo({ tag: 'porcelanato-piso', descricao: 'Porcelanato para piso (calculado)', unidade: 'm²', quantidade: resumo.areaPorcelanatoPiso, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('porcelanatoPiso')}
                onToggleSelecionado={() => toggleSelecionado('porcelanatoPiso')}
              />
            )}
            {itensAtivos.includes('porcelanatoParede') && (
              <LinhaResumoItem
                label="Porcelanato — parede" tipoItem="parede"
                area={resumo.areaPorcelanatoParede} m={m}
                config={m.configPorcelanatoParede}
                onConfigChange={(cfg) => atualizar({ configPorcelanatoParede: cfg })}
                onRemover={() => removerItemAtivo('porcelanatoParede')}
                onAplicar={() => onAplicarInsumo({ tag: 'porcelanato-parede', descricao: 'Porcelanato para parede (calculado)', unidade: 'm²', quantidade: resumo.areaPorcelanatoParede, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('porcelanatoParede')}
                onToggleSelecionado={() => toggleSelecionado('porcelanatoParede')}
              />
            )}
            {itensAtivos.includes('pintura') && (
              <LinhaResumoItem
                label="Pintura" tipoItem="parede"
                area={resumo.areaPintura} m={m}
                config={m.configPintura}
                onConfigChange={(cfg) => atualizar({ configPintura: cfg })}
                onRemover={() => removerItemAtivo('pintura')}
                onAplicar={() => onAplicarInsumo({ tag: 'pintura', descricao: 'Pintura de parede (calculado)', unidade: 'm²', quantidade: resumo.areaPintura, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('pintura')}
                onToggleSelecionado={() => toggleSelecionado('pintura')}
              />
            )}
            {itensAtivos.includes('forro') && (
              <LinhaResumoItem
                label="Forro (teto)" tipoItem="plano"
                area={resumo.areaForro} m={m}
                config={m.configForro}
                onConfigChange={(cfg) => atualizar({ configForro: cfg })}
                onRemover={() => removerItemAtivo('forro')}
                onAplicar={() => onAplicarInsumo({ tag: 'forro', descricao: 'Forro (calculado)', unidade: 'm²', quantidade: resumo.areaForro, tipo: 'parametro_calculado' })}
                selecionado={selecionados.includes('forro')}
                onToggleSelecionado={() => toggleSelecionado('forro')}
              />
            )}

            <div className="medidas-ambiente__resumo-linha medidas-ambiente__resumo-linha--simples">
              <span>Total de pontos elétricos</span>
              <strong>{resumo.totalPontosEletricos}</strong>
            </div>
            {itensAtivos.length > 0 && (
              <p className="medidas-ambiente__hint">
                "Aplicar" cria ou atualiza a linha correspondente lá embaixo, nos insumos — clicar de novo depois de mudar as medidas atualiza a mesma linha.
                Se preferir, ignore o cálculo e digite/ajuste a quantidade direto na tabela de insumos, como sempre.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface LinhaResumoItemProps {
  label: string;
  tipoItem: 'parede' | 'plano'; // parede = alvenaria/reboco/porcelanato-parede/pintura (usa altura); plano = piso/teto
  area: number;
  m: MedidasAmbiente;
  config: ConfigItemAmbiente | undefined;
  onConfigChange: (cfg: ConfigItemAmbiente | undefined) => void;
  onRemover: () => void;
  onAplicar: () => void;
  selecionado: boolean;
  onToggleSelecionado: () => void;
}

function campoVazio(cfg: ConfigItemAmbiente | undefined): boolean {
  return (
    !cfg ||
    (!cfg.areaDireta &&
      !(cfg.segmentos && cfg.segmentos.length > 0) &&
      !(cfg.segmentosPlanos && cfg.segmentosPlanos.length > 0) &&
      !cfg.largura &&
      !cfg.comprimento &&
      !cfg.aberturas)
  );
}

function novoSegmento(metroLinearPadrao: number, alturaPadrao: number): SegmentoParede {
  return { id: generateId(), metroLinear: metroLinearPadrao, altura: alturaPadrao };
}

function novoSegmentoPlano(larguraPadrao: number, comprimentoPadrao: number): SegmentoPlano {
  return { id: generateId(), largura: larguraPadrao, comprimento: comprimentoPadrao };
}

/** Linha do resumo pra 1 item calculado — mostra a área e um botão "Aplicar", e (atrás do ícone de
 * ajuste) um mini formulário com os campos certos pro tipo do item: parede (alvenaria, reboco,
 * porcelanato-parede, pintura) usa metro linear x altura; plano (piso, forro) usa largura x
 * comprimento. Campo vazio = usa o valor geral do ambiente. */
function LinhaResumoItem({ label, tipoItem, area, m, config, onConfigChange, onRemover, onAplicar, selecionado, onToggleSelecionado }: LinhaResumoItemProps) {
  // sempre começa fechado, mesmo quando já tem um ajuste salvo — só expande se o usuário clicar
  // no ícone; o valor calculado (com o ajuste aplicado) já aparece na linha, então não precisa
  // abrir o painel só pra "avisar" que tem uma personalização.
  const [expandido, setExpandido] = useState(false);

  function set(patch: Partial<ConfigItemAmbiente>) {
    const novo = { ...(config ?? {}), ...patch };
    onConfigChange(campoVazio(novo) ? undefined : novo);
  }

  const metroLinearPadrao = (m.largura ?? 0) + (m.comprimento ?? 0);
  const alturaPadrao = m.peDireito ?? 0;
  const segmentos = config?.segmentos ?? [];

  function setSegmentos(novos: SegmentoParede[]) {
    set({ segmentos: novos.length > 0 ? novos : undefined });
  }
  function atualizarSegmento(id: string, patch: Partial<SegmentoParede>) {
    setSegmentos(segmentos.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removerSegmento(id: string) {
    setSegmentos(segmentos.filter((s) => s.id !== id));
  }

  const segmentosPlanos = config?.segmentosPlanos ?? [];
  function setSegmentosPlanos(novos: SegmentoPlano[]) {
    set({ segmentosPlanos: novos.length > 0 ? novos : undefined });
  }
  function atualizarSegmentoPlano(id: string, patch: Partial<SegmentoPlano>) {
    setSegmentosPlanos(segmentosPlanos.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removerSegmentoPlano(id: string) {
    setSegmentosPlanos(segmentosPlanos.filter((s) => s.id !== id));
  }

  return (
    <div className="medidas-ambiente__item-resumo">
      <div className="medidas-ambiente__resumo-linha">
        <input
          type="checkbox"
          checked={selecionado}
          onChange={onToggleSelecionado}
          title="Marcar pra somar com outro item e aplicar os dois juntos"
          aria-label={`Selecionar ${label} para somar`}
        />
        <span>{label}</span>
        <button
          type="button"
          className={`btn btn-ghost medidas-ambiente__ajuste-btn${!campoVazio(config) ? ' is-ativo' : ''}`}
          onClick={() => setExpandido((v) => !v)}
          title={tipoItem === 'parede' ? 'Detalhar parede por parede (metro linear x altura) ou dar um desconto de abertura só deste item' : 'Personalizar largura/comprimento/abertura só deste item'}
          aria-label="Personalizar este item"
        >
          <IconAdjustments size={14} />
        </button>
        <strong>{formatNumberBR(area)} m²</strong>
        <button type="button" className="btn btn-secondary" disabled={area <= 0} onClick={onAplicar}>
          Aplicar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRemover} aria-label={`Tirar ${label} do resumo`} title="Tirar do resumo (não apaga o ajuste, só deixa de mostrar)">
          <IconX size={14} />
        </button>
      </div>
      {expandido && (
        <div className="medidas-ambiente__ajuste-painel">
          <label className="medidas-ambiente__area-direta">
            Já sei o m² — digitar direto (ignora o resto do cálculo abaixo)
            <input
              type="text" inputMode="decimal"
              key={`areaDireta-${label}-${config?.areaDireta ?? ''}`}
              defaultValue={config?.areaDireta ? formatNumberBR(config.areaDireta) : ''}
              placeholder="ex: 18,50"
              onBlur={(e) => set({ areaDireta: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
            />
          </label>
          {!!config?.areaDireta && (
            <p className="medidas-ambiente__vazio">Usando {formatNumberBR(config.areaDireta)} m² direto — o cálculo abaixo fica desativado. Apague o campo acima pra voltar a calcular.</p>
          )}
          <div className={config?.areaDireta ? 'medidas-ambiente__calculo-desativado' : undefined}>
          {tipoItem === 'parede' ? (
            <div className="medidas-ambiente__segmentos">
              <div className="medidas-ambiente__aberturas-header">
                <span>Paredes (metro linear x altura)</span>
                <button type="button" className="btn btn-ghost" onClick={() => setSegmentos([...segmentos, novoSegmento(metroLinearPadrao, alturaPadrao)])}>
                  <IconPlus size={13} /> Parede
                </button>
              </div>
              {segmentos.length === 0 && (
                <p className="medidas-ambiente__vazio">
                  Nenhuma parede detalhada — usando {formatNumberBR(metroLinearPadrao)}m x {formatNumberBR(alturaPadrao)}m (largura+comprimento x pé-direito do ambiente).
                </p>
              )}
              {segmentos.map((s, i) => (
                <div className="medidas-ambiente__segmento-linha" key={s.id}>
                  <span className="medidas-ambiente__segmento-numero">{i + 1}</span>
                  <input
                    type="text" inputMode="decimal" placeholder="Metro linear"
                    key={`ml-${s.id}-${s.metroLinear}`}
                    defaultValue={s.metroLinear ? formatNumberBR(s.metroLinear) : ''}
                    onBlur={(e) => atualizarSegmento(s.id, { metroLinear: parseNumberBR(e.target.value) })}
                  />
                  <span>x</span>
                  <input
                    type="text" inputMode="decimal" placeholder="Altura"
                    key={`alt-${s.id}-${s.altura}`}
                    defaultValue={s.altura ? formatNumberBR(s.altura) : ''}
                    onBlur={(e) => atualizarSegmento(s.id, { altura: parseNumberBR(e.target.value) })}
                  />
                  <span className="medidas-ambiente__segmento-area">{formatNumberBR(s.metroLinear * s.altura)} m²</span>
                  <button type="button" className="btn btn-ghost" onClick={() => removerSegmento(s.id)} aria-label="Remover parede"><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="medidas-ambiente__segmentos">
              <div className="medidas-ambiente__aberturas-header">
                <span>Áreas (largura x comprimento)</span>
                <button type="button" className="btn btn-ghost" onClick={() => setSegmentosPlanos([...segmentosPlanos, novoSegmentoPlano(m.largura ?? 0, m.comprimento ?? 0)])}>
                  <IconPlus size={13} /> Área
                </button>
              </div>
              {segmentosPlanos.length === 0 && (
                <p className="medidas-ambiente__vazio">
                  Nenhuma área detalhada — usando {formatNumberBR(m.largura ?? 0)}m x {formatNumberBR(m.comprimento ?? 0)}m (largura x comprimento do ambiente).
                </p>
              )}
              {segmentosPlanos.map((s, i) => (
                <div className="medidas-ambiente__segmento-linha" key={s.id}>
                  <span className="medidas-ambiente__segmento-numero">{i + 1}</span>
                  <input
                    type="text" inputMode="decimal" placeholder="Largura"
                    key={`spl-${s.id}-${s.largura}`}
                    defaultValue={s.largura ? formatNumberBR(s.largura) : ''}
                    onBlur={(e) => atualizarSegmentoPlano(s.id, { largura: parseNumberBR(e.target.value) })}
                  />
                  <span>x</span>
                  <input
                    type="text" inputMode="decimal" placeholder="Comprimento"
                    key={`spc-${s.id}-${s.comprimento}`}
                    defaultValue={s.comprimento ? formatNumberBR(s.comprimento) : ''}
                    onBlur={(e) => atualizarSegmentoPlano(s.id, { comprimento: parseNumberBR(e.target.value) })}
                  />
                  <span className="medidas-ambiente__segmento-area">{formatNumberBR(s.largura * s.comprimento)} m²</span>
                  <button type="button" className="btn btn-ghost" onClick={() => removerSegmentoPlano(s.id)} aria-label="Remover área"><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <label className="medidas-ambiente__abertura-item">
            Abertura a descontar (m²)
            <input
              type="text" inputMode="decimal"
              key={`aberturas-${label}-${config?.aberturas ?? ''}`}
              defaultValue={config?.aberturas ? formatNumberBR(config.aberturas) : ''}
              placeholder="0"
              onBlur={(e) => set({ aberturas: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
            />
          </label>
          </div>
        </div>
      )}
    </div>
  );
}
