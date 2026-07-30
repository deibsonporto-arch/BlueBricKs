import type { MaterialCatalogItem, UnidadeMedida } from '../../types/domain';
import type { ItemExtraido } from './types';

export interface ItemMaterialConfirmado {
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  valorUnitario: number;
  valorTotal: number;
  materialCatalogId?: string; // preenchido quando casou com um material já cadastrado
  categoriaNovoMaterial: string; // usada só quando materialCatalogId está ausente (material novo)
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function casarMaterial(nome: string, catalogo: MaterialCatalogItem[]): MaterialCatalogItem | undefined {
  const alvo = normalizar(nome);
  if (!alvo) return undefined;
  return (
    catalogo.find((m) => normalizar(m.nome) === alvo) ??
    catalogo.find((m) => alvo.includes(normalizar(m.nome)) || normalizar(m.nome).includes(alvo))
  );
}

/** Converte itens crus extraídos da nota em linhas editáveis da lista de Produtos, já casando com o catálogo quando possível. */
export function mapItensExtraidosParaProdutos(itens: ItemExtraido[], catalogo: MaterialCatalogItem[]): ItemMaterialConfirmado[] {
  return itens.map((item) => {
    const casado = casarMaterial(item.descricao, catalogo);
    const quantidade = item.quantidade ?? 1;
    const valorUnitario = item.valorUnitario ?? 0;
    return {
      nome: casado?.nome ?? item.descricao,
      quantidade,
      unidade: casado?.unidade ?? item.unidade ?? 'un',
      valorUnitario,
      valorTotal: item.valorTotal ?? Math.round(quantidade * valorUnitario * 100) / 100,
      materialCatalogId: casado?.id,
      categoriaNovoMaterial: casado?.categoria ?? '',
    };
  });
}
