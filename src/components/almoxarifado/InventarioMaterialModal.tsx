import { useMemo } from 'react';
import { Modal } from '../common/Modal';
import type { EntradaEstoque, SaidaEstoque } from '../../types/domain';
import { formatNumberBR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import './InventarioMaterialModal.css';

interface InventarioMaterialModalProps {
  open: boolean;
  codigo: string | null;
  material: string;
  unidade: string;
  entradas: EntradaEstoque[];
  saidas: SaidaEstoque[];
  onClose: () => void;
}

interface Movimento {
  data: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  detalhe: string;
}

export function InventarioMaterialModal({ open, codigo, material, unidade, entradas, saidas, onClose }: InventarioMaterialModalProps) {
  const movimentos = useMemo(() => {
    if (!codigo) return [];
    const doMaterial: Movimento[] = [
      ...entradas.filter((e) => e.codigo === codigo).map((e) => ({ data: e.data, tipo: 'entrada' as const, quantidade: e.quantidade, detalhe: `${e.fornecedor}${e.notaFiscal ? ` — NF ${e.notaFiscal}` : ''}` })),
      ...saidas.filter((s) => s.codigo === codigo).map((s) => ({ data: s.data, tipo: 'saida' as const, quantidade: s.quantidade, detalhe: `${s.responsavel}${s.etapaNome ? ` — ${s.etapaNome}` : ''}` })),
    ];
    return doMaterial.sort((a, b) => a.data.localeCompare(b.data));
  }, [codigo, entradas, saidas]);

  let saldoCorrente = 0;
  const linhas = movimentos.map((m) => {
    saldoCorrente += m.tipo === 'entrada' ? m.quantidade : -m.quantidade;
    return { ...m, saldo: saldoCorrente };
  });

  const totalEntradas = movimentos.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0);
  const totalSaidas = movimentos.filter((m) => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0);

  return (
    <Modal open={open} title={`Inventário — ${material}`} onClose={onClose} width={720}>
      <div className="inventario-material__resumo">
        <div><span>Código</span><strong>{codigo}</strong></div>
        <div><span>Total recebido</span><strong>{formatNumberBR(totalEntradas)} {unidade}</strong></div>
        <div><span>Total retirado</span><strong>{formatNumberBR(totalSaidas)} {unidade}</strong></div>
        <div><span>Saldo atual</span><strong>{formatNumberBR(totalEntradas - totalSaidas)} {unidade}</strong></div>
      </div>

      {linhas.length === 0 ? (
        <p className="form-field__hint">Nenhuma movimentação registrada pra esse material.</p>
      ) : (
        <div className="scroll-x">
          <table className="inventario-material__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Movimento</th>
                <th>Quantidade</th>
                <th>Detalhe</th>
                <th>Saldo após</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className={l.tipo === 'saida' ? 'is-saida' : 'is-entrada'}>
                  <td>{formatDate(l.data)}</td>
                  <td>{l.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
                  <td>{l.tipo === 'entrada' ? '+' : '−'}{formatNumberBR(l.quantidade)} {unidade}</td>
                  <td className="text-muted">{l.detalhe}</td>
                  <td className="mono">{formatNumberBR(l.saldo)} {unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
