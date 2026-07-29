import { useState } from 'react';
import { Modal } from '../common/Modal';
import { useLocacoes } from '../../hooks/useLocacoes';
import { useLancamentos } from '../../hooks/useLancamentos';
import type { HistoricoEntry, LancamentoFinanceiro, Locacao } from '../../types/domain';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { getCurrentUserName } from '../../utils/currentUser';
import './RenovarLocacaoModal.css';

interface RenovarLocacaoModalProps {
  open: boolean;
  locacao: Locacao;
  lancamento?: LancamentoFinanceiro;
  onClose: () => void;
  onSaved: () => void;
}

export function RenovarLocacaoModal({ open, locacao, lancamento, onClose, onSaved }: RenovarLocacaoModalProps) {
  const { updateLocacao } = useLocacoes(locacao.obraId);
  const { updateLancamento } = useLancamentos(locacao.obraId);
  const [novoVencimento, setNovoVencimento] = useState(lancamento?.dataVencimento ?? todayISO());
  const [novaDataFim, setNovaDataFim] = useState(locacao.dataFim);
  const [observacao, setObservacao] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const usuario = getCurrentUserName();
    const partes = [`Locação renovada — novo término: ${formatDate(novaDataFim)}`];
    if (lancamento) partes.push(`vencimento: ${formatDate(lancamento.dataVencimento)} → ${formatDate(novoVencimento)}`);
    if (observacao.trim()) partes.push(observacao.trim());
    const resumo = partes.join('; ');

    const historicoLocacao: HistoricoEntry[] = [...locacao.historico, { data: now, usuario, resumo }];
    const tarefas: Promise<unknown>[] = [
      updateLocacao(locacao.id, {
        dataFim: novaDataFim,
        updatedBy: usuario,
        historico: historicoLocacao,
      }),
    ];

    if (lancamento) {
      const historicoLancamento: HistoricoEntry[] = [...lancamento.historico, { data: now, usuario, resumo }];
      tarefas.push(
        updateLancamento(lancamento.id, {
          dataVencimento: novoVencimento,
          status: lancamento.status === 'atrasado' ? 'pendente' : lancamento.status,
          updatedBy: usuario,
          historico: historicoLancamento,
        }),
      );
    }

    await Promise.all(tarefas);
    onSaved();
  }

  return (
    <Modal
      open={open}
      title="Renovar locação"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="renovar-locacao-form" className="btn btn-primary">Renovar</button>
        </>
      }
    >
      <form id="renovar-locacao-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Novo término da locação</label>
          <input required type="date" value={novaDataFim} onChange={(e) => setNovaDataFim(e.target.value)} />
        </div>

        {lancamento ? (
          <div className="form-field">
            <label>Nova data de vencimento</label>
            <input required type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} />
          </div>
        ) : (
          <p className="form-field form-field--full renovar-locacao__aviso">
            Sem lançamento financeiro vinculado — apenas o período da locação será atualizado.
          </p>
        )}

        <div className="form-field form-field--full">
          <label>Observação (opcional)</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: renovado por mais 30 dias, valor mantido" />
        </div>

        {locacao.historico.length > 0 && (
          <div className="form-field form-field--full">
            <label>Histórico</label>
            <ul className="renovar-locacao-historico">
              {[...locacao.historico].reverse().map((h, i) => (
                <li key={i}>
                  <span className="renovar-locacao-historico__data">{formatDate(h.data.slice(0, 10))} — {h.usuario}</span>
                  <span>{h.resumo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
