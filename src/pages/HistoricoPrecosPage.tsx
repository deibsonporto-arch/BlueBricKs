import { useMemo, useState } from 'react';
import { AppHeader } from '../components/layout/AppHeader';
import { useHistoricoPrecos } from '../hooks/useHistoricoPrecos';
import { useFornecedores } from '../hooks/useFornecedores';
import type { HistoricoPrecoItem, TipoHistoricoPreco } from '../types/domain';
import { formatBRL } from '../utils/currency';
import { formatDate } from '../utils/dateUtils';
import './HistoricoPrecosPage.css';

const TIPO_LABEL: Record<TipoHistoricoPreco, string> = { material: 'Material', servico: 'Serviço' };

export function HistoricoPrecosPage() {
  const { historicoPrecos } = useHistoricoPrecos();
  const { fornecedores } = useFornecedores();

  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoHistoricoPreco>('');
  const [nomeFiltro, setNomeFiltro] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  function nomeFornecedor(item: HistoricoPrecoItem): string {
    return (item.fornecedorId ? fornecedores.find((f) => f.id === item.fornecedorId)?.nome : undefined) ?? item.fornecedorNomeDetectado ?? '—';
  }

  const itensFiltrados = useMemo(() => {
    const nomeQ = nomeFiltro.trim().toLowerCase();
    return historicoPrecos
      .filter((h) => !tipoFiltro || h.tipo === tipoFiltro)
      .filter((h) => !nomeQ || h.nome.toLowerCase().includes(nomeQ))
      .filter((h) => !fornecedorFiltro || h.fornecedorId === fornecedorFiltro)
      .filter((h) => !dataInicio || h.data >= dataInicio)
      .filter((h) => !dataFim || h.data <= dataFim)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [historicoPrecos, tipoFiltro, nomeFiltro, fornecedorFiltro, dataInicio, dataFim]);

  return (
    <div>
      <AppHeader />
      <div className="container">
        <div className="historico-precos-header">
          <div>
            <h1 className="historico-precos-title">Histórico de Preços</h1>
            <p className="historico-precos-subtitle">
              Preço real pago por material e serviço, com fornecedor e data — alimentado automaticamente pelos lançamentos financeiros
              confirmados. Vale pra todas as obras, use pra comparar fornecedor e estimar custo numa obra nova.
            </p>
          </div>
        </div>

        <div className="historico-precos-section">
          <div className="historico-precos-filtros">
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as '' | TipoHistoricoPreco)}>
              <option value="">Todos os tipos</option>
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
            </select>
            <input placeholder="Buscar por nome..." value={nomeFiltro} onChange={(e) => setNomeFiltro(e.target.value)} />
            <select value={fornecedorFiltro} onChange={(e) => setFornecedorFiltro(e.target.value)}>
              <option value="">Todos os fornecedores</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <div className="historico-precos-filtros__periodo">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <span>até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          {itensFiltrados.length === 0 ? (
            <p className="historico-precos-empty">
              {historicoPrecos.length === 0
                ? 'Nenhum registro ainda. Lançamentos financeiros de material (com nota confirmada) ou serviço alimentam essa lista automaticamente.'
                : 'Nenhum registro bate com esse filtro.'}
            </p>
          ) : (
            <div className="historico-precos-table-wrap">
              <table className="historico-precos-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Nome</th>
                    <th>Fornecedor</th>
                    <th>Qtd</th>
                    <th>Valor unitário</th>
                    <th>Valor total</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((h) => (
                    <tr key={h.id}>
                      <td>{TIPO_LABEL[h.tipo]}</td>
                      <td>{h.nome}</td>
                      <td>{nomeFornecedor(h)}</td>
                      <td>{h.quantidade} {h.unidade}</td>
                      <td>{formatBRL(h.valorUnitario)}</td>
                      <td>{formatBRL(h.valorTotal)}</td>
                      <td>{formatDate(h.data)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
