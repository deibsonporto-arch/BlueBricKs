import { useMemo, useState } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { Fornecedor, MaterialCatalogItem, UnidadeMedida } from '../../types/domain';
import type { NotaFiscalExtraida } from '../../utils/notaFiscal/extractNotaFiscal';
import { formatBRL } from '../../utils/currency';
import './NotaFiscalExtracaoPanel.css';

export interface ItemMaterialConfirmado {
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  valorUnitario: number;
  valorTotal: number;
  materialCatalogId?: string; // preenchido quando casou com um material já cadastrado
  categoriaNovoMaterial: string; // usada só quando materialCatalogId está ausente (material novo)
}

interface Linha extends ItemMaterialConfirmado {
  incluida: boolean;
}

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function casarMaterial(nome: string, catalogo: MaterialCatalogItem[]): MaterialCatalogItem | undefined {
  const alvo = normalizar(nome);
  if (!alvo) return undefined;
  return (
    catalogo.find((m) => normalizar(m.nome) === alvo) ??
    catalogo.find((m) => alvo.includes(normalizar(m.nome)) || normalizar(m.nome).includes(alvo))
  );
}

const CONFIANCA_LABEL: Record<NotaFiscalExtraida['confianca'], string> = {
  alta: 'confiança alta — dados vieram do XML da nota',
  media: 'confiança média — leitura do texto do PDF, confira com atenção',
  baixa: 'confiança baixa — leitura por OCR da imagem, confira com atenção',
};

interface NotaFiscalExtracaoPanelProps {
  extraida: NotaFiscalExtraida;
  fornecedores: Fornecedor[];
  materiaisCatalogo: MaterialCatalogItem[];
  descricaoAtual: string;
  valorAtual: string;
  fornecedorIdAtual: string;
  numeroNFAtual: string;
  onAplicarDescricao: (valor: string) => void;
  onAplicarValor: (valor: number) => void;
  onSelecionarFornecedor: (fornecedorId: string) => void;
  onAplicarNumeroNF: (valor: string) => void;
  onConfirmarItens: (itens: ItemMaterialConfirmado[]) => void;
  onDispensar: () => void;
}

export function NotaFiscalExtracaoPanel({
  extraida,
  fornecedores,
  materiaisCatalogo,
  descricaoAtual,
  valorAtual,
  fornecedorIdAtual,
  numeroNFAtual,
  onAplicarDescricao,
  onAplicarValor,
  onSelecionarFornecedor,
  onAplicarNumeroNF,
  onConfirmarItens,
  onDispensar,
}: NotaFiscalExtracaoPanelProps) {
  const mostrarItens = extraida.categoriaDetectada === 'material' && extraida.itens.length > 0;

  const [linhas, setLinhas] = useState<Linha[]>(() =>
    extraida.itens.map((item) => {
      const casado = casarMaterial(item.descricao, materiaisCatalogo);
      const quantidade = item.quantidade ?? 1;
      const valorUnitario = item.valorUnitario ?? 0;
      return {
        nome: casado?.nome ?? item.descricao,
        quantidade,
        unidade: casado?.unidade ?? item.unidade ?? 'un',
        valorUnitario,
        valorTotal: item.valorTotal ?? quantidade * valorUnitario,
        materialCatalogId: casado?.id,
        categoriaNovoMaterial: casado?.categoria ?? '',
        incluida: true,
      };
    }),
  );
  const [confirmado, setConfirmado] = useState(false);

  const fornecedorSugerido = useMemo(() => {
    if (!extraida.fornecedorDocumento) return undefined;
    return fornecedores.find((f) => f.documento.replace(/\D/g, '') === extraida.fornecedorDocumento);
  }, [fornecedores, extraida.fornecedorDocumento]);

  function atualizarLinha(idx: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function reconferirMaterial(idx: number) {
    setLinhas((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const casado = casarMaterial(l.nome, materiaisCatalogo);
        return { ...l, materialCatalogId: casado?.id, categoriaNovoMaterial: casado?.categoria ?? l.categoriaNovoMaterial };
      }),
    );
  }

  function confirmarItens() {
    onConfirmarItens(linhas.filter((l) => l.incluida).map(({ incluida: _incluida, ...resto }) => resto));
    setConfirmado(true);
  }

  const nenhumaSugestaoDeCabecalho =
    (extraida.valorTotal === undefined || !!valorAtual) &&
    (mostrarItens || !extraida.fornecedorNome || !!descricaoAtual) &&
    (!fornecedorSugerido || fornecedorIdAtual === fornecedorSugerido.id) &&
    (!extraida.numeroNF || !!numeroNFAtual);

  return (
    <div className="nota-extracao-panel">
      <div className="nota-extracao-panel__header">
        <strong>Dados extraídos da nota fiscal</strong>
        <span className="nota-extracao-panel__confianca">{CONFIANCA_LABEL[extraida.confianca]}</span>
        <button type="button" className="btn btn-ghost" onClick={onDispensar} aria-label="Dispensar dados extraídos">
          <IconX size={14} />
        </button>
      </div>

      {extraida.data && (
        <p className="nota-extracao-panel__hint">Data da nota: {extraida.data.split('-').reverse().join('/')} (usada no histórico de preços)</p>
      )}

      {!nenhumaSugestaoDeCabecalho && (
        <div className="nota-extracao-panel__sugestoes">
          {extraida.valorTotal !== undefined && !valorAtual && (
            <button type="button" className="btn btn-secondary" onClick={() => onAplicarValor(extraida.valorTotal!)}>
              Usar valor {formatBRL(extraida.valorTotal)}
            </button>
          )}
          {!mostrarItens && extraida.fornecedorNome && !descricaoAtual && (
            <button type="button" className="btn btn-secondary" onClick={() => onAplicarDescricao(extraida.fornecedorNome!)}>
              Usar "{extraida.fornecedorNome}" como descrição
            </button>
          )}
          {fornecedorSugerido && fornecedorIdAtual !== fornecedorSugerido.id && (
            <button type="button" className="btn btn-secondary" onClick={() => onSelecionarFornecedor(fornecedorSugerido.id)}>
              Usar fornecedor {fornecedorSugerido.nome}
            </button>
          )}
          {extraida.numeroNF && !numeroNFAtual && (
            <button type="button" className="btn btn-secondary" onClick={() => onAplicarNumeroNF(extraida.numeroNF!)}>
              Usar número da NF {extraida.numeroNF}
            </button>
          )}
        </div>
      )}
      {!fornecedorSugerido && extraida.fornecedorNome && (
        <p className="nota-extracao-panel__hint">
          Fornecedor detectado: "{extraida.fornecedorNome}" — não achei no cadastro, selecione ou cadastre manualmente acima.
        </p>
      )}

      {mostrarItens && (
        <div className="nota-extracao-panel__itens">
          <p className="nota-extracao-panel__itens-hint">
            {confirmado
              ? `✓ ${linhas.filter((l) => l.incluida).length} item(ns) confirmados — serão salvos no catálogo de materiais e no histórico de preços ao salvar o lançamento.`
              : 'Itens da nota — confira nome, quantidade e valor antes de confirmar:'}
          </p>
          {!confirmado &&
            linhas.map((linha, idx) => (
              <div className="nota-extracao-panel__linha" key={idx}>
                <label className="nota-extracao-panel__linha-check">
                  <input type="checkbox" checked={linha.incluida} onChange={(e) => atualizarLinha(idx, { incluida: e.target.checked })} />
                </label>
                <input
                  value={linha.nome}
                  onChange={(e) => atualizarLinha(idx, { nome: e.target.value })}
                  onBlur={() => reconferirMaterial(idx)}
                  list="nota-extracao-materiais-catalogo"
                  placeholder="Nome do material"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={linha.quantidade}
                  onChange={(e) => atualizarLinha(idx, { quantidade: Number(e.target.value) })}
                />
                <select value={linha.unidade} onChange={(e) => atualizarLinha(idx, { unidade: e.target.value as UnidadeMedida })}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={linha.valorUnitario}
                  onChange={(e) => atualizarLinha(idx, { valorUnitario: Number(e.target.value) })}
                />
                <span className="nota-extracao-panel__linha-status">{linha.materialCatalogId ? 'material existente' : 'novo material'}</span>
              </div>
            ))}
          <datalist id="nota-extracao-materiais-catalogo">
            {materiaisCatalogo.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
          {!confirmado && (
            <button type="button" className="btn btn-primary" onClick={confirmarItens}>
              <IconCheck size={14} /> Confirmar dados extraídos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
