import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { MaterialCatalogItem, UnidadeMedida } from '../../types/domain';
import { casarMaterial, type ItemMaterialConfirmado } from '../../utils/notaFiscal/produtoLancamento';
import { useHistoricoPrecos } from '../../hooks/useHistoricoPrecos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { formatBRL } from '../../utils/currency';
import '../obra-detail/DynamicListField.css';
import './ProdutosLancamentoField.css';

const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'm', 'm2', 'm3', 'saco', 'l', 'cx', 'pç', 'verba'];

interface ProdutosLancamentoFieldProps {
  produtos: ItemMaterialConfirmado[];
  onChange: (produtos: ItemMaterialConfirmado[]) => void;
  materiaisCatalogo: MaterialCatalogItem[];
}

export function ProdutosLancamentoField({ produtos, onChange, materiaisCatalogo }: ProdutosLancamentoFieldProps) {
  const { getUltimoPreco } = useHistoricoPrecos();
  const { fornecedores } = useFornecedores();

  function atualizar(idx: number, patch: Partial<ItemMaterialConfirmado>) {
    onChange(produtos.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function reconferir(idx: number) {
    const item = produtos[idx];
    const casado = casarMaterial(item.nome, materiaisCatalogo);
    atualizar(idx, {
      materialCatalogId: casado?.id,
      categoriaNovoMaterial: casado?.categoria ?? item.categoriaNovoMaterial,
      unidade: casado?.unidade ?? item.unidade,
    });
  }

  function adicionar() {
    onChange([...produtos, { nome: '', quantidade: 1, unidade: 'un', valorUnitario: 0, valorTotal: 0, categoriaNovoMaterial: '' }]);
  }

  function remover(idx: number) {
    onChange(produtos.filter((_, i) => i !== idx));
  }

  function nomeFornecedor(fornecedorId?: string, fornecedorNomeDetectado?: string): string | undefined {
    return (fornecedorId ? fornecedores.find((f) => f.id === fornecedorId)?.nome : undefined) ?? fornecedorNomeDetectado;
  }

  const total = produtos.reduce((s, p) => s + p.valorTotal, 0);

  return (
    <div className="dynamic-list-field produtos-lancamento-field">
      <div className="dynamic-list-field__header">
        <label>Produtos</label>
        <button type="button" className="btn btn-ghost" onClick={adicionar}>
          <IconPlus size={14} /> Adicionar produto
        </button>
      </div>
      {produtos.length === 0 && (
        <p className="dynamic-list-field__empty">Nenhum produto adicionado — adicione manualmente ou anexe a nota fiscal para preencher automaticamente.</p>
      )}
      {produtos.map((item, idx) => {
        const ultimo = !item.materialCatalogId && item.nome ? getUltimoPreco({ nome: item.nome, tipo: 'material' }) : undefined;
        return (
          <div className="produtos-lancamento-field__linha" key={idx}>
            <div className="produtos-lancamento-field__nome">
              <input
                required
                value={item.nome}
                onChange={(e) => atualizar(idx, { nome: e.target.value })}
                onBlur={() => reconferir(idx)}
                list="produtos-lancamento-materiais-catalogo"
                placeholder="Nome do material"
              />
              {ultimo && (
                <span className="produtos-lancamento-field__hint">
                  última compra: {formatBRL(ultimo.valorUnitario)}
                  {nomeFornecedor(ultimo.fornecedorId, ultimo.fornecedorNomeDetectado) ? ` em ${nomeFornecedor(ultimo.fornecedorId, ultimo.fornecedorNomeDetectado)}` : ''} (estimativa)
                </span>
              )}
            </div>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Qtd"
              value={item.quantidade}
              onChange={(e) => {
                const quantidade = Number(e.target.value);
                atualizar(idx, { quantidade, valorTotal: Math.round(quantidade * item.valorUnitario * 100) / 100 });
              }}
            />
            <select value={item.unidade} onChange={(e) => atualizar(idx, { unidade: e.target.value as UnidadeMedida })}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Valor unitário"
              value={item.valorUnitario}
              onChange={(e) => {
                const valorUnitario = Number(e.target.value);
                atualizar(idx, { valorUnitario, valorTotal: Math.round(item.quantidade * valorUnitario * 100) / 100 });
              }}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Valor total"
              value={item.valorTotal}
              onChange={(e) => atualizar(idx, { valorTotal: Number(e.target.value) })}
            />
            <span className="produtos-lancamento-field__status">{item.materialCatalogId ? 'existente' : 'novo'}</span>
            <button type="button" className="btn btn-ghost dynamic-list-field__remove" onClick={() => remover(idx)} aria-label="Remover produto">
              <IconTrash size={14} />
            </button>
          </div>
        );
      })}
      <datalist id="produtos-lancamento-materiais-catalogo">
        {materiaisCatalogo.map((m) => (
          <option key={m.id} value={m.nome} />
        ))}
      </datalist>
      {produtos.length > 0 && <p className="produtos-lancamento-field__total">Total dos produtos: {formatBRL(total)}</p>}
    </div>
  );
}
