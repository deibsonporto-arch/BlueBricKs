import { Fragment } from 'react';
import type { Atividade, Obra, StatusAtividade, Subatividade } from '../../types/domain';
import { addDays, isWeekend, monthsBetween, pctOffset, todayISO } from '../../utils/dateUtils';
import { deriveParentStatus } from '../../utils/subatividades';
import './GanttChart.css';

interface GanttChartProps {
  obra: Obra;
  atividades: Atividade[];
  onBarClick: (atividade: Atividade) => void;
}

const STATUS_CLASS: Record<StatusAtividade, string> = {
  concluida: 'gantt-bar--concluida',
  em_andamento: 'gantt-bar--em_andamento',
  pendente: 'gantt-bar--pendente',
};

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function isGapWeekendOnly(prevEnd: string, nextStart: string): boolean {
  let cursor = addDays(prevEnd, 1);
  while (cursor < nextStart) {
    if (!isWeekend(cursor)) return false;
    cursor = addDays(cursor, 1);
  }
  return true;
}

interface GanttSegment {
  start: string;
  end: string;
  status: StatusAtividade;
}

/**
 * Agrupa as subatividades (já ordenadas por data) em segmentos visuais do Gantt: uma pausa que é só
 * sábado/domingo sem trabalho não conta como intervalo — as subatividades ficam no mesmo segmento (uma
 * barra contínua). Só um intervalo com dia útil de folga real vira um segmento separado — e nesse caso o
 * espaço entre os dois segmentos é preenchido por uma linha pontilhada (ver `.gantt-connector`) mostrando
 * que ainda fazem parte do mesmo conjunto de trabalho.
 */
function buildGanttSegments(subatividades: Subatividade[]): GanttSegment[] {
  const ordered = [...subatividades].sort((a, b) => (a.dataInicio < b.dataInicio ? -1 : a.dataInicio > b.dataInicio ? 1 : 0));
  const segments: GanttSegment[] = [];
  let bucket: Subatividade[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const start = bucket.reduce((min, s) => (s.dataInicio < min ? s.dataInicio : min), bucket[0].dataInicio);
    const end = bucket.reduce((max, s) => (s.dataFim > max ? s.dataFim : max), bucket[0].dataFim);
    segments.push({ start, end, status: deriveParentStatus(bucket)?.status ?? 'pendente' });
    bucket = [];
  };

  for (const s of ordered) {
    if (bucket.length > 0) {
      const prevEnd = bucket.reduce((max, b) => (b.dataFim > max ? b.dataFim : max), bucket[0].dataFim);
      if (s.dataInicio > prevEnd && !isGapWeekendOnly(prevEnd, s.dataInicio)) flush();
    }
    bucket.push(s);
  }
  flush();

  return segments;
}

export function GanttChart({ obra, atividades, onBarClick }: GanttChartProps) {
  if (atividades.length === 0) {
    return (
      <div className="gantt-card">
        <h3>Cronograma (Gantt)</h3>
        <p className="gantt-empty">Nenhuma atividade cadastrada ainda.</p>
      </div>
    );
  }

  const rangeStart = atividades.reduce((acc, a) => minDate(acc, a.dataInicio), obra.dataInicio);
  const rangeEnd = atividades.reduce((acc, a) => maxDate(acc, a.dataFim), obra.previsaoEntrega);

  const months = monthsBetween(rangeStart, rangeEnd);
  const today = todayISO();
  const showHoje = today >= rangeStart && today <= rangeEnd;
  const hojePct = pctOffset(rangeStart, rangeEnd, today);
  const minWidth = Math.max(600, months.length * 120);

  return (
    <div className="gantt-card">
      <h3>Cronograma (Gantt)</h3>
      <div className="scroll-x">
        <div className="gantt-wrapper" style={{ minWidth: minWidth + 220 }}>
          <div className="gantt-months-row">
            <div className="gantt-label-col" />
            <div className="gantt-timeline-col" style={{ minWidth }}>
              {months.map((m) => (
                <div key={m.key} className="gantt-month" style={{ left: `${m.startOffsetPct}%`, width: `${m.widthPct}%` }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {atividades.map((a) => {
            const status = deriveParentStatus(a.subatividades)?.status ?? a.status;

            return (
              <div className="gantt-row" key={a.id}>
                <div className="gantt-label-col" title={a.nome}>{a.nome}</div>
                <div className="gantt-timeline-col" style={{ minWidth }}>
                  {showHoje && <div className="gantt-hoje-line" style={{ left: `${hojePct}%` }} />}
                  {a.subatividades.length > 0 ? (
                    // Um segmento por trecho contínuo de subatividades — pausas de só fim de semana ficam
                    // unidas na mesma barra; um vão real de dias úteis vira segmento separado, ligado por
                    // uma linha pontilhada (.gantt-connector) para deixar claro que é o mesmo conjunto.
                    buildGanttSegments(a.subatividades).map((seg, i, segs) => {
                      const segLeft = pctOffset(rangeStart, rangeEnd, seg.start);
                      const segRight = pctOffset(rangeStart, rangeEnd, seg.end);
                      const segWidth = Math.max(1, segRight - segLeft);
                      const prevSeg = i > 0 ? segs[i - 1] : undefined;
                      return (
                        <Fragment key={`${seg.start}-${seg.end}`}>
                          {prevSeg && (
                            <div
                              className="gantt-connector"
                              style={{
                                left: `${pctOffset(rangeStart, rangeEnd, prevSeg.end)}%`,
                                width: `${Math.max(0, segLeft - pctOffset(rangeStart, rangeEnd, prevSeg.end))}%`,
                              }}
                            />
                          )}
                          <button
                            type="button"
                            className={`gantt-bar ${STATUS_CLASS[seg.status]}`}
                            style={{ left: `${segLeft}%`, width: `${segWidth}%` }}
                            onClick={() => onBarClick(a)}
                            title={`${a.nome} (${seg.start} — ${seg.end})`}
                          />
                        </Fragment>
                      );
                    })
                  ) : (
                    <button
                      type="button"
                      className={`gantt-bar ${STATUS_CLASS[status]}`}
                      style={{
                        left: `${pctOffset(rangeStart, rangeEnd, a.dataInicio)}%`,
                        width: `${Math.max(1, pctOffset(rangeStart, rangeEnd, a.dataFim) - pctOffset(rangeStart, rangeEnd, a.dataInicio))}%`,
                      }}
                      onClick={() => onBarClick(a)}
                      title={`${a.nome} (${a.dataInicio} — ${a.dataFim})`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gantt-legend">
        <span><i className="gantt-bar--concluida" /> Concluída</span>
        <span><i className="gantt-bar--em_andamento" /> Em andamento</span>
        <span><i className="gantt-bar--pendente" /> Pendente</span>
      </div>
    </div>
  );
}
