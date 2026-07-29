import { useState } from 'react';
import { Modal } from '../common/Modal';
import type { TipoObra } from '../../types/domain';

interface NovoModeloModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (nome: string, tipo: TipoObra) => void;
}

const TIPO_OPTIONS: { value: TipoObra; label: string }[] = [
  { value: 'casa', label: 'Casa' },
  { value: 'galpao', label: 'Galpão' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'comercial', label: 'Comercial' },
];

export function NovoModeloModal({ open, onClose, onCreate }: NovoModeloModalProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoObra>('casa');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(nome, tipo);
    setNome('');
    setTipo('casa');
  }

  return (
    <Modal
      open={open}
      title="Novo modelo"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="novo-modelo-form" className="btn btn-primary">Criar e editar</button>
        </>
      }
    >
      <form id="novo-modelo-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full">
          <label>Nome do modelo</label>
          <input required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Casa padrão 3 quartos" />
        </div>
        <div className="form-field form-field--full">
          <label>Tipo de obra</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoObra)}>
            {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  );
}
