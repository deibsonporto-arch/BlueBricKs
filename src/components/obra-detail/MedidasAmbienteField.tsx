import { useState } from 'react';
import { IconAdjustments, IconPlus, IconTrash } from '@tabler/icons-react';
import type { AberturaAmbiente, ConfigItemAmbiente, MedidasAmbiente, PontoEletricoAmbiente, TipoInsumoAtividade } from '../../types/domain';
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
            <span className="medidas-ambiente__resumo-titulo">Resumo calculado</span>
            <p className="medidas-ambiente__hint" style={{ margin: '0 0 4px' }}>
              Cada item usa a largura/comprimento/pé-direito do ambiente por padrão. Clique no ícone de ajuste pra dar uma largura, comprimento, altura ou desconto de abertura diferente só pra aquele item.
            </p>

            <LinhaResumoItem
              label="Alvenaria" tipoItem="parede"
              area={resumo.areaAlvenaria} m={m}
              config={m.configAlvenaria}
              onConfigChange={(cfg) => atualizar({ configAlvenaria: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'alvenaria', descricao: 'Alvenaria (calculado)', unidade: 'm²', quantidade: resumo.areaAlvenaria, tipo: 'material' })}
            />
            <LinhaResumoItem
              label="Reboco" tipoItem="parede"
              area={resumo.areaReboco} m={m}
              config={m.configReboco}
              onConfigChange={(cfg) => atualizar({ configReboco: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'reboco-parede', descricao: 'Reboco de parede (calculado)', unidade: 'm²', quantidade: resumo.areaReboco, tipo: 'material' })}
            />
            <LinhaResumoItem
              label="Porcelanato — piso" tipoItem="plano"
              area={resumo.areaPorcelanatoPiso} m={m}
              config={m.configPorcelanatoPiso}
              onConfigChange={(cfg) => atualizar({ configPorcelanatoPiso: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'porcelanato-piso', descricao: 'Porcelanato para piso (calculado)', unidade: 'm²', quantidade: resumo.areaPorcelanatoPiso, tipo: 'material' })}
            />
            <LinhaResumoItem
              label="Porcelanato — parede" tipoItem="parede"
              area={resumo.areaPorcelanatoParede} m={m}
              config={m.configPorcelanatoParede}
              onConfigChange={(cfg) => atualizar({ configPorcelanatoParede: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'porcelanato-parede', descricao: 'Porcelanato para parede (calculado)', unidade: 'm²', quantidade: resumo.areaPorcelanatoParede, tipo: 'material' })}
            />
            <LinhaResumoItem
              label="Pintura" tipoItem="parede"
              area={resumo.areaPintura} m={m}
              config={m.configPintura}
              onConfigChange={(cfg) => atualizar({ configPintura: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'pintura', descricao: 'Pintura de parede (calculado)', unidade: 'm²', quantidade: resumo.areaPintura, tipo: 'material' })}
            />
            <LinhaResumoItem
              label="Forro (teto)" tipoItem="plano"
              area={resumo.areaForro} m={m}
              config={m.configForro}
              onConfigChange={(cfg) => atualizar({ configForro: cfg })}
              onAplicar={() => onAplicarInsumo({ tag: 'forro', descricao: 'Forro (calculado)', unidade: 'm²', quantidade: resumo.areaForro, tipo: 'material' })}
            />
            <div className="medidas-ambiente__resumo-linha medidas-ambiente__resumo-linha--simples">
              <span>Total de pontos elétricos</span>
              <strong>{resumo.totalPontosEletricos}</strong>
            </div>
            <p className="medidas-ambiente__hint">
              "Aplicar" cria ou atualiza a linha correspondente lá embaixo, nos insumos — clicar de novo depois de mudar as medidas atualiza a mesma linha.
              Se preferir, ignore o cálculo e digite/ajuste a quantidade direto na tabela de insumos, como sempre.
            </p>
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
  onAplicar: () => void;
}

function campoVazio(cfg: ConfigItemAmbiente | undefined): boolean {
  return !cfg || (!cfg.metroLinear && !cfg.largura && !cfg.comprimento && !cfg.altura && !cfg.aberturas);
}

/** Linha do resumo pra 1 item calculado — mostra a área e um botão "Aplicar", e (atrás do ícone de
 * ajuste) um mini formulário com os campos certos pro tipo do item: parede (alvenaria, reboco,
 * porcelanato-parede, pintura) usa metro linear x altura; plano (piso, forro) usa largura x
 * comprimento. Campo vazio = usa o valor geral do ambiente. */
function LinhaResumoItem({ label, tipoItem, area, m, config, onConfigChange, onAplicar }: LinhaResumoItemProps) {
  const [expandido, setExpandido] = useState(!campoVazio(config));

  function set(patch: Partial<ConfigItemAmbiente>) {
    const novo = { ...(config ?? {}), ...patch };
    onConfigChange(campoVazio(novo) ? undefined : novo);
  }

  const metroLinearPadrao = (m.largura ?? 0) + (m.comprimento ?? 0);

  return (
    <div className="medidas-ambiente__item-resumo">
      <div className="medidas-ambiente__resumo-linha">
        <span>{label}</span>
        <button
          type="button"
          className={`btn btn-ghost medidas-ambiente__ajuste-btn${!campoVazio(config) ? ' is-ativo' : ''}`}
          onClick={() => setExpandido((v) => !v)}
          title={tipoItem === 'parede' ? 'Personalizar metro linear/altura/abertura só deste item' : 'Personalizar largura/comprimento/abertura só deste item'}
          aria-label="Personalizar este item"
        >
          <IconAdjustments size={14} />
        </button>
        <strong>{formatNumberBR(area)} m²</strong>
        <button type="button" className="btn btn-secondary" disabled={area <= 0} onClick={onAplicar}>
          Aplicar
        </button>
      </div>
      {expandido && (
        <div className="medidas-ambiente__ajuste-painel">
          {tipoItem === 'parede' ? (
            <>
              <label>
                Metro linear
                <input
                  type="text" inputMode="decimal"
                  key={`metroLinear-${label}-${config?.metroLinear ?? ''}`}
                  defaultValue={config?.metroLinear ? formatNumberBR(config.metroLinear) : ''}
                  placeholder={metroLinearPadrao ? formatNumberBR(metroLinearPadrao) : '—'}
                  onBlur={(e) => set({ metroLinear: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
                />
              </label>
              <label>
                Altura
                <input
                  type="text" inputMode="decimal"
                  key={`altura-${label}-${config?.altura ?? ''}`}
                  defaultValue={config?.altura ? formatNumberBR(config.altura) : ''}
                  placeholder={m.peDireito ? formatNumberBR(m.peDireito) : '—'}
                  onBlur={(e) => set({ altura: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Larg.
                <input
                  type="text" inputMode="decimal"
                  key={`largura-${label}-${config?.largura ?? ''}`}
                  defaultValue={config?.largura ? formatNumberBR(config.largura) : ''}
                  placeholder={m.largura ? formatNumberBR(m.largura) : '—'}
                  onBlur={(e) => set({ largura: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
                />
              </label>
              <label>
                Compr.
                <input
                  type="text" inputMode="decimal"
                  key={`comprimento-${label}-${config?.comprimento ?? ''}`}
                  defaultValue={config?.comprimento ? formatNumberBR(config.comprimento) : ''}
                  placeholder={m.comprimento ? formatNumberBR(m.comprimento) : '—'}
                  onBlur={(e) => set({ comprimento: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
                />
              </label>
            </>
          )}
          <label>
            Abertura (m²)
            <input
              type="text" inputMode="decimal"
              key={`aberturas-${label}-${config?.aberturas ?? ''}`}
              defaultValue={config?.aberturas ? formatNumberBR(config.aberturas) : ''}
              placeholder="0"
              onBlur={(e) => set({ aberturas: e.target.value.trim() ? parseNumberBR(e.target.value) : undefined })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
