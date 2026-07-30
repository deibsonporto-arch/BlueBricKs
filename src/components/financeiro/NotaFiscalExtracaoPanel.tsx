import { useMemo } from 'react';
import { IconDownload, IconX } from '@tabler/icons-react';
import type { Fornecedor, MaterialCatalogItem } from '../../types/domain';
import type { NotaFiscalExtraida } from '../../utils/notaFiscal/extractNotaFiscal';
import { mapItensExtraidosParaProdutos, type ItemMaterialConfirmado } from '../../utils/notaFiscal/produtoLancamento';
import { formatBRL } from '../../utils/currency';
import './NotaFiscalExtracaoPanel.css';

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
  onImportarItens: (itens: ItemMaterialConfirmado[]) => void;
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
  onImportarItens,
  onDispensar,
}: NotaFiscalExtracaoPanelProps) {
  const temItens = extraida.categoriaDetectada === 'material' && extraida.itens.length > 0;
  const descricaoServicoDetectada =
    extraida.categoriaDetectada === 'servico' ? extraida.itens[0]?.descricao : undefined;

  const fornecedorSugerido = useMemo(() => {
    if (!extraida.fornecedorDocumento) return undefined;
    return fornecedores.find((f) => f.documento.replace(/\D/g, '') === extraida.fornecedorDocumento);
  }, [fornecedores, extraida.fornecedorDocumento]);

  const nenhumaSugestaoDeCabecalho =
    (extraida.valorTotal === undefined || !!valorAtual) &&
    (!descricaoServicoDetectada || !!descricaoAtual) &&
    (temItens || descricaoServicoDetectada || !extraida.fornecedorNome || !!descricaoAtual) &&
    (!fornecedorSugerido || fornecedorIdAtual === fornecedorSugerido.id) &&
    (!extraida.numeroNF || !!numeroNFAtual) &&
    !temItens;

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
          {descricaoServicoDetectada && !descricaoAtual && (
            <button type="button" className="btn btn-secondary" onClick={() => onAplicarDescricao(descricaoServicoDetectada)}>
              Usar descrição da nota: "{descricaoServicoDetectada}"
            </button>
          )}
          {!descricaoServicoDetectada && !temItens && extraida.fornecedorNome && !descricaoAtual && (
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

      {temItens && (
        <div className="nota-extracao-panel__itens">
          <p className="nota-extracao-panel__itens-hint">
            {extraida.itens.length} produto(s) detectado(s) na nota:{' '}
            {extraida.itens.map((i) => i.descricao).join(', ')}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onImportarItens(mapItensExtraidosParaProdutos(extraida.itens, materiaisCatalogo))}
          >
            <IconDownload size={14} /> Importar para a lista de produtos
          </button>
        </div>
      )}
    </div>
  );
}
