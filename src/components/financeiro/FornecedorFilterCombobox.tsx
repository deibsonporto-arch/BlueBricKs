import { useEffect, useMemo, useState } from 'react';
import type { Fornecedor } from '../../types/domain';
import './FornecedorFilterCombobox.css';

interface FornecedorFilterComboboxProps {
  fornecedores: Fornecedor[];
  value: string;
  onChange: (fornecedorId: string) => void;
}

export function FornecedorFilterCombobox({ fornecedores, value, onChange }: FornecedorFilterComboboxProps) {
  const selecionado = fornecedores.find((f) => f.id === value);
  const [query, setQuery] = useState(selecionado?.nome ?? '');
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setQuery(selecionado?.nome ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sugestoes = useMemo(() => {
    if (!query || query === selecionado?.nome) return fornecedores;
    const q = query.toLowerCase();
    return fornecedores.filter((f) => f.nome.toLowerCase().includes(q));
  }, [fornecedores, query, selecionado]);

  function selecionar(f?: Fornecedor) {
    onChange(f?.id ?? '');
    setQuery(f?.nome ?? '');
    setAberto(false);
  }

  return (
    <div className="fornecedor-filter-combobox">
      <input
        placeholder="Todos os fornecedores"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setAberto(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && (
        <ul className="fornecedor-filter-combobox__suggestions">
          <li>
            <button type="button" onMouseDown={() => selecionar(undefined)}>Todos os fornecedores</button>
          </li>
          {sugestoes.map((f) => (
            <li key={f.id}>
              <button type="button" onMouseDown={() => selecionar(f)}>{f.nome}</button>
            </li>
          ))}
          {sugestoes.length === 0 && <li className="fornecedor-filter-combobox__empty">Nenhum fornecedor encontrado</li>}
        </ul>
      )}
    </div>
  );
}
