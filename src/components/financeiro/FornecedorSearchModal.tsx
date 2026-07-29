import { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import type { Fornecedor } from '../../types/domain';
import './FornecedorSearchModal.css';

interface FornecedorSearchModalProps {
  open: boolean;
  fornecedores: Fornecedor[];
  onClose: () => void;
  onSelect: (fornecedor: Fornecedor) => void;
}

export function FornecedorSearchModal({ open, fornecedores, onClose, onSelect }: FornecedorSearchModalProps) {
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [cidade, setCidade] = useState('');
  const [contato, setContato] = useState('');

  const filtrados = useMemo(() => {
    return fornecedores.filter((f) => {
      if (nome && !f.nome.toLowerCase().includes(nome.toLowerCase())) return false;
      if (documento && !f.documento.toLowerCase().includes(documento.toLowerCase())) return false;
      if (cidade && !(f.cidade ?? '').toLowerCase().includes(cidade.toLowerCase())) return false;
      if (contato && !(f.contato ?? '').toLowerCase().includes(contato.toLowerCase())) return false;
      return true;
    });
  }, [fornecedores, nome, documento, cidade, contato]);

  return (
    <Modal open={open} title="Pesquisar fornecedor" onClose={onClose} width={720}>
      <div className="fornecedor-search__filters">
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="CPF / CNPJ" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        <input placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        <input placeholder="Telefone" value={contato} onChange={(e) => setContato(e.target.value)} />
      </div>
      <div className="fornecedor-search__results">
        {filtrados.length === 0 ? (
          <p className="fornecedor-search__empty">Nenhum fornecedor encontrado.</p>
        ) : (
          filtrados.map((f) => (
            <button type="button" key={f.id} className="fornecedor-search__row" onClick={() => { onSelect(f); onClose(); }}>
              <div>
                <strong>{f.codigo}</strong> — {f.nome}
                <div className="fornecedor-search__row-sub">{f.documento || '—'} · {f.cidade || 'cidade não informada'} · {f.contato || 'sem contato'}</div>
              </div>
              <span className="fornecedor-search__row-select">Selecionar</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
