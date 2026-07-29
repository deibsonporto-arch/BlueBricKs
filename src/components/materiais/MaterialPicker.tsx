import { useEffect, useMemo, useState } from 'react';
import type { MaterialCatalogItem } from '../../types/domain';
import { useHistoricoPrecos } from '../../hooks/useHistoricoPrecos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { formatBRL } from '../../utils/currency';
import { diffDays, todayISO } from '../../utils/dateUtils';
import './MaterialPicker.css';

interface MaterialPickerProps {
  catalogo: MaterialCatalogItem[];
  value: string;
  onChange: (materialId: string) => void;
}

function rotuloRelativo(dias: number): string {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  if (dias < 365) return `há ${Math.round(dias / 30)} meses`;
  return `há ${Math.round(dias / 365)} anos`;
}

export function MaterialPicker({ catalogo, value, onChange }: MaterialPickerProps) {
  const selecionado = catalogo.find((m) => m.id === value);
  const { getUltimoPreco } = useHistoricoPrecos();
  const { fornecedores } = useFornecedores();
  const [categoriaFiltro, setCategoriaFiltro] = useState(selecionado?.categoria ?? '');
  const [query, setQuery] = useState(selecionado?.nome ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setQuery(selecionado?.nome ?? '');
    if (selecionado) setCategoriaFiltro(selecionado.categoria);
  }, [value]);

  const categorias = useMemo(() => Array.from(new Set(catalogo.map((m) => m.categoria))).sort(), [catalogo]);

  const sugestoes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo
      .filter((m) => (!categoriaFiltro || m.categoria === categoriaFiltro) && (!q || m.nome.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [catalogo, categoriaFiltro, query]);

  function selecionar(m: MaterialCatalogItem) {
    onChange(m.id);
    setQuery(m.nome);
    setCategoriaFiltro(m.categoria);
    setShowSuggestions(false);
  }

  function nomeFornecedor(fornecedorId: string | undefined, fornecedorNomeDetectado: string | undefined): string | undefined {
    return (fornecedorId ? fornecedores.find((f) => f.id === fornecedorId)?.nome : undefined) ?? fornecedorNomeDetectado;
  }

  const ultimoPrecoSelecionado = selecionado ? getUltimoPreco({ materialCatalogId: selecionado.id, tipo: 'material' }) : undefined;

  return (
    <div className="material-picker">
      <div className="material-picker__row">
        <select
          className="material-picker__categoria"
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="material-picker__combobox">
          <input
            placeholder="Buscar material..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && sugestoes.length > 0 && (
            <ul className="material-picker__suggestions">
              {sugestoes.map((m) => {
                const ultimo = getUltimoPreco({ materialCatalogId: m.id, tipo: 'material' });
                const fornecedor = ultimo ? nomeFornecedor(ultimo.fornecedorId, ultimo.fornecedorNomeDetectado) : undefined;
                return (
                  <li key={m.id}>
                    <button type="button" onMouseDown={() => selecionar(m)}>
                      <strong>{m.nome}</strong>
                      <span>
                        {m.categoria} · {m.unidade}
                        {ultimo ? ` · última compra ${formatBRL(ultimo.valorUnitario)}${fornecedor ? ` (${fornecedor})` : ''}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {selecionado && ultimoPrecoSelecionado && (
        <p className="material-picker__ultimo-preco">
          Última compra: {formatBRL(ultimoPrecoSelecionado.valorUnitario)}
          {(() => {
            const fornecedor = nomeFornecedor(ultimoPrecoSelecionado.fornecedorId, ultimoPrecoSelecionado.fornecedorNomeDetectado);
            return fornecedor ? ` em ${fornecedor}` : '';
          })()}
          {' · '}{rotuloRelativo(diffDays(ultimoPrecoSelecionado.data, todayISO()))} <span className="material-picker__ultimo-preco-tag">(estimativa)</span>
        </p>
      )}
    </div>
  );
}
