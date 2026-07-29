import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { useFerramentas } from '../../hooks/useFerramentas';
import { useObras } from '../../hooks/useObras';
import { useLocaisFerramentas } from '../../hooks/useLocaisFerramentas';
import type { Ferramenta } from '../../types/domain';
import { todayISO } from '../../utils/dateUtils';

interface EnviarFerramentaModalProps {
  open: boolean;
  ferramenta: Ferramenta;
  onClose: () => void;
  onSaved: () => void;
}

export function EnviarFerramentaModal({ open, ferramenta, onClose, onSaved }: EnviarFerramentaModalProps) {
  const { enviarParaObra } = useFerramentas(ferramenta.obraId);
  const { obras } = useObras();
  const { locais } = useLocaisFerramentas();
  const obrasDestino = obras.filter((o) => o.id !== ferramenta.obraId && !o.isModelo);
  const locaisDestino = locais.filter((l) => l.id !== ferramenta.obraId);
  const opcoesDestino = useMemo(() => [...obrasDestino, ...locaisDestino], [obrasDestino, locaisDestino]);

  const [obraDestinoId, setObraDestinoId] = useState('');
  const [data, setData] = useState(todayISO());
  const [quantidade, setQuantidade] = useState(String(ferramenta.quantidade));
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (open) {
      setObraDestinoId('');
      setData(todayISO());
      setQuantidade(String(ferramenta.quantidade));
      setObservacao('');
    }
  }, [open, ferramenta.id, ferramenta.quantidade]);

  // obras/locais carregam de forma assíncrona (começam com []), então o destino padrão
  // só pode ser preenchido depois que a lista chegar — não dá pra fazer isso no efeito acima.
  useEffect(() => {
    if (open && !obraDestinoId && opcoesDestino.length > 0) {
      setObraDestinoId(opcoesDestino[0].id);
    }
  }, [open, obraDestinoId, opcoesDestino]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!obraDestinoId) return;
    const qtd = Math.min(ferramenta.quantidade, Math.max(1, Number(quantidade) || 0));
    await enviarParaObra(ferramenta.id, { obraDestinoId, data, quantidade: qtd, observacao: observacao || undefined });
    onSaved();
  }

  return (
    <Modal
      open={open}
      title={`Enviar "${ferramenta.nome}" para outra obra ou local`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="enviar-ferramenta-form" className="btn btn-primary" disabled={!obraDestinoId}>Enviar</button>
        </>
      }
    >
      <form id="enviar-ferramenta-form" className="form-grid" onSubmit={handleSubmit}>
        {opcoesDestino.length === 0 ? (
          <p className="form-field form-field--full">Não há outra obra ou local cadastrado para enviar.</p>
        ) : (
          <div className="form-field form-field--full">
            <label>Destino</label>
            <select required value={obraDestinoId} onChange={(e) => setObraDestinoId(e.target.value)}>
              {obrasDestino.length > 0 && (
                <optgroup label="Obras">
                  {obrasDestino.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </optgroup>
              )}
              {locaisDestino.length > 0 && (
                <optgroup label="Locais">
                  {locaisDestino.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )}
        <div className="form-field">
          <label>Data do envio</label>
          <input required type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Quantidade (disponível: {ferramenta.quantidade})</label>
          <input
            required
            type="number"
            min={1}
            max={ferramenta.quantidade}
            step="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>
        <div className="form-field form-field--full">
          <label>Observação (opcional)</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: levado na caçamba junto com a betoneira" />
        </div>
      </form>
    </Modal>
  );
}
