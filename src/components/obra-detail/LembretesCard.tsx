import { useState } from 'react';
import { IconCheck, IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '@tabler/icons-react';
import type { Lembrete } from '../../types/domain';
import { formatDate, isPast, todayISO } from '../../utils/dateUtils';
import './LembretesCard.css';

interface LembretesCardProps {
  lembretes: Lembrete[];
  onCreate: (texto: string, data: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function rowClass(l: Lembrete): string {
  if (l.concluido) return 'is-concluido';
  if (isPast(l.data)) return 'is-atrasado';
  if (l.data === todayISO()) return 'is-hoje';
  return '';
}

export function LembretesCard({ lembretes, onCreate, onToggle, onDelete }: LembretesCardProps) {
  const [texto, setTexto] = useState('');
  const [data, setData] = useState(todayISO());
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  const pendentes = lembretes.filter((l) => !l.concluido);
  const concluidos = lembretes.filter((l) => l.concluido);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    onCreate(texto.trim(), data);
    setTexto('');
    setData(todayISO());
  }

  return (
    <div className="lembretes-card">
      <div className="lembretes-card__header">
        <h3>Lembretes</h3>
      </div>

      <form className="lembretes-card__form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ex: Ajustar alvenaria, lançar nota amanhã..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <button type="submit" className="btn btn-primary" aria-label="Adicionar lembrete">
          <IconPlus size={16} />
        </button>
      </form>

      {pendentes.length === 0 ? (
        <p className="lembretes-card__empty">Nenhum lembrete pendente.</p>
      ) : (
        <ul className="lembretes-card__list">
          {pendentes.map((l) => (
            <li key={l.id} className={rowClass(l)}>
              <button type="button" className="lembretes-card__check" onClick={() => onToggle(l.id)} aria-label="Marcar como concluído">
                <IconCheck size={14} />
              </button>
              <span className="lembretes-card__texto">{l.texto}</span>
              <span className="lembretes-card__data">{formatDate(l.data)}</span>
              <button type="button" className="lembretes-card__del" onClick={() => onDelete(l.id)} aria-label="Excluir lembrete">
                <IconTrash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {concluidos.length > 0 && (
        <div className="lembretes-card__concluidos">
          <button type="button" className="lembretes-card__toggle" onClick={() => setMostrarConcluidos((v) => !v)}>
            {concluidos.length} concluído{concluidos.length > 1 ? 's' : ''} {mostrarConcluidos ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
          {mostrarConcluidos && (
            <ul className="lembretes-card__list">
              {concluidos.map((l) => (
                <li key={l.id} className="is-concluido">
                  <button type="button" className="lembretes-card__check is-checked" onClick={() => onToggle(l.id)} aria-label="Marcar como pendente">
                    <IconCheck size={14} />
                  </button>
                  <span className="lembretes-card__texto">{l.texto}</span>
                  <span className="lembretes-card__data">{formatDate(l.data)}</span>
                  <button type="button" className="lembretes-card__del" onClick={() => onDelete(l.id)} aria-label="Excluir lembrete">
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
