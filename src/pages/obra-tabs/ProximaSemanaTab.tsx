import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAtividades } from '../../hooks/useAtividades';
import { useCotacoes } from '../../hooks/useCotacoes';
import { useItensProvidenciados } from '../../hooks/useItensProvidenciados';
import { EmptyState } from '../../components/common/EmptyState';
import { buildItensSemana, getNextWeekRange, type ItemSemana, type TipoItemSemana } from '../../utils/proximaSemana';
import { formatDate } from '../../utils/dateUtils';
import './ProximaSemanaTab.css';

const TIPO_LABEL: Record<TipoItemSemana, string> = {
  aluguel: 'Aluguel',
  compra: 'Compra',
  mobilizacao: 'Mobilização',
  servico_contratado: 'Serviço contratado',
};

const DIA_LABEL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export function ProximaSemanaTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { atividades } = useAtividades(obraId);
  const { cotacoes } = useCotacoes(obraId);
  const { isProvidenciado, toggle } = useItensProvidenciados(obraId);

  const range = useMemo(() => getNextWeekRange(), []);
  const itens = useMemo(() => buildItensSemana(atividades, cotacoes, range), [atividades, cotacoes, range]);

  const dias = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(range.monday);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [range]);

  const itensPorDia = (dia: string): ItemSemana[] => itens.filter((it) => it.dia === dia);

  if (itens.length === 0) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <EmptyState
          title="Nenhum item previsto para a próxima semana"
          description="Materiais, mão de obra, equipamentos e serviços contratados vinculados a atividades cujo período cruza a próxima semana aparecem aqui automaticamente."
        />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <p className="proxima-semana-range">
        Semana de {formatDate(dias[0])} a {formatDate(dias[4])}
      </p>
      <div className="proxima-semana-grid">
        {dias.map((dia, idx) => {
          const itensDoDia = itensPorDia(dia);
          return (
            <div className="proxima-semana-card" key={dia}>
              <div className="proxima-semana-card__header">
                <span className="proxima-semana-card__dia">{DIA_LABEL[idx]}</span>
                <span className="proxima-semana-card__data">{formatDate(dia)}</span>
              </div>
              {itensDoDia.length === 0 ? (
                <p className="proxima-semana-card__empty">Sem itens</p>
              ) : (
                <ul className="proxima-semana-card__list">
                  {itensDoDia.map((it) => {
                    const providenciado = isProvidenciado(it.key);
                    return (
                      <li key={it.key} className={providenciado ? 'is-providenciado' : ''}>
                        <label>
                          <input type="checkbox" checked={providenciado} onChange={() => toggle(it.key)} />
                          <div>
                            <span className={`item-semana-badge item-semana-badge--${it.tipo}`}>{TIPO_LABEL[it.tipo]}</span>
                            <div className="proxima-semana-card__label">{it.label}</div>
                            <div className="proxima-semana-card__atividade">{it.atividadeNome}</div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
