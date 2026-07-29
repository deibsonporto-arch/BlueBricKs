import { useEffect, useMemo, useState } from 'react';
import type { MaterialCatalogItem } from '../../types/domain';
import './MaterialPicker.css';

interface MaterialPickerProps {
  catalogo: MaterialCatalogItem[];
  value: string;
  onChange: (materialId: string) => void;
}

export function MaterialPicker({ catalogo, value, onChange }: MaterialPickerProps) {
  const selecionado = catalogo.find((m) => m.id === value);
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

  return (
    <div className="material-picker">
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
            {sugestoes.map((m) => (
              <li key={m.id}>
                <button type="button" onMouseDown={() => selecionar(m)}>
                  <strong>{m.nome}</strong> <span>{m.categoria} · {m.unidade}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
