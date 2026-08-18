import { IconArrowDown, IconArrowUp, IconClipboardList } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import type { EntradaEstoque } from '../../types/domain';
import './EscolhaAcaoEstoqueModal.css';

interface EscolhaAcaoEstoqueModalProps {
  open: boolean;
  entrada: EntradaEstoque | null;
  onClose: () => void;
  onEditarEntrada: (entrada: EntradaEstoque) => void;
  onDarSaida: (entrada: EntradaEstoque) => void;
  onVerInventario: (entrada: EntradaEstoque) => void;
}

export function EscolhaAcaoEstoqueModal({ open, entrada, onClose, onEditarEntrada, onDarSaida, onVerInventario }: EscolhaAcaoEstoqueModalProps) {
  if (!entrada) return null;

  return (
    <Modal open={open} title={entrada.material} onClose={onClose} width={420}>
      <p className="escolha-acao-estoque__hint">Código {entrada.codigo} — o que você quer fazer?</p>
      <div className="escolha-acao-estoque__opcoes">
        <button type="button" className="escolha-acao-estoque__opcao" onClick={() => onEditarEntrada(entrada)}>
          <IconArrowUp size={18} />
          <span>
            <strong>Editar entrada</strong>
            <small>Corrigir quantidade, fornecedor, etapa, nota fiscal...</small>
          </span>
        </button>
        <button type="button" className="escolha-acao-estoque__opcao" onClick={() => onDarSaida(entrada)}>
          <IconArrowDown size={18} />
          <span>
            <strong>Dar saída</strong>
            <small>Registrar retirada desse material do estoque</small>
          </span>
        </button>
        <button type="button" className="escolha-acao-estoque__opcao" onClick={() => onVerInventario(entrada)}>
          <IconClipboardList size={18} />
          <span>
            <strong>Ver inventário</strong>
            <small>Histórico completo de entradas e saídas desse material</small>
          </span>
        </button>
      </div>
    </Modal>
  );
}
