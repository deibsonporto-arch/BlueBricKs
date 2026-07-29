import type { UnidadeMedida } from '../../types/domain';

export interface ItemExtraido {
  descricao: string;
  quantidade?: number;
  unidade?: UnidadeMedida;
  valorUnitario?: number;
  valorTotal?: number;
}

export type CategoriaDetectada = 'material' | 'servico' | 'indeterminado';
export type NivelConfianca = 'alta' | 'media' | 'baixa';

export interface NotaFiscalExtraida {
  fornecedorNome?: string;
  fornecedorDocumento?: string; // CNPJ/CPF, só dígitos
  numeroNF?: string;
  data?: string; // ISO date
  categoriaDetectada: CategoriaDetectada;
  itens: ItemExtraido[];
  valorTotal?: number;
  confianca: NivelConfianca;
}
