import { useMemo, useState } from 'react';
import type { HistoricoPrecoItem } from '../../types/domain';
import { useHistoricoPrecos } from '../../hooks/useHistoricoPrecos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { formatBRL } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import './ServicoPicker.css';

interface ServicoPickerProps {
  value: string;
  onChange: (valor: string) => void;
  onSelecionarSugestao?: (sugestao: HistoricoPrecoItem) => void;
  placeholder?: string;
  required?: boolean;
}

/** Combobox de texto livre pra serviço, com sugestão pelo que já foi contratado antes (nome + último valor + fornecedor). */
export function ServicoPicker({ value, onChange, onSelecionarSugestao, placeholder, required }: ServicoPickerProps) {
  const { buscarServicos } = useHistoricoPrecos();
  const { fornecedores } = useFornecedores();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sugestoes = useMemo(() => (value.trim() ? buscarServicos(value) : []), [value, buscarServicos]);

  function selecionar(s: HistoricoPrecoItem) {
    onChange(s.nome);
    onSelecionarSugestao?.(s);
    setShowSuggestions(false);
  }

  return (
    <div className="servico-picker">
      <input
        required={required}
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
      />
      {showSuggestions && sugestoes.length > 0 && (
        <ul className="servico-picker__suggestions">
          {sugestoes.map((s) => {
            const fornecedor = (s.fornecedorId ? fornecedores.find((f) => f.id === s.fornecedorId)?.nome : undefined) ?? s.fornecedorNomeDetectado;
            return (
              <li key={s.id}>
                <button type="button" onMouseDown={() => selecionar(s)}>
                  <strong>{s.nome}</strong>
                  <span>
                    {formatBRL(s.valorUnitario)}{fornecedor ? ` · ${fornecedor}` : ''} · {formatDate(s.data)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
