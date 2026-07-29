import { useEffect, useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import type { Fornecedor } from '../../types/domain';
import { FornecedorSearchModal } from './FornecedorSearchModal';
import './FornecedorPicker.css';

interface FornecedorPickerProps {
  fornecedores: Fornecedor[];
  value: string;
  onChange: (fornecedorId: string) => void;
}

export function FornecedorPicker({ fornecedores, value, onChange }: FornecedorPickerProps) {
  const selecionado = fornecedores.find((f) => f.id === value);
  const [query, setQuery] = useState(selecionado?.nome ?? '');
  const [idQuery, setIdQuery] = useState(selecionado?.codigo ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setQuery(selecionado?.nome ?? '');
    setIdQuery(selecionado?.codigo ?? '');
  }, [value]);

  const sugestoes = useMemo(() => {
    if (!query || query === selecionado?.nome) return [];
    const q = query.toLowerCase();
    return fornecedores
      .filter((f) => f.nome.toLowerCase().includes(q) || f.documento.toLowerCase().includes(q))
      .slice(0, 8);
  }, [fornecedores, query, selecionado]);

  function selecionar(f: Fornecedor) {
    onChange(f.id);
    setQuery(f.nome);
    setIdQuery(f.codigo);
    setShowSuggestions(false);
  }

  function handleIdBlur() {
    const encontrado = fornecedores.find((f) => f.codigo.toLowerCase() === idQuery.trim().toLowerCase());
    if (encontrado) selecionar(encontrado);
    else setIdQuery(selecionado?.codigo ?? '');
  }

  return (
    <div className="fornecedor-picker">
      <input
        className="fornecedor-picker__id"
        placeholder="ID"
        value={idQuery}
        onChange={(e) => setIdQuery(e.target.value)}
        onBlur={handleIdBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        title="Digite o ID do fornecedor para preencher automaticamente"
      />
      <div className="fornecedor-picker__combobox">
        <input
          placeholder="Buscar fornecedor por nome, CPF ou CNPJ"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); if (!e.target.value) onChange(''); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {showSuggestions && sugestoes.length > 0 && (
          <ul className="fornecedor-picker__suggestions">
            {sugestoes.map((f) => (
              <li key={f.id}>
                <button type="button" onMouseDown={() => selecionar(f)}>
                  <strong>{f.nome}</strong> <span>{f.documento}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="btn btn-secondary fornecedor-picker__search-btn" onClick={() => setSearchOpen(true)} aria-label="Pesquisar fornecedor">
        <IconSearch size={16} />
      </button>

      <FornecedorSearchModal
        open={searchOpen}
        fornecedores={fornecedores}
        onClose={() => setSearchOpen(false)}
        onSelect={selecionar}
      />
    </div>
  );
}
