import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconChevronDown, IconChevronUp, IconDownload, IconPlus, IconPrinter, IconUsers } from '@tabler/icons-react';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useLancamentos } from '../../hooks/useLancamentos';
import { useAtividades } from '../../hooks/useAtividades';
import { useObras } from '../../hooks/useObras';
import { useEmpresaConfig } from '../../hooks/useEmpresaConfig';
import { ResumoFinanceiro } from '../../components/financeiro/ResumoFinanceiro';
import { GastosPorCategoriaChart } from '../../components/financeiro/GastosPorCategoriaChart';
import { CustosPorEtapaSection } from '../../components/financeiro/CustosPorEtapaSection';
import { ContasAPagarPanel } from '../../components/financeiro/ContasAPagarPanel';
import { LancamentosTable } from '../../components/financeiro/LancamentosTable';
import { LancamentoFormModal } from '../../components/financeiro/LancamentoFormModal';
import { RegistrarPagamentoModal } from '../../components/financeiro/RegistrarPagamentoModal';
import { FornecedoresListModal } from '../../components/financeiro/FornecedoresListModal';
import type { CategoriaLancamento, LancadoTipo, LancamentoFinanceiro, StatusLancamento } from '../../types/domain';
import { exportToCsv } from '../../utils/csvExport';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { formatBRL, formatNumberBR } from '../../utils/currency';
import { getCurrentUserName } from '../../utils/currentUser';
import { lancadoTipoEfetivo } from '../../utils/lancado';
import type { VencimentoBucket } from '../../utils/contasAPagar';
import { lancamentoNoBucket } from '../../utils/contasAPagar';
import './FinanceiroTab.css';

function formatPeriodoLabel(dataInicio: string, dataFim: string): string {
  if (dataInicio && dataFim) return `${formatDate(dataInicio)} a ${formatDate(dataFim)}`;
  if (dataInicio) return `A partir de ${formatDate(dataInicio)}`;
  if (dataFim) return `Até ${formatDate(dataFim)}`;
  return 'Todos os lançamentos';
}

const CATEGORIA_LABEL: Record<CategoriaLancamento, string> = {
  sem_categoria: 'Sem categoria', mao_de_obra: 'Mão de obra', material: 'Material', aluguel: 'Aluguel', alimentacao: 'Alimentação/Marmitas', servico: 'Serviço', taxa: 'Taxa', empreitada: 'Empreitada', projetos: 'Projetos', sondagem: 'Sondagem',
};

const STATUS_LABEL: Record<StatusLancamento, string> = {
  pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado',
};

export function FinanceiroTab() {
  const { id } = useParams<{ id: string }>();
  const obraId = id!;
  const { obras } = useObras();
  const obra = obras.find((o) => o.id === obraId);
  const { fornecedores, refresh: refreshFornecedores } = useFornecedores();
  const { lancamentos, updateLancamento, deleteLancamento, refresh: refreshLancamentos } = useLancamentos(obraId);
  const { atividades } = useAtividades(obraId);
  const { nomeEmpresa } = useEmpresaConfig();

  const [lancamentoModalOpen, setLancamentoModalOpen] = useState(false);
  const [lancamentoModalMode, setLancamentoModalMode] = useState<'create' | 'edit'>('create');
  const [editingLancamento, setEditingLancamento] = useState<LancamentoFinanceiro | undefined>(undefined);
  const [fornecedoresModalOpen, setFornecedoresModalOpen] = useState(false);
  const [pagamentoModalTarget, setPagamentoModalTarget] = useState<LancamentoFinanceiro | undefined>(undefined);
  const [graficosAbertos, setGraficosAbertos] = useState(false);

  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaLancamento | 'todas'>('todas');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroAtividade, setFiltroAtividade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusLancamento | 'todos'>('todos');
  const [filtroVencimento, setFiltroVencimento] = useState<VencimentoBucket | null>(null);

  const lancamentosSemBucket = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroCategoria !== 'todas' && l.categoria !== filtroCategoria) return false;
      if (filtroFornecedor && l.fornecedorId !== filtroFornecedor) return false;
      if (filtroAtividade && l.atividadeId !== filtroAtividade) return false;
      if (filtroDataInicio && l.data < filtroDataInicio) return false;
      if (filtroDataFim && l.data > filtroDataFim) return false;
      if (filtroStatus !== 'todos' && l.status !== filtroStatus) return false;
      return true;
    });
  }, [lancamentos, filtroCategoria, filtroFornecedor, filtroAtividade, filtroDataInicio, filtroDataFim, filtroStatus]);

  const lancamentosFiltrados = useMemo(() => {
    return lancamentosSemBucket
      .filter((l) => !filtroVencimento || lancamentoNoBucket(l, filtroVencimento))
      .sort((a, b) => {
        // notas ainda não lançadas para pagamento vêm sempre primeiro, como lembrete.
        const lancA = lancadoTipoEfetivo(a) === 'nao_lancado' ? 0 : 1;
        const lancB = lancadoTipoEfetivo(b) === 'nao_lancado' ? 0 : 1;
        if (lancA !== lancB) return lancA - lancB;
        const pagoA = a.status === 'pago' ? 1 : 0;
        const pagoB = b.status === 'pago' ? 1 : 0;
        if (pagoA !== pagoB) return pagoA - pagoB;
        // pendentes/atrasados: vencimento mais próximo primeiro. pagos: pagamento mais recente primeiro.
        return pagoA === 1 ? b.dataVencimento.localeCompare(a.dataVencimento) : a.dataVencimento.localeCompare(b.dataVencimento);
      });
  }, [lancamentosSemBucket, filtroVencimento]);

  if (!obra) return null;

  function openCreate() {
    setLancamentoModalMode('create');
    setEditingLancamento(undefined);
    setLancamentoModalOpen(true);
  }

  function openEdit(lancamento: LancamentoFinanceiro) {
    setLancamentoModalMode('edit');
    setEditingLancamento(lancamento);
    setLancamentoModalOpen(true);
  }

  function handleDelete(lancamento: LancamentoFinanceiro) {
    if (confirm(`Excluir o lançamento "${lancamento.descricao}"? Essa ação não pode ser desfeita.`)) deleteLancamento(lancamento.id);
  }

  function handleUpdateStatus(lancamento: LancamentoFinanceiro, novoStatus: StatusLancamento) {
    if (novoStatus === 'pago') {
      if (lancamento.status === 'pago') return;
      setPagamentoModalTarget(lancamento);
      return;
    }
    const now = new Date().toISOString();
    const historico = [
      ...lancamento.historico,
      { data: now, usuario: getCurrentUserName(), resumo: `Status alterado de ${STATUS_LABEL[lancamento.status]} para ${STATUS_LABEL[novoStatus]}` },
    ];
    updateLancamento(lancamento.id, { status: novoStatus, updatedBy: getCurrentUserName(), historico, updatedAt: now });
  }

  function handleUpdateLancado(lancamento: LancamentoFinanceiro, tipo: LancadoTipo, numero: string) {
    updateLancamento(lancamento.id, {
      lancadoTipo: tipo,
      lancadoNumero: numero || undefined,
      lancado: tipo !== 'nao_lancado',
      updatedBy: getCurrentUserName(),
      updatedAt: new Date().toISOString(),
    });
  }

  function handleImprimir() {
    requestAnimationFrame(() => window.print());
  }

  function handleExportCsv() {
    const totalPago = lancamentosFiltrados.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
    const totalNaoPago = lancamentosFiltrados.filter((l) => l.status !== 'pago').reduce((s, l) => s + l.valorPago, 0);
    exportToCsv(
      `financeiro-${obraId}.csv`,
      ['Data', 'Vencimento', 'Fornecedor', 'Descrição', 'Categoria', 'Valor previsto', 'Valor a pagar', 'Forma pagamento', 'NF', 'Status'],
      [
        ...lancamentosFiltrados.map((l) => [
          formatDate(l.data),
          formatDate(l.dataVencimento),
          fornecedores.find((f) => f.id === l.fornecedorId)?.nome ?? '',
          l.descricao,
          CATEGORIA_LABEL[l.categoria],
          formatNumberBR(l.valorPrevisto),
          formatNumberBR(l.valorPago),
          l.formaPagamento,
          l.nf ? 'Sim' : 'Não',
          l.status,
        ]),
        ['', '', '', '', '', '', '', '', '', ''],
        ['', '', '', 'Total pago', '', '', formatNumberBR(totalPago), '', '', ''],
        ['', '', '', 'Total a pagar', '', '', formatNumberBR(totalNaoPago), '', '', ''],
      ],
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <ContasAPagarPanel
        lancamentos={lancamentosSemBucket}
        activeBucket={filtroVencimento}
        onSelectBucket={(bucket) => setFiltroVencimento((cur) => (cur === bucket ? null : bucket))}
      />
      <ResumoFinanceiro lancamentos={lancamentosFiltrados} orcamentoTotal={obra.orcamentoTotal} />

      <button type="button" className="financeiro-graficos-toggle" onClick={() => setGraficosAbertos((v) => !v)}>
        {graficosAbertos ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        {graficosAbertos ? 'Ocultar gráficos e análises' : 'Ver gráficos e análises'}
      </button>
      {graficosAbertos && (
        <>
          <GastosPorCategoriaChart lancamentos={lancamentosFiltrados} />
          <CustosPorEtapaSection obra={obra} lancamentos={lancamentos} atividades={atividades} />
        </>
      )}

      <div className="financeiro-card">
        <div className="financeiro-filters">
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value as CategoriaLancamento | 'todas')}>
            <option value="todas">Todas as categorias</option>
            {(Object.keys(CATEGORIA_LABEL) as CategoriaLancamento[]).map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </select>
          <select value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)}>
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select value={filtroAtividade} onChange={(e) => setFiltroAtividade(e.target.value)}>
            <option value="">Todas as etapas</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <div className="financeiro-filters__periodo">
            <input type="date" value={filtroDataInicio} max={filtroDataFim || undefined} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            <span>até</span>
            <input type="date" value={filtroDataFim} min={filtroDataInicio || undefined} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusLancamento | 'todos')}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>

          <div className="financeiro-filters__actions">
            <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
              <IconDownload size={16} /> Exportar CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleImprimir}>
              <IconPrinter size={16} /> Imprimir relatório
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setFornecedoresModalOpen(true)}>
              <IconUsers size={16} /> Gerenciar fornecedores
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus size={16} /> Novo lançamento
            </button>
          </div>
        </div>

        <LancamentosTable
          lancamentos={lancamentosFiltrados}
          fornecedores={fornecedores}
          atividades={atividades}
          onEdit={openEdit}
          onFiltrarPorAtividade={setFiltroAtividade}
          onUpdateStatus={handleUpdateStatus}
          onRegistrarPagamento={setPagamentoModalTarget}
          onDelete={handleDelete}
          onUpdateLancado={handleUpdateLancado}
        />
      </div>

      <div className="financeiro-print-view">
        <div className="financeiro-print-header">
          <div className="financeiro-print-header__empresa">{nomeEmpresa || 'Nome da empresa'}</div>
          <h2>Relatório financeiro</h2>
          <div className="financeiro-print-header__grid">
            <span><strong>Obra:</strong> {obra.nome}</span>
            <span><strong>Período:</strong> {formatPeriodoLabel(filtroDataInicio, filtroDataFim)}</span>
            <span><strong>Gerado em:</strong> {formatDate(todayISO())}</span>
          </div>
        </div>
        <table className="financeiro-print-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Vencimento</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor a pagar</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lancamentosFiltrados.map((l) => (
              <tr key={l.id}>
                <td>{formatDate(l.data)}</td>
                <td>{formatDate(l.dataVencimento)}</td>
                <td>{fornecedores.find((f) => f.id === l.fornecedorId)?.nome ?? '—'}</td>
                <td>{l.descricao}</td>
                <td>{CATEGORIA_LABEL[l.categoria]}</td>
                <td>{formatBRL(l.valorPago)}</td>
                <td>{STATUS_LABEL[l.status]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="is-total">
              <td colSpan={5}>Total pago</td>
              <td>{formatBRL(lancamentosFiltrados.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0))}</td>
              <td></td>
            </tr>
            <tr className="is-total">
              <td colSpan={5}>Falta pagar</td>
              <td>{formatBRL(lancamentosFiltrados.filter((l) => l.status !== 'pago').reduce((s, l) => s + l.valorPago, 0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <LancamentoFormModal
        open={lancamentoModalOpen}
        mode={lancamentoModalMode}
        obraId={obraId}
        lancamento={editingLancamento}
        fornecedores={fornecedores}
        atividades={atividades}
        onClose={() => setLancamentoModalOpen(false)}
        onSaved={() => {
          setLancamentoModalOpen(false);
          refreshLancamentos();
        }}
      />
      <FornecedoresListModal
        open={fornecedoresModalOpen}
        onClose={() => { setFornecedoresModalOpen(false); refreshFornecedores(); }}
      />
      <RegistrarPagamentoModal
        open={!!pagamentoModalTarget}
        obraId={obraId}
        lancamento={pagamentoModalTarget}
        onClose={() => setPagamentoModalTarget(undefined)}
        onSaved={() => {
          setPagamentoModalTarget(undefined);
          refreshLancamentos();
        }}
      />
    </div>
  );
}
