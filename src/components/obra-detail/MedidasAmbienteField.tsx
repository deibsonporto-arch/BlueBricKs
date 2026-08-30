import { useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { AberturaAmbiente, MedidasAmbiente, PontoEletricoAmbiente, TipoInsumoAtividade } from '../../types/domain';
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
                value={m.largura ? formatNumberBR(m.largura) : ''}
                onChange={(e) => atualizar({ largura: parseNumberBR(e.target.value) })}
                placeholder="1,30"
              />
            </label>
            <label>
              Comprimento (m)
              <input
                type="text" inputMode="decimal"
                value={m.comprimento ? formatNumberBR(m.comprimento) : ''}
                onChange={(e) => atualizar({ comprimento: parseNumberBR(e.target.value) })}
                placeholder="2,30"
              />
            </label>
            <label>
              Pé-direito / altura (m)
              <input
                type="text" inputMode="decimal"
                value={m.peDireito ? formatNumberBR(m.peDireito) : ''}
                onChange={(e) => atualizar({ peDireito: parseNumberBR(e.target.value) })}
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
                  <input type="text" inputMode="decimal" placeholder="Larg." value={p.largura ? formatNumberBR(p.largura) : ''} onChange={(e) => atualizarAbertura('portas', p.id, { largura: parseNumberBR(e.target.value) })} />
                  <span>x</span>
                  <input type="text" inputMode="decimal" placeholder="Alt." value={p.altura ? formatNumberBR(p.altura) : ''} onChange={(e) => atualizarAbertura('portas', p.id, { altura: parseNumberBR(e.target.value) })} />
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
                  <input type="text" inputMode="decimal" placeholder="Larg." value={j.largura ? formatNumberBR(j.largura) : ''} onChange={(e) => atualizarAbertura('janelas', j.id, { largura: parseNumberBR(e.target.value) })} />
                  <span>x</span>
                  <input type="text" inputMode="decimal" placeholder="Alt." value={j.altura ? formatNumberBR(j.altura) : ''} onChange={(e) => atualizarAbertura('janelas', j.id, { altura: parseNumberBR(e.target.value) })} />
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
            <div className="medidas-ambiente__resumo-linha">
              <span>Alvenaria (parede líquida)</span>
              <strong>{formatNumberBR(resumo.areaLiquidaParede)} m²</strong>
              <button type="button" className="btn btn-secondary" disabled={resumo.areaLiquidaParede <= 0} onClick={() => onAplicarInsumo({ tag: 'alvenaria', descricao: 'Alvenaria (calculado)', unidade: 'm²', quantidade: resumo.areaLiquidaParede, tipo: 'material' })}>
                Aplicar
              </button>
            </div>
            <div className="medidas-ambiente__resumo-linha">
              <span>Reboco (parede líquida)</span>
              <strong>{formatNumberBR(resumo.areaLiquidaParede)} m²</strong>
              <button type="button" className="btn btn-secondary" disabled={resumo.areaLiquidaParede <= 0} onClick={() => onAplicarInsumo({ tag: 'reboco-parede', descricao: 'Reboco de parede (calculado)', unidade: 'm²', quantidade: resumo.areaLiquidaParede, tipo: 'material' })}>
                Aplicar
              </button>
            </div>
            <div className="medidas-ambiente__resumo-linha">
              <span>Porcelanato — piso</span>
              <strong>{formatNumberBR(resumo.areaPiso)} m²</strong>
              <button type="button" className="btn btn-secondary" disabled={resumo.areaPiso <= 0} onClick={() => onAplicarInsumo({ tag: 'porcelanato-piso', descricao: 'Porcelanato para piso (calculado)', unidade: 'm²', quantidade: resumo.areaPiso, tipo: 'material' })}>
                Aplicar
              </button>
            </div>
            <div className="medidas-ambiente__resumo-linha">
              <span>Porcelanato — parede</span>
              <strong>{formatNumberBR(resumo.areaLiquidaParede)} m²</strong>
              <button type="button" className="btn btn-secondary" disabled={resumo.areaLiquidaParede <= 0} onClick={() => onAplicarInsumo({ tag: 'porcelanato-parede', descricao: 'Porcelanato para parede (calculado)', unidade: 'm²', quantidade: resumo.areaLiquidaParede, tipo: 'material' })}>
                Aplicar
              </button>
            </div>
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
