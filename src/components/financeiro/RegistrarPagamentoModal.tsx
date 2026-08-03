import { useEffect, useState } from 'react';
import { IconPaperclip, IconTrash } from '@tabler/icons-react';
import { Modal } from '../common/Modal';
import type { Anexo, LancamentoFinanceiro, Pagamento, ParcelaLancamento } from '../../types/domain';
import { useLancamentos } from '../../hooks/useLancamentos';
import { generateId } from '../../utils/id';
import { todayISO, formatDate } from '../../utils/dateUtils';
import { formatBRL } from '../../utils/currency';
import { getCurrentUserName } from '../../utils/currentUser';
import { readFileAsAnexo } from '../../utils/anexoUpload';
import { deleteBlob, downloadAnexo, storeAnexo } from '../../utils/attachmentStore';
import './LancamentoFormModal.css';
import './RegistrarPagamentoModal.css';

interface RegistrarPagamentoModalProps {
  open: boolean;
  obraId: string;
  lancamento?: LancamentoFinanceiro;
  onClose: () => void;
  onSaved: () => void;
}

/** Parcela pendente com o vencimento mais próximo do plano definido na criação do lançamento (se houver). */
function acharProximaParcela(lancamento?: LancamentoFinanceiro): ParcelaLancamento | undefined {
  if (!lancamento?.parcelas || lancamento.parcelas.length === 0) return undefined;
  return [...lancamento.parcelas].filter((p) => !p.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
}

export function RegistrarPagamentoModal({ open, obraId, lancamento, onClose, onSaved }: RegistrarPagamentoModalProps) {
  const { updateLancamento } = useLancamentos(obraId);
  const [valor, setValor] = useState('');
  const [dataPagamento, setDataPagamento] = useState(todayISO());
  const [comprovante, setComprovante] = useState<Anexo | undefined>(undefined);
  const [anexoErro, setAnexoErro] = useState('');
  const [proximoVencimento, setProximoVencimento] = useState('');
  const [parcelaTotalInput, setParcelaTotalInput] = useState('');

  const proximaParcela = acharProximaParcela(lancamento);
  const valorAPagarTotal = lancamento?.valorPago ?? 0;
  const jaPagoConfirmado = (lancamento?.pagamentos ?? []).reduce((s, p) => s + p.valor, 0);
  const naoPrevisto = lancamento?.naoPrevisto ?? false;
  const saldoRestante = naoPrevisto ? 0 : Math.max(0, valorAPagarTotal - jaPagoConfirmado);

  useEffect(() => {
    if (open && lancamento) {
      const jaPago = (lancamento.pagamentos ?? []).reduce((s, p) => s + p.valor, 0);
      const saldo = lancamento.naoPrevisto ? 0 : Math.max(0, lancamento.valorPago - jaPago);
      const proxima = acharProximaParcela(lancamento);
      setValor(lancamento.naoPrevisto ? '' : proxima ? String(proxima.valor) : String(saldo));
      setDataPagamento(todayISO());
      setComprovante(undefined);
      setAnexoErro('');
      setProximoVencimento('');
      setParcelaTotalInput(lancamento.parcelaTotal ? String(lancamento.parcelaTotal) : '');
    }
  }, [open, lancamento]);

  function handleComprovanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnexoErro('');
    readFileAsAnexo(file)
      .then(storeAnexo)
      .then((anexo) => setComprovante(anexo))
      .catch((err: Error) => setAnexoErro(err.message));
    e.target.value = '';
  }

  const valorNum = Number(valor) || 0;
  const restanteAposEste = Math.max(0, saldoRestante - valorNum);
  const isParcial = !naoPrevisto && valorNum > 0 && valorNum < saldoRestante;
  const numeroParcela = proximaParcela?.numero ?? (lancamento?.pagamentos?.length ?? 0) + 1;
  const totalParcelasPreview = proximaParcela
    ? lancamento?.parcelas?.filter((p) => !p.ehEntrada).length
    : parcelaTotalInput
      ? Number(parcelaTotalInput) || undefined
      : lancamento?.parcelaTotal;
  const parcelasRestantesAposEsta = totalParcelasPreview ? Math.max(0, totalParcelasPreview - numeroParcela) : undefined;
  const labelParcelaAtual = proximaParcela
    ? proximaParcela.ehEntrada
      ? 'entrada'
      : `parcela ${proximaParcela.numero}/${totalParcelasPreview}`
    : `parcela ${numeroParcela}${totalParcelasPreview ? `/${totalParcelasPreview}` : ''}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lancamento) return;
    if (valorNum <= 0) return;

    const novoPagamento: Pagamento = { id: generateId(), data: dataPagamento, valor: valorNum, comprovante };
    const novoTotalPago = jaPagoConfirmado + valorNum;
    const now = new Date().toISOString();

    if (proximaParcela) {
      const parcelasAtualizadas = lancamento.parcelas!.map((p) =>
        p.id === proximaParcela.id ? { ...p, pago: true, dataPagamento } : p,
      );
      const proximaPendente = [...parcelasAtualizadas].filter((p) => !p.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
      const quitado = naoPrevisto || parcelasAtualizadas.every((p) => p.pago);
      const resumo = quitado
        ? `Pagamento de ${formatBRL(valorNum)} registrado (${labelParcelaAtual}) — lançamento quitado`
        : `Pagamento de ${formatBRL(valorNum)} registrado (${labelParcelaAtual}) — próxima parcela vence em ${formatDate(proximaPendente!.vencimento)}`;

      updateLancamento(lancamento.id, {
        pagamentos: [...(lancamento.pagamentos ?? []), novoPagamento],
        parcelas: parcelasAtualizadas,
        status: quitado ? 'pago' : 'pendente',
        dataVencimento: quitado ? lancamento.dataVencimento : proximaPendente!.vencimento,
        anexos: comprovante ? [...lancamento.anexos, comprovante] : lancamento.anexos,
        updatedBy: getCurrentUserName(),
        updatedAt: now,
        historico: [...lancamento.historico, { data: now, usuario: getCurrentUserName(), resumo }],
      }).then(onSaved);
      return;
    }

    const quitado = naoPrevisto || novoTotalPago >= valorAPagarTotal;
    const totalParcelas = parcelaTotalInput ? Number(parcelaTotalInput) || undefined : lancamento.parcelaTotal;

    const resumo = quitado
      ? `Pagamento de ${formatBRL(valorNum)} registrado — lançamento quitado`
      : `Pagamento parcial de ${formatBRL(valorNum)} registrado (parcela ${numeroParcela}${totalParcelas ? `/${totalParcelas}` : ''})${
          proximoVencimento ? ` — próximo vencimento em ${formatDate(proximoVencimento)}` : ''
        }`;

    updateLancamento(lancamento.id, {
      pagamentos: [...(lancamento.pagamentos ?? []), novoPagamento],
      status: quitado ? 'pago' : 'pendente',
      dataVencimento: quitado ? lancamento.dataVencimento : proximoVencimento || lancamento.dataVencimento,
      anexos: comprovante ? [...lancamento.anexos, comprovante] : lancamento.anexos,
      parcelaTotal: totalParcelas,
      updatedBy: getCurrentUserName(),
      updatedAt: now,
      historico: [...lancamento.historico, { data: now, usuario: getCurrentUserName(), resumo }],
    }).then(onSaved);
  }

  if (!lancamento) return null;

  return (
    <Modal
      open={open}
      title="Registrar pagamento"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="submit"
            form="registrar-pagamento-form"
            className="btn btn-primary"
            disabled={valorNum <= 0}
          >
            Confirmar pagamento
          </button>
        </>
      }
    >
      <form id="registrar-pagamento-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field form-field--full registrar-pagamento-resumo">
          <span>{lancamento.descricao}</span>
          {!naoPrevisto && (
            <div className="registrar-pagamento-resumo__grid">
              <span>Valor a pagar: <strong>{formatBRL(saldoRestante)}</strong></span>
            </div>
          )}
          {proximaParcela ? (
            <span className="registrar-pagamento-resumo__parcela">
              {proximaParcela.ehEntrada ? 'Entrada' : `Parcela ${proximaParcela.numero} de ${totalParcelasPreview}`} — vencimento {formatDate(proximaParcela.vencimento)}
            </span>
          ) : (
            !!lancamento.parcelaTotal && (
              <span className="registrar-pagamento-resumo__parcela">
                Parcela {numeroParcela} de {lancamento.parcelaTotal}
              </span>
            )
          )}
        </div>

        <div className="form-field">
          <label>Valor pago agora (R$)</label>
          <input required type="number" min={0.01} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>Data do pagamento</label>
          <input required type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
        </div>

        <div className="form-field form-field--full">
          <label>Comprovante</label>
          <label className="btn btn-secondary lancamento-anexo-btn">
            <IconPaperclip size={16} /> Anexar comprovante
            <input type="file" onChange={handleComprovanteChange} hidden />
          </label>
          {anexoErro && <p className="lancamento-anexo-erro">{anexoErro}</p>}
          {comprovante && (
            <ul className="lancamento-anexos-list">
              <li>
                <button type="button" className="lancamento-anexo-nome" onClick={() => downloadAnexo(comprovante)}>
                  {comprovante.nome}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteBlob(comprovante.id).catch((err) => console.error('Erro ao remover anexo do armazenamento:', err));
                    setComprovante(undefined);
                  }}
                  aria-label="Remover comprovante"
                >
                  <IconTrash size={14} />
                </button>
              </li>
            </ul>
          )}
        </div>

        {isParcial && (
          <div className="form-field form-field--full registrar-pagamento-parcial">
            <p className="registrar-pagamento-parcial__aviso">
              Pagamento parcial ({labelParcelaAtual}) — vai restar <strong>{formatBRL(restanteAposEste)}</strong>
              {parcelasRestantesAposEsta !== undefined && ` (${parcelasRestantesAposEsta} parcela${parcelasRestantesAposEsta === 1 ? '' : 's'} restante${parcelasRestantesAposEsta === 1 ? '' : 's'} após esta)`}.
            </p>
            {!proximaParcela && (
              <div className="registrar-pagamento-parcial__grid">
                <div className="form-field">
                  <label>Vencimento da próxima parcela (opcional)</label>
                  <input type="date" value={proximoVencimento} onChange={(e) => setProximoVencimento(e.target.value)} />
                </div>
                {!lancamento.parcelaTotal && (
                  <div className="form-field">
                    <label>Número total de parcelas (opcional)</label>
                    <input type="number" min={2} value={parcelaTotalInput} onChange={(e) => setParcelaTotalInput(e.target.value)} placeholder="ex: 2" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
